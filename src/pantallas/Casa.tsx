import { useCallback, useEffect, useState } from 'react'
import {
  anadirALista, borrarCosa, cargarInventario, cargarSugerencias, cuanto, fijarCantidad, guardarCosa, LUGARES, reponer,
  type Cosa, type Lugar, type Repuesto, type Sugerencia,
} from '../lib/casa'

const NOMBRE_LUGAR: Record<Lugar, string> = { nevera: 'Nevera', congelador: 'Congelador', despensa: 'Despensa' }
const fecha = (iso: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(iso))
const decimal = (s: string) => Number(s.replace(',', '.'))

export default function Casa({ onIrALista }: { onIrALista: () => void }) {
  const [cosas, setCosas] = useState<Cosa[] | null>(null)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [abierta, setAbierta] = useState<string | null>(null)
  const [repuesto, setRepuesto] = useState<Repuesto[] | null>(null)
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [nueva, setNueva] = useState(false)

  const recargar = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([cargarInventario(), cargarSugerencias()])
      setCosas(c)
      setSugerencias(s)
    } catch (e) {
      setAviso((e as Error).message)
      setCosas((x) => x ?? [])
    }
  }, [])
  useEffect(() => {
    void recargar()
  }, [recargar])

  async function hacer(f: () => Promise<unknown>) {
    setAviso('')
    try {
      await f()
    } catch (e) {
      setAviso((e as Error).message)
    }
    await recargar()
  }

  async function completarLista() {
    setOcupado(true)
    setAviso('')
    try {
      setRepuesto(await reponer(7))
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  if (!cosas) return <div aria-busy="true" />
  const pronto = cosas.filter((c) => c.consumo_dia > 0 && (c.dias_restantes ?? 0) < 7)
  const toca = sugerencias.filter((s) => s.toca && !cosas.some((c) => c.producto_id && c.producto_id === s.producto_id))

  return (
    <>
      <p className="apagado sm-intro">
        Lo que hay en casa. Las recetas del menú tiran de aquí antes de comprar, y lo que se gasta a diario (la leche) se descuenta solo.
      </p>

      <section className="sp-resumen ca-resumen">
        <div>
          <p className="ceja">Para la compra</p>
          <p className="ca-frase">
            {pronto.length
              ? `${pronto.map((c) => c.nombre.toLowerCase()).join(', ')}: ${pronto.length === 1 ? 'se acaba' : 'se acaban'} esta semana.`
              : 'Nada se acaba esta semana.'}
          </p>
        </div>
        <button className="boton" onClick={() => void completarLista()} disabled={ocupado}>Completar la lista</button>
      </section>
      {repuesto && (
        <div className="bloque ca-repuesto" role="status">
          {repuesto.length ? (
            <>
              <p className="ceja">Añadido a la lista</p>
              <ul>
                {repuesto.map((r) => (
                  <li key={r.texto}>
                    {r.cantidad > 1 && <b>{r.cantidad} × </b>}
                    {r.texto} <small className="apagado">· {r.motivo}</small>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="sm-pista">No falta nada para los próximos 7 días (o ya estaba en la lista).</p>
          )}
          <button type="button" className="enlace" style={{ alignSelf: 'flex-start' }} onClick={onIrALista}>Ver la lista</button>
        </div>
      )}

      {toca.length > 0 && (
        <section className="bloque">
          <p className="ceja">Lo soléis comprar y ya toca</p>
          {toca.map((s) => (
            <div className="ca-sugerencia" key={s.texto}>
              <span className="sp-nombre">
                {s.texto}
                <small>Cada ~{Math.round(s.cada_dias)} días · la última, el {fecha(s.ultima)}</small>
              </span>
              <div className="sm-votos">
                <button type="button" className="chip-claro" onClick={() => void hacer(() => anadirALista(s.texto, s.producto_id))}>A la lista</button>
                <button
                  type="button"
                  className="chip-claro"
                  onClick={() => void hacer(() => guardarCosa(null, {
                    nombre: s.texto.slice(0, 80), producto_id: s.producto_id, unidad: 'ud', cantidad: 0, reserva: true,
                    consumo_dia: Math.round((1 / Math.max(1, s.cada_dias)) * 1000) / 1000, lugar: 'despensa',
                  }))}
                >
                  Tenerlo siempre
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {LUGARES.map((l) => {
        const del = cosas.filter((c) => c.lugar === l)
        if (!del.length) return null
        return (
          <section key={l}>
            <h2 className="ceja ca-lugar">{NOMBRE_LUGAR[l]}</h2>
            {del.map((c) => (
              <FilaCosa
                key={c.id}
                cosa={c}
                abierta={abierta === c.id}
                onAbrir={() => setAbierta(abierta === c.id ? null : c.id)}
                onCantidad={(n) => void hacer(() => fijarCantidad(c.id, n))}
                onGuardar={(cambios) => void hacer(async () => { await guardarCosa(c.id, cambios); setAbierta(null) })}
                onBorrar={() => void hacer(() => borrarCosa(c.id))}
              />
            ))}
          </section>
        )
      })}

      {aviso && <p role="status" className="aviso">{aviso}</p>}

      {nueva ? (
        <Editor
          titulo="Algo nuevo en casa"
          onCancelar={() => setNueva(false)}
          onGuardar={(c) => void hacer(async () => { await guardarCosa(null, c); setNueva(false) })}
        />
      ) : (
        <div className="sm-acciones">
          <button className="boton claro" onClick={() => setNueva(true)}>Añadir algo</button>
        </div>
      )}
    </>
  )
}

type FilaProps = {
  cosa: Cosa
  abierta: boolean
  onAbrir: () => void
  onCantidad: (n: number) => void
  onGuardar: (c: Parameters<typeof guardarCosa>[1]) => void
  onBorrar: () => void
}

function FilaCosa({ cosa: c, abierta, onAbrir, onCantidad, onGuardar, onBorrar }: FilaProps) {
  const bajo = (c.reserva || c.minimo > 0) && c.efectiva < Math.max(c.minimo, c.consumo_dia > 0 ? c.consumo_dia * 3 : 0)
  const detalle = [
    c.consumo_dia > 0 && c.dias_restantes != null ? `para ${Math.floor(c.dias_restantes)} días` : null,
    c.reserva ? 'siempre en casa' : null,
    c.efectiva === 0 ? 'no queda' : null,
  ].filter(Boolean).join(' · ')
  return (
    <div className={`sm-plato${bajo ? ' ca-bajo' : ''}`}>
      <div className="rc-cab">
        <button className="sm-plato-cab" onClick={onAbrir} aria-expanded={abierta}>
          <span className="sp-nombre">
            {c.nombre}
            <small>{[cuanto(c), detalle].filter(Boolean).join(' · ')}</small>
          </span>
        </button>
        <div className="ca-pasos" role="group" aria-label={`Cantidad de ${c.nombre}`}>
          <button type="button" aria-label="Uno menos" onClick={() => onCantidad(Math.max(0, Math.ceil(c.efectiva) - 1))} disabled={c.efectiva <= 0}>−</button>
          <button type="button" aria-label="Uno más" onClick={() => onCantidad(c.efectiva + 1)}>+</button>
        </div>
      </div>
      {abierta && (
        <div className="sm-detalle ca-detalle">
          <Editor inicial={c} onGuardar={onGuardar} onCancelar={onAbrir} onBorrar={onBorrar} />
        </div>
      )}
    </div>
  )
}

function Editor({ inicial, titulo, onGuardar, onCancelar, onBorrar }: {
  inicial?: Cosa
  titulo?: string
  onGuardar: (c: Parameters<typeof guardarCosa>[1]) => void
  onCancelar: () => void
  onBorrar?: () => void
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [cantidad, setCantidad] = useState(String(inicial ? Math.round(inicial.efectiva * 100) / 100 : 1).replace('.', ','))
  const [unidad, setUnidad] = useState(inicial?.unidad ?? 'ud')
  const [minimo, setMinimo] = useState(String(inicial?.minimo ?? 0).replace('.', ','))
  const [consumo, setConsumo] = useState(String(inicial?.consumo_dia ?? 0).replace('.', ','))
  const [porEnvase, setPorEnvase] = useState(String(inicial?.por_envase ?? 1).replace('.', ','))
  const [lugar, setLugar] = useState<Lugar>(inicial?.lugar ?? 'despensa')
  const [reserva, setReserva] = useState(inicial?.reserva ?? false)
  const valido = nombre.trim() && [cantidad, minimo, consumo, porEnvase].every((x) => Number.isFinite(decimal(x)) && decimal(x) >= 0) && decimal(porEnvase) > 0

  return (
    <form
      className="bloque ca-editor"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valido) return
        onGuardar({
          nombre: nombre.trim().slice(0, 80), unidad: unidad.trim().slice(0, 20) || 'ud', lugar, reserva,
          minimo: decimal(minimo), consumo_dia: decimal(consumo), por_envase: decimal(porEnvase),
          ...(!inicial || decimal(cantidad) !== Math.round(inicial.efectiva * 100) / 100 ? { cantidad: decimal(cantidad) } : {}),
        })
      }}
    >
      {titulo && <p className="ceja">{titulo}</p>}
      <label className="campo">
        <span className="etiqueta">Qué es</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Leche semidesnatada" required />
      </label>
      <div className="sm-dos">
        <label className="campo">
          <span className="etiqueta">Cuánto hay</span>
          <input inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </label>
        <label className="campo">
          <span className="etiqueta">Unidad</span>
          <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="brik, paquete, lata…" />
        </label>
      </div>
      <div className="sm-dos">
        <label className="campo">
          <span className="etiqueta">Se gasta al día</span>
          <input inputMode="decimal" value={consumo} onChange={(e) => setConsumo(e.target.value)} />
        </label>
        <label className="campo">
          <span className="etiqueta">Mínimo en casa</span>
          <input inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </label>
      </div>
      <label className="campo">
        <span className="etiqueta">Unidades por envase al comprar (pack de 6 briks → 6)</span>
        <input inputMode="decimal" value={porEnvase} onChange={(e) => setPorEnvase(e.target.value)} />
      </label>
      <div className="opciones-chips" role="group" aria-label="Dónde">
        {LUGARES.map((l) => (
          <button key={l} type="button" className={`chip-claro${lugar === l ? ' activo' : ''}`} aria-pressed={lugar === l} onClick={() => setLugar(l)}>
            {NOMBRE_LUGAR[l]}
          </button>
        ))}
        <button type="button" className={`chip-claro${reserva ? ' activo' : ''}`} aria-pressed={reserva} onClick={() => setReserva(!reserva)}>
          Siempre en casa
        </button>
      </div>
      <div className="sm-acciones">
        <button className="boton" disabled={!valido}>Guardar</button>
        <button type="button" className="enlace" onClick={onCancelar}>Cancelar</button>
        {onBorrar && <button type="button" className="enlace ca-borrar" onClick={onBorrar}>Quitar</button>}
      </div>
    </form>
  )
}
