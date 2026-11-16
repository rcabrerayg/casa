import { supabase } from './supabase'
import type { Super } from './super'

export type Prefs = {
  household_id?: string
  presupuesto: number
  personas: number
  electrodomesticos: string[]
  gustos: string[]
  evitar: string
  notas: string
  desayuno: string
  postcena: string
  reglas: string[]
}

export const PREFS_INICIALES: Prefs = {
  presupuesto: 60,
  personas: 2,
  electrodomesticos: [],
  gustos: [],
  evitar: '',
  notas: '',
  desayuno: '',
  postcena: 'Un vaso de leche con algo dulce: galletas, magdalenas o similar.',
  reglas: ['La leche, siempre Hacendado de Mercadona.', 'La carne, casi siempre de HiperDino.'],
}

export const APARATOS = ['Vitrocerámica o inducción', 'Horno', 'Microondas', 'Freidora de aire', 'Olla a presión', 'Olla lenta', 'Robot de cocina', 'Batidora', 'Grill o sandwichera', 'Arrocera']
export const GUSTOS = ['Rápido', 'Para dejar hecho', 'De todo un poco', 'Mediterráneo', 'Italiano', 'Mexicano', 'Asiático', 'Canario', 'Legumbres', 'Pollo', 'Pescado', 'Pasta y arroz', 'Verduras', 'Guisos de cuchara', 'Ligero', 'Barato']

export type Plato = {
  titulo: string
  minutos: number
  aparato: string
  etiquetas: string[]
  ingredientes: string[]
  receta?: Receta
  recetario?: string
  /** Quién lo eligió a mano (los que propone el menú no lo llevan). */
  elegido?: { uid: string; nombre: string; rol: 'mama' | 'papa' | null; at: string }
  /** Si se comió (si) o no (se pasó a otro día o se quitó). */
  hecho?: { si: boolean; at: string; por: string }
}
export type Receta = { raciones: number; pasos: string[]; consejo: string }
export type Dia = { dia: string; almuerzo: Plato; cena: Plato }
export type LineaCompra = {
  ingrediente: string
  cantidad: string
  uso: string
  producto: { id: string; super: Super; nombre: string; formato: string | null; precio: number } | null
  unidades: number
  por_regla: boolean
  coste: number
}
export type Menu = {
  id: string
  semana: string
  estado: 'generando' | 'listo' | 'error'
  paso: string | null
  error: string | null
  plan: {
    resumen: string
    dias: Dia[]
    compra_vieja?: boolean
    cambios?: { dia: number; momento: 'almuerzo' | 'cena' }[]
    /** Platos que se quedaron sin cocinar: el menú siguiente los tiene en cuenta. */
    pendientes?: (Plato & { momento?: 'almuerzo' | 'cena' })[]
  } | null
  sincronizando_at?: string | null
  compra: LineaCompra[] | null
  total: number | null
  created_at: string
}

export async function cargarPrefs(): Promise<Prefs | null> {
  const { data } = await supabase.from('preferencias').select('*').maybeSingle()
  return data as Prefs | null
}

export async function guardarPrefs(p: Prefs) {
  const { household_id: _h, ...resto } = p
  void _h
  const { error } = await supabase.from('preferencias').upsert({ ...resto, updated_at: new Date().toISOString() })
  if (error) throw error
}

// Lunes de esta semana en Canarias (YYYY-MM-DD).
export function lunesDeEstaSemana(): string {
  const hoy = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Canary' }).format(new Date()) + 'T12:00:00Z')
  hoy.setUTCDate(hoy.getUTCDate() - ((hoy.getUTCDay() + 6) % 7))
  return hoy.toISOString().slice(0, 10)
}

const masDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const diaMes = (iso: string, mes: boolean) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', ...(mes ? { month: 'short' } : {}), timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))

// «Esta semana · 16–22 nov», «Desde mañana · 16–22 nov» o «23–29 nov»: siempre con fechas, sin ambigüedad.
export function nombreSemana(semana: string): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Canary' }).format(new Date())
  const fin = masDias(semana, 6)
  const rango = semana.slice(5, 7) === fin.slice(5, 7)
    ? `${diaMes(semana, false)}–${diaMes(fin, true)}`
    : `${diaMes(semana, true)} – ${diaMes(fin, true)}`
  if (hoy >= semana && hoy <= fin) return `Esta semana · ${rango}`
  if (semana === masDias(hoy, 1)) return `Desde mañana · ${rango}`
  return rango
}

// Los menús de esta semana en adelante (el último hecho de cada semana), por orden de semana.
// Si no hay ninguno vigente, el último que haya.
export async function menusVigentes(): Promise<Menu[]> {
  const { data } = await supabase.from('menus').select('*').gte('semana', lunesDeEstaSemana())
    .order('created_at', { ascending: false }).limit(10)
  const porSemana = new Map<string, Menu>()
  for (const m of (data ?? []) as Menu[]) if (!porSemana.has(m.semana)) porSemana.set(m.semana, m)
  if (porSemana.size) return [...porSemana.values()].sort((a, b) => a.semana.localeCompare(b.semana))
  const ultimo = await ultimoMenu()
  return ultimo ? [ultimo] : []
}

export async function ultimoMenu(): Promise<Menu | null> {
  const { data } = await supabase.from('menus').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data as Menu | null
}

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('menu', { body: cuerpo })
  if (error) {
    let msg = error.message
    try {
      const b = await (error as { context?: Response }).context?.json()
      if (b?.error) msg = b.error
    } catch {
      /* sin cuerpo */
    }
    throw new Error(msg)
  }
  return data as T
}

export const planear = () => llamar<{ id: string }>({ accion: 'planear' })
/** Pone en el menú lo que escribáis, «comemos fuera / pedimos» (fuera) o «lo que haya en casa» (sinCompra). */
export async function ponerPlato(menuId: string, dia: number, momento: 'almuerzo' | 'cena', titulo: string, o: { fuera?: boolean; sinCompra?: boolean } = {}) {
  const { error } = await supabase.rpc('poner_plato', {
    p_menu: menuId, p_dia: dia, p_momento: momento, p_titulo: titulo, p_fuera: !!o.fuera, p_sin_compra: !!o.sinCompra,
  })
  if (error) throw new Error(error.message)
  sincronizar(menuId, dia, momento)
}

/** Cambia el plato de un día por el de otro (mismo momento). La compra no cambia. */
export async function intercambiarDias(menuId: string, momento: 'almuerzo' | 'cena', dia: number, otro: number) {
  const { error } = await supabase.rpc('intercambiar_dias', { p_menu: menuId, p_momento: momento, p_dia: dia, p_otro: otro })
  if (error) throw new Error(error.message)
}

/**
 * Tras cambiar un plato: la función ajusta la compra y la lista solo con lo de ese plato, en segundo plano,
 * y avisa al otro si el cambio lo hace la mamá. No se espera: la app se entera por realtime.
 */
export function sincronizar(menuId: string, dia?: number, momento?: 'almuerzo' | 'cena') {
  void llamar({ accion: 'sincronizar', menu_id: menuId, dia, momento }).catch((e) => console.warn('sincronizar', e))
}

export type TituloReceta = { slug: string; titulo: string; momento: 'almuerzo' | 'cena'; etiquetas: string[]; minutos: number }
let titulos: Promise<TituloReceta[]> | null = null
/** Títulos del recetario para sugerir al cambiar un plato (se piden una vez). */
export function titulosRecetario() {
  titulos ??= Promise.resolve(supabase.from('recetario').select('slug, titulo, momento, etiquetas, minutos').order('titulo')).then(({ data, error }) => {
    if (error) {
      titulos = null
      throw new Error(error.message)
    }
    return (data ?? []) as TituloReceta[]
  })
  return titulos
}

/** Rehace la compra (y el total) con los platos que hay ahora en el menú. */
export const rehacerCompra = (menuId: string) => llamar<{ total: number }>({ accion: 'compra', menu_id: menuId })

export const pedirReceta = (menuId: string, dia: number, momento: 'almuerzo' | 'cena') =>
  llamar<Receta>({ accion: 'receta', menu_id: menuId, dia, momento })

export function escucharMenus(householdId: string, alCambiar: () => void) {
  const canal = supabase
    .channel(`menus-${householdId}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menus', filter: `household_id=eq.${householdId}` }, alCambiar)
    .subscribe()
  return () => {
    void supabase.removeChannel(canal)
  }
}

// Pasa la compra del menú a la lista: lo que ya hay en casa no se compra (y se descuenta del inventario),
// y sustituye lo que quedara sin comprar de menús anteriores.
export async function pasarALista(menu: Menu) {
  const { data, error } = await supabase.rpc('menu_a_lista', { p_menu: menu.id })
  if (error) throw error
  const r = (data as { anadidos: number; de_casa: string[] }[] | null)?.[0]
  return { anadidos: r?.anadidos ?? 0, deCasa: r?.de_casa ?? [] }
}

// Lo que opina cada uno de cada plato: -1 no repetir, 0 normal, 1 bien, 2 le encantó. El planificador aprende de esto.
export type Voto = -1 | 0 | 1 | 2
export const VOTOS: [Voto, string, string][] = [
  [2, '😍', 'Me encantó'],
  [1, '👍', 'Bien'],
  [0, '😐', 'Normal'],
  [-1, '👎', 'No repetir'],
]
export type Opinion = { id: string; user_id: string | null; titulo: string; momento: 'almuerzo' | 'cena' | null; voto: Voto; fuente: 'voto' | 'cambio'; created_at: string }
export async function cargarOpiniones(): Promise<Opinion[]> {
  const { data, error } = await supabase.from('opiniones').select('id, user_id, titulo, momento, voto, fuente, created_at')
    .order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data ?? []) as Opinion[]
}
/** Mis votos, por título. */
export const misVotos = (ops: Opinion[], uid: string) =>
  new Map(ops.filter((o) => o.fuente === 'voto' && o.user_id === uid).map((o) => [o.titulo, o.voto]))
export async function opinar(titulo: string, momento: 'almuerzo' | 'cena' | null, voto: Voto | null) {
  const { error } = await supabase.rpc('opinar', { p_titulo: titulo, p_momento: momento, p_voto: voto })
  if (error) throw new Error(error.message)
}
export async function olvidarOpiniones(ids: string[]) {
  const { error } = await supabase.from('opiniones').delete().in('id', ids)
  if (error) throw new Error(error.message)
}

// Antojos: lo que a alguien le apetece. El próximo menú los incluye (los de la mamá, primero).
export type Antojo = { id: string; user_id: string | null; texto: string; usado_en: string | null; created_at: string }
export async function cargarAntojos(): Promise<Antojo[]> {
  const { data, error } = await supabase.from('antojos').select('id, user_id, texto, usado_en, created_at')
    .is('usado_en', null).order('created_at')
  if (error) throw error
  return (data ?? []) as Antojo[]
}
export async function apuntarAntojo(texto: string) {
  const { error } = await supabase.from('antojos').insert({ texto: texto.trim() })
  if (error) throw new Error(error.message)
}
export async function quitarAntojo(id: string) {
  const { error } = await supabase.from('antojos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ¿Se comió lo del menú?
export const sinCocinar = (p: Plato) => p.etiquetas.includes('Fuera') || p.etiquetas.includes('Sin compra')
export async function marcarComida(menuId: string, dia: number, momento: 'almuerzo' | 'cena', si: boolean | null) {
  const { error } = await supabase.rpc('marcar_comida', { p_menu: menuId, p_dia: dia, p_momento: momento, p_si: si })
  if (error) throw new Error(error.message)
}
/** No lo comimos: «pasar» lo corre al día siguiente (la compra no cambia); «quitar» lo saca y la lista se ajusta sola. */
export async function noComimos(menuId: string, dia: number, momento: 'almuerzo' | 'cena', que: 'pasar' | 'quitar', titulo: string) {
  const { error } = await supabase.rpc('no_comimos', { p_menu: menuId, p_dia: dia, p_momento: momento, p_que: que, p_titulo: titulo })
  if (error) throw new Error(error.message)
  if (que === 'quitar') sincronizar(menuId)
}
/** Sobró: las sobras ocupan los n huecos siguientes y lo que había allí sale de la lista (queda para la semana siguiente). */
export async function haySobras(menuId: string, dia: number, momento: 'almuerzo' | 'cena', n: number) {
  const { data, error } = await supabase.rpc('hay_sobras', { p_menu: menuId, p_dia: dia, p_momento: momento, p_n: n })
  if (error) throw new Error(error.message)
  if (data) sincronizar(menuId)
  return data as number
}

/** Hora (Canarias) a partir de la cual se pregunta si se comió: 15:00 el almuerzo, 21:30 la cena. */
export function yaTocaba(semana: string, dia: number, momento: 'almuerzo' | 'cena', ahora = new Date()) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Canary' }).format(ahora)
  const d = new Date(`${semana}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dia)
  const fecha = d.toISOString().slice(0, 10)
  if (fecha !== hoy) return fecha < hoy
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Atlantic/Canary', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ahora).split(':').map(Number)
  return h * 60 + m >= (momento === 'almuerzo' ? 15 * 60 : 21 * 60 + 30)
}
/** Comidas que ya tocaban y nadie ha confirmado (las que se cocinan). */
export function sinConfirmar(menu: Menu) {
  const r: { dia: number; momento: 'almuerzo' | 'cena'; plato: Plato }[] = []
  if (menu.estado !== 'listo' || !menu.plan) return r
  menu.plan.dias.forEach((d, dia) => {
    for (const momento of ['almuerzo', 'cena'] as const) {
      const plato = d[momento]
      if (!plato.hecho && !sinCocinar(plato) && yaTocaba(menu.semana, dia, momento)) r.push({ dia, momento, plato })
    }
  })
  return r
}
