// Revisa cada 10 minutos (pg_cron) si toca avisar de una toma o del sacaleches.
// Un único aviso por hueco: no se repite hasta que se apunte la siguiente toma o extracción.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const TZ = "Atlantic/Canary";
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

const horaLocal = (d: Date) => Number(new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "numeric", hour12: false }).format(d));
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
// Un uuid fijo para cada comida (el registro de avisos guarda uuid).
async function uuidDe(texto: string) {
  const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)))].slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
function duracion(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

type Evento = { id: string; kind: string; side: string | null; ml: number | null; metodo: string | null; at: string; ended_at: string | null };
function etiqueta(e: Evento) {
  if (e.side === "extraida") return `leche de mamá, ${e.ml ?? "?"} ml`;
  if (e.side === "bib") return `fórmula, ${e.ml ?? "?"} ml`;
  return e.side === "izq" ? "pecho izquierdo" : "pecho derecho";
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get("CRON_SECRET") ?? "";
  if (!secreto || !igual(req.headers.get("x-cron-secret") ?? "", secreto)) return json({ error: "No autorizado" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false } });
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

  const ahora = new Date();
  const deNoche = horaLocal(ahora) < 7;
  const [{ data: casas, error: e1 }, { data: miembros, error: e2 }, { data: bebes, error: e3 }] = await Promise.all([
    db.from("households").select("id, toma_cada_min, saca_cada_min"),
    db.from("members").select("user_id, household_id, display_name, rol, aviso_tomas, aviso_saca, aviso_noche, aviso_comidas"),
    db.from("people").select("id, household_id, name").eq("kind", "bebe"),
  ]);

  let enviados = 0;
  const errores: string[] = [e1, e2, e3].filter(Boolean).map((e) => e!.message);

  async function avisar(userId: string, tipo: "toma" | "saca" | "comida", refId: string, title: string, body: string) {
    // Primero se reserva el aviso: si ya existía, no se manda otra vez.
    const { data: nuevo, error } = await db
      .from("avisos_enviados")
      .upsert({ user_id: userId, tipo, ref_id: refId }, { onConflict: "user_id,tipo,ref_id", ignoreDuplicates: true })
      .select("user_id");
    if (error) errores.push(error.message);
    if (!nuevo?.length) return;
    const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    const payload = JSON.stringify({ title, body, url: "./" });
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 1800, urgency: "high" });
        enviados++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push", code, (e as Error).message);
      }
    }));
  }

  for (const bebe of bebes ?? []) {
    const casa = casas?.find((c) => c.id === bebe.household_id);
    if (!casa) continue;
    const gente = (miembros ?? []).filter((m) => m.household_id === bebe.household_id);
    const mama = gente.find((m) => m.rol === "mama")?.display_name ?? "mamá";

    const [{ data: tomas }, { data: extr }] = await Promise.all([
      db.from("baby_events").select("id, kind, side, ml, metodo, at, ended_at").eq("person_id", bebe.id).eq("kind", "toma").order("at", { ascending: false }).limit(1),
      db.from("baby_events").select("id, kind, side, ml, metodo, at, ended_at").eq("person_id", bebe.id).eq("kind", "extraccion").order("at", { ascending: false }).limit(1),
    ]);

    // Toma
    const t = tomas?.[0] as Evento | undefined;
    if (t) {
      const min = Math.round((ahora.getTime() - new Date(t.at).getTime()) / 60000);
      const enCurso = (t.side === "izq" || t.side === "dcho") && !t.ended_at && min < 90;
      if (!enCurso && min >= casa.toma_cada_min) {
        for (const m of gente) {
          if (!m.aviso_tomas || (deNoche && !m.aviso_noche)) continue;
          await avisar(m.user_id, "toma", t.id, `${bebe.name}: toca toma`, `Han pasado ${duracion(min)} desde la última (${etiqueta(t)}, a las ${hhmm(t.at)}).`);
        }
      }
    }

    // Sacaleches (solo si ya se usa: hay al menos una extracción)
    const x = extr?.[0] as Evento | undefined;
    if (x) {
      const min = Math.round((ahora.getTime() - new Date(x.at).getTime()) / 60000);
      if (min >= casa.saca_cada_min) {
        for (const m of gente) {
          const quiere = m.aviso_saca ?? m.rol === "mama";
          if (!quiere || (deNoche && !m.aviso_noche)) continue;
          const esElla = m.rol === "mama";
          await avisar(
            m.user_id,
            "saca",
            x.id,
            esElla ? "Sacaleches, cuando puedas" : `Sacaleches de ${mama}`,
            esElla
              ? `Llevas ${duracion(min)} desde la última extracción. Sin prisa: cada ml cuenta.`
              : `${mama} lleva ${duracion(min)} sin sacarse leche. Buen momento para prepararle el sacaleches y un vaso de agua.`,
          );
        }
      }
    }
  }

  // Después de comer (16:00) y de cenar (22:00): «¿comisteis…?». Un aviso por comida y persona.
  const hora = horaLocal(ahora);
  const momento = hora === 16 ? "almuerzo" : hora === 22 ? "cena" : null;
  if (momento) {
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ahora);
    const d = new Date(`${hoy}T12:00:00Z`);
    const dia = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dia);
    const { data: menus, error } = await db.from("menus").select("id, household_id, plan").eq("semana", d.toISOString().slice(0, 10))
      .eq("estado", "listo").order("created_at", { ascending: false });
    if (error) errores.push(error.message);
    const vistos = new Set<string>();
    for (const m of menus ?? []) {
      if (vistos.has(m.household_id)) continue; // el último menú de la semana de cada casa
      vistos.add(m.household_id);
      const plato = m.plan?.dias?.[dia]?.[momento] as { titulo: string; etiquetas?: string[]; hecho?: unknown } | undefined;
      if (!plato || plato.hecho || plato.etiquetas?.some((e) => e === "Fuera" || e === "Sin compra")) continue;
      const ref = await uuidDe(`${m.id}-${dia}-${momento}`);
      for (const p of (miembros ?? []).filter((x) => x.household_id === m.household_id && x.aviso_comidas !== false)) {
        await avisar(p.user_id, "comida", ref, `¿Qué tal ${momento === "almuerzo" ? "el almuerzo" : "la cena"}?`,
          `¿Comisteis ${plato.titulo}? Cuéntalo con un toque: así el menú aprende lo que os gusta y la lista cuadra.`);
      }
    }
  }

  return json({ ok: errores.length === 0, enviados, bebes: bebes?.length ?? 0, errores });
});
