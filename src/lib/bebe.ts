import { supabase } from './supabase'

export const TZ = 'Atlantic/Canary'

export type Kind = 'toma' | 'panal' | 'dormido' | 'despierto' | 'extraccion' | 'peso'
export type Metodo = 'jeringa' | 'biberon' | 'vasito'
export type BabyEvent = {
  id: string
  household_id: string
  person_id: string
  kind: Kind
  side: 'izq' | 'dcho' | 'bib' | 'extraida' | 'ambos' | null
  metodo: Metodo | null
  gramos: number | null
  ml: number | null
  panal: 'pipi' | 'caca' | 'ambos' | null
  at: string
  ended_at: string | null
  created_by: string
}
export type Person = { id: string; household_id: string; name: string; kind: 'adulto' | 'bebe'; birth_at: string | null }

type Op = { k: string } & (
  | { op: 'insert'; row: BabyEvent }
  | { op: 'delete'; id: string }
  | { op: 'update'; id: string; patch: Cambio }
)

export type Cambio = Partial<Pick<BabyEvent, 'at' | 'ended_at'>>

// Cola de cambios pendientes de subir. Solo se AÑADE al final y cada operación
// se quita por su clave al confirmarse: así nada se pierde aunque se apunte
// algo mientras otra subida está en marcha.
const KEY = 'casa.outbox.v2'

// Migra lo que quedara pendiente en la cola antigua (v1) a la nueva.
try {
  const viejo = localStorage.getItem('casa.outbox.v1')
  if (viejo) {
    const ops = (JSON.parse(viejo) as Array<Record<string, unknown>>).map((o) =>
      o.op === 'update' && 'at' in o ? { op: 'update', id: o.id, patch: { at: o.at }, k: crypto.randomUUID() } : { ...o, k: crypto.randomUUID() },
    )
    localStorage.setItem(KEY, JSON.stringify([...ops, ...JSON.parse(localStorage.getItem(KEY) ?? '[]')]))
    localStorage.removeItem('casa.outbox.v1')
  }
} catch {
  /* sin almacenamiento: nada que migrar */
}

function leer(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[]
  } catch {
    return []
  }
}
function guardar(ops: Op[]) {
  localStorage.setItem(KEY, JSON.stringify(ops))
}

export const nPendientes = () => leer().length

/** Lo del servidor con lo pendiente aplicado encima, en orden. */
export function conPendientes(servidor: BabyEvent[]): BabyEvent[] {
  const filas = new Map(servidor.map((e) => [e.id, e]))
  for (const o of leer()) {
    if (o.op === 'insert') filas.set(o.row.id, { ...(filas.get(o.row.id) ?? {}), ...o.row })
    else if (o.op === 'delete') filas.delete(o.id)
    else {
      const f = filas.get(o.id)
      if (f) filas.set(o.id, { ...f, ...o.patch })
    }
  }
  return [...filas.values()].sort((a, b) => b.at.localeCompare(a.at))
}

let vaciando = false
/** Sube lo pendiente en orden. Lo que falla se queda para el siguiente intento. */
export async function vaciarCola(): Promise<number> {
  if (!navigator.onLine) return leer().length
  if (vaciando) return 0 // ya hay una subida en marcha y recogerá lo nuevo
  vaciando = true
  try {
    for (;;) {
      const o = leer()[0]
      if (!o) return 0
      const { error } =
        o.op === 'insert'
          ? await supabase.from('baby_events').upsert(o.row, { onConflict: 'id', ignoreDuplicates: true })
          : o.op === 'delete'
            ? await supabase.from('baby_events').delete().eq('id', o.id)
            : await supabase.from('baby_events').update(o.patch).eq('id', o.id)
      if (error) return leer().length
      guardar(leer().filter((x) => x.k !== o.k))
    }
  } finally {
    vaciando = false
  }
}

type SinClave<T> = T extends unknown ? Omit<T, 'k'> : never
function encolar(op: SinClave<Op>) {
  guardar([...leer(), { ...op, k: crypto.randomUUID() } as Op])
  void vaciarCola()
}

export function nuevo(base: Pick<BabyEvent, 'household_id' | 'person_id' | 'created_by'>, datos: Partial<BabyEvent> & { kind: Kind }): BabyEvent {
  const row: BabyEvent = {
    id: crypto.randomUUID(),
    side: null,
    ml: null,
    panal: null,
    metodo: null,
    gramos: null,
    ended_at: null,
    at: new Date().toISOString(),
    ...base,
    ...datos,
  }
  encolar({ op: 'insert', row })
  return row
}

export function borrar(id: string) {
  encolar({ op: 'delete', id })
}

export function actualizar(id: string, patch: Cambio) {
  encolar({ op: 'update', id, patch })
}

export async function cargar(personId: string, desdeHoras = 72): Promise<BabyEvent[]> {
  const desde = new Date(Date.now() - desdeHoras * 3600_000).toISOString()
  const { data } = await supabase
    .from('baby_events')
    .select('id, household_id, person_id, kind, side, ml, panal, metodo, gramos, at, ended_at, created_by')
    .eq('person_id', personId)
    .gte('at', desde)
    .order('at', { ascending: false })
  return (data ?? []) as BabyEvent[]
}

export function escuchar(personId: string, alCambiar: () => void, canalNombre = 'principal') {
  const canal = supabase
    .channel(`bebe-${personId}-${canalNombre}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'baby_events', filter: `person_id=eq.${personId}` }, alCambiar)
    .subscribe()
  return () => {
    void supabase.removeChannel(canal)
  }
}

// ——— Formatos ———
export const hora = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

export function hace(iso: string, ahora = Date.now()) {
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'Ahora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h} h ${String(m).padStart(2, '0')}`
}

export function edad(birthIso: string, ahora = Date.now()) {
  const h = Math.floor((ahora - new Date(birthIso).getTime()) / 3600_000)
  if (h < 48) return `${h} horas`
  const d = Math.floor(h / 24)
  if (d < 60) return `${d} días`
  return `${Math.floor(d / 7)} semanas`
}

export function minutos(desde: string, hasta: string | number) {
  const fin = typeof hasta === 'number' ? hasta : new Date(hasta).getTime()
  return Math.max(0, Math.round((fin - new Date(desde).getTime()) / 60000))
}

export function cronometro(desde: string, ahora: number) {
  const s = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Toma de pecho empezada y sin terminar (máximo 90 min: después se da por olvidada). */
export function enCurso(e: BabyEvent | undefined, ahora: number) {
  return !!e && esPecho(e) && !e.ended_at && ahora - new Date(e.at).getTime() < 90 * 60000
}

export const esPecho = (e: BabyEvent) => e.kind === 'toma' && (e.side === 'izq' || e.side === 'dcho')

const nombreMetodo: Record<Metodo, string> = { jeringa: 'jeringa y dedo', biberon: 'biberón', vasito: 'vasito' }
export const textoMetodo = (m: Metodo) => nombreMetodo[m]

export const kilos = (g: number) => (g / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg'

/** Día natural en Canarias, para agrupar ("2026-11-14"). */
export const dia = (iso: string | number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

/** "hoy 07:10", "ayer 07:10" o "12/11 07:10". */
export function cuando(iso: string, ahora = Date.now()) {
  const d = dia(iso)
  if (d === dia(ahora)) return `hoy ${hora(iso)}`
  if (d === dia(ahora - 86400_000)) return `ayer ${hora(iso)}`
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${hora(iso)}`
}

export function etiqueta(e: BabyEvent) {
  if (e.kind === 'peso') return `Peso · ${e.gramos ? kilos(e.gramos) : '?'}`
  if (e.kind === 'extraccion') {
    const lado = e.side === 'izq' ? 'izquierdo' : e.side === 'dcho' ? 'derecho' : 'los dos'
    return `Sacaleches · ${lado}${e.ml ? ` · ${e.ml} ml` : ''}`
  }
  if (e.kind === 'toma') {
    if (e.side === 'bib') return `Fórmula · ${e.ml ?? '?'} ml`
    if (e.side === 'extraida') return `Leche de mamá · ${e.ml ?? '?'} ml${e.metodo ? ` · ${nombreMetodo[e.metodo]}` : ''}`
    const lado = e.side === 'izq' ? 'Pecho izquierdo' : 'Pecho derecho'
    return e.ended_at ? `${lado} · ${minutos(e.at, e.ended_at)} min` : lado
  }
  if (e.kind === 'panal') return e.panal === 'pipi' ? 'Pañal · pipí' : e.panal === 'caca' ? 'Pañal · caca' : 'Pañal · pipí y caca'
  return e.kind === 'dormido' ? 'Se durmió' : 'Se despertó'
}
