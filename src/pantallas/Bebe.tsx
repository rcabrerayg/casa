import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Member } from '../lib/supabase'
import {
  actualizar, borrar, cargar, conPendientes, cronometro, edad, enCurso, escuchar, esPecho, etiqueta, hace, hora, minutos, nuevo, textoMetodo, vaciarCola,
  type BabyEvent, type Cambio, type Metodo, type Person,
} from '../lib/bebe'
import { mensajes } from '../lib/animo'

type Props = { member: Member; bebe: Person; mama: string }
type Lado = 'izq' | 'dcho'

const ML_KEY = 'casa.ml'
const ML_FORMULA = 'casa.ml.formula'
const ML_SACA = 'casa.ml.saca'
const METODO = 'casa.metodo'
const leerNum = (k: string, def: number) => Number(localStorage.getItem(k)) || def
const nombreLado = (l: Lado) => (l === 'izq' ? 'izquierdo' : 'derecho')
const otro = (l: Lado): Lado => (l === 'izq' ? 'dcho' : 'izq')

/** Próxima toma aproximada: media entre las últimas tomas de las últimas 24 h. */
function proxima(tomas: BabyEvent[], ahora: number) {
  const t = tomas.filter((e) => ahora - new Date(e.at).getTime() < 86400_000).map((e) => new Date(e.at).getTime())
  if (t.length < 3) return null
  const huecos = t.slice(0, -1).map((v, i) => v - t[i + 1]).filter((h) => h > 20 * 60000)
  if (huecos.length < 2) return null
  const media = huecos.reduce((a, b) => a + b, 0) / huecos.length
  return new Date(t[0] + media).toISOString()
}

export default function Bebe({ member, bebe, mama }: Props) {
  const [servidor, setServidor] = useState<BabyEvent[]>([])
  const [ver, setVer] = useState(0)
  const [ahora, setAhora] = useState(Date.now())
  const [ml, setMl] = useState<number>(() => leerNum(ML_KEY, 15))
  const [mlFormula, setMlFormula] = useState<number>(() => leerNum(ML_FORMULA, 30))
  const [mlSaca, setMlSaca] = useState<number>(() => leerNum(ML_SACA, 20))
  const [metodo, setMetodo] = useState<Metodo>(() => (localStorage.getItem(METODO) as Metodo) || 'jeringa')
  const [verFormula, setVerFormula] = useState(false)
  const [aviso, setAviso] = useState<BabyEvent | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [iMsg, setIMsg] = useState(0)
  const [sinRed, setSinRed] = useState(!navigator.onLine)

  const refrescar = useCallback(async () => {
    const quedan = await vaciarCola()
    setSinRed(!navigator.onLine || quedan > 0)
    setServidor(await cargar(bebe.id))
    setVer((v) => v + 1)
  }, [bebe.id])

  useEffect(() => {
    void refrescar()
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
  }, [bebe.id, refrescar])

  // Lo del servidor con lo pendiente de subir aplicado encima.
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
  const minDesdeExt = ultimaExt ? minutos(ultimaExt.at, ahora) : 0
  const tocaSacar = !!ultimaExt && minDesdeExt >= 210
  const esMama = member.rol === 'mama'

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

  const lista = mensajes({ esMama: member.rol === 'mama', mama, bebe: bebe.name, birthAt: bebe.birth_at, eventos, ahora })
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
    localStorage.setItem(clave, String(v))
  }

  function elegirMetodo(m: Metodo) {
    setMetodo(m)
    localStorage.setItem(METODO, m)
  }

  return (
    <main className="pantalla" style={{ paddingBottom: aviso ? 150 : 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <p className="ceja">{bebe.name}{bebe.birth_at ? ` · ${edad(bebe.birth_at, ahora)}` : ''}</p>
        {sinRed && <p className="ceja" role="status">Sin conexión · se guarda aquí</p>}
      </div>

      {actual && (actual.side === 'izq' || actual.side === 'dcho') ? (
        <section className="en-curso" aria-live="polite">
          <span className="ceja" style={{ color: '#181818' }}>Dando el pecho {nombreLado(actual.side)}</span>
          <span className="reloj" style={{ fontVariantNumeric: 'tabular-nums' }}>{cronometro(actual.at, ahora)}</span>
          <span style={{ fontSize: 13 }}>Empezó a las {hora(actual.at)}</span>
          <div className="rejilla r2" style={{ marginTop: 6 }}>
            <button className="tecla clara" onClick={cambiarPecho}>
              <small>Cambiar al</small>
              <b>{nombreLado(otro(actual.side))}</b>
            </button>
            <button className="tecla oscura" onClick={() => terminar()}>
              <small>Ya está</small>
              <b>Terminar toma</b>
            </button>
          </div>
        </section>
      ) : (
        <section aria-label="Última toma" style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <span className="ceja">Desde la última toma</span>
          <span className="reloj">{ultimaToma ? hace(ultimaToma.at, ahora) : '—'}</span>
          <span style={{ fontSize: 13, color: '#A3A3AB' }}>
            {ultimaToma ? `${etiqueta(ultimaToma)} · a las ${hora(ultimaToma.at)}` : 'Toca un pecho o «Leche de mamá» para apuntar la primera toma.'}
          </span>
          {(sugerido || prox) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
              {sugerido ? <span className="toca">le toca el {nombreLado(sugerido)}</span> : <span />}
              {prox && <span style={{ fontSize: 13, color: '#A3A3AB' }}>próxima, hacia las {hora(prox)}</span>}
            </div>
          )}
        </section>
      )}

      <section className="animo" aria-live="polite">
        <span className="ceja">{msg.para}</span>
        <p>{msg.texto}</p>
        <button className="otro" onClick={() => setIMsg((i) => i + 1)}>Otro mensaje</button>
      </section>

      <h2 className="ceja seccion">Comer</h2>
      {!actual && (
        <div className="rejilla r2">
          {(['izq', 'dcho'] as const).map((lado) => (
            <button key={lado} className={`tecla pecho${sugerido === lado ? ' sugerida' : ''}`} onClick={() => apuntar({ kind: 'toma', side: lado })}>
              <span className="marca">Le toca</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <b style={{ fontSize: 20 }}>Pecho</b>
                <span className="lado">{nombreLado(lado)}</span>
                <small style={{ marginTop: 6, color: 'inherit', opacity: 0.7 }}>toca para empezar</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="tecla estrecha" aria-label="Cinco mililitros menos" onClick={() => paso(ml, -5, setMl, ML_KEY)}>−</button>
        <button className="tecla" style={{ flexGrow: 1, gap: 2 }} onClick={() => apuntar({ kind: 'toma', side: 'extraida', ml, metodo })}>
          <small>Leche de mamá · {textoMetodo(metodo)}</small>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: 28 }}>{ml}</span>
            <small>ml</small>
          </span>
        </button>
        <button className="tecla estrecha" aria-label="Cinco mililitros más" onClick={() => paso(ml, 5, setMl, ML_KEY)}>+</button>
      </div>
      <div className="segmentos" role="radiogroup" aria-label="Cómo se la damos">
        {(['jeringa', 'biberon', 'vasito'] as const).map((m) => (
          <button key={m} role="radio" aria-checked={metodo === m} className={metodo === m ? 'activo' : undefined} onClick={() => elegirMetodo(m)}>
            {textoMetodo(m)}
          </button>
        ))}
      </div>
      {verFormula ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="tecla estrecha" aria-label="Cinco mililitros menos de fórmula" onClick={() => paso(mlFormula, -5, setMlFormula, ML_FORMULA)}>−</button>
          <button className="tecla" style={{ flexGrow: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10 }} onClick={() => apuntar({ kind: 'toma', side: 'bib', ml: mlFormula, metodo })}>
            <b>Fórmula</b>
            <span style={{ fontFamily: 'var(--display)', fontSize: 24 }}>{mlFormula}</span>
            <small>ml</small>
          </button>
          <button className="tecla estrecha" aria-label="Cinco mililitros más de fórmula" onClick={() => paso(mlFormula, 5, setMlFormula, ML_FORMULA)}>+</button>
        </div>
      ) : (
        <button className="enlace" style={{ alignSelf: 'flex-start', minHeight: 36, padding: 0 }} onClick={() => setVerFormula(true)}>Apuntar fórmula</button>
      )}

      <h2 className="ceja seccion">Sacaleches{esMama ? '' : ` · ${mama}`}</h2>
      <section className="saca">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, color: '#A3A3AB' }}>
            {ultimaExt ? `Última hace ${hace(ultimaExt.at, ahora)} · ${ext24.length} en 24 h` : 'Aún no hay extracciones apuntadas'}
          </span>
          {mlSacados > 0 && <span style={{ fontSize: 13, color: '#A3A3AB' }}>{mlSacados} ml sacados · {mlDados} dados</span>}
        </div>
        {tocaSacar && (
          <p className="recuerdo">
            {esMama
              ? `Han pasado ${hace(ultimaExt!.at, ahora)} desde la última. Cuando puedas, sin prisa.`
              : `Han pasado ${hace(ultimaExt!.at, ahora)} desde la última extracción. Buen momento para prepararle el sacaleches y un vaso de agua a ${mama}.`}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="tecla estrecha" aria-label="Cinco mililitros menos sacados" onClick={() => paso(mlSaca, -5, setMlSaca, ML_SACA)}>−</button>
          <div className="tecla" style={{ flexGrow: 1, cursor: 'default' }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--display)', fontSize: 28 }}>{mlSaca}</span>
              <small>ml sacados</small>
            </span>
          </div>
          <button className="tecla estrecha" aria-label="Cinco mililitros más sacados" onClick={() => paso(mlSaca, 5, setMlSaca, ML_SACA)}>+</button>
        </div>
        <div className="rejilla r3">
          <button className="tecla" onClick={() => apuntar({ kind: 'extraccion', side: 'izq', ml: mlSaca })}><small>Pecho</small><b>izquierdo</b></button>
          <button className="tecla" onClick={() => apuntar({ kind: 'extraccion', side: 'dcho', ml: mlSaca })}><small>Pecho</small><b>derecho</b></button>
          <button className="tecla" onClick={() => apuntar({ kind: 'extraccion', side: 'ambos', ml: mlSaca })}><small>Pecho</small><b>los dos</b></button>
        </div>
      </section>

      <h2 className="ceja seccion">Pañal</h2>
      <div className="rejilla r3">
        <button className="tecla" onClick={() => apuntar({ kind: 'panal', panal: 'pipi' })}><b>Pipí</b></button>
        <button className="tecla" onClick={() => apuntar({ kind: 'panal', panal: 'caca' })}><b>Caca</b></button>
        <button className="tecla" onClick={() => apuntar({ kind: 'panal', panal: 'ambos' })}><b>Las dos</b></button>
      </div>

      <h2 className="ceja seccion">Sueño</h2>
      <button className="tecla" style={{ minHeight: 72, flexDirection: 'row', justifyContent: 'space-between', padding: '12px 18px' }} onClick={() => apuntar({ kind: dormido ? 'despierto' : 'dormido' })}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' }}>
          <small>{sueno ? `${dormido ? 'Duerme' : 'Despierto'} desde las ${hora(sueno.at)} · ${hace(sueno.at, ahora)}` : 'Sin datos de sueño'}</small>
          <b>{dormido ? 'Se ha despertado' : 'Se ha dormido'}</b>
        </span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
      </button>

      <section style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
        <h2 className="ceja" style={{ paddingBottom: 4 }}>
          Últimas 24 h · {nTomas} {nTomas === 1 ? 'toma' : 'tomas'} · {nPanales} {nPanales === 1 ? 'pañal' : 'pañales'}
        </h2>
        <p style={{ margin: '0 0 6px', fontSize: 12, color: '#A3A3AB' }}>Toca un apunte para cambiar la hora o borrarlo.</p>
        {h24.length === 0 && <p style={{ fontSize: 14, color: '#A3A3AB' }}>Aún no hay nada apuntado.</p>}
        {h24.map((e) => (
          <div key={e.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
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
                  background: e.kind === 'toma' ? '#F2F2F0' : e.kind === 'panal' ? '#6B6B73' : e.kind === 'extraccion' ? 'var(--senal)' : 'transparent',
                  border: e.kind === 'dormido' || e.kind === 'despierto' ? '1px solid #A3A3AB' : 'none',
                }}
              />
              <span style={{ fontSize: 15, flexGrow: 1, textAlign: 'left' }}>
                {etiqueta(e)}
                {enCurso(e, ahora) ? ` · en curso (${minutos(e.at, ahora)} min)` : ''}
              </span>
            </button>
            {abierto === e.id && (
              <div className="editor">
                <span style={{ fontSize: 13, color: '#A3A3AB', flexBasis: '100%' }}>Mover la hora</span>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#A3A3AB', alignSelf: 'center' }}>¿Fue antes?</span>
            <button className="chip" onClick={() => mover(aviso, -5)}>−5</button>
            <button className="chip" onClick={() => mover(aviso, -15)}>−15</button>
            <button className="chip" onClick={() => mover(aviso, -30)}>−30</button>
            <span style={{ flexGrow: 1 }} />
            <button className="chip senal" onClick={() => quitar(aviso)}>Deshacer</button>
          </div>
        </div>
      )}
    </main>
  )
}
