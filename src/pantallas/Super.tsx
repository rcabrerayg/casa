import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Member } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import {
  buscar, cargarLista, ofertas, equivalente, escucharLista, euros, NOMBRE, repartir, SUPERS, textoLista,
  type Item, type Linea, type Producto, type Super as SuperT,
} from '../lib/super'

const porUnidad = (p: Producto) => (p.precio_unidad && p.unidad ? `${euros(p.precio_unidad)}/${p.unidad}` : '')

function Resultado({ p, onElegir }: { p: Producto; onElegir: () => void }) {
  return (
    <button className="sp-resultado" onClick={onElegir}>
      <span className={`sp-marca ${p.super}`} aria-hidden="true" />
      <span className="sp-nombre">
        {p.nombre}
        <small>{[NOMBRE[p.super], p.formato, porUnidad(p)].filter(Boolean).join(' · ')}</small>
      </span>
      <span className="sp-precio">
        {euros(p.precio)}
        {p.precio_antes && (
          <s>
            {euros(p.precio_antes)} −{Math.round((1 - p.precio / p.precio_antes) * 100)}%
          </s>
        )}
      </span>
    </button>
  )
}

function Fila({ l, abierta, onAbrir, onCambio }: { l: Linea; abierta: boolean; onAbrir: () => void; onCambio: (c: Partial<Item> | null) => void }) {
  const { item, producto, precios } = l
  const otro = producto && precios[producto.super === 'mercadona' ? 'hiperdino' : 'mercadona']
  const comprado = !!item.comprado_at
  return (
    <div className={`sp-fila${comprado ? ' comprado' : ''}`}>
      <div className="sp-linea">
        <button
          className="sp-check"
          role="checkbox"
          aria-checked={comprado}
          aria-label={comprado ? `Desmarcar ${item.texto}` : `Marcar ${item.texto} como comprado`}
          onClick={() => onCambio({ comprado_at: comprado ? null : new Date().toISOString() })}
        >
          {comprado && '✓'}
        </button>
        <button className="sp-cuerpo" onClick={onAbrir} aria-expanded={abierta}>
          <span className="sp-nombre">
            {item.cantidad > 1 && <b>{item.cantidad} × </b>}
            {producto?.nombre ?? item.texto}
            {otro && !comprado && (
              <small>
                {NOMBRE[otro.super]}: {euros(otro.precio)}
                {l.ahorro > 0 && <em> · ahorras {euros(l.ahorro)}</em>}
              </small>
            )}
            {!producto && !comprado && <small>Sin precio · texto libre</small>}
          </span>
          {producto && <span className="sp-precio">{euros(producto.precio * item.cantidad)}</span>}
        </button>
      </div>
      {abierta && (
        <div className="sp-editor">
          <div className="sp-cantidad">
            <button className="chip-claro" aria-label="Uno menos" disabled={item.cantidad <= 1} onClick={() => onCambio({ cantidad: item.cantidad - 1 })}>−</button>
            <span>{item.cantidad}</span>
            <button className="chip-claro" aria-label="Uno más" onClick={() => onCambio({ cantidad: Math.min(99, item.cantidad + 1) })}>+</button>
          </div>
          {SUPERS.map((s) => (
            <button
              key={s}
              className={`chip-claro${item.super_fijo === s ? ' activo' : ''}`}
              onClick={() => onCambio({ super_fijo: item.super_fijo === s ? null : s })}
              title={precios[s] ? precios[s]!.nombre : 'Sin precio en este súper'}
            >
              {NOMBRE[s]}
              {precios[s] ? ` ${euros(precios[s]!.precio)}` : ''}
            </button>
          ))}
          <button className="chip-claro peligro" onClick={() => onCambio(null)}>Quitar</button>
        </div>
      )}
    </div>
  )
}

export default function Super({ member }: { member: Member }) {
  const [items, setItems] = useState<Item[]>([])
  const [productos, setProductos] = useState<Map<string, Producto>>(new Map())
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [verComprados, setVerComprados] = useState(false)
  const [rebajas, setRebajas] = useState<Producto[] | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const recargar = useCallback(async () => {
    try {
      const r = await cargarLista()
      setItems(r.items)
      setProductos(r.productos)
    } catch (e) {
      setAviso((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void recargar()
    return escucharLista(member.household_id, () => void recargar())
  }, [member.household_id, recargar])

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) {
      setResultados([])
      return
    }
    setBuscando(true)
    const id = setTimeout(() => {
      buscar(t)
        .then(setResultados)
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 250)
    return () => clearTimeout(id)
  }, [q])

  async function anadir(p: Producto | null) {
    const texto = (p?.nombre ?? q.trim()).slice(0, 120)
    if (!texto) return
    setQ('')
    setRebajas(null)
    setResultados([])
    entrada.current?.focus()
    const alt = p ? await equivalente(p.id) : null
    const { error } = await supabase.from('lista_items').insert({
      texto,
      producto_id: p?.id ?? null,
      alternativa_id: alt?.id ?? null,
    })
    if (error) setAviso(error.message)
    await recargar()
  }

  async function cambiar(item: Item, c: Partial<Item> | null) {
    // Optimista: se ve al momento, la base confirma después.
    setItems((xs) => (c ? xs.map((x) => (x.id === item.id ? { ...x, ...c } : x)) : xs.filter((x) => x.id !== item.id)))
    const { error } = c
      ? await supabase.from('lista_items').update({ ...c, comprado_por: 'comprado_at' in c ? (c.comprado_at ? member.user_id : null) : undefined }).eq('id', item.id)
      : await supabase.from('lista_items').delete().eq('id', item.id)
    if (error) {
      setAviso(error.message)
      void recargar()
    }
    if (!c) setAbierta(null)
  }

  async function vaciarComprados() {
    const ids = items.filter((i) => i.comprado_at).map((i) => i.id)
    setItems((xs) => xs.filter((x) => !x.comprado_at))
    if (ids.length) await supabase.from('lista_items').delete().in('id', ids)
  }

  const pendientes = useMemo(() => repartir(items.filter((i) => !i.comprado_at), productos), [items, productos])
  const comprados = useMemo(() => repartir(items.filter((i) => i.comprado_at), productos), [items, productos])

  const resumen = useMemo(() => {
    const total = pendientes.reduce((s, l) => s + (l.producto ? l.producto.precio * l.item.cantidad : 0), 0)
    // Ahorro: frente a comprar en un solo súper lo que está en los dos.
    const ambos = pendientes.filter((l) => l.precios.mercadona && l.precios.hiperdino && l.producto)
    const enUno = Math.min(
      ...SUPERS.map((s) => ambos.reduce((t, l) => t + l.precios[s]!.precio * l.item.cantidad, 0)),
    )
    const repartido = ambos.reduce((t, l) => t + l.producto!.precio * l.item.cantidad, 0)
    const vistos = [...productos.values()].map((p) => p.visto_at ?? '').sort()
    return { total, ahorro: ambos.length ? Math.max(0, enUno - repartido) : 0, actualizado: vistos.at(-1) }
  }, [pendientes, productos])

  async function compartir() {
    const texto = textoLista(pendientes)
    try {
      if (navigator.share) await navigator.share({ title: 'Lista de la compra', text: texto })
      else {
        await navigator.clipboard.writeText(texto)
        setAviso('Lista copiada. Pégala donde quieras.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(texto).catch(() => {})
        setAviso('Lista copiada. Pégala donde quieras.')
      }
    }
  }

  const grupos: [string, SuperT | null, Linea[]][] = [
    ...SUPERS.map((s) => [NOMBRE[s], s, pendientes.filter((l) => l.super === s)] as [string, SuperT, Linea[]]),
    ['Donde sea', null, pendientes.filter((l) => !l.super)],
  ]

  return (
    <main className="pantalla">
      <p className="ceja">Súper · Tenerife</p>
      <h1 className="titular">
        La compra, <span className="cursiva">repartida.</span>
      </h1>

      <div className="sp-buscar">
        <input
          ref={entrada}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) void anadir(null)
          }}
          placeholder="Añadir: leche, plátanos, pañales…"
          aria-label="Buscar producto para añadir"
          enterKeyHint="done"
        />
        {!q.trim() && (
          <button className="enlace sp-ofertas" onClick={() => (rebajas ? setRebajas(null) : void ofertas().then(setRebajas).catch((e) => setAviso(e.message)))}>
            {rebajas ? 'Cerrar ofertas' : 'Ver ofertas de hoy en los dos súper'}
          </button>
        )}
        {!q.trim() && rebajas && (
          <div className="sp-resultados">
            {rebajas.map((p) => (
              <Resultado key={p.id} p={p} onElegir={() => void anadir(p)} />
            ))}
            {!rebajas.length && <p className="sp-nota">Ahora mismo no hay ofertas registradas.</p>}
          </div>
        )}
        {q.trim().length >= 1 && (
          <div className="sp-resultados" role="listbox">
            <button className="sp-resultado libre" onClick={() => void anadir(null)}>
              <span className="sp-marca" aria-hidden="true" />
              <span className="sp-nombre">
                Añadir «{q.trim()}» tal cual
                <small>Sin precio; lo compráis donde sea</small>
              </span>
            </button>
            {resultados.map((p) => (
              <Resultado key={p.id} p={p} onElegir={() => void anadir(p)} />
            ))}
            {buscando && !resultados.length && <p className="sp-nota">Buscando…</p>}
            {!buscando && q.trim().length >= 2 && !resultados.length && <p className="sp-nota">Nada en el catálogo con eso.</p>}
          </div>
        )}
      </div>

      {aviso && (
        <p role="status" className="aviso" onClick={() => setAviso('')}>
          {aviso}
        </p>
      )}

      {pendientes.length > 0 ? (
        <section className="sp-resumen" aria-label="Total estimado">
          <div>
            <p className="ceja">Total estimado</p>
            <p className="sp-total">{euros(resumen.total)}</p>
            {resumen.ahorro > 0.009 && (
              <p className="cursiva sp-ahorro">ahorras {euros(resumen.ahorro)} repartiendo</p>
            )}
          </div>
          <button className="boton" onClick={() => void compartir()}>Compartir</button>
        </section>
      ) : (
        <p className="apagado" style={{ margin: 0, lineHeight: 1.5 }}>
          La lista está vacía. Escribe arriba y elige el producto: te digo dónde sale más barato.
        </p>
      )}

      {grupos.map(([nombre, s, ls]) =>
        ls.length ? (
          <section className="bloque" key={nombre}>
            <h2 className="sp-grupo">
              <span className={`sp-marca ${s ?? ''}`} aria-hidden="true" />
              <span className="ceja">{nombre}</span>
              {s && (
                <span className="sp-subtotal">
                  {euros(ls.reduce((t, l) => t + (l.producto ? l.producto.precio * l.item.cantidad : 0), 0))}
                </span>
              )}
            </h2>
            <div>
              {ls.map((l) => (
                <Fila
                  key={l.item.id}
                  l={l}
                  abierta={abierta === l.item.id}
                  onAbrir={() => setAbierta(abierta === l.item.id ? null : l.item.id)}
                  onCambio={(c) => void cambiar(l.item, c)}
                />
              ))}
            </div>
          </section>
        ) : null,
      )}

      {comprados.length > 0 && (
        <section className="bloque">
          <div className="sp-grupo">
            <button className="enlace" onClick={() => setVerComprados(!verComprados)} aria-expanded={verComprados}>
              {verComprados ? 'Ocultar' : 'Ver'} comprados ({comprados.length})
            </button>
            <button className="enlace" onClick={() => void vaciarComprados()}>Vaciar comprados</button>
          </div>
          {verComprados && (
            <div>
              {comprados.map((l) => (
                <Fila key={l.item.id} l={l} abierta={false} onAbrir={() => {}} onCambio={(c) => void cambiar(l.item, c)} />
              ))}
            </div>
          )}
        </section>
      )}

      {resumen.actualizado && (
        <p className="sp-nota">
          Precios de Mercadona (CP 38107) e HiperDino Tenerife, actualizados cada noche. Último:{' '}
          {new Intl.DateTimeFormat('es-ES', { timeZone: 'Atlantic/Canary', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(resumen.actualizado))}.
        </p>
      )}
    </main>
  )
}
