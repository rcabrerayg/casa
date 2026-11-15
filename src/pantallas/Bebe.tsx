import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Member } from '../lib/supabase'
import {
  actualizar, borrar, cadaSaca, cargar, conPendientes, cronometro, cuando, dia, edad, kilos, enCurso, escuchar, esPecho, etiqueta, hace, hora,
  minutos, nuevo, proxima, queFue, textoMetodo, vaciarCola, SACAR_CADA_MIN,
  type BabyEvent, type Cambio, type Metodo, type Person,
} from '../lib/bebe'
import { mensajes } from '../lib/animo'
import Hoja from '../componentes/Hoja'
import { IcoBiberon, IcoGota, IcoLuna, IcoPanal } from '../componentes/Iconos'
import Resumen from './Resumen'

export type Panel = 'comer' | 'panal' | 'sueno' | 'saca' | 'peso'
type Props = { member: Member; bebe: Person; mama: string; panelInicial?: Panel | null; onPanelAbierto?: () => void }
type Lado = 'izq' | 'dcho'

const ML_KEY = 'casa.ml'
const ML_FORMULA = 'casa.ml.formula'
const ML_SACA = 'casa.ml.saca'
const METODO = 'casa.metodo'
const leer = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const escribir = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* sin almacenamiento: se usa el valor de esta sesión */
  }
}
const leerNum = (k: string, def: number) => Number(leer(k)) || def
const nombreLado = (l: Lado) => (l === 'izq' ? 'izquierdo' : 'derecho')
const otro = (l: Lado): Lado => (l === 'izq' ? 'dcho' : 'izq')
const haceTexto = (iso: string, ahora: number) => {
  const h = hace(iso, ahora)
  return h === 'Ahora' ? 'ahora mismo' : `hace ${h}`
}
const TITULOS: Record<Panel, string> = { comer: 'Comer', panal: 'Pañal', sueno: 'Sueño', saca: 'Sacaleches', peso: 'Peso' }

function PasoMl({ etiqueta: et, valor, onCambio, nombre }: { etiqueta: string; valor: number; onCambio: (d: number) => void; nombre: string }) {
  return (
    <div className="paso-ml">
      <button aria-label={`Cinco mililitros menos ${nombre}`} onClick={() => onCambio(-5)}>−</button>
      <div className="valor" aria-live="polite">
        <span>{et}</span>
        <b>
          {valor} <small>ml</small>
        </b>
      </div>
      <button aria-label={`Cinco mililitros más ${nombre}`} onClick={() => onCambio(5)}>+</button>
    </div>
  )
}

export default function Bebe({ member, bebe, mama, panelInicial, onPanelAbierto }: Props) {
  const [servidor, setServidor] = useState<BabyEvent[]>([])
  const [ver, setVer] = useState(0)
  const [ahora, setAhora] = useState(Date.now())
  const [vista, setVista] = useState<'hoy' | 'pediatra'>('hoy')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [ml, setMl] = useState<number>(() => leerNum(ML_KEY, 15))
  const [mlFormula, setMlFormula] = useState<number>(() => leerNum(ML_FORMULA, 30))
  const [mlSaca, setMlSaca] = useState<number>(() => leerNum(ML_SACA, 20))
  const [metodo, setMetodo] = useState<Metodo>(() => (leer(METODO) as Metodo) || 'jeringa')
  const [verFormula, setVerFormula] = useState(false)
  const [aviso, setAviso] = useState<BabyEvent | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [iMsg, setIMsg] = useState(0)
  const [sinRed, setSinRed] = useState(!navigator.onLine)
  const [gramos, setGramos] = useState('')
  const [cada, setCada] = useState(SACAR_CADA_MIN)

  // Si venimos de «Ahora» con un panel pedido, se abre.
  useEffect(() => {
    if (!panelInicial) return
    setVista('hoy')
    setPanel(panelInicial)
    onPanelAbierto?.()
  }, [panelInicial, onPanelAbierto])

  const refrescar = useCallback(async () => {
    const quedan = await vaciarCola()
    setSinRed(!navigator.onLine || quedan > 0)
    setServidor(await cargar(bebe.id))
    setVer((v) => v + 1)
  }, [bebe.id])

  useEffect(() => {
    void refrescar()
    void cadaSaca(member.household_id).then(setCada)
    const parar = escuchar(bebe.id, () => void refrescar())
    const online = () => void refrescar()
    const offline = () => setSinRed(true)
    const visible = () => document.visibilityState === 'visible' && void refrescar()
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', visible)
    return () => {
      parar()
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [bebe.id, member.household_id, refrescar])

  // Lo del servidor con lo pendiente de subir aplicado encima.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eventos = useMemo(() => conPendientes(servidor), [servidor, ver])

  const tomas = eventos.filter((e) => e.kind === 'toma')
  const ultimaToma = tomas[0]
  const actual = enCurso(ultimaToma, ahora) ? ultimaToma : undefined
  const ultimoPecho = tomas.find(esPecho)
  const sugerido: Lado | null = ultimoPecho?.side === 'izq' ? 'dcho' : ultimoPecho?.side === 'dcho' ? 'izq' : null
  const sueno = eventos.find((e) => e.kind === 'dormido' || e.kind === 'despierto')
  const dormido = sueno?.kind === 'dormido'
  const prox = proxima(tomas, ahora)
  const h24 = eventos.filter((e) => ahora - new Date(e.at).getTime() < 86400_000)
  const nTomas = h24.filter((e) => e.kind === 'toma').length
  const nPanales = h24.filter((e) => e.kind === 'panal').length
  const extracciones = eventos.filter((e) => e.kind === 'extraccion')
  const ultimaExt = extracciones[0]
  const ext24 = extracciones.filter((e) => ahora - new Date(e.at).getTime() < 86400_000)
  const mlSacados = ext24.reduce((a, e) => a + (e.ml ?? 0), 0)
  const mlDados = h24.filter((e) => e.kind === 'toma' && e.side === 'extraida').reduce((a, e) => a + (e.ml ?? 0), 0)
  const tocaSacar = !!ultimaExt && minutos(ultimaExt.at, ahora) >= cada
  const esMama = member.rol === 'mama'
  const hoyDia = dia(ahora)
  const panalesHoy = eventos.filter((e) => e.kind === 'panal' && dia(e.at) === hoyDia)
  const pipisHoy = panalesHoy.filter((e) => e.panal !== 'caca').length
  const cacasHoy = panalesHoy.filter((e) => e.panal !== 'pipi').length
  const ultimaCaca = eventos.find((e) => e.kind === 'panal' && e.panal !== 'pipi')
  const pesos = eventos.filter((e) => e.kind === 'peso')

  // Cronómetro: cada segundo si hay toma en curso; si no, cada 30 s.
  useEffect(() => {
    const tic = setInterval(() => setAhora(Date.now()), actual ? 1000 : 30_000)
    return () => clearInterval(tic)
  }, [actual])

  // El aviso de "apuntado" se va solo a los 20 s.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 20_000)
    return () => clearTimeout(t)
  }, [aviso])

  const lista = mensajes({ esMama, mama, bebe: bebe.name, birthAt: bebe.birth_at, eventos, ahora })
  const msg = lista[iMsg % lista.length]

  const base = { household_id: member.household_id, person_id: bebe.id, created_by: member.user_id }
  const sincronizar = () => {
    setVer((v) => v + 1)
    setAhora(Date.now())
    navigator.vibrate?.(15)
  }

  function apuntar(datos: Partial<BabyEvent> & { kind: BabyEvent['kind'] }) {
    // Solo otra toma cierra la que está en curso; un pañal o el sueño no.
    if (actual && datos.kind === 'toma') terminar()
    const e = nuevo(base, datos)
    sincronizar()
    setPanel(null)
    setVerFormula(false)
    if (!esPecho(e)) setAviso(e)
    return e
  }

  function cambiar(e: BabyEvent, patch: Cambio) {
    actualizar(e.id, patch)
    sincronizar()
  }

  function terminar() {
    if (!actual) return
    cambiar(actual, { ended_at: new Date().toISOString() })
  }

  function cambiarPecho() {
    if (!actual || !esPecho(actual)) return
    const siguiente = otro(actual.side as Lado)
    terminar()
    nuevo(base, { kind: 'toma', side: siguiente })
    sincronizar()
  }

  function quitar(e: BabyEvent) {
    borrar(e.id)
    sincronizar()
    setAviso(null)
    setAbierto(null)
    setConfirmar(false)
  }

  function mover(e: BabyEvent, min: number) {
    const at = new Date(new Date(e.at).getTime() + min * 60000).toISOString()
    const patch: Cambio = { at }
    if (e.ended_at) patch.ended_at = new Date(new Date(e.ended_at).getTime() + min * 60000).toISOString()
    cambiar(e, patch)
    if (aviso?.id === e.id) setAviso({ ...e, ...patch })
  }

  function paso(valor: number, d: number, set: (n: number) => void, clave: string) {
    const v = Math.min(300, Math.max(5, valor + d))
    set(v)
    escribir(clave, String(v))
  }

  function elegirMetodo(m: Metodo) {
    setMetodo(m)
    escribir(METODO, m)
  }

  const cerrarPanel = useCallback(() => {
    setPanel(null)
    setVerFormula(false)
  }, [])

  return (
    <main className="pantalla" style={aviso ? { paddingBottom: 170 } : undefined}>
      <div className="cabecera">
        <p className="ceja">{bebe.name}{bebe.birth_at ? ` · ${edad(bebe.birth_at, ahora)}` : ''}</p>
        <div className="segmentado ajustado" role="tablist" aria-label="Qué ver">
          <button role="tab" aria-selected={vista === 'hoy'} onClick={() => setVista('hoy')}>Hoy</button>
          <button role="tab" aria-selected={vista === 'pediatra'} onClick={() => setVista('pediatra')}>Para el pediatra</button>
        </div>
      </div>
      {sinRed && <p className="sin-red" role="status">Sin conexión · se guarda en el móvil y se sube solo</p>}

      {vista === 'pediatra' ? (
        <Resumen bebe={bebe} />
      ) : (
        <>
          {actual && (actual.side === 'izq' || actual.side === 'dcho') ? (
            <section className="en-curso" aria-live="polite">
              <span className="ceja">Dando el pecho {nombreLado(actual.side)}</span>
              <span className="reloj">{cronometro(actual.at, ahora)}</span>
              <span style={{ fontSize: 15 }}>Empezó a las {hora(actual.at)}</span>
              <div className="dos" style={{ marginTop: 8 }}>
                <button className="boton" onClick={cambiarPecho}>
                  <small>Cambiar al</small>
                  {nombreLado(otro(actual.side))}
                </button>
                <button className="boton oscuro" onClick={() => terminar()}>
                  <small>Ya está</small>
                  Terminar toma
                </button>
              </div>
            </section>
          ) : (
            <section className="estado-bebe" aria-label="Última toma">
              <span className="reloj">{ultimaToma ? hace(ultimaToma.at, ahora) : '—'}</span>
              <span className="que">
                {ultimaToma ? `desde la última toma · ${queFue(ultimaToma)} a las ${hora(ultimaToma.at)}` : 'Toca «Comer» para apuntar la primera toma.'}
              </span>
              {(sugerido || prox) && (
                <div className="pistas">
                  {sugerido ? <span className="toca">le toca el {nombreLado(sugerido)}</span> : <span />}
                  {prox && <span>{Date.parse(prox) > ahora ? 'próxima, hacia las' : 'ya le toca, desde las'} {hora(prox)}</span>}
                </div>
              )}
            </section>
          )}

          <div className="acciones-bebe">
            <button className="accion principal" onClick={() => setPanel('comer')}>
              <IcoBiberon size={26} />
              <span>
                <b>Comer</b>
                <br />
                <small>{ultimaToma ? haceTexto(ultimaToma.at, ahora) : 'apunta la primera'}</small>
              </span>
            </button>
            <button className="accion" onClick={() => setPanel('panal')}>
              <IcoPanal />
              <span>
                <b>Pañal</b>
                <br />
                <small>{ultimaCaca ? `última caca ${haceTexto(ultimaCaca.at, ahora)}` : `${panalesHoy.length} hoy`}</small>
              </span>
            </button>
            <button className="accion" onClick={() => setPanel('sueno')}>
              <IcoLuna />
              <span>
                <b>Sueño</b>
                <br />
                <small>{sueno ? `${dormido ? 'duerme' : 'despierto'} · ${hace(sueno.at, ahora)}` : 'sin datos'}</small>
              </span>
            </button>
            <button className="accion" onClick={() => setPanel('saca')}>
              <span className="icono">
                <IcoGota />
                {tocaSacar && <span className="cuadro" aria-hidden="true" />}
              </span>
              <span>
                <b>Sacaleches</b>
                <br />
                <small>{ultimaExt ? `${esMama ? 'tú' : mama} · ${haceTexto(ultimaExt.at, ahora)}` : esMama ? 'apunta la primera' : mama}</small>
                {tocaSacar && <span className="solo-lector">, ya toca</span>}
              </span>
            </button>
          </div>

          <div className="chips">
            <button className="chip" onClick={() => setPanel('peso')}>Apuntar peso</button>
            {pesos[0]?.gramos ? <span className="nota">Último: {kilos(pesos[0].gramos)} · {cuando(pesos[0].at, ahora)}</span> : null}
          </div>

          <section className="animo" aria-live="polite">
            <p>{msg.texto}</p>
            <button className="enlace" onClick={() => setIMsg((i) => i + 1)}>Otro mensaje</button>
          </section>

          <section className="registro-lista">
            <h2 className="ceja" style={{ paddingBottom: 4 }}>
              Últimas 24 h · {nTomas} {nTomas === 1 ? 'toma' : 'tomas'} · {nPanales} {nPanales === 1 ? 'pañal' : 'pañales'}
            </h2>
            <p className="nota" style={{ marginBottom: 6 }}>Toca un apunte para cambiar la hora o borrarlo.</p>
            {h24.length === 0 && <p className="nota">Aún no hay nada apuntado.</p>}
            {h24.map((e) => (
              <div key={e.id}>
                <button
                  className="registro"
                  aria-expanded={abierto === e.id}
                  onClick={() => {
                    setAbierto(abierto === e.id ? null : e.id)
                    setConfirmar(false)
                  }}
                >
                  <span className="t">{hora(e.at)}</span>
                  <span
                    className="p"
                    aria-hidden="true"
                    style={{
                      background: e.kind === 'toma' ? 'var(--tinta)' : e.kind === 'panal' ? 'var(--tinta-3)' : e.kind === 'extraccion' ? 'var(--senal)' : e.kind === 'peso' ? '#7FD6B0' : 'transparent',
                      border: e.kind === 'dormido' || e.kind === 'despierto' ? '1px solid var(--tinta-3)' : 'none',
                    }}
                  />
                  <span style={{ flexGrow: 1 }}>
                    {etiqueta(e)}
                    {enCurso(e, ahora) ? ` · en curso (${minutos(e.at, ahora)} min)` : ''}
                  </span>
                </button>
                {abierto === e.id && (
                  <div className="editor">
                    <span className="nota">Mover la hora</span>
                    <button className="chip" onClick={() => mover(e, -15)}>−15 min</button>
                    <button className="chip" onClick={() => mover(e, -5)}>−5 min</button>
                    <button className="chip" onClick={() => mover(e, 5)}>+5 min</button>
                    <span style={{ flexGrow: 1 }} />
                    {confirmar ? (
                      <button className="chip peligro" onClick={() => quitar(e)}>Sí, borrar</button>
                    ) : (
                      <button className="chip" onClick={() => setConfirmar(true)}>Borrar</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      {panel && (
        <Hoja titulo={panel === 'saca' && !esMama ? `Sacaleches de ${mama}` : TITULOS[panel]} onCerrar={cerrarPanel}>
          {panel === 'comer' && (
            <>
              <PasoMl etiqueta="Leche de mamá" valor={ml} nombre="de leche de mamá" onCambio={(d) => paso(ml, d, setMl, ML_KEY)} />
              <div className="segmentado" role="radiogroup" aria-label="Cómo se la damos">
                {(['jeringa', 'biberon', 'vasito'] as const).map((m) => (
                  <button key={m} role="radio" aria-checked={metodo === m} onClick={() => elegirMetodo(m)}>
                    {textoMetodo(m)}
                  </button>
                ))}
              </div>
              <button className="boton senal grande" onClick={() => apuntar({ kind: 'toma', side: 'extraida', ml, metodo })}>
                Apuntar {ml} ml de leche de mamá
              </button>
              <div className="tres">
                {actual && (actual.side === 'izq' || actual.side === 'dcho') ? (
                  <>
                    <button className="tecla" onClick={() => { cambiarPecho(); cerrarPanel() }}>
                      <small>Cambiar al</small>
                      {nombreLado(otro(actual.side))}
                    </button>
                    <button className="tecla" onClick={() => { terminar(); cerrarPanel() }}>
                      <small>{cronometro(actual.at, ahora)}</small>
                      Terminar pecho
                    </button>
                  </>
                ) : (
                  (['izq', 'dcho'] as const).map((lado) => (
                    <button key={lado} className="tecla" onClick={() => apuntar({ kind: 'toma', side: lado })}>
                      Pecho {lado === 'izq' ? 'izq.' : 'dcho.'}
                      <small>{sugerido === lado ? 'le toca' : 'cronómetro'}</small>
                    </button>
                  ))
                )}
                <button className="tecla" aria-expanded={verFormula} onClick={() => setVerFormula(!verFormula)}>
                  Fórmula
                  <small>{mlFormula} ml</small>
                </button>
              </div>
              {verFormula && (
                <>
                  <PasoMl etiqueta="Fórmula" valor={mlFormula} nombre="de fórmula" onCambio={(d) => paso(mlFormula, d, setMlFormula, ML_FORMULA)} />
                  <button className="boton grande" onClick={() => apuntar({ kind: 'toma', side: 'bib', ml: mlFormula, metodo })}>
                    Apuntar {mlFormula} ml de fórmula
                  </button>
                </>
              )}
            </>
          )}

          {panel === 'panal' && (
            <>
              <div className="tres">
                <button className="tecla alta" onClick={() => apuntar({ kind: 'panal', panal: 'pipi' })}>Pipí</button>
                <button className="tecla alta" onClick={() => apuntar({ kind: 'panal', panal: 'caca' })}>Caca</button>
                <button className="tecla alta" onClick={() => apuntar({ kind: 'panal', panal: 'ambos' })}>Las dos</button>
              </div>
              <p className="nota">
                Hoy: {pipisHoy} con pipí · {cacasHoy} con caca
                {ultimaCaca ? ` · última caca ${cuando(ultimaCaca.at, ahora)}` : ''}
              </p>
            </>
          )}

          {panel === 'sueno' && (
            <>
              <p className="nota">
                {sueno ? `${dormido ? 'Duerme' : 'Despierto'} desde las ${hora(sueno.at)} · ${hace(sueno.at, ahora)}` : 'Aún no hay sueño apuntado.'}
              </p>
              <button className="tecla alta senal" onClick={() => apuntar({ kind: dormido ? 'despierto' : 'dormido' })}>
                {dormido ? 'Se ha despertado' : 'Se ha dormido'}
              </button>
            </>
          )}

          {panel === 'saca' && (
            <>
              <p className="nota">
                {ultimaExt ? `Última ${haceTexto(ultimaExt.at, ahora)} · ${ext24.length} en 24 h` : 'Aún no hay extracciones apuntadas.'}
                {mlSacados > 0 && ` · ${mlSacados} ml sacados y ${mlDados} ml dados a ${bebe.name}`}
              </p>
              {tocaSacar && (
                <p className="toca" style={{ fontSize: 19, margin: 0 }}>
                  {esMama ? 'Cuando puedas, sin prisa.' : `Buen momento para prepararle el sacaleches y un vaso de agua a ${mama}.`}
                </p>
              )}
              <PasoMl etiqueta="Sacado" valor={mlSaca} nombre="sacados" onCambio={(d) => paso(mlSaca, d, setMlSaca, ML_SACA)} />
              <div className="tres">
                <button className="tecla" onClick={() => apuntar({ kind: 'extraccion', side: 'izq', ml: mlSaca })}>Izquierdo</button>
                <button className="tecla" onClick={() => apuntar({ kind: 'extraccion', side: 'dcho', ml: mlSaca })}>Derecho</button>
                <button className="tecla senal" onClick={() => apuntar({ kind: 'extraccion', side: 'ambos', ml: mlSaca })}>Los dos</button>
              </div>
            </>
          )}

          {panel === 'peso' && (
            <form
              className="bloque"
              onSubmit={(ev) => {
                ev.preventDefault()
                const g = Math.round(Number(gramos.replace(',', '.')) * (gramos.includes(',') || gramos.includes('.') ? 1000 : 1))
                if (g >= 1000 && g <= 15000) {
                  apuntar({ kind: 'peso', gramos: g })
                  setGramos('')
                }
              }}
            >
              <label className="campo">
                <span className="etiqueta">Peso en gramos o en kilos</span>
                <input inputMode="decimal" placeholder="3250 g o 3,25 kg" value={gramos} onChange={(ev) => setGramos(ev.target.value)} />
              </label>
              <button className="boton senal grande" type="submit">Apuntar peso</button>
              {pesos.length > 0 && (
                <p className="nota">
                  Último: {kilos(pesos[0].gramos ?? 0)} · {cuando(pesos[0].at, ahora)}
                  {pesos[1] ? ` · ${(pesos[0].gramos ?? 0) - (pesos[1].gramos ?? 0) >= 0 ? '+' : ''}${(pesos[0].gramos ?? 0) - (pesos[1].gramos ?? 0)} g desde el anterior` : ''}
                </p>
              )}
            </form>
          )}
        </Hoja>
      )}

      {aviso && (
        <div className="hecho" role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <span style={{ flexGrow: 1 }}>
              <b>{etiqueta(aviso)}</b> · {hora(aviso.at)}
            </span>
            <button className="chip" aria-label="Cerrar" onClick={() => setAviso(null)}>✕</button>
          </div>
          <div className="chips">
            <span className="nota">¿Fue antes?</span>
            <button className="chip" onClick={() => mover(aviso, -5)}>−5</button>
            <button className="chip" onClick={() => mover(aviso, -15)}>−15</button>
            <button className="chip" onClick={() => mover(aviso, -30)}>−30</button>
            <span style={{ flexGrow: 1 }} />
            <button className="chip texto-senal" onClick={() => quitar(aviso)}>Deshacer</button>
          </div>
        </div>
      )}
    </main>
  )
}
