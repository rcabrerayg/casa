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
  plan: { resumen: string; dias: Dia[] } | null
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

// Lo que opináis de cada plato. El planificador lo usa para aprender.
export type Voto = 1 | -1
export async function cargarVotos(): Promise<Map<string, Voto>> {
  const { data } = await supabase.from('valoraciones').select('titulo, voto')
  return new Map((data ?? []).map((v) => [v.titulo as string, v.voto as Voto]))
}
export async function votar(titulo: string, momento: 'almuerzo' | 'cena', voto: Voto | null) {
  const { error } = voto
    ? await supabase.from('valoraciones').upsert({ titulo, momento, voto, updated_at: new Date().toISOString() })
    : await supabase.from('valoraciones').delete().eq('titulo', titulo)
  if (error) throw error
}
