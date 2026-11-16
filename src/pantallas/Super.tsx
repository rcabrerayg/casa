import { Cargador } from '../componentes/Logo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Member } from '../lib/supabase'
import Semana from './Semana'
import { lunesDeEstaSemana, menusVigentes, sinConfirmar } from '../lib/semana'
import Recetario from './Recetario'
import { IcoVolver } from '../componentes/Iconos'
import Despensa from './Casa'
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
          <span>{comprado && '✓'}</span>
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
            <button className="chip" aria-label="Uno menos" disabled={item.cantidad <= 1} onClick={() => onCambio({ cantidad: item.cantidad - 1 })}>−</button>
            <span>{item.cantidad}</span>
            <button className="chip" aria-label="Uno más" onClick={() => onCambio({ cantidad: Math.min(99, item.cantidad + 1) })}>+</button>
          </div>
          {SUPERS.map((s) => (
            <button
              key={s}
              className={`chip${item.super_fijo === s ? ' activo' : ''}`}
              onClick={() => onCambio({ super_fijo: item.super_fijo === s ? null : s })}
              title={precios[s] ? precios[s]!.nombre : 'Sin precio en este súper'}
            >
              {NOMBRE[s]}
              {precios[s] ? ` ${euros(precios[s]!.precio)}` : ''}
            </button>
          ))}
          <button className="chip peligro" onClick={() => onCambio(null)}>Quitar</button>
        </div>
      )}
    </div>
  )
}

export type VistaComida = 'menu' | 'lista' | 'despensa'

export default function Super({ member, vistaInicial, onVistaUsada }: { member: Member; vistaInicial?: VistaComida | null; onVistaUsada?: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [cargada, setCargada] = useState(false)
  const [productos, setProductos] = useState<Map<string, Producto>>(new Map())
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [verComprados, setVerComprados] = useState(false)
  const [rebajas, setRebajas] = useState<Producto[] | null>(null)
  const [vista, setVista] = useState<VistaComida>(() => {
    try {
      const v = localStorage.getItem('casa-comida')
      return v === 'lista' || v === 'despensa' ? v : 'menu'
    } catch {
      return 'menu'
    }
  })
  const [recetario, setRecetario] = useState(false)
  // Comidas de días pasados que nadie ha confirmado: si no se cocinaron, sus ingredientes siguen en la lista.
  const [sinVer, setSinVer] = useState(0)
  useEffect(() => {
    if (vista !== 'lista') return
    void menusVigentes().then((ms) => {
      const m = ms.find((x) => x.semana === lunesDeEstaSemana())
      setSinVer(m && !m.plan?.compra_vieja ? sinConfirmar(m).length : 0)
    })
  }, [vista])
  const irA = (v: VistaComida) => {
    setVista(v)
    setRecetario(false)
    window.scrollTo(0, 0)
    try {
      localStorage.setItem('casa-comida', v)
    } catch {
      /* sin almacenamiento */
    }
  }
  useEffect(() => {
    if (!vistaInicial) return
    setVista(vistaInicial)
    try {
      localStorage.setItem('casa-comida', vistaInicial)
    } catch {
      /* sin almacenamiento */
    }
    setRecetario(false)
    onVistaUsada?.()
  }, [vistaInicial, onVistaUsada])
  const entrada = useRef<HTMLInputElement>(null)
  const probados = useRef(new Set<string>())

  const recargar = useCallback(async () => {
    try {
      const r = await cargarLista()
      setItems(r.items)
      setCargada(true)
      setProductos(r.productos)
      // Productos sin pareja en el otro súper (p. ej. añadidos antes de tener su precio): se buscan una vez.
      const sinPareja = r.items.filter((i) => i.producto_id && !i.alternativa_id && !i.comprado_at && !probados.current.has(i.id)).slice(0, 5)
      for (const i of sinPareja) {
        probados.current.add(i.id)
        const alt = await equivalente(i.producto_id!)
        if (alt) await supabase.from('lista_items').update({ alternativa_id: alt.id }).eq('id', i.id)
      }
    } catch (e) {
      setAviso((e as Error).message)
      setCargada(true)
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
    // Se guarda ya; la pareja del otro súper la busca `recargar` después (tarda unos segundos).
    const { error } = await supabase.from('lista_items').insert({ texto, producto_id: p?.id ?? null })
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
      <h1 className="titulo">Comida</h1>
      <div className="segmentado" role="tablist" aria-label="Apartados de comida">
        <button role="tab" aria-selected={vista === 'menu'} onClick={() => irA('menu')}>Menú</button>
        <button role="tab" aria-selected={vista === 'lista'} onClick={() => irA('lista')}>
          Lista{pendientes.length ? ` · ${pendientes.length}` : ''}
        </button>
        <button role="tab" aria-selected={vista === 'despensa'} onClick={() => irA('despensa')}>Despensa</button>
      </div>
      {vista === 'menu' && !recetario && (
        <>
          <Semana member={member} onIrALista={() => irA('lista')} />
          <button className="boton secundario ancho" onClick={() => { setRecetario(true); window.scrollTo(0, 0) }}>Buscar en el recetario</button>
        </>
      )}
      {vista === 'menu' && recetario && (
        <>
          <button className="volver" onClick={() => setRecetario(false)}>
            <IcoVolver />
            Volver al menú
          </button>
          <Recetario onIrALista={() => irA('lista')} onIrAlMenu={() => setRecetario(false)} />
        </>
      )}
      {vista === 'despensa' && <Despensa onIrALista={() => irA('lista')} />}
      {vista === 'lista' && (
      <>
      {sinVer > 0 && pendientes.length > 0 && (
        <section className="sm-aviso-compra" role="status">
          <p>
            {sinVer === 1 ? 'Hay una comida' : `Hay ${sinVer} comidas`} de esta semana sin confirmar. Si no se cocinó, sus ingredientes siguen en la lista: dímelo antes de comprar.
          </p>
          <button className="boton claro" onClick={() => irA('menu')}>Revisar el menú</button>
        </section>
      )}

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
          <button className="boton" onClick={() => void compartir()}>Compartir lista</button>
        </section>
      ) : cargada ? (
        <p className="apagado sm-intro">
          La lista está vacía. Escribe arriba y elige el producto: te digo dónde sale más barato.
        </p>
      ) : (
        <Cargador pantalla={false} />
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
      </>
      )}
    </main>
  )
}
