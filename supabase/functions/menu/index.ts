// Menú semanal con Claude (tipo Whipp): almuerzos y cenas para 7 días, dentro del presupuesto,
// con los electrodomésticos y gustos de la casa, y la compra con precios reales del catálogo.
//   POST {accion: "planear"}                         → crea un menú (en segundo plano)
//   POST {accion: "receta", menu_id, dia, momento}   → pasos de un plato (bajo demanda)
//   POST {accion: "compra", menu_id}                 → rehace la compra entera (en segundo plano)
//   POST {accion: "sincronizar", menu_id, dia?, momento?} → tras cambiar platos: retoca la compra y la lista
//        solo con lo de esos platos (en segundo plano) y avisa al otro si cambia la mamá
import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@1.8.0/helpers/zod";
import { z } from "npm:zod@4.6.7";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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
  recetario: z.string().describe("El código [slug] del recetario si el plato sale de ahí tal cual, o vacío"),
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
      unidades: z.number().int().describe("Cuántos envases comprar para cubrir la cantidad (1 si es al peso)"),
      kilos: z.number().describe("Solo si el producto se vende al peso (por kg): los kilos que hay que pedir, p. ej. 0.4 para 400 g o 0.05 para un trozo de jengibre. Si no es al peso, 0"),
      por_regla: z.boolean().describe("true si lo eliges por una preferencia de la casa y no por precio"),
    }),
  ),
});

const Receta = z.object({
  raciones: z.number().int(),
  pasos: z.array(z.string()).describe("Pasos de cocinero: técnica, señales de punto, tiempos y fuegos"),
  consejo: z.string().describe("El truco clave del plato, o vacío"),
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

const SISTEMA = `Eres el cocinero de casa de una pareja con un bebé recién nacido. A él le gusta cocinar y quiere comer bien gastando poco:
platos caseros, sabrosos y algo elaborados, no genéricos ni de menú de hospital.
Viven en Tenerife y compran en Mercadona e HiperDino: eso solo decide dónde se compra, no qué se cocina.
Escribes en castellano de España, como un cocinero que explica a un amigo: claro, concreto, sin adornos.
Cómo cocinas:
- Técnica antes que ingredientes caros: dorar bien la carne (seca, sartén caliente, sin amontonar), desglasar el fondo, reposar la carne,
  sofritos lentos, especias tostadas en grasa, salsas reducidas que napan, la pasta terminada en su salsa con agua de cocción.
- Cortes baratos bien tratados (contramuslo, carrillera, morcillo, aguja, costilla, caballa) y legumbres con cariño.
- Producto de temporada (otoño-invierno: calabaza, setas, coles, brócoli, puerro, boniato, cítricos, granada).
- Cocina variada de todas partes: casera española, italiana, mexicana, asiática, india, de Oriente Medio, de bistró francés. Mezcla a lo largo de la semana.
- Cada plato, fiel a su estilo: nada de toques de otra cocina por obligación (ni mojo en unos burritos ni gofio en una pasta). Un plato canario solo si es canario de verdad.
Cómo planificas:
- Almuerzo = la comida fuerte y cocinada del día. Cena = ligera y casi sin cocinar (hummus con palitos, picoteo, tostas, sándwiches, burritos, cremas).
- Equilibrio semanal: 2 legumbres, 1-2 pescados (azul pequeño mejor), carne blanca y roja sin repetir proteína dos días seguidos, verdura todos los días.
- Uno o dos «platos de cocinero» a la semana (un guiso largo, un risotto, una carne con salsa) en los días con más tiempo; entre semana, rápido o dejado hecho.
- Reaprovecha: guisos y legumbres en cantidad doble para otro día o para congelar; lo que sobra de un almuerzo puede ser la cena (burritos, tostas).
- Carnes caras (solomillo, filete de ternera, secreto) solo si caben en el presupuesto, idealmente si están de oferta.
- Solo usas los electrodomésticos que tiene la casa. Respeta lo que no quieren comer sin excepción.
Seguridad (la madre da el pecho):
- Nada de pez espada, tiburón, atún rojo ni lucio (mercurio). Atún claro de lata, sí.
- Huevo siempre bien cuajado; nada de mayonesa casera ni huevo crudo.
- Sin alcohol en el plato final: vino o cerveza solo si cuecen largo hasta evaporarse (dilo) y con alternativa sin alcohol.
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
    max_tokens: 16000,
    system: SISTEMA,
    thinking: { type: "disabled" },
    output_config: { format: zodOutputFormat(Eleccion), effort: "medium" },
    messages: [{
      role: "user",
      content: `Elige qué producto comprar para cada ingrediente de la lista. Criterios, por orden:
1) Las preferencias de compra de la casa: ${prefs.reglas.join(" ") || "ninguna"}
2) Que sea de verdad ese ingrediente (no un derivado: «cebolla» no es «cebolla frita»).
3) El más barato por kilo o litro con un envase razonable para la cantidad.
Calcula las unidades para cubrir la cantidad. Si el producto se vende «al peso, por kg», su precio es por kilo: pon unidades 1 y en «kilos» lo que hay que pedir (no un kilo entero si hace falta poco).
Si ninguno sirve, deja el producto vacío.

${bloques.join("\n\n")}`,
    }],
  });
  if (!r.parsed_output) throw new Error(`Claude no devolvió la elección (${r.stop_reason})`);
  const compra = plan.compra.map((c, i) => {
    const e = r.parsed_output!.elecciones.find((x) => x.n === i);
    const p = e?.producto ? codigos.get(e.producto) : undefined;
    const alPeso = !!p && /al peso|por kg/i.test(p.formato ?? "");
    const kilos = alPeso ? Math.max(0.02, Math.min(10, e?.kilos || 1)) : 0;
    const unidades = alPeso ? 1 : Math.max(1, Math.min(20, e?.unidades ?? 1));
    return {
      ingrediente: c.ingrediente,
      cantidad: c.cantidad,
      uso: c.uso,
      producto: p ? { id: p.id, super: p.super, nombre: p.nombre, formato: p.formato, precio: Number(p.precio) } : null,
      unidades,
      por_regla: !!e?.por_regla,
      kilos: alPeso ? kilos : undefined,
      coste: p ? Math.round(Number(p.precio) * (alPeso ? kilos : unidades) * 100) / 100 : 0,
    };
  });
  return compra;
}

type Compra = Awaited<ReturnType<typeof elegir>>;

// ——— Recetario: una selección de platos de la casa como inspiración ———
type RecetaLibro = {
  id: string; slug: string; titulo: string; cocina: string; momento: "almuerzo" | "cena"; minutos: number; aparato: string;
  etiquetas: string[]; ingredientes: string[]; pasos: string[]; truco: string; conservacion: string; sobras: boolean; congela: boolean;
  coste: string; meses: number[] | null; raciones: number; claves: { q: string }[];
};
type Precio = { coste: number; oferta: boolean; ofertas: string[] };

// Coste estimado de cada receta con los precios de hoy; «oferta» = el ingrediente principal está rebajado.
async function preciosRecetario(db: SupabaseClient, libro: RecetaLibro[]) {
  const { data } = await db.rpc("recetario_costes");
  const principal = new Map(libro.map((r) => [r.slug, r.claves?.[0]?.q]));
  return new Map(((data ?? []) as { slug: string; coste: number; ofertas: string[] }[]).map((c) => [
    c.slug,
    { coste: Number(c.coste), oferta: !!principal.get(c.slug) && c.ofertas.includes(principal.get(c.slug)!), ofertas: c.ofertas },
  ]));
}

// Lo que está rebajado esta semana en fresco y básicos (HiperDino publica el precio de antes).
const CATEGORIAS_OFERTA = ["Carne", "Pescado y marisco", "Fruta", "Verduras y hortalizas", "Charcuteria al corte", "Quesos al corte",
  "Legumbres cocidas", "Legumbres", "Pasta", "Arroz", "Huevos", "Aves"];
// Lactancia: ni atún grande (salvo el claro de lata), ni pez espada/emperador, tiburón/cazón/marrajo o lucio.
const MERCURIO = /(at[uú]n(?! claro)|pez espada|emperador|tibur[oó]n|caz[oó]n|marrajo|lucio)/i;
async function ofertas(db: SupabaseClient) {
  const { data } = await db.from("productos").select("nombre, formato, precio, precio_antes, precio_unidad, unidad, super")
    .eq("activo", true).not("precio_antes", "is", null).in("categoria", CATEGORIAS_OFERTA).limit(400);
  return ((data ?? []) as { nombre: string; formato: string | null; precio: number; precio_antes: number; precio_unidad: number | null; unidad: string | null; super: string }[])
    .map((p) => ({ ...p, baja: 1 - Number(p.precio) / Number(p.precio_antes) }))
    .filter((p) => p.baja >= 0.08 && !MERCURIO.test(p.nombre))
    .sort((a, b) => b.baja - a.baja)
    .slice(0, 25);
}
// Lo que hay en casa ahora (descontando el consumo diario) y lo que es reserva fija.
type CosaCasa = { nombre: string; unidad: string; cantidad: number; consumo_dia: number; reserva: boolean; actualizado_at: string };
async function textoCasa(db: SupabaseClient, householdId: string) {
  const { data } = await db.from("inventario").select("nombre, unidad, cantidad, consumo_dia, reserva, actualizado_at").eq("household_id", householdId);
  const cosas = ((data ?? []) as CosaCasa[]).map((c) => {
    const dias = (Date.now() - new Date(c.actualizado_at).getTime()) / 86_400_000;
    return { ...c, queda: Math.max(0, Number(c.cantidad) - Number(c.consumo_dia) * dias) };
  });
  if (!cosas.length) return "";
  const hay = cosas.filter((c) => c.queda > 0 && !c.reserva).map((c) => `${c.nombre} (${Math.round(c.queda * 10) / 10} ${c.unidad})`);
  const reserva = cosas.filter((c) => c.reserva).map((c) => c.nombre);
  return [
    hay.length ? `Ya hay en casa (aprovéchalo en los platos si encaja y no lo pongas en la compra si alcanza): ${hay.join("; ")}.` : "",
    reserva.length ? `Reserva de la casa, siempre hay y se repone aparte: NO la pongas en la compra (tampoco para desayunos ni después de cenar): ${reserva.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
}

function textoOfertas(o: Awaited<ReturnType<typeof ofertas>>) {
  if (!o.length) return "";
  return `Ofertas de esta semana (aprovéchalas si encajan; la carne o el pescado caros, solo si están aquí):
${o.map((p) => `- ${p.nombre}${p.formato && !p.formato.startsWith("al peso") ? `, ${p.formato}` : ""}: ${euros(Number(p.precio))}${p.formato?.startsWith("al peso") ? "/kg" : ""} (antes ${euros(Number(p.precio_antes))}, −${Math.round(p.baja * 100)} %)`).join("\n")}`;
}
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
const VACIAS = new Set(["con", "de", "del", "la", "las", "los", "el", "y", "a", "al", "en", "o", "un", "una", "casero", "casera"]);
const claves = (t: string) => norm(t).split(/\s+/).filter((w) => w.length > 3 && !VACIAS.has(w));

function seleccionar(libro: RecetaLibro[], precios: Map<string, Precio>, o: {
  favoritos: Set<string>; gustaron: string[]; noGustaron: string[]; recientes: string[]; notas: string; aparatos: string[]; mes: number;
}) {
  const parecido = (a: string, b: string) => {
    const ka = new Set(claves(a)), kb = claves(b);
    return kb.length > 0 && kb.filter((w) => ka.has(w)).length / Math.min(ka.size || 1, kb.length) >= 0.6;
  };
  const notas = norm(o.notas);
  const tieneAparato = (a: string) => a === "Sin cocinar" || !o.aparatos.length || o.aparatos.includes(a);
  const puntuado = libro
    .filter((r) => tieneAparato(r.aparato))
    .filter((r) => !o.noGustaron.some((t) => parecido(r.titulo, t)))
    .map((r) => {
      let p = Math.random() * 2;
      if (o.favoritos.has(r.id)) p += 3;
      if (o.gustaron.some((t) => parecido(r.titulo, t))) p += 3;
      if (claves(r.titulo).slice(0, 2).some((w) => notas.includes(w))) p += 2;
      if (r.meses && r.meses.includes(o.mes)) p += 1;
      if (o.recientes.some((t) => parecido(r.titulo, t))) p -= 4;
      const pr = precios.get(r.slug);
      if (pr?.oferta) p += 1.5;
      if (r.coste === "oferta" && !pr?.oferta) p -= 6; // filete y similares: solo con oferta
      if (pr) p -= Math.max(0, pr.coste - 4) * 0.4; // lo caro, algo menos a menudo
      return { r, p };
    })
    .sort((a, b) => b.p - a.p);
  // Variedad: como mucho 3 por cocina en almuerzos.
  const porCocina = new Map<string, number>();
  const almuerzos: RecetaLibro[] = [];
  for (const { r } of puntuado.filter((x) => x.r.momento === "almuerzo")) {
    const n = porCocina.get(r.cocina) ?? 0;
    if (n >= 3 || almuerzos.length >= 12) continue;
    porCocina.set(r.cocina, n + 1);
    almuerzos.push(r);
  }
  const cenas = puntuado.filter((x) => x.r.momento === "cena").slice(0, 8).map((x) => x.r);
  return [...almuerzos, ...cenas];
}

function textoRecetario(sel: RecetaLibro[], precios: Map<string, Precio>) {
  if (!sel.length) return "";
  const linea = (r: RecetaLibro) => {
    const pr = precios.get(r.slug);
    const coste = pr ? ` · ≈ ${euros(pr.coste)} para 2${pr.oferta ? ` · DE OFERTA: ${pr.ofertas[0]}` : ""}` : "";
    return `- [${r.slug}] ${r.titulo} · ${r.cocina} · ${r.minutos} min · ${r.aparato}${coste}${r.coste === "oferta" ? " · solo si hay oferta" : ""}${r.sobras ? " · da para otro día" : ""}
  Ingredientes (2 raciones): ${r.ingredientes.join("; ")}. Clave: ${r.truco}`;
  };
  return `Recetario de la casa (platos probados con buena técnica; úsalos como inspiración y repite los favoritos, pero no hace falta usarlos todos
ni solo estos; el coste es orientativo con los precios de hoy). Si pones un plato tal cual, copia su título y pon su código en «recetario» (y sus ingredientes, ajustando cantidades):
ALMUERZOS
${sel.filter((r) => r.momento === "almuerzo").map(linea).join("\n")}
CENAS
${sel.filter((r) => r.momento === "cena").map(linea).join("\n")}`;
}

async function planear(claude: Anthropic, prefs: Prefs, recientes: string[], recetario: string, ajuste?: { plan: PlanT; compra: Compra; total: number }) {
  const pedido = ajuste
    ? `Este plan se pasa del presupuesto: cuesta ${euros(ajuste.total)} y el tope es ${euros(prefs.presupuesto)}.
Lo más caro de la compra: ${[...ajuste.compra].sort((a, b) => b.coste - a.coste).slice(0, 8).map((c) => `${c.ingrediente} ${euros(c.coste)}`).join("; ")}.
Rehaz la semana para que quede por debajo, cambiando lo justo (ingredientes más baratos, más legumbre, huevo o pollo, reaprovechar).
Plan anterior: ${JSON.stringify({ dias: ajuste.plan.dias.map((d) => ({ dia: d.dia, almuerzo: d.almuerzo.titulo, cena: d.cena.titulo })) })}`
    : `Planifica la semana: almuerzo y cena de lunes a domingo, y la lista de la compra completa de la semana (incluidos desayunos y lo de después de cenar).
Que no se repitan platos dentro de la semana (salvo días de sobras, que se titulan «… (del lunes)»).
Mete uno o dos platos de cocinero, al menos dos de los favoritos de la casa si caben en el presupuesto, y que se note la temporada (noviembre).
${recientes.length ? `Evita repetir estos de semanas anteriores: ${recientes.join(", ")}.` : ""}`;
  const r = await claude.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    system: SISTEMA,
    // Haiku 5.5 piensa por defecto y ese pensamiento cuenta en max_tokens: con el plan se lo comía entero
    // y no llegaba a escribir nada. Aquí no hace falta: sale un JSON guiado por el esquema.
    thinking: { type: "disabled" },
    output_config: { format: zodOutputFormat(Plan), effort: "medium" },
    messages: [{ role: "user", content: [textoPrefs(prefs), recetario, pedido].filter(Boolean).join("\n\n") }],
  });
  if (!r.parsed_output) throw new Error(`Claude no devolvió el plan (${r.stop_reason})`);
  return r.parsed_output;
}

// Lo aprendido de la casa: opiniones de cada uno (lo de la mamá cuenta doble; los cambios de plato, flojito),
// antojos pendientes y platos que se quedaron sin cocinar la semana anterior.
type Opinion = { user_id: string | null; titulo: string; momento: string | null; voto: number; fuente: "voto" | "cambio" };
async function aprendido(db: SupabaseClient, hogar: string, pendientes: { titulo: string; momento?: string }[]) {
  const [{ data: ops }, { data: gente }, { data: antojos }] = await Promise.all([
    db.from("opiniones").select("user_id, titulo, momento, voto, fuente").eq("household_id", hogar)
      .order("created_at", { ascending: false }).limit(400),
    db.from("members").select("user_id, display_name, rol").eq("household_id", hogar),
    db.from("antojos").select("id, texto, user_id").eq("household_id", hogar).is("usado_en", null).order("created_at").limit(12),
  ]);
  const quien = new Map((gente ?? []).map((g) => [g.user_id as string, g as { display_name: string; rol: string | null }]));
  const esMama = (uid: string | null) => !!uid && quien.get(uid)?.rol === "mama";
  const puntos = new Map<string, { titulo: string; momento: string | null; p: number }>();
  for (const o of (ops ?? []) as Opinion[]) {
    const peso = (o.fuente === "cambio" ? 0.4 : 1) * (esMama(o.user_id) ? 2 : 1);
    const x = puntos.get(o.titulo) ?? { titulo: o.titulo, momento: o.momento, p: 0 };
    x.p += o.voto * peso;
    puntos.set(o.titulo, x);
  }
  const todos = [...puntos.values()].filter((x) => !/^sobras/i.test(x.titulo));
  const gustaron = todos.filter((x) => x.p >= 1).sort((a, b) => b.p - a.p).slice(0, 40);
  const noGustaron = todos.filter((x) => x.p <= -1).slice(0, 40);
  const conMomento = (v: { titulo: string; momento: string | null }) => (v.momento ? `${v.titulo} (${v.momento})` : v.titulo);

  // Por persona, solo lo que votó (no los cambios): para que Claude entienda el gusto de cada uno.
  const porPersona = [...quien.entries()]
    .sort(([, a], [, b]) => Number(b.rol === "mama") - Number(a.rol === "mama"))
    .map(([uid, g]) => {
      const suyos = ((ops ?? []) as Opinion[]).filter((o) => o.user_id === uid && o.fuente === "voto");
      const lista = (v: number) => suyos.filter((o) => o.voto === v).slice(0, 15).map((o) => o.titulo).join("; ");
      const partes = [
        lista(2) && `le encantan: ${lista(2)}`,
        lista(1) && `le gustan: ${lista(1)}`,
        lista(-1) && `no le apetecen: ${lista(-1)}`,
      ].filter(Boolean);
      return partes.length ? `- ${g.display_name}${g.rol === "mama" ? " (mamá, de postparto: lo suyo manda)" : ""}: ${partes.join(" · ")}.` : "";
    }).filter(Boolean);

  const nombre = (uid: string | null) => (uid && quien.get(uid)?.display_name) || "alguien";
  const ants = (antojos ?? []) as { id: string; texto: string; user_id: string | null }[];
  const pend = pendientes.slice(-4);
  const texto = [
    porPersona.length ? `Lo que opina cada uno:\n${porPersona.join("\n")}` : "",
    gustaron.length ? `Platos que gustan en casa (pueden repetirse alguno y sirven de pista de su estilo): ${gustaron.map(conMomento).join("; ")}.` : "",
    noGustaron.length ? `Platos que NO quieren repetir (ni versiones muy parecidas): ${noGustaron.map(conMomento).join("; ")}.` : "",
    pend.length
      ? `Se quedaron sin cocinar la semana pasada (puede que ya haya ingredientes en casa): ponlos en los primeros días: ${pend.map((p) => p.titulo).join("; ")}.`
      : "",
  ].filter(Boolean).join("\n");
  const obligatorio = ants.length
    ? `OBLIGATORIO esta semana: cada uno de estos antojos tiene que ser un almuerzo o una cena del menú, con la idea en el título (si es vaga, concrétala en una receta): ${ants.map((a) => `«${a.texto}» (${nombre(a.user_id)}${esMama(a.user_id) ? ", mamá: el primero" : ""})`).join("; ")}.`
    : "";
  return { gustaron, noGustaron, texto, obligatorio, antojos: ants };
}

async function generar(db: SupabaseClient, claude: Anthropic, menuId: string, householdId: string, prefs: Prefs) {
  const paso = (p: string) => db.from("menus").update({ paso: p }).eq("id", menuId);
  try {
    const { data: previos } = await db.from("menus").select("plan").eq("household_id", householdId).eq("estado", "listo")
      .order("created_at", { ascending: false }).limit(2);
    const aprende = await aprendido(db, householdId, (previos?.[0]?.plan as MenuDin | null)?.pendientes ?? []);
    const { gustaron, noGustaron } = aprende;
    // Los que gustaron pueden volver; el resto de semanas recientes, mejor variar.
    const recientes = (previos ?? []).flatMap((m) =>
      ((m.plan as PlanT | null)?.dias ?? []).flatMap((d) => [d.almuerzo.titulo, d.cena.titulo])
    ).filter((t) => !gustaron.some((g) => g.titulo === t) && !/^sobras/i.test(t));
    if (aprende.texto) prefs = { ...prefs, notas: [prefs.notas, aprende.texto].filter(Boolean).join("\n") };

    const [{ data: libro }, { data: favs }] = await Promise.all([
      db.from("recetario").select("*"),
      db.from("recetario_favoritos").select("receta_id").eq("household_id", householdId),
    ]);
    const mes = Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "numeric" }).format(new Date()));
    const libroT = (libro ?? []) as RecetaLibro[];
    const [precios, rebajas] = await Promise.all([preciosRecetario(db, libroT), ofertas(db)]);
    const casa = await textoCasa(db, householdId);
    const recetario = [casa, textoOfertas(rebajas), textoRecetario(seleccionar(libroT, precios, {
      favoritos: new Set((favs ?? []).map((f) => f.receta_id as string)),
      gustaron: gustaron.map((g) => g.titulo), noGustaron: noGustaron.map((g) => g.titulo),
      recientes, notas: prefs.notas, aparatos: prefs.electrodomesticos, mes,
    }), precios), aprende.obligatorio].filter(Boolean).join("\n\n");

    await paso("Pensando los platos");
    let plan = await planear(claude, prefs, recientes, recetario);
    await paso("Buscando precios");
    let compra = await elegir(claude, prefs, plan, await candidatos(db, plan));
    let total = compra.reduce((t, c) => t + c.coste, 0);

    if (total > prefs.presupuesto * 1.03) {
      await paso("Ajustando al presupuesto");
      const plan2 = await planear(claude, prefs, recientes, recetario, { plan, compra, total });
      const compra2 = await elegir(claude, prefs, plan2, await candidatos(db, plan2));
      const total2 = compra2.reduce((t, c) => t + c.coste, 0);
      if (total2 < total) [plan, compra, total] = [plan2, compra2, total2];
    }

    await db.from("menus").update({ estado: "listo", paso: null, plan, compra, total: Math.round(total * 100) / 100 }).eq("id", menuId);
    // Solo cuentan como usados los antojos que de verdad han entrado en el menú; el resto sigue para la próxima.
    const titulos = plan.dias.flatMap((d) => [d.almuerzo.titulo, d.cena.titulo]).map((t) => new Set(claves(t)));
    const usados = aprende.antojos.filter((a) => claves(a.texto).some((w) => titulos.some((t) => t.has(w))));
    if (usados.length) await db.from("antojos").update({ usado_en: menuId }).in("id", usados.map((a) => a.id));
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

async function leerPrefs(db: SupabaseClient, hogar: string): Promise<Prefs> {
  const { data: p } = await db.from("preferencias").select("*").eq("household_id", hogar).maybeSingle();
  return {
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
}

// La compra de los platos que hay ahora en el menú (tras cambiar alguno a mano).
const SoloCompra = Plan.pick({ resumen: true, compra: true });

async function rehacerCompra(db: SupabaseClient, claude: Anthropic, menuId: string, hogar: string) {
  const { data: menu } = await db.from("menus").select("plan").eq("id", menuId).eq("household_id", hogar).eq("estado", "listo").maybeSingle();
  const plan = menu?.plan as (PlanT & { compra_vieja?: boolean }) | null;
  if (!plan) throw new Error("No encuentro ese menú");
  const prefs = await leerPrefs(db, hogar);
  const casa = await textoCasa(db, hogar);
  const platos = plan.dias.map((d) => {
    const p = (x: z.infer<typeof Plato>) =>
      x.etiquetas?.includes("Fuera") ? `${x.titulo} (no se cocina: no compres nada)` : `${x.titulo}${x.ingredientes?.length ? `: ${x.ingredientes.join("; ")}` : " (escrito a mano: deduce los ingredientes de un plato así)"}`;
    return `${d.dia}\n  Almuerzo: ${p(d.almuerzo)}\n  Cena: ${p(d.cena)}`;
  }).join("\n");
  const r = await claude.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    system: SISTEMA,
    output_config: { format: zodOutputFormat(SoloCompra) },
    messages: [{
      role: "user",
      content: [textoPrefs(prefs), casa, `Estos son los platos de la semana, ya decididos (no los cambies). Escribe el resumen de la semana (una frase) y haz la lista de la compra completa de la semana para ${prefs.personas} personas, juntando lo que se repite, incluidos desayunos y lo de después de cenar. Los días de sobras no suman compra.\n${platos}`].filter(Boolean).join("\n\n"),
    }],
  });
  if (!r.parsed_output) throw new Error(`Claude no devolvió la compra (${r.stop_reason})`);
  const nuevo = { ...plan, resumen: r.parsed_output.resumen, compra: r.parsed_output.compra };
  const compra = await elegir(claude, prefs, nuevo, await candidatos(db, nuevo));
  const total = compra.reduce((t, c) => t + c.coste, 0);
  delete nuevo.compra_vieja;
  delete (nuevo as { cambios?: unknown }).cambios;
  const { compra: _, ...sinCompra } = nuevo;
  await db.from("menus").update({ plan: sinCompra, compra, total: Math.round(total * 100) / 100, paso: null, error: null }).eq("id", menuId);
  return { total };
}

// ——— Menú dinámico: al cambiar un plato, solo cambia lo de ese plato ———
type PlatoMenu = z.infer<typeof Plato> & { elegido?: { uid: string; nombre: string; rol: string | null } };
type Cambio = { dia: number; momento: "almuerzo" | "cena"; antes: PlatoMenu | null; por: string };
type MenuDin = PlanT & { compra_vieja?: boolean; cambios?: Cambio[]; pendientes?: { titulo: string; momento?: string }[]; dias: { dia: string; almuerzo: PlatoMenu; cena: PlatoMenu }[] };

const Diff = z.object({
  resumen: z.string().describe("Una frase que resume TODA la semana tal como queda (estilo, platos destacados), no el cambio"),
  quitar: z.array(z.number().int()).describe("Números de las líneas de la compra que hay que quitar o rehacer (porque solo eran para el plato que se va, o cambia la cantidad)"),
  anadir: z.array(Plan.shape.compra.element).describe("Líneas nuevas: lo que pide el plato nuevo y no está, y las que se rehacen con la cantidad corregida"),
  platos: z.array(z.object({
    n: z.number().int().describe("Número del cambio"),
    ingredientes: z.array(z.string()).describe("Ingredientes con cantidad, solo para los platos escritos a mano; si no, vacío"),
  })),
});

const sinCompra = (p: PlatoMenu | null | undefined) => !p || p.etiquetas?.some((e) => e === "Fuera" || e === "Sin compra");
const textoPlato = (p: PlatoMenu | null | undefined) =>
  !p ? "(nada)" : sinCompra(p) ? `${p.titulo} (no se cocina en casa: no necesita compra)`
  : `${p.titulo}${p.ingredientes?.length ? `: ${p.ingredientes.join("; ")}` : " (escrito a mano: deduce sus ingredientes para un plato así)"}`;

async function sincronizar(db: SupabaseClient, claude: Anthropic, menuId: string, hogar: string) {
  // Va por lotes: si mientras tanto cambian otro plato, se procesa en la vuelta siguiente.
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const { data: menu } = await db.from("menus").select("plan, compra").eq("id", menuId).maybeSingle();
    const plan = menu?.plan as MenuDin | null;
    const cambios = plan?.cambios ?? [];
    if (!plan || !cambios.length) break;
    const compra = (menu!.compra ?? []) as Compra;

    // Varios cambios del mismo hueco: cuenta el plato de antes del primero y el que hay ahora.
    const huecos = new Map<string, { dia: number; momento: "almuerzo" | "cena"; antes: PlatoMenu | null }>();
    for (const c of cambios) {
      const k = `${c.dia}-${c.momento}`;
      if (!huecos.has(k)) huecos.set(k, { dia: c.dia, momento: c.momento, antes: c.antes });
    }
    const lista = [...huecos.values()].map((h) => ({ ...h, ahora: plan.dias[h.dia]?.[h.momento] as PlatoMenu }))
      .filter((h) => h.antes?.titulo !== h.ahora?.titulo || sinCompra(h.antes) !== sinCompra(h.ahora));

    let resumen: string | null = null;
    let nueva = compra, quitadas: Compra = [], nuevas: Compra = [], platos: { dia: number; momento: string; titulo: string; ingredientes: string[] }[] = [];
    if (lista.length) {
      const prefs = await leerPrefs(db, hogar);
      const casa = await textoCasa(db, hogar);
      const resto = plan.dias.map((d) => `${d.dia}: ${d.almuerzo.titulo} / ${d.cena.titulo}`).join("\n");
      const r = await claude.messages.parse({
        model: MODELO,
        max_tokens: 8000,
        system: SISTEMA,
        output_config: { format: zodOutputFormat(Diff) },
        messages: [{
          role: "user",
          content: [textoPrefs(prefs), casa, `Han cambiado platos del menú de la semana (para ${prefs.personas} personas). Ajusta la lista de la compra SOLO a esos cambios:
quita lo que solo servía para el plato que se va, añade lo que pide el plato nuevo, y si un ingrediente se comparte con otros platos, rehaz esa línea con la cantidad que queda.
Escribe también el resumen de la semana: una frase que describa toda la semana como queda (no hables del cambio ni de lo que se quita).
No toques lo demás de la compra (desayunos, después de cenar y los otros platos se quedan igual). Lo que ya hay en casa no se compra.

Cambios:
${lista.map((h, n) => `${n}. ${DIAS[h.dia]}, ${h.momento}. Antes: ${textoPlato(h.antes)}. Ahora: ${textoPlato(h.ahora)}.`).join("\n")}

Menú completo de la semana tal como queda:
${resto}

Compra actual:
${compra.map((c, i) => `${i}. ${c.ingrediente} — ${c.cantidad} (${c.uso})`).join("\n")}`].filter(Boolean).join("\n\n"),
        }],
      });
      if (!r.parsed_output) throw new Error(`Claude no devolvió el ajuste (${r.stop_reason})`);
      const d = r.parsed_output;
      resumen = d.resumen;
      const fuera = new Set(d.quitar.filter((n) => n >= 0 && n < compra.length));
      quitadas = compra.filter((_, i) => fuera.has(i));
      if (d.anadir.length) {
        const parcial = { ...plan, compra: d.anadir };
        nuevas = await elegir(claude, prefs, parcial, await candidatos(db, parcial));
      }
      nueva = [...compra.filter((_, i) => !fuera.has(i)), ...nuevas];
      platos = d.platos.flatMap((p) => {
        const h = lista[p.n];
        return h && !sinCompra(h.ahora) && !h.ahora.ingredientes?.length && p.ingredientes.length
          ? [{ dia: h.dia, momento: h.momento, titulo: h.ahora.titulo, ingredientes: p.ingredientes.slice(0, 20) }] : [];
      });
    }
    const { error } = await db.rpc("aplicar_cambios_compra", {
      p_menu: menuId, p_n: cambios.length, p_compra: nueva, p_quitadas: quitadas, p_nuevas: nuevas, p_platos: platos, p_resumen: resumen,
    });
    if (error) throw new Error(error.message);
  }
  await db.from("menus").update({ sincronizando_at: null, error: null }).eq("id", menuId);
}

// Aviso al móvil cuando la mamá cambia un plato (o cuando alguien cambia uno que eligió ella).
async function avisarCambio(db: SupabaseClient, menuId: string, hogar: string, uid: string, dia: number, momento: "almuerzo" | "cena") {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY"), sub = Deno.env.get("VAPID_SUBJECT");
  if (!pub || !priv || !sub) return;
  const [{ data: menu }, { data: miembros }] = await Promise.all([
    db.from("menus").select("plan").eq("id", menuId).maybeSingle(),
    db.from("members").select("user_id, display_name, rol").eq("household_id", hogar),
  ]);
  const plan = menu?.plan as MenuDin | null;
  const plato = plan?.dias?.[dia]?.[momento];
  const yo = (miembros ?? []).find((m) => m.user_id === uid);
  if (!plato || !yo) return;
  const ultimo = [...(plan!.cambios ?? [])].reverse().find((c) => c.dia === dia && c.momento === momento && c.por === uid);
  const deLaMama = ultimo?.antes?.elegido?.rol === "mama" ? ultimo.antes.elegido.uid : null;
  const para = (miembros ?? []).filter((m) => m.user_id !== uid && (yo.rol === "mama" || m.user_id === deLaMama));
  if (!para.length) return;
  webpush.setVapidDetails(sub, pub, priv);
  const body = `${yo.display_name} ha cambiado el ${momento} del ${DIAS[dia]}: ${plato.titulo}. La lista ya se está ajustando.`;
  const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", para.map((m) => m.user_id));
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "Cambio en el menú", body, url: "./" }), { TTL: 3600 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("push", code, (e as Error).message);
    }
  }));
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
  const sinClave = () => json({ error: "Falta conectar Claude: hay que guardar la clave de API en Supabase." }, 503);
  const claude = apiKey ? new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 }) : null;

  const cuerpo = await req.json().catch(() => ({}));

  if (cuerpo.accion === "planear") {
    if (!claude) return sinClave();
    // Freno de gasto: uno a la vez y como mucho 6 al día por casa.
    const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const [{ count: enCurso }, { count: hoy }] = await Promise.all([
      db.from("menus").select("id", { count: "exact", head: true }).eq("household_id", hogar).eq("estado", "generando").gt("created_at", hace(4)),
      db.from("menus").select("id", { count: "exact", head: true }).eq("household_id", hogar).gt("created_at", hace(24 * 60)),
    ]);
    if (enCurso) return json({ error: "Ya se está preparando un menú." }, 429);
    if ((hoy ?? 0) >= 6) return json({ error: "Por hoy ya van 6 menús. Mañana más." }, 429);

    const prefs = await leerPrefs(db, hogar);
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
    const personas = p?.personas ?? 2;
    const { data: base } = plato.recetario
      ? await db.from("recetario").select("*").eq("slug", plato.recetario).maybeSingle()
      : { data: null };
    const libro = base as RecetaLibro | null;
    // Del recetario y para las mismas raciones: la receta ya está escrita, sin gastar en Claude.
    const doble = plato.etiquetas.some((e) => /dejar hecho|sobras/i.test(e));
    if (libro && libro.raciones === personas && !doble) {
      const receta = {
        raciones: libro.raciones,
        pasos: libro.pasos,
        consejo: [libro.truco, libro.conservacion].filter(Boolean).join(" "),
      };
      plato.receta = receta;
      await db.from("menus").update({ plan }).eq("id", menu_id);
      return json(receta);
    }
    if (!claude) return sinClave();
    const r = await claude.messages.parse({
      model: MODELO,
      max_tokens: 4000,
      system: SISTEMA,
      output_config: { format: zodOutputFormat(Receta) },
      messages: [{
        role: "user",
        content: `Escribe la receta de «${plato.titulo}» con estos ingredientes (ya calculados para lo que se cocina: ${personas} personas${doble ? ", más lo que se guarda para otro día" : ""}), con ${plato.aparato}.
Electrodomésticos de la casa: ${(p?.electrodomesticos ?? []).join(", ") || "vitrocerámica y microondas"}.
Ingredientes: ${plato.ingredientes.join("; ")}.
${libro ? `Parte de esta receta probada y adáptala a las cantidades, sin perder su técnica:\n${libro.pasos.map((x, i) => `${i + 1}. ${x}`).join("\n")}\nTruco: ${libro.truco}\n` : ""}
Escríbela como un buen cocinero que explica a un amigo: entre 4 y 7 pasos, cada uno con el porqué cuando importa
(fuego, tiempo, temperatura y la señal de que está en su punto: «hasta que la cebolla esté dorada y blanda», «que la salsa nape la cuchara»).
Incluye la técnica que hace bueno el plato: secar y dorar bien, desglasar, reposar la carne, sofrito lento, tostar especias, reducir, terminar la pasta en la salsa…
Si sobra para otro día, di cuánto guardar y cómo. En «consejo», el truco que marca la diferencia.`,
      }],
    });
    if (!r.parsed_output) return json({ error: "No se pudo escribir la receta" }, 502);
    plato.receta = r.parsed_output;
    await db.from("menus").update({ plan }).eq("id", menu_id);
    return json(r.parsed_output);
  }

  if (cuerpo.accion === "compra") {
    if (!claude) return sinClave();
    const menuId = String(cuerpo.menu_id ?? "");
    const { data: menu } = await db.from("menus").select("id, paso").eq("id", menuId).eq("household_id", hogar).eq("estado", "listo").maybeSingle();
    if (!menu) return json({ error: "No encuentro ese menú" }, 404);
    if (menu.paso) return json({ error: "Ya se está rehaciendo la compra." }, 429);
    await db.from("menus").update({ paso: "Rehaciendo la compra", error: null }).eq("id", menuId);
    // Tarda un par de minutos: se hace en segundo plano y la app se entera por realtime.
    EdgeRuntime.waitUntil(rehacerCompra(db, claude, menuId, hogar).catch(async (e) => {
      console.error("compra", e);
      await db.from("menus").update({ paso: null, error: "No se pudo rehacer la compra. Prueba otra vez." }).eq("id", menuId);
    }));
    return json({ ok: true }, 202);
  }

  if (cuerpo.accion === "sincronizar") {
    const menuId = String(cuerpo.menu_id ?? "");
    const { data: menu } = await db.from("menus").select("id, plan").eq("id", menuId).eq("household_id", hogar).eq("estado", "listo").maybeSingle();
    if (!menu) return json({ error: "No encuentro ese menú" }, 404);
    const { dia, momento } = cuerpo as { dia?: number; momento?: "almuerzo" | "cena" };
    if (typeof dia === "number" && dia >= 0 && dia < 7 && (momento === "almuerzo" || momento === "cena")) {
      EdgeRuntime.waitUntil(avisarCambio(db, menuId, hogar, u.user.id, dia, momento).catch((e) => console.error("aviso", e)));
    }
    if (!((menu.plan as MenuDin | null)?.cambios?.length)) return json({ ok: true });
    if (!claude) return sinClave();
    // Uno a la vez por menú; si uno se quedó colgado, a los 3 minutos se puede retomar.
    const { data: mio } = await db.from("menus").update({ sincronizando_at: new Date().toISOString(), error: null }).eq("id", menuId)
      .or(`sincronizando_at.is.null,sincronizando_at.lt.${new Date(Date.now() - 3 * 60_000).toISOString()}`).select("id");
    if (!mio?.length) return json({ ok: true, en_curso: true }, 202);
    EdgeRuntime.waitUntil(sincronizar(db, claude, menuId, hogar).catch(async (e) => {
      console.error("sincronizar", e);
      await db.from("menus").update({ sincronizando_at: null, error: "No se pudo ajustar la lista al plato nuevo. Prueba otra vez." }).eq("id", menuId);
    }));
    return json({ ok: true }, 202);
  }

  return json({ error: "Acción desconocida" }, 400);
});
