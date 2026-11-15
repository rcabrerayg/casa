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
    .channel(`menus-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menus', filter: `household_id=eq.${householdId}` }, alCambiar)
    .subscribe()
  return () => {
    void supabase.removeChannel(canal)
  }
}

// Pasa la compra del menú a la lista: sustituye lo que quedara sin comprar de menús anteriores.
export async function pasarALista(menu: Menu) {
  const { error: e1 } = await supabase.from('lista_items').delete().not('menu_id', 'is', null).is('comprado_at', null)
  if (e1) throw e1
  const filas = (menu.compra ?? []).map((c) => ({
    texto: (c.producto?.nombre ?? `${c.ingrediente} (${c.cantidad})`).slice(0, 120),
    cantidad: Math.max(1, Math.min(99, c.unidades)),
    producto_id: c.producto?.id ?? null,
    super_fijo: c.por_regla && c.producto ? c.producto.super : null,
    menu_id: menu.id,
  }))
  if (filas.length) {
    const { error } = await supabase.from('lista_items').insert(filas)
    if (error) throw error
  }
  return filas.length
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
