// Rastreo nocturno de precios (Tenerife): Mercadona (almacén 3004, CP 38107) e HiperDino
// (vista de tienda c9495). pg_cron la llama cada 3 minutos de madrugada; cada llamada
// trabaja ~2 minutos en segundo plano sobre una cola en `precios_cola` y sale.
// Ritmo bajo a propósito: una petición por segundo como mucho.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const TZ = "Atlantic/Canary";
const UA = "Mozilla/5.0 (compatible; CasaPrecios/1.0; uso domestico, 1 peticion/seg)";
const MERCADONA = "https://tienda.mercadona.es/api";
const WH = "3004";
const HIPERDINO = "https://www.hiperdino.es/c9495";
// Secciones de HiperDino que no rastreamos (duplican productos o no son de la compra).
const HD_FUERA = /^(bazar|hogar|ocio|ecologicos|folleto-ecologico|marca-propia|oferta-exclusiva|productos-destacados|tarjeta-regalo-y-donaciones)\//;
const PRESUPUESTO_MS = 120_000;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  return keys.default ?? (Object.values(keys)[0] as string);
}

function igual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const noche = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

async function traer(url: string, tipo: "json" | "text") {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-ES" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return tipo === "json" ? r.json() : r.text();
}

type Item = {
  ext_id: string;
  nombre: string;
  formato: string | null;
  categoria: string | null;
  imagen: string | null;
  url: string | null;
  precio: number;
  precio_unidad: number | null;
  unidad: string | null;
  precio_antes: number | null;
};

const num = (s: unknown) => {
  const n = Number(String(s ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// ——— Mercadona ———
type MProducto = {
  id: string;
  display_name: string;
  packaging: string | null;
  thumbnail: string | null;
  share_url: string | null;
  published: boolean;
  price_instructions: {
    unit_price: string;
    bulk_price: string;
    reference_format: string | null;
    unit_size: number | null;
    size_format: string | null;
    previous_unit_price: string | null;
    price_decreased: boolean;
  };
};
type MCategoria = { id: number; name: string; products?: MProducto[]; categories?: MCategoria[] };

function unidadMercadona(f: string | null) {
  const u = (f ?? "").toLowerCase();
  if (u === "kg") return "kg";
  if (u === "l") return "l";
  if (u === "ud" || u === "uds") return "ud";
  return u || null;
}

function mercadonaItems(cat: MCategoria): Item[] {
  const out: Item[] = [];
  const recorrer = (c: MCategoria, nombre: string) => {
    for (const p of c.products ?? []) {
      if (p.published === false) continue;
      const pi = p.price_instructions;
      const precio = num(pi.unit_price);
      if (!precio) continue;
      const antes = pi.price_decreased ? num(pi.previous_unit_price) : null;
      const tam = pi.unit_size ? `${String(pi.unit_size).replace(".", ",")} ${pi.size_format ?? ""}`.trim() : "";
      out.push({
        ext_id: String(p.id),
        nombre: p.display_name,
        formato: [p.packaging, tam].filter(Boolean).join(" ") || null,
        categoria: nombre,
        imagen: p.thumbnail,
        url: p.share_url,
        precio,
        precio_unidad: num(pi.bulk_price),
        unidad: unidadMercadona(pi.reference_format),
        precio_antes: antes && antes > precio ? antes : null,
      });
    }
    for (const s of c.categories ?? []) recorrer(s, s.name || nombre);
  };
  recorrer(cat, cat.name);
  return out;
}

async function sembrarMercadona(): Promise<string[]> {
  const d = await traer(`${MERCADONA}/categories/?lang=es&wh=${WH}`, "json");
  return (d.results as MCategoria[]).flatMap((c) => (c.categories ?? []).map((s) => String(s.id)));
}

// ——— HiperDino ———
const desescapa = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

// Tamaño a partir del nombre: «1 kg», «500 g», «6x1 l», «pack 4 x 125 g»…
export function tamano(nombre: string): { cantidad: number; unidad: "kg" | "l" } | null {
  const t = nombre.toLowerCase().replace(",", ".");
  const m = t.match(/(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(kg|kgs|g|gr|grs|l|lt|litros?|ml|cl)\b(?!.*\b\d+(?:\.\d+)?\s*(?:kg|g|gr|l|ml|cl)\b)/);
  if (!m) return null;
  const veces = m[1] ? Number(m[1]) : 1;
  const v = Number(m[2]) * veces;
  const u = m[3];
  if (u.startsWith("k")) return { cantidad: v, unidad: "kg" };
  if (u.startsWith("g")) return { cantidad: v / 1000, unidad: "kg" };
  if (u === "ml") return { cantidad: v / 1000, unidad: "l" };
  if (u === "cl") return { cantidad: v / 100, unidad: "l" };
  return { cantidad: v, unidad: "l" };
}

function hiperdinoItems(html: string, categoria: string): Item[] {
  const out: Item[] = [];
  const trozos = html.split('<li class="product-list-item').slice(1);
  for (const t of trozos) {
    const id = t.match(/data-id="(\d+)"/)?.[1];
    const url = t.match(/data-url="([^"]+)"/)?.[1] ?? null;
    const orden = t.match(/data-sort='([^']*)'/)?.[1];
    const nombreCrudo = t.match(/class="description__text name">([^<]+)</)?.[1];
    if (!id || !nombreCrudo) continue;
    let precio: number | null = null;
    try {
      precio = num(JSON.parse(desescapa(orden ?? "{}")).price_asc?.value);
    } catch { /* sin precio */ }
    if (!precio) {
      precio = num(t.match(/price--final[\s\S]*?class="price__text[^"]*">\s*([\d.,]+)/)?.[1]);
    }
    if (!precio) continue;
    const antes = num(t.match(/price--previous flex-item">[\s\S]*?class="price__text">\s*([\d.,]+)/)?.[1]);
    const nombre = desescapa(nombreCrudo);
    const tam = tamano(nombre);
    const img = t.match(/data-src="([^"]+)"/)?.[1] ?? null;
    out.push({
      ext_id: id,
      nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      formato: null,
      categoria,
      imagen: img,
      url,
      precio: r2(precio),
      precio_unidad: tam && tam.cantidad > 0 ? r2(precio / tam.cantidad) : null,
      unidad: tam?.unidad ?? null,
      precio_antes: antes && antes > precio ? antes : null,
    });
  }
  return out;
}

async function sembrarHiperdino(): Promise<string[]> {
  const html = (await traer(`${HIPERDINO}/`, "text")) as string;
  const rutas = new Set<string>();
  for (const m of html.matchAll(/href="https:\/\/www\.hiperdino\.es\/c9495\/([a-z0-9_-]+\/[a-z0-9_-]+)\.html"/g)) {
    if (!HD_FUERA.test(m[1] + "/") && !HD_FUERA.test(m[1])) rutas.add(m[1]);
  }
  return [...rutas];
}

const nombreRuta = (ruta: string) => {
  const s = ruta.split("/").pop()!.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// ——— Cola ———
type Tarea = { id: number; noche: string; super: "mercadona" | "hiperdino"; ref: string; pagina: number; intentos: number };

async function sembrar(db: SupabaseClient, hoy: string) {
  const [m, h] = await Promise.all([sembrarMercadona(), sembrarHiperdino()]);
  const filas = [
    ...m.map((ref) => ({ noche: hoy, super: "mercadona", ref, pagina: 1 })),
    ...h.map((ref) => ({ noche: hoy, super: "hiperdino", ref, pagina: 1 })),
  ];
  const { error } = await db.from("precios_cola").upsert(filas, { onConflict: "noche,super,ref,pagina", ignoreDuplicates: true });
  if (error) throw error;
  // Limpia colas viejas.
  await db.from("precios_cola").delete().lt("noche", hoy);
  return filas.length;
}

async function procesar(db: SupabaseClient, t: Tarea) {
  let items: Item[];
  if (t.super === "mercadona") {
    const cat = (await traer(`${MERCADONA}/categories/${t.ref}/?lang=es&wh=${WH}`, "json")) as MCategoria;
    items = mercadonaItems(cat);
  } else {
    const url = `${HIPERDINO}/${t.ref}.html${t.pagina > 1 ? `?p=${t.pagina}` : ""}`;
    const html = (await traer(url, "text")) as string;
    items = hiperdinoItems(html, nombreRuta(t.ref));
    if (items.length && html.includes(`${t.ref}.html?p=${t.pagina + 1}"`)) {
      await db.from("precios_cola").upsert(
        { noche: t.noche, super: t.super, ref: t.ref, pagina: t.pagina + 1 },
        { onConflict: "noche,super,ref,pagina", ignoreDuplicates: true },
      );
    }
  }
  if (items.length) {
    const { error } = await db.rpc("guardar_precios", { p_super: t.super, p_items: items });
    if (error) throw error;
  }
  return items.length;
}

async function trabajar(db: SupabaseClient) {
  const inicio = Date.now();
  const hoy = noche();
  const resumen = { sembradas: 0, hechas: 0, productos: 0, errores: [] as string[] };

  const { count } = await db.from("precios_cola").select("id", { count: "exact", head: true }).eq("noche", hoy);
  if (!count) resumen.sembradas = await sembrar(db, hoy);

  while (Date.now() - inicio < PRESUPUESTO_MS) {
    const { data: t } = await db
      .from("precios_cola")
      .select("id, noche, super, ref, pagina, intentos")
      .eq("noche", hoy)
      .eq("estado", "pendiente")
      .order("id")
      .limit(1)
      .maybeSingle<Tarea>();
    if (!t) {
      // Terminado: lo que no aparece hace 3 noches deja de ofrecerse.
      const hace3 = new Date(Date.now() - 3 * 86400_000).toISOString();
      await db.from("productos").update({ activo: false }).lt("visto_at", hace3).eq("activo", true);
      break;
    }
    await db.from("precios_cola").update({ intentos: t.intentos + 1 }).eq("id", t.id);
    const antes = Date.now();
    try {
      resumen.productos += await procesar(db, t);
      resumen.hechas++;
      await db.from("precios_cola").update({ estado: "hecho", hecho_at: new Date().toISOString(), error: null }).eq("id", t.id);
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      resumen.errores.push(msg);
      await db.from("precios_cola").update({ estado: t.intentos + 1 >= 3 ? "error" : "pendiente", error: msg.slice(0, 300) }).eq("id", t.id);
    }
    // Ritmo bajo: al menos 1,2 s entre peticiones al mismo súper.
    await espera(Math.max(0, 1200 - (Date.now() - antes)));
  }
  console.log(JSON.stringify(resumen));
  return resumen;
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get("CRON_SECRET") ?? "";
  if (!secreto || !igual(req.headers.get("x-cron-secret") ?? "", secreto)) return json({ error: "No autorizado" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false } });
  EdgeRuntime.waitUntil(trabajar(db).catch((e) => console.error("precios", e)));
  return json({ ok: true }, 202);
});
