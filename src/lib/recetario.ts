import { sincronizar } from './semana'
import { supabase } from './supabase'

export type Receta = {
  id: string
  slug: string
  titulo: string
  cocina: string
  momento: 'almuerzo' | 'cena'
  raciones: number
  minutos: number
  aparato: string
  etiquetas: string[]
  ingredientes: string[]
  pasos: string[]
  truco: string
  conservacion: string
  sobras: boolean
  congela: boolean
  coste: 'barato' | 'medio' | 'oferta'
}
export type Precio = { coste: number; en_oferta: boolean; ofertas: string[] }

const COLUMNAS = 'id, slug, titulo, cocina, momento, raciones, minutos, aparato, etiquetas, ingredientes, pasos, truco, conservacion, sobras, congela, coste'

export async function cargarRecetario() {
  const [{ data: recetas, error }, { data: favs }, { data: precios }] = await Promise.all([
    supabase.from('recetario').select(COLUMNAS).order('titulo'),
    supabase.from('recetario_favoritos').select('receta_id'),
    supabase.rpc('recetario_costes'),
  ])
  if (error) throw error
  return {
    recetas: (recetas ?? []) as Receta[],
    favoritos: new Set((favs ?? []).map((f) => f.receta_id as string)),
    precios: new Map(((precios ?? []) as (Precio & { slug: string })[]).map((p) => [p.slug, { ...p, coste: Number(p.coste) }])),
  }
}

export async function marcarFavorito(recetaId: string, si: boolean) {
  const { error } = si
    ? await supabase.from('recetario_favoritos').upsert({ receta_id: recetaId })
    : await supabase.from('recetario_favoritos').delete().eq('receta_id', recetaId)
  if (error) throw error
}

export async function ponerEnMenu(menuId: string, dia: number, momento: 'almuerzo' | 'cena', slug: string) {
  const { error } = await supabase.rpc('poner_receta', { p_menu: menuId, p_dia: dia, p_momento: momento, p_slug: slug })
  if (error) throw error
  sincronizar(menuId, dia, momento)
}

// Los ingredientes que mandan en la receta, con el producto del catálogo que mejor sale, a la lista.
export async function ingredientesALista(slug: string) {
  const { data, error } = await supabase.rpc('recetario_productos', { p_slug: slug })
  if (error) throw error
  const filas = ((data ?? []) as { q: string; producto_id: string | null; nombre: string | null }[]).map((p) => ({
    texto: (p.nombre ?? p.q).slice(0, 120),
    producto_id: p.producto_id,
  }))
  if (filas.length) {
    const { error: e2 } = await supabase.from('lista_items').insert(filas)
    if (e2) throw e2
  }
  return filas.length
}
