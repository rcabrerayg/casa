import { useCallback, useEffect, useState } from 'react'
import type { Member } from '../lib/supabase'
import {
  APARATOS, cargarPrefs, escucharMenus, GUSTOS, guardarPrefs, pasarALista, pedirReceta, planear, PREFS_INICIALES, ultimoMenu,
  type Menu, type Plato, type Prefs, type Receta,
} from '../lib/semana'
import { euros, NOMBRE, SUPERS } from '../lib/super'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const fechaCorta = (iso: string, mas = 0) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + mas)
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)
}

function Chips({ opciones, valor, onCambio }: { opciones: string[]; valor: string[]; onCambio: (v: string[]) => void }) {
  return (
    <div className="opciones-chips">
      {opciones.map((o) => {
        const on = valor.includes(o)
        return (
          <button key={o} type="button" className={`chip-claro${on ? ' activo' : ''}`} aria-pressed={on} onClick={() => onCambio(on ? valor.filter((x) => x !== o) : [...valor, o])}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Ajustes({ inicial, onGuardado, onCancelar }: { inicial: Prefs; onGuardado: (p: Prefs) => void; onCancelar?: () => void }) {
  const [p, setP] = useState<Prefs>(inicial)
  const [reglas, setReglas] = useState(inicial.reglas.join('\n'))
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const cambia = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setP((x) => ({ ...x, [k]: v }))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError('')
    const final = { ...p, reglas: reglas.split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 12) }
    try {
      await guardarPrefs(final)
      onGuardado(final)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form className="bloque sm-ajustes" onSubmit={guardar}>
      <h2 className="ceja">Tu cocina</h2>
      <div className="sm-dos">
        <div className="campo">
          <label htmlFor="presupuesto">Presupuesto por semana (€)</label>
          <input id="presupuesto" type="number" inputMode="decimal" min={10} max={500} step={5} value={p.presupuesto} onChange={(e) => cambia('presupuesto', Number(e.target.value))} />
        </div>
        <div className="campo">
          <label htmlFor="personas">Personas que comen</label>
          <input id="personas" type="number" inputMode="numeric" min={1} max={10} value={p.personas} onChange={(e) => cambia('personas', Number(e.target.value))} />
        </div>
      </div>
      <div className="campo">
        <span className="etiqueta">Qué tenéis para cocinar</span>
        <Chips opciones={APARATOS} valor={p.electrodomesticos} onCambio={(v) => cambia('electrodomesticos', v)} />
      </div>
      <div className="campo">
        <span className="etiqueta">Qué os gusta</span>
        <Chips opciones={GUSTOS} valor={p.gustos} onCambio={(v) => cambia('gustos', v)} />
      </div>
      <div className="campo">
        <label htmlFor="evitar">Lo que no queréis comer</label>
        <input id="evitar" value={p.evitar} maxLength={500} placeholder="p. ej. coliflor, picante" onChange={(e) => cambia('evitar', e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="desayuno">El desayuno de siempre</label>
        <input id="desayuno" value={p.desayuno} maxLength={300} placeholder="p. ej. café con leche y tostadas con tomate" onChange={(e) => cambia('desayuno', e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="postcena">Después de cenar</label>
        <input id="postcena" value={p.postcena} maxLength={300} onChange={(e) => cambia('postcena', e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="reglas">Dónde compráis cada cosa (una por línea)</label>
        <textarea id="reglas" rows={3} value={reglas} onChange={(e) => setReglas(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="notas">Algo más</label>
        <textarea id="notas" rows={2} maxLength={1000} value={p.notas} placeholder="p. ej. los domingos comemos fuera; nos encanta el gofio" onChange={(e) => cambia('notas', e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="sm-acciones">
        <button className="boton" disabled={ocupado}>Guardar</button>
        {onCancelar && <button type="button" className="boton claro" onClick={onCancelar}>Cancelar</button>}
      </div>
    </form>
  )
}

function FilaPlato({ menuId, dia, momento, plato }: { menuId: string; dia: number; momento: 'almuerzo' | 'cena'; plato: Plato }) {
  const [abierto, setAbierto] = useState(false)
  const [receta, setReceta] = useState<Receta | undefined>(plato.receta)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function verPasos() {
    setCargando(true)
    setError('')
    try {
      setReceta(await pedirReceta(menuId, dia, momento))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="sm-plato">
      <button className="sm-plato-cab" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <span className="sm-momento">{momento === 'almuerzo' ? 'Almuerzo' : 'Cena'}</span>
        <span className="sp-nombre">
          {plato.titulo}
          <small>{[`${plato.minutos} min`, plato.aparato].filter(Boolean).join(' · ')}</small>
        </span>
      </button>
      {abierto && (
        <div className="sm-detalle">
          <ul>
            {plato.ingredientes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          {receta ? (
            <>
              <ol>
                {receta.pasos.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
              {receta.consejo && <p className="cursiva sm-consejo">{receta.consejo}</p>}
            </>
          ) : (
            <button className="chip-claro" onClick={() => void verPasos()} disabled={cargando}>
              {cargando ? 'Escribiendo la receta…' : 'Ver cómo se hace'}
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  )
}

export default function Semana({ member, onIrALista }: { member: Member; onIrALista: () => void }) {
  const [prefs, setPrefs] = useState<Prefs | null | undefined>(undefined)
  const [editando, setEditando] = useState(false)
  const [menu, setMenu] = useState<Menu | null | undefined>(undefined)
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verCompra, setVerCompra] = useState(false)

  const recargar = useCallback(async () => setMenu(await ultimoMenu()), [])

  useEffect(() => {
    void cargarPrefs().then(setPrefs)
    void recargar()
    return escucharMenus(member.household_id, () => void recargar())
  }, [member.household_id, recargar])

  async function nuevo() {
    setAviso('')
    setOcupado(true)
    try {
      await planear()
      await recargar()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function aLaLista() {
    if (!menu) return
    setOcupado(true)
    try {
      await pasarALista(menu)
      onIrALista()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  if (prefs === undefined || menu === undefined) return <div aria-busy="true" />

  if (!prefs || editando) {
    return (
      <>
        {!prefs && (
          <p className="apagado sm-intro">
            Dime cuánto queréis gastar y con qué cocináis, y os preparo almuerzos y cenas para toda la semana, con la compra ya hecha y repartida entre Mercadona e HiperDino.
          </p>
        )}
        <Ajustes
          inicial={prefs ?? PREFS_INICIALES}
          onGuardado={(p) => {
            setPrefs(p)
            setEditando(false)
          }}
          onCancelar={prefs ? () => setEditando(false) : undefined}
        />
      </>
    )
  }

  const generando = menu?.estado === 'generando' && Date.now() - new Date(menu.created_at).getTime() < 5 * 60_000
  const listo = menu?.estado === 'listo' && menu.plan
  const pasado = listo && menu.total != null && menu.total > prefs.presupuesto

  return (
    <>
      {generando ? (
        <section className="sm-cocinando" aria-live="polite">
          <span className="sm-punto" aria-hidden="true" />
          <p className="cursiva">{menu.paso ?? 'Preparando'}…</p>
          <small>Tarda un minuto. Puedes salir; queda guardado.</small>
        </section>
      ) : listo ? (
        <>
          <section className="sp-resumen" aria-label="Coste de la semana">
            <div>
              <p className="ceja">
                Semana del {fechaCorta(menu.semana)} al {fechaCorta(menu.semana, 6)}
              </p>
              <p className="sp-total">{euros(menu.total ?? 0)}</p>
              <p className={`sm-presupuesto${pasado ? ' pasado' : ''}`}>
                {pasado ? `${euros((menu.total ?? 0) - prefs.presupuesto)} por encima` : `de ${euros(prefs.presupuesto)}`}
              </p>
            </div>
            <button className="boton" onClick={() => void aLaLista()} disabled={ocupado}>A la lista</button>
          </section>
          <p className="cursiva sm-resumen-texto">{menu.plan!.resumen}</p>

          {menu.plan!.dias.map((d, i) => (
            <section className="sm-dia" key={i}>
              <h2 className="ceja">
                {DIAS[i]} · {fechaCorta(menu.semana, i)}
              </h2>
              <FilaPlato menuId={menu.id} dia={i} momento="almuerzo" plato={d.almuerzo} />
              <FilaPlato menuId={menu.id} dia={i} momento="cena" plato={d.cena} />
            </section>
          ))}
          <p className="apagado sm-fijos">
            Cada día, además: {prefs.desayuno || 'el desayuno de siempre'} por la mañana, y {prefs.postcena.charAt(0).toLowerCase() + prefs.postcena.slice(1)}
          </p>

          <section className="bloque">
            <button className="enlace" style={{ alignSelf: 'flex-start' }} onClick={() => setVerCompra(!verCompra)} aria-expanded={verCompra}>
              {verCompra ? 'Ocultar' : 'Ver'} la compra de la semana ({menu.compra?.length ?? 0})
            </button>
            {verCompra &&
              [...SUPERS, null].map((s) => {
                const ls = (menu.compra ?? []).filter((c) => (c.producto?.super ?? null) === s)
                if (!ls.length) return null
                return (
                  <div key={s ?? 'nada'}>
                    <h3 className="sp-grupo">
                      <span className={`sp-marca ${s ?? ''}`} aria-hidden="true" />
                      <span className="ceja">{s ? NOMBRE[s] : 'Sin precio'}</span>
                      {s && <span className="sp-subtotal">{euros(ls.reduce((t, c) => t + c.coste, 0))}</span>}
                    </h3>
                    {ls.map((c, i) => (
                      <div className="sm-compra" key={i}>
                        <span className="sp-nombre">
                          {c.unidades > 1 && <b>{c.unidades} × </b>}
                          {c.producto?.nombre ?? c.ingrediente}
                          <small>
                            {c.cantidad} · {c.uso}
                            {c.por_regla && ' · vuestra preferencia'}
                          </small>
                        </span>
                        {c.producto && <span className="sp-precio">{euros(c.coste)}</span>}
                      </div>
                    ))}
                  </div>
                )
              })}
          </section>
        </>
      ) : (
        <p className="apagado sm-intro">
          {menu?.estado === 'error' ? menu.error : 'Todo listo. Cuando quieras, preparo la semana.'}
        </p>
      )}

      {aviso && <p role="status" className="aviso">{aviso}</p>}

      {!generando && (
        <div className="sm-acciones">
          <button className={listo ? 'boton claro' : 'boton'} onClick={() => void nuevo()} disabled={ocupado}>
            {listo ? 'Hacer otra semana' : 'Preparar la semana'}
          </button>
          <button className="enlace" onClick={() => setEditando(true)}>Tu cocina y gustos</button>
        </div>
      )}
    </>
  )
}
