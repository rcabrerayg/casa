// Menú semanal con Claude (tipo Whipp): almuerzos y cenas para 7 días, dentro del presupuesto,
// con los electrodomésticos y gustos de la casa, y la compra con precios reales del catálogo.
//   POST {accion: "planear"}                         → crea un menú (en segundo plano)
//   POST {accion: "receta", menu_id, dia, momento}   → pasos de un plato (bajo demanda)
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@1.8.0/helpers/zod";
import { z } from "npm:zod@4.6.7";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MODELO = Deno.env.get("MENU_MODELO") ?? "claude-haiku-5-5";
const TZ = "Atlantic/Canary";
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  return keys.default ?? (Object.values(keys)[0] as string);
}

// ——— Esquemas de salida ———
const Plato = z.object({
  titulo: z.string(),
  minutos: z.number().int(),
  aparato: z.string().describe("Electrodoméstico principal que se usa"),
  etiquetas: z.array(z.string()),
  ingredientes: z.array(z.string()).describe("Con cantidad para las raciones, p. ej. «400 g de pechuga de pollo»"),
});
const Plan = z.object({
  resumen: z.string().describe("Una frase sobre la semana"),
  dias: z.array(z.object({ dia: z.enum(DIAS), almuerzo: Plato, cena: Plato })),
  compra: z.array(
    z.object({
      ingrediente: z.string().describe("Nombre normal, p. ej. «pechuga de pollo»"),
      busqueda: z.string().describe("1 a 3 palabras para buscarlo en la tienda online, sin cantidades ni marcas, p. ej. «pechuga pollo»"),
      cantidad: z.string().describe("Total para la semana, p. ej. «1 kg» o «2 latas»"),
      uso: z.string().describe("Para qué platos o fijos se usa, corto"),
    }),
  ),
});
type PlanT = z.infer<typeof Plan>;

const Eleccion = z.object({
  elecciones: z.array(
    z.object({
      n: z.number().int().describe("Número del ingrediente"),
      producto: z.string().describe("Código del producto elegido (p. ej. «m3» o «h1»), o vacío si ninguno sirve"),
      unidades: z.number().int().describe("Cuántos envases comprar para cubrir la cantidad"),
      por_regla: z.boolean().describe("true si lo eliges por una preferencia de la casa y no por precio"),
    }),
  ),
});

const Receta = z.object({
  raciones: z.number().int(),
  pasos: z.array(z.string()),
  consejo: z.string().describe("Un truco corto, o vacío"),
});

type Prefs = {
  presupuesto: number;
  personas: number;
  electrodomesticos: string[];
  gustos: string[];
  evitar: string;
  notas: string;
  desayuno: string;
  postcena: string;
  reglas: string[];
};

const SISTEMA = `Eres el planificador de comidas de una casa en Tenerife (Canarias): una pareja con un bebé recién nacido, con poco tiempo y poco sueño.
Compran en Mercadona e HiperDino. Escribes en castellano de España, claro y sin adornos.
Reglas fijas:
- Recetas reales y caseras, hechas con ingredientes normales de supermercado.
- Solo usas los electrodomésticos que tiene la casa.
- Entre semana, platos rápidos o que se puedan dejar hechos; reaprovecha (lo que sobra de una cena puede ser el almuerzo del día siguiente).
- Respeta lo que no quieren comer sin excepción.
- La madre está dando leche materna: nada de pez espada, tiburón, atún rojo ni lucio (mercurio), y nada de alcohol en las recetas.
- La casa siempre tiene sal, aceite de oliva, vinagre, pimienta, ajo en polvo y especias básicas: no las pongas en la compra.`;

function textoPrefs(p: Prefs) {
  return [
    `Personas: ${p.personas} adultos.`,
    `Presupuesto de la semana (todo incluido: almuerzos, cenas, desayunos y el picoteo de después de cenar): ${p.presupuesto} €.`,
    `Electrodomésticos: ${p.electrodomesticos.length ? p.electrodomesticos.join(", ") : "vitrocerámica y microondas"}.`,
    p.gustos.length ? `Les gusta: ${p.gustos.join(", ")}.` : "",
    p.evitar ? `No quieren: ${p.evitar}.` : "",
    p.notas ? `Notas de la casa: ${p.notas}` : "",
    `Desayuno de cada día (añade a la compra lo que haga falta para 7 días): ${p.desayuno || "café con leche y tostadas"}.`,
    `Después de cenar, cada día: ${p.postcena}`,
    p.reglas.length ? `Preferencias de compra: ${p.reglas.join(" ")}` : "",
  ].filter(Boolean).join("\n");
}

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

function lunesDeLaSemana() {
  // Si es lunes o martes, esta semana; si no, la que viene.
  const hoy = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()) + "T12:00:00Z");
  const dow = (hoy.getUTCDay() + 6) % 7; // 0 = lunes
  const d = new Date(hoy);
  d.setUTCDate(hoy.getUTCDate() + (dow <= 1 ? -dow : 7 - dow));
  return d.toISOString().slice(0, 10);
}

type Producto = { id: string; super: string; nombre: string; formato: string | null; precio: number; precio_unidad: number | null; unidad: string | null };

async function candidatos(db: SupabaseClient, plan: PlanT) {
  const porItem: Producto[][] = [];
  const lotes = plan.compra.map((c, i) => async () => {
    const [m, h] = await Promise.all(
      (["mercadona", "hiperdino"] as const).map((s) => db.rpc("buscar_productos", { q: c.busqueda, p_super: s }).limit(6)),
    );
    porItem[i] = [...((m.data ?? []) as Producto[]), ...((h.data ?? []) as Producto[])];
  });
  for (let i = 0; i < lotes.length; i += 8) await Promise.all(lotes.slice(i, i + 8).map((f) => f()));
  return porItem;
}

async function elegir(claude: Anthropic, prefs: Prefs, plan: PlanT, porItem: Producto[][]) {
  const codigos = new Map<string, Producto>();
  const bloques = plan.compra.map((c, i) => {
    const lineas = porItem[i].map((p, j) => {
      const cod = `${p.super[0]}${i}_${j}`;
      codigos.set(cod, p);
      const ud = p.precio_unidad && p.unidad ? ` (${euros(Number(p.precio_unidad))}/${p.unidad})` : "";
      return `  ${cod}: ${p.nombre}${p.formato ? `, ${p.formato}` : ""} · ${p.super === "mercadona" ? "Mercadona" : "HiperDino"} · ${euros(Number(p.precio))}${ud}`;
    });
    return `${i}. ${c.ingrediente} — necesito ${c.cantidad} (${c.uso})\n${lineas.join("\n") || "  (sin resultados)"}`;
  });
  const r = await claude.messages.parse({
    model: MODELO,
    max_tokens: 8000,
    system: SISTEMA,
    output_config: { format: zodOutputFormat(Eleccion) },
    messages: [{
      role: "user",
      content: `Elige qué producto comprar para cada ingrediente de la lista. Criterios, por orden:
1) Las preferencias de compra de la casa: ${prefs.reglas.join(" ") || "ninguna"}
2) Que sea de verdad ese ingrediente (no un derivado: «cebolla» no es «cebolla frita»).
3) El más barato por kilo o litro con un envase razonable para la cantidad.
Calcula las unidades para cubrir la cantidad. Si ninguno sirve, deja el producto vacío.

${bloques.join("\n\n")}`,
    }],
  });
  if (!r.parsed_output) throw new Error(`Claude no devolvió la elección (${r.stop_reason})`);
  const compra = plan.compra.map((c, i) => {
    const e = r.parsed_output!.elecciones.find((x) => x.n === i);
    const p = e?.producto ? codigos.get(e.producto) : undefined;
    const unidades = Math.max(1, Math.min(20, e?.unidades ?? 1));
    return {
      ingrediente: c.ingrediente,
      cantidad: c.cantidad,
      uso: c.uso,
      producto: p ? { id: p.id, super: p.super, nombre: p.nombre, formato: p.formato, precio: Number(p.precio) } : null,
      unidades,
      por_regla: !!e?.por_regla,
      coste: p ? Math.round(Number(p.precio) * unidades * 100) / 100 : 0,
    };
  });
  return compra;
}

type Compra = Awaited<ReturnType<typeof elegir>>;

async function planear(claude: Anthropic, prefs: Prefs, recientes: string[], ajuste?: { plan: PlanT; compra: Compra; total: number }) {
  const pedido = ajuste
    ? `Este plan se pasa del presupuesto: cuesta ${euros(ajuste.total)} y el tope es ${euros(prefs.presupuesto)}.
Lo más caro de la compra: ${[...ajuste.compra].sort((a, b) => b.coste - a.coste).slice(0, 8).map((c) => `${c.ingrediente} ${euros(c.coste)}`).join("; ")}.
Rehaz la semana para que quede por debajo, cambiando lo justo (ingredientes más baratos, más legumbre, huevo o pollo, reaprovechar).
Plan anterior: ${JSON.stringify({ dias: ajuste.plan.dias.map((d) => ({ dia: d.dia, almuerzo: d.almuerzo.titulo, cena: d.cena.titulo })) })}`
    : `Planifica la semana: almuerzo y cena de lunes a domingo, y la lista de la compra completa de la semana (incluidos desayunos y lo de después de cenar).
Que no se repitan platos dentro de la semana.${recientes.length ? ` Evita repetir estos de semanas anteriores: ${recientes.join(", ")}.` : ""}`;
  const r = await claude.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    system: SISTEMA,
    output_config: { format: zodOutputFormat(Plan) },
    messages: [{ role: "user", content: `${textoPrefs(prefs)}\n\n${pedido}` }],
  });
  if (!r.parsed_output) throw new Error(`Claude no devolvió el plan (${r.stop_reason})`);
  return r.parsed_output;
}

async function generar(db: SupabaseClient, claude: Anthropic, menuId: string, householdId: string, prefs: Prefs) {
  const paso = (p: string) => db.from("menus").update({ paso: p }).eq("id", menuId);
  try {
    const { data: previos } = await db.from("menus").select("plan").eq("household_id", householdId).eq("estado", "listo")
      .order("created_at", { ascending: false }).limit(2);
    const { data: votos } = await db.from("valoraciones").select("titulo, voto, momento").eq("household_id", householdId)
      .order("updated_at", { ascending: false }).limit(80);
    const gustaron = (votos ?? []).filter((v) => v.voto > 0);
    const noGustaron = (votos ?? []).filter((v) => v.voto < 0);
    const conMomento = (v: { titulo: string; momento: string | null }) => (v.momento ? `${v.titulo} (${v.momento})` : v.titulo);
    // Los que gustaron pueden volver; el resto de semanas recientes, mejor variar.
    const recientes = (previos ?? []).flatMap((m) =>
      ((m.plan as PlanT | null)?.dias ?? []).flatMap((d) => [d.almuerzo.titulo, d.cena.titulo])
    ).filter((t) => !gustaron.some((g) => g.titulo === t));
    const aprendido = [
      gustaron.length ? `Platos que les gustaron (pueden repetirse alguno y sirven de pista de su estilo): ${gustaron.map(conMomento).join("; ")}.` : "",
      noGustaron.length ? `Platos que NO quieren repetir (ni versiones muy parecidas): ${noGustaron.map(conMomento).join("; ")}.` : "",
    ].filter(Boolean).join("\n");
    if (aprendido) prefs = { ...prefs, notas: [prefs.notas, aprendido].filter(Boolean).join("\n") };

    await paso("Pensando los platos");
    let plan = await planear(claude, prefs, recientes);
    await paso("Buscando precios");
    let compra = await elegir(claude, prefs, plan, await candidatos(db, plan));
    let total = compra.reduce((t, c) => t + c.coste, 0);

    if (total > prefs.presupuesto * 1.03) {
      await paso("Ajustando al presupuesto");
      const plan2 = await planear(claude, prefs, recientes, { plan, compra, total });
      const compra2 = await elegir(claude, prefs, plan2, await candidatos(db, plan2));
      const total2 = compra2.reduce((t, c) => t + c.coste, 0);
      if (total2 < total) [plan, compra, total] = [plan2, compra2, total2];
    }

    await db.from("menus").update({ estado: "listo", paso: null, plan, compra, total: Math.round(total * 100) / 100 }).eq("id", menuId);
  } catch (e) {
    console.error("menu", e);
    const msg = e instanceof Anthropic.AuthenticationError
      ? "La clave de Claude no es válida."
      : e instanceof Anthropic.RateLimitError
      ? "Claude está saturado; prueba en un rato."
      : "No se pudo preparar el menú. Prueba otra vez.";
    await db.from("menus").update({ estado: "error", paso: null, error: msg }).eq("id", menuId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return json({ error: "No autenticado" }, 401);
  const { data: m } = await db.from("members").select("household_id").eq("user_id", u.user.id).maybeSingle();
  if (!m) return json({ error: "Sin hogar" }, 403);
  const hogar = m.household_id as string;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Falta conectar Claude: hay que guardar la clave de API en Supabase." }, 503);
  const claude = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });

  const cuerpo = await req.json().catch(() => ({}));

  if (cuerpo.accion === "planear") {
    // Freno de gasto: uno a la vez y como mucho 6 al día por casa.
    const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const [{ count: enCurso }, { count: hoy }] = await Promise.all([
      db.from("menus").select("id", { count: "exact", head: true }).eq("household_id", hogar).eq("estado", "generando").gt("created_at", hace(4)),
      db.from("menus").select("id", { count: "exact", head: true }).eq("household_id", hogar).gt("created_at", hace(24 * 60)),
    ]);
    if (enCurso) return json({ error: "Ya se está preparando un menú." }, 429);
    if ((hoy ?? 0) >= 6) return json({ error: "Por hoy ya van 6 menús. Mañana más." }, 429);

    const { data: p } = await db.from("preferencias").select("*").eq("household_id", hogar).maybeSingle();
    const prefs: Prefs = {
      presupuesto: Number(p?.presupuesto ?? 60),
      personas: p?.personas ?? 2,
      electrodomesticos: p?.electrodomesticos ?? [],
      gustos: p?.gustos ?? [],
      evitar: p?.evitar ?? "",
      notas: p?.notas ?? "",
      desayuno: p?.desayuno ?? "",
      postcena: p?.postcena ?? "Un vaso de leche con algo dulce: galletas, magdalenas o similar.",
      reglas: p?.reglas ?? ["La leche, siempre Hacendado de Mercadona.", "La carne, casi siempre de HiperDino."],
    };
    const { data: menu, error } = await db.from("menus")
      .insert({ household_id: hogar, semana: lunesDeLaSemana(), creado_por: u.user.id, paso: "Empezando" })
      .select("id").single();
    if (error) return json({ error: error.message }, 500);
    EdgeRuntime.waitUntil(generar(db, claude, menu.id, hogar, prefs));
    return json({ id: menu.id }, 202);
  }

  if (cuerpo.accion === "receta") {
    const { menu_id, dia, momento } = cuerpo as { menu_id: string; dia: number; momento: "almuerzo" | "cena" };
    if (!(momento === "almuerzo" || momento === "cena") || !(dia >= 0 && dia < 7)) return json({ error: "Petición no válida" }, 400);
    const { data: menu } = await db.from("menus").select("id, plan").eq("id", menu_id).eq("household_id", hogar).maybeSingle();
    const plan = menu?.plan as (PlanT & { dias: (PlanT["dias"][number] & Record<string, unknown>)[] }) | null;
    const plato = plan?.dias?.[dia]?.[momento] as (z.infer<typeof Plato> & { receta?: unknown }) | undefined;
    if (!plato) return json({ error: "No encuentro ese plato" }, 404);
    if (plato.receta) return json(plato.receta);
    const { data: p } = await db.from("preferencias").select("electrodomesticos, personas").eq("household_id", hogar).maybeSingle();
    const r = await claude.messages.parse({
      model: MODELO,
      max_tokens: 4000,
      system: SISTEMA,
      output_config: { format: zodOutputFormat(Receta) },
      messages: [{
        role: "user",
        content: `Escribe la receta de «${plato.titulo}» para ${p?.personas ?? 2} personas, con ${plato.aparato}.
Electrodomésticos de la casa: ${(p?.electrodomesticos ?? []).join(", ") || "vitrocerámica y microondas"}.
Ingredientes: ${plato.ingredientes.join("; ")}.
Pasos cortos y concretos (tiempos y temperaturas), como mucho 7.`,
      }],
    });
    if (!r.parsed_output) return json({ error: "No se pudo escribir la receta" }, 502);
    plato.receta = r.parsed_output;
    await db.from("menus").update({ plan }).eq("id", menu_id);
    return json(r.parsed_output);
  }

  return json({ error: "Acción desconocida" }, 400);
});
