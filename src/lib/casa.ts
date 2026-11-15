import { supabase } from './supabase'

export type Lugar = 'nevera' | 'congelador' | 'despensa'
export const LUGARES: Lugar[] = ['nevera', 'congelador', 'despensa']
export type Cosa = {
  id: string
  nombre: string
  producto_id: string | null
  unidad: string
  cantidad: number
  efectiva: number
  por_envase: number
  consumo_dia: number
  minimo: number
  reserva: boolean
  lugar: Lugar
  dias_restantes: number | null
}
export type Sugerencia = { texto: string; producto_id: string | null; veces: number; cada_dias: number; ultima: string; toca: boolean }
export type Repuesto = { texto: string; cantidad: number; motivo: string }

const num = (x: unknown) => Number(x ?? 0)

export async function cargarInventario(): Promise<Cosa[]> {
  const { data, error } = await supabase.rpc('inventario_estado')
  if (error) throw error
  return ((data ?? []) as Cosa[]).map((c) => ({
    ...c,
    cantidad: num(c.cantidad), efectiva: num(c.efectiva), por_envase: num(c.por_envase),
    consumo_dia: num(c.consumo_dia), minimo: num(c.minimo), dias_restantes: c.dias_restantes == null ? null : num(c.dias_restantes),
  }))
}

export async function cargarSugerencias(): Promise<Sugerencia[]> {
  const { data } = await supabase.rpc('compras_sugeridas')
  return ((data ?? []) as Sugerencia[]).map((s) => ({ ...s, cada_dias: num(s.cada_dias) }))
}

// Fija lo que hay ahora (a partir de aquí se descuenta el consumo diario).
export async function fijarCantidad(id: string, cantidad: number) {
  const { error } = await supabase.from('inventario').update({ cantidad: Math.max(0, Math.round(cantidad * 100) / 100), actualizado_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export type Cambios = Partial<Pick<Cosa, 'nombre' | 'producto_id' | 'unidad' | 'por_envase' | 'consumo_dia' | 'minimo' | 'reserva' | 'lugar'>> & { cantidad?: number }
export async function guardarCosa(id: string | null, c: Cambios) {
  const fila = { ...c, ...(c.cantidad != null ? { actualizado_at: new Date().toISOString() } : {}) }
  const { error } = id ? await supabase.from('inventario').update(fila).eq('id', id) : await supabase.from('inventario').insert(fila)
  if (error) throw error
}

export async function borrarCosa(id: string) {
  const { error } = await supabase.from('inventario').delete().eq('id', id)
  if (error) throw error
}

// Añade a la lista lo que va a faltar esta semana (reserva, consumo diario y lo que soléis comprar y ya toca).
export async function reponer(dias = 7): Promise<Repuesto[]> {
  const { data, error } = await supabase.rpc('reponer', { p_dias: dias, p_habituales: true })
  if (error) throw error
  return (data ?? []) as Repuesto[]
}

export async function anadirALista(texto: string, productoId: string | null) {
  const { error } = await supabase.from('lista_items').insert({ texto: texto.slice(0, 120), producto_id: productoId })
  if (error) throw error
}

// Formato corto: 3,5 briks
export function cuanto(c: Pick<Cosa, 'efectiva' | 'unidad'>) {
  const n = Math.round(c.efectiva * 10) / 10
  const plural = n === 1 ? c.unidad : c.unidad.endsWith('s') ? c.unidad : `${c.unidad}${/[aeiou]$/.test(c.unidad) ? 's' : 'es'}`
  return `${n.toLocaleString('es-ES')} ${plural}`
}

// Lo que ya está en la lista sin comprar, para no ofrecer «A la lista» dos veces.
export async function pendientesEnLista(): Promise<{ productos: Set<string>; textos: Set<string> }> {
  const { data } = await supabase.from('lista_items').select('texto, producto_id, alternativa_id').is('comprado_at', null)
  const filas = (data ?? []) as { texto: string; producto_id: string | null; alternativa_id: string | null }[]
  return {
    productos: new Set(filas.flatMap((f) => [f.producto_id, f.alternativa_id]).filter(Boolean) as string[]),
    textos: new Set(filas.map((f) => f.texto.toLowerCase())),
  }
}
