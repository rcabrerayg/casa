import { supabase } from './supabase'

export type Super = 'mercadona' | 'hiperdino'
export const SUPERS: Super[] = ['mercadona', 'hiperdino']
export const NOMBRE: Record<Super, string> = { mercadona: 'Mercadona', hiperdino: 'HiperDino' }

export type Producto = {
  id: string
  super: Super
  nombre: string
  formato: string | null
  imagen: string | null
  precio: number
  precio_unidad: number | null
  unidad: string | null
  precio_antes: number | null
  visto_at?: string
}

export type Item = {
  id: string
  texto: string
  cantidad: number
  producto_id: string | null
  alternativa_id: string | null
  super_fijo: Super | null
  comprado_at: string | null
  created_at: string
}

const CAMPOS = 'id, super, nombre, formato, imagen, precio, precio_unidad, unidad, precio_antes, visto_at'

export async function buscar(q: string, superFiltro: Super | null = null): Promise<Producto[]> {
  const { data, error } = await supabase.rpc('buscar_productos', { q, p_super: superFiltro })
  if (error) throw error
  return (data ?? []) as Producto[]
}

export async function ofertas(): Promise<Producto[]> {
  const { data, error } = await supabase
    .from('productos')
    .select(CAMPOS)
    .eq('activo', true)
    .not('precio_antes', 'is', null)
    .limit(400)
  if (error) throw error
  const desc = (p: Producto) => (p.precio_antes! - p.precio) / p.precio_antes!
  return ((data ?? []) as Producto[]).sort((a, b) => desc(b) - desc(a)).slice(0, 80)
}

export async function equivalente(productoId: string): Promise<Producto | null> {
  const { data } = await supabase.rpc('equivalentes', { p_producto: productoId })
  const top = (data ?? [])[0] as (Producto & { parecido: number }) | undefined
  return top && top.parecido >= 0.3 ? top : null
}

export async function cargarLista(): Promise<{ items: Item[]; productos: Map<string, Producto> }> {
  const { data, error } = await supabase
    .from('lista_items')
    .select('id, texto, cantidad, producto_id, alternativa_id, super_fijo, comprado_at, created_at')
    .order('created_at')
  if (error) throw error
  const items = (data ?? []) as Item[]
  const ids = [...new Set(items.flatMap((i) => [i.producto_id, i.alternativa_id]).filter(Boolean))] as string[]
  const productos = new Map<string, Producto>()
  if (ids.length) {
    const { data: ps } = await supabase.from('productos').select(CAMPOS).in('id', ids)
    for (const p of (ps ?? []) as Producto[]) productos.set(p.id, p)
  }
  return { items, productos }
}

export function escucharLista(householdId: string, alCambiar: () => void, nombre = 'principal') {
  // Al pasar un menú a la lista llegan decenas de cambios seguidos: se recarga una sola vez al final.
  let t: ReturnType<typeof setTimeout> | undefined
  const avisar = () => {
    clearTimeout(t)
    t = setTimeout(alCambiar, 400)
  }
  const canal = supabase
    .channel(`lista-${householdId}-${nombre}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lista_items', filter: `household_id=eq.${householdId}` }, avisar)
    .subscribe()
  return () => {
    clearTimeout(t)
    void supabase.removeChannel(canal)
  }
}

// ——— Reparto ———
export type Linea = {
  item: Item
  super: Super | null // null = sin precio conocido
  producto: Producto | null
  precios: Partial<Record<Super, Producto>>
  ahorro: number // frente a la otra opción, por la cantidad
}

export function opciones(item: Item, productos: Map<string, Producto>) {
  const precios: Partial<Record<Super, Producto>> = {}
  for (const id of [item.producto_id, item.alternativa_id]) {
    const p = id ? productos.get(id) : undefined
    if (p) precios[p.super] = p
  }
  return precios
}

// Compara por precio por kilo/litro si ambos lo tienen en la misma unidad; si no, por precio del envase.
function masBarato(a: Producto, b: Producto): Producto {
  if (a.precio_unidad && b.precio_unidad && a.unidad && a.unidad === b.unidad) return a.precio_unidad <= b.precio_unidad ? a : b
  return a.precio <= b.precio ? a : b
}

export function repartir(items: Item[], productos: Map<string, Producto>): Linea[] {
  return items.map((item) => {
    const precios = opciones(item, productos)
    const m = precios.mercadona
    const h = precios.hiperdino
    let elegido: Producto | null = null
    if (item.super_fijo) elegido = precios[item.super_fijo] ?? null
    else if (m && h) {
      // Si los envases no se parecen (p. ej. 1 kg frente a 10 kg), manda el producto elegido, no la pareja encontrada.
      const parecen = m.precio < h.precio * 3 && h.precio < m.precio * 3
      elegido = parecen ? masBarato(m, h) : (productos.get(item.producto_id ?? '') ?? masBarato(m, h))
    }
    else elegido = m ?? h ?? null
    const otro = elegido && (elegido.super === 'mercadona' ? h : m)
    // Envases muy distintos (una patata frente a un saco) no se comparan: el «ahorro» sería engañoso.
    const parecidos = !!elegido && !!otro && otro.precio < elegido.precio * 3 && elegido.precio < otro.precio * 3
    const ahorro = elegido && otro && parecidos && !item.super_fijo ? Math.max(0, otro.precio - elegido.precio) * item.cantidad : 0
    return { item, super: item.super_fijo ?? elegido?.super ?? null, producto: elegido, precios, ahorro }
  })
}

export const euros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export function textoLista(lineas: Linea[]) {
  const grupos: [string, Linea[]][] = [
    ...SUPERS.map((s) => [NOMBRE[s], lineas.filter((l) => l.super === s)] as [string, Linea[]]),
    ['Donde sea', lineas.filter((l) => !l.super)],
  ]
  const out: string[] = ['Lista de la compra']
  for (const [nombre, ls] of grupos) {
    if (!ls.length) continue
    const total = ls.reduce((s, l) => s + (l.producto ? l.producto.precio * l.item.cantidad : 0), 0)
    out.push('', `${nombre.toUpperCase()}${total ? ` · ${euros(total)}` : ''}`)
    for (const l of ls) out.push(`☐ ${l.item.cantidad > 1 ? `${l.item.cantidad} × ` : ''}${l.producto?.nombre ?? l.item.texto}`)
  }
  return out.join('\n')
}
