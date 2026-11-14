import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Member } from '../lib/supabase'
import {
  borrar, cargar, edad, escuchar, etiqueta, hace, hora, moverHora, nuevo, pendientes, vaciarCola,
  type BabyEvent, type Person,
} from '../lib/bebe'
import { mensajes } from '../lib/animo'

type Props = { member: Member; bebe: Person; mama: string }

const ML_KEY = 'casa.ml'

export default function Bebe({ member, bebe, mama }: Props) {
  const [servidor, setServidor] = useState<BabyEvent[]>([])
  const [locales, setLocales] = useState<BabyEvent[]>(pendientes())
  const [ahora, setAhora] = useState(Date.now())
  const [ml, setMl] = useState<number>(() => Number(localStorage.getItem(ML_KEY)) || 40)
  const [ultimoMio, setUltimoMio] = useState<BabyEvent | null>(null)
  const [iMsg, setIMsg] = useState(0)
  const [sinRed, setSinRed] = useState(!navigator.onLine)

  const refrescar = useCallback(async () => {
    const quedan = await vaciarCola()
    setLocales(pendientes())
    setSinRed(!navigator.onLine || quedan > 0)
    setServidor(await cargar(bebe.id))
  }, [bebe.id])

  useEffect(() => {
    void refrescar()
    const parar = escuchar(bebe.id, () => void refrescar())
    const tic = setInterval(() => setAhora(Date.now()), 30_000)
    const online = () => void refrescar()
    const visible = () => document.visibilityState === 'visible' && void refrescar()
    window.addEventListener('online', online)
    window.addEventListener('offline', () => setSinRed(true))
    document.addEventListener('visibilitychange', visible)
    return () => {
      parar()
      clearInterval(tic)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [bebe.id, refrescar])

  const eventos = useMemo(() => {
    const ids = new Set(servidor.map((e) => e.id))
    return [...locales.filter((e) => !ids.has(e.id)), ...servidor].sort((a, b) => b.at.localeCompare(a.at))
  }, [servidor, locales])

  const ultimaToma = eventos.find((e) => e.kind === 'toma')
  const sueno = eventos.find((e) => e.kind === 'dormido' || e.kind === 'despierto')
  const dormido = sueno?.kind === 'dormido'
  const ultimoPecho = eventos.find((e) => e.kind === 'toma' && e.side !== 'bib')
  const sugerido = ultimoPecho?.side === 'izq' ? 'dcho' : ultimoPecho?.side === 'dcho' ? 'izq' : null
  const h24 = eventos.filter((e) => ahora - new Date(e.at).getTime() < 86400_000)
  const nTomas = h24.filter((e) => e.kind === 'toma').length
  const nPanales = h24.filter((e) => e.kind === 'panal').length

  const lista = mensajes({
    esMama: member.rol === 'mama',
    mama,
    bebe: bebe.name,
    birthAt: bebe.birth_at,
    eventos,
    ahora,
  })
  const msg = lista[iMsg % lista.length]

  function apuntar(datos: Partial<BabyEvent> & { kind: BabyEvent['kind'] }) {
    const e = nuevo({ household_id: member.household_id, person_id: bebe.id, created_by: member.user_id }, datos)
    setLocales(pendientes())
    setUltimoMio(e)
    setAhora(Date.now())
    navigator.vibrate?.(15)
  }

  function deshacer() {
    if (!ultimoMio) return
    borrar(ultimoMio.id)
    setServidor((s) => s.filter((e) => e.id !== ultimoMio.id))
    setLocales(pendientes())
    setUltimoMio(null)
  }

  function antes(min: number) {
    if (!ultimoMio) return
    const at = new Date(new Date(ultimoMio.at).getTime() - min * 60000).toISOString()
    moverHora(ultimoMio.id, at)
    const movido = { ...ultimoMio, at }
    setServidor((s) => s.map((e) => (e.id === movido.id ? movido : e)))
    setLocales(pendientes())
    setUltimoMio(movido)
  }

  function cambiaMl(d: number) {
    const v = Math.min(300, Math.max(5, ml + d))
    setMl(v)
    localStorage.setItem(ML_KEY, String(v))
  }

  return (
    <div className="noche">
      <main className="pantalla" style={{ paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <p className="ceja">{bebe.name}{bebe.birth_at ? ` · ${edad(bebe.birth_at, ahora)}` : ''}</p>
          {sinRed && <p className="ceja" role="status">Sin conexión · se guarda aquí</p>}
        </div>

        <section aria-label="Última toma" style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <span className="ceja">Última toma</span>
          <span className="reloj">{ultimaToma ? hace(ultimaToma.at, ahora) : '—'}</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#A3A3AB' }}>
              {ultimaToma ? `${etiqueta(ultimaToma)} · ${hora(ultimaToma.at)}` : 'Apunta la primera toma'}
            </span>
            {sugerido && <span className="toca">le toca el {sugerido === 'izq' ? 'izquierdo' : 'derecho'}</span>}
          </div>
        </section>

        <section className="animo" aria-live="polite">
          <span className="ceja">{msg.para}</span>
          <p>{msg.texto}</p>
          <button className="otro" onClick={() => setIMsg((i) => i + 1)}>Otro mensaje</button>
        </section>

        <div className="rejilla r2">
          {(['izq', 'dcho'] as const).map((lado) => (
            <button key={lado} className={`tecla pecho${sugerido === lado ? ' sugerida' : ''}`} onClick={() => apuntar({ kind: 'toma', side: lado })}>
              <span className="marca">Le toca</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <b style={{ fontSize: 20 }}>Pecho</b>
                <span className="lado">{lado === 'izq' ? 'izquierdo' : 'derecho'}</span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="tecla estrecha" aria-label="Cinco mililitros menos" onClick={() => cambiaMl(-5)}>−</button>
          <button className="tecla" style={{ flexGrow: 1, flexDirection: 'row', alignItems: 'baseline', gap: 10 }} onClick={() => apuntar({ kind: 'toma', side: 'bib', ml })}>
            <b>Biberón</b>
            <span style={{ fontFamily: 'var(--display)', fontSize: 26 }}>{ml}</span>
            <small>ml</small>
          </button>
          <button className="tecla estrecha" aria-label="Cinco mililitros más" onClick={() => cambiaMl(5)}>+</button>
        </div>

        <div className="rejilla r3">
          <button className="tecla" onClick={() => apuntar({ kind: 'panal', panal: 'pipi' })}><small>Pañal</small><b>pipí</b></button>
          <button className="tecla" onClick={() => apuntar({ kind: 'panal', panal: 'caca' })}><small>Pañal</small><b>caca</b></button>
          <button className="tecla" onClick={() => apuntar({ kind: 'panal', panal: 'ambos' })}><small>Pañal</small><b>los dos</b></button>
        </div>

        <button className="tecla" style={{ minHeight: 60, flexDirection: 'row', gap: 10 }} onClick={() => apuntar({ kind: dormido ? 'despierto' : 'dormido' })}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
          <b>{dormido ? 'Se ha despertado' : 'Se ha dormido'}</b>
        </button>
        <p style={{ margin: 0, fontSize: 12, color: '#A3A3AB', textAlign: 'center' }}>
          {sueno ? `${dormido ? 'Duerme' : 'Despierto'} desde las ${hora(sueno.at)}` : 'Sin datos de sueño todavía'}
        </p>

        {ultimoMio && (
          <div role="status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <span style={{ fontSize: 13, color: '#A3A3AB', flexBasis: '100%' }}>Apuntado: {etiqueta(ultimoMio)} a las {hora(ultimoMio.at)}. ¿Fue antes?</span>
            <button className="chip" onClick={() => antes(5)}>−5 min</button>
            <button className="chip" onClick={() => antes(15)}>−15 min</button>
            <button className="chip" onClick={() => antes(30)}>−30 min</button>
            <button className="chip senal" onClick={deshacer}>Deshacer</button>
          </div>
        )}

        <section style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          <h2 className="ceja" style={{ paddingBottom: 6 }}>Últimas 24 h · {nTomas} {nTomas === 1 ? 'toma' : 'tomas'} · {nPanales} {nPanales === 1 ? 'pañal' : 'pañales'}</h2>
          {h24.length === 0 && <p style={{ fontSize: 14, color: '#A3A3AB' }}>Aún no hay nada apuntado.</p>}
          {h24.map((e) => (
            <div className="registro" key={e.id}>
              <span className="t">{hora(e.at)}</span>
              <span
                className="p"
                aria-hidden="true"
                style={{
                  background: e.kind === 'toma' ? '#F2F2F0' : e.kind === 'panal' ? '#6B6B73' : 'transparent',
                  border: e.kind === 'dormido' || e.kind === 'despierto' ? '1px solid #A3A3AB' : 'none',
                }}
              />
              <span style={{ fontSize: 15 }}>{etiqueta(e)}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
