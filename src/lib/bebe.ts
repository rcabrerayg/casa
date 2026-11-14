import { supabase } from './supabase'

export const TZ = 'Atlantic/Canary'

export type Kind = 'toma' | 'panal' | 'dormido' | 'despierto'
export type BabyEvent = {
  id: string
  household_id: string
  person_id: string
  kind: Kind
  side: 'izq' | 'dcho' | 'bib' | null
  ml: number | null
  panal: 'pipi' | 'caca' | 'ambos' | null
  at: string
  created_by: string
}
export type Person = { id: string; household_id: string; name: string; kind: 'adulto' | 'bebe'; birth_at: string | null }

type Op =
  | { op: 'insert'; row: BabyEvent }
  | { op: 'delete'; id: string }
  | { op: 'update'; id: string; at: string }

const KEY = 'casa.outbox.v1'

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

export function pendientes(): BabyEvent[] {
  return leer().flatMap((o) => (o.op === 'insert' ? [o.row] : []))
}

let vaciando = false
/** Sube lo pendiente. Lo que falla se queda para el siguiente intento. */
export async function vaciarCola(): Promise<number> {
  if (vaciando || !navigator.onLine) return leer().length
  vaciando = true
  try {
    let ops = leer()
    while (ops.length) {
      const o = ops[0]
      const { error } =
        o.op === 'insert'
          ? await supabase.from('baby_events').upsert(o.row, { onConflict: 'id', ignoreDuplicates: true })
          : o.op === 'delete'
            ? await supabase.from('baby_events').delete().eq('id', o.id)
            : await supabase.from('baby_events').update({ at: o.at }).eq('id', o.id)
      if (error) break
      ops = ops.slice(1)
      guardar(ops)
    }
    return ops.length
  } finally {
    vaciando = false
  }
}

function encolar(op: Op) {
  const ops = leer()
  // Si se borra o ajusta algo que aún no se ha subido, se resuelve en la cola.
  if (op.op === 'delete') {
    const i = ops.findIndex((o) => o.op === 'insert' && o.row.id === op.id)
    if (i >= 0) {
      ops.splice(i, 1)
      guardar(ops)
      return
    }
  }
  if (op.op === 'update') {
    const ins = ops.find((o) => o.op === 'insert' && o.row.id === op.id)
    if (ins && ins.op === 'insert') {
      ins.row.at = op.at
      guardar(ops)
      return
    }
  }
  guardar([...ops, op])
}

export function nuevo(base: Pick<BabyEvent, 'household_id' | 'person_id' | 'created_by'>, datos: Partial<BabyEvent> & { kind: Kind }): BabyEvent {
  const row: BabyEvent = {
    id: crypto.randomUUID(),
    side: null,
    ml: null,
    panal: null,
    at: new Date().toISOString(),
    ...base,
    ...datos,
  }
  encolar({ op: 'insert', row })
  void vaciarCola()
  return row
}

export function borrar(id: string) {
  encolar({ op: 'delete', id })
  void vaciarCola()
}

export function moverHora(id: string, at: string) {
  encolar({ op: 'update', id, at })
  void vaciarCola()
}

export async function cargar(personId: string, desdeHoras = 72): Promise<BabyEvent[]> {
  const desde = new Date(Date.now() - desdeHoras * 3600_000).toISOString()
  const { data } = await supabase
    .from('baby_events')
    .select('id, household_id, person_id, kind, side, ml, panal, at, created_by')
    .eq('person_id', personId)
    .gte('at', desde)
    .order('at', { ascending: false })
  return (data ?? []) as BabyEvent[]
}

export function escuchar(personId: string, alCambiar: () => void) {
  const canal = supabase
    .channel('bebe-' + personId)
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

export function etiqueta(e: BabyEvent) {
  if (e.kind === 'toma') return e.side === 'bib' ? `Biberón · ${e.ml ?? '?'} ml` : e.side === 'izq' ? 'Pecho izquierdo' : 'Pecho derecho'
  if (e.kind === 'panal') return e.panal === 'pipi' ? 'Pañal · pipí' : e.panal === 'caca' ? 'Pañal · caca' : 'Pañal · pipí y caca'
  return e.kind === 'dormido' ? 'Se durmió' : 'Se despertó'
}
