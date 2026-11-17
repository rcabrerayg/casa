import { useEffect, useState } from 'react'
import Hoja from '../componentes/Hoja'
import { supabase, type Member } from '../lib/supabase'
import {
  apuntarAntojo, cargarAntojos, cargarOpiniones, haySobras, marcarComida, noComimos, olvidarOpiniones, opinar, quitarAntojo, VOTOS,
  type Antojo, type Menu, type Opinion, type Plato, type Voto,
} from '../lib/semana'

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

type ComimosProps = {
  menu: Menu
  dia: number
  momento: 'almuerzo' | 'cena'
  plato: Plato
  voto?: Voto
  onCerrar: () => void
  onOpinado?: (titulo: string, voto: Voto | null) => void
  /** Empezar directamente en un paso (p. ej. «no» o «sobras» desde la pregunta rápida). */
  pasoInicial?: 'pregunta' | 'voto' | 'sobras' | 'no'
}

/**
 * «¿Comisteis…?»: sí → qué tal estaba y si sobró; no → qué comisteis y qué hacemos con el plato
 * (pasarlo al día siguiente o quitarlo de la lista). Si ya está marcado como comido, va directo al voto.
 */
export function Comimos({ menu, dia, momento, plato, voto, onCerrar, onOpinado, pasoInicial }: ComimosProps) {
  const [paso, setPaso] = useState<'pregunta' | 'voto' | 'sobras' | 'no'>(pasoInicial ?? (plato.hecho?.si ? 'voto' : 'pregunta'))
  const [comimos, setComimos] = useState('Sobras')
  const [otra, setOtra] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const elQue = `${momento === 'almuerzo' ? 'el almuerzo' : 'la cena'} del ${DIAS[dia]}`

  async function hacer(f: () => Promise<unknown>, siguiente?: typeof paso) {
    setOcupado(true)
    setError('')
    try {
      await f()
      if (siguiente) setPaso(siguiente)
      else onCerrar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const votar = (v: Voto) =>
    hacer(async () => {
      const nuevo = voto === v ? null : v
      await opinar(plato.titulo, momento, nuevo)
      onOpinado?.(plato.titulo, nuevo)
    }, plato.hecho?.si ? undefined : 'sobras')

  const titulo = comimos === 'Otra cosa' ? otra.trim() || 'Otra cosa' : comimos

  return (
    <Hoja titulo={paso === 'voto' ? '¿Qué tal estaba?' : paso === 'sobras' ? '¿Sobró algo?' : paso === 'no' ? '¿Y el plato?' : `¿Comisteis lo del menú?`} onCerrar={onCerrar}>
      <p className="apagado sm-hoja-sub">
        {elQue.charAt(0).toUpperCase() + elQue.slice(1)}: <b>{plato.titulo}</b>
      </p>

      {paso === 'pregunta' && (
        <div className="cm-botones">
          <button className="boton" disabled={ocupado} onClick={() => void hacer(() => marcarComida(menu.id, dia, momento, true), 'voto')}>
            Sí, lo comimos
          </button>
          <button className="boton claro" disabled={ocupado} onClick={() => setPaso('no')}>No, comimos otra cosa</button>
        </div>
      )}

      {paso === 'voto' && (
        <>
          <div className="cm-votos" role="group" aria-label="¿Qué tal estaba?">
            {VOTOS.map(([v, emoji, texto]) => (
              <button key={v} type="button" className={`cm-voto${voto === v ? ' activo' : ''}`} aria-pressed={voto === v} disabled={ocupado} onClick={() => void votar(v)}>
                <span aria-hidden="true">{emoji}</span>
                {texto}
              </button>
            ))}
          </div>
          <p className="apagado sm-pista">Cada uno vota lo suyo; el menú aprende.</p>
          {!plato.hecho?.si && (
            <button className="enlace" disabled={ocupado} onClick={() => setPaso('sobras')}>Ahora no</button>
          )}
        </>
      )}

      {paso === 'sobras' && (
        <>
          <div className="cm-botones">
            <button className="boton claro" disabled={ocupado} onClick={onCerrar}>No, nada</button>
            {[1, 2].map((n) => (
              <button key={n} className="boton claro" disabled={ocupado} onClick={() => void hacer(() => haySobras(menu.id, dia, momento, n))}>
                Para {n === 1 ? 'una comida más' : 'dos comidas más'}
              </button>
            ))}
          </div>
          <p className="apagado sm-pista">
            Lo que había en esos huecos pasa a la semana que viene.
          </p>
        </>
      )}

      {paso === 'no' && (
        <>
          <p className="ceja sm-hoja-ceja">¿Qué comisteis?</p>
          <div className="opciones-chips">
            {['Sobras', 'Comimos fuera', 'Pedimos a domicilio', 'Otra cosa'].map((c) => (
              <button key={c} type="button" className={`chip${comimos === c ? ' activo' : ''}`} aria-pressed={comimos === c} onClick={() => setComimos(c)}>
                {c}
              </button>
            ))}
          </div>
          {comimos === 'Otra cosa' && (
            <input className="entrada" value={otra} onChange={(e) => setOtra(e.target.value)} placeholder="¿Qué? (opcional)" aria-label="Qué comisteis" maxLength={100} />
          )}
          <p className="ceja sm-hoja-ceja">¿Y {plato.titulo.length > 40 ? 'el plato' : `«${plato.titulo}»`}?</p>
          <ul className="sm-sugeridas">
            <li>
              <button className="sm-sugerida" disabled={ocupado} onClick={() => void hacer(() => noComimos(menu.id, dia, momento, 'pasar', titulo))}>
                <span>Pasarlo al día siguiente</span>
                <small>Los demás se corren un día. La compra no cambia.</small>
              </button>
            </li>
            <li>
              <button className="sm-sugerida" disabled={ocupado} onClick={() => void hacer(() => noComimos(menu.id, dia, momento, 'quitar', titulo))}>
                <span>Quitarlo</span>
                <small>Sus ingredientes salen de la lista.</small>
              </button>
            </li>
          </ul>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </Hoja>
  )
}

export type Pendiente = { dia: number; momento: 'almuerzo' | 'cena'; plato: Plato }

const DE_MOMENTO = (p: Pendiente, hoy?: number) =>
  `${p.momento === 'almuerzo' ? 'Almuerzo' : 'Cena'} ${p.dia === hoy ? 'de hoy' : `del ${DIAS[p.dia]}`}`

/**
 * «¿Comisteis…?» en un toque: Sí / No en el sitio. Tras el sí, el voto (opcional) y «sobró» quedan a mano;
 * el «no» abre la hoja para decidir qué pasa con el plato. Con varias pendientes, «Sí a todas».
 */
export function PreguntaComida({ menu, p, todas, hoy, variante, voto, onOpinado, onSi, onListo }: {
  menu: Menu
  p: Pendiente
  todas?: Pendiente[]
  hoy?: number
  variante: 'tarjeta' | 'fila'
  voto?: Voto
  onOpinado?: (titulo: string, voto: Voto | null) => void
  onSi?: () => void
  onListo: () => void
}) {
  const [si, setSi] = useState(!!p.plato.hecho?.si)
  const [hoja, setHoja] = useState<'no' | 'sobras' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  async function hacer(f: () => Promise<unknown>, despues: () => void) {
    setOcupado(true)
    setError('')
    try {
      await f()
      despues()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  const comido = () => hacer(() => marcarComida(menu.id, p.dia, p.momento, true), () => { setSi(true); onSi?.() })
  const todasSi = () => hacer(async () => {
    for (const x of todas ?? []) await marcarComida(menu.id, x.dia, x.momento, true)
  }, onListo)
  const votar = (v: Voto) => hacer(async () => {
    await opinar(p.plato.titulo, p.momento, v)
    onOpinado?.(p.plato.titulo, v)
  }, onListo)
  const tarjeta = variante === 'tarjeta'

  return (
    <div className={tarjeta ? 'tarjeta cm-rapida' : 'cm-rapida en-fila'} aria-live="polite">
      {tarjeta && <span className="ceja">{DE_MOMENTO(p, hoy)}{si ? ' · comido ✓' : ''}</span>}
      {tarjeta && <span className="grande">{si ? '¿Qué tal estaba?' : `¿Comisteis ${p.plato.titulo}?`}</span>}
      {!si ? (
        <div className="cm-sino">
          <button className="boton" disabled={ocupado} onClick={() => void comido()}>Sí</button>
          <button className="boton claro" disabled={ocupado} onClick={() => setHoja('no')}>No</button>
          {todas && todas.length > 1 && (
            <button className="boton claro" disabled={ocupado} onClick={() => void todasSi()}>Sí a las {todas.length}</button>
          )}
        </div>
      ) : (
        <>
          <div className="cm-votar">
            {VOTOS.map(([v, emoji, texto]) => (
              <button key={v} className={`cm-emoji${voto === v ? ' activo' : ''}`} aria-label={texto} title={texto} aria-pressed={voto === v} disabled={ocupado} onClick={() => void votar(v)}>
                {emoji}
              </button>
            ))}
          </div>
          <div className="cm-sino">
            <button className="chip" disabled={ocupado} onClick={() => setHoja('sobras')}>Sobró algo</button>
            <button className="chip" disabled={ocupado} onClick={onListo}>Ahora no</button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
      {hoja && (
        <Comimos menu={menu} dia={p.dia} momento={p.momento} plato={p.plato} voto={voto} pasoInicial={hoja} onOpinado={onOpinado}
          onCerrar={() => { setHoja(null); onListo() }} />
      )}
    </div>
  )
}

type Persona = { user_id: string; display_name: string; rol: 'mama' | 'papa' | null }

/** «Antojos y gustos»: lo que os apetece y lo que el menú ha aprendido de cada uno. Todo se puede corregir. */
export function Gustos({ member, menu, onCerrar }: { member: Member; menu: Menu | null; onCerrar: () => void }) {
  const [antojos, setAntojos] = useState<Antojo[] | null>(null)
  const [ops, setOps] = useState<Opinion[] | null>(null)
  const [gente, setGente] = useState<Persona[]>([])
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const fallo = (e: Error) => setError(e.message)
    void cargarAntojos().then(setAntojos, fallo)
    void cargarOpiniones().then(setOps, fallo)
    void supabase.from('members').select('user_id, display_name, rol').eq('household_id', member.household_id)
      .then(({ data }) => setGente(((data ?? []) as Persona[]).sort((a, b) => Number(b.rol === 'mama') - Number(a.rol === 'mama'))))
  }, [member.household_id])

  const mama = gente.find((g) => g.rol === 'mama')
  const nombre = (uid: string | null) => (uid === member.user_id ? 'tú' : gente.find((g) => g.user_id === uid)?.display_name ?? 'alguien')

  async function apuntar(e: React.FormEvent) {
    e.preventDefault()
    if (texto.trim().length < 2) return
    try {
      await apuntarAntojo(texto)
      setTexto('')
      setAntojos(await cargarAntojos())
    } catch (err) {
      setError((err as Error).message)
    }
  }
  async function quitar(a: Antojo) {
    setAntojos((x) => x?.filter((y) => y.id !== a.id) ?? null)
    await quitarAntojo(a.id).catch((e: Error) => setError(e.message))
  }
  async function olvidar(quitadas: Opinion[]) {
    const ids = new Set(quitadas.map((o) => o.id))
    setOps((x) => x?.filter((o) => !ids.has(o.id)) ?? null)
    await olvidarOpiniones([...ids]).catch((e: Error) => setError(e.message))
  }

  // Lo que suele cambiarse (sin votos de por medio): al menos dos veces.
  const cambiados = new Map<string, Opinion[]>()
  for (const o of ops ?? []) if (o.fuente === 'cambio' && o.voto < 0) cambiados.set(o.titulo, [...(cambiados.get(o.titulo) ?? []), o])
  const suelenCambiar = [...cambiados.entries()].filter(([, l]) => l.length >= 2)
  const pendientes = menu?.plan?.pendientes ?? []

  return (
    <Hoja titulo="Antojos y gustos" onCerrar={onCerrar}>
      <p className="apagado sm-hoja-sub">
        Lo que apuntéis aquí entra en el próximo menú{mama ? `. Lo de ${mama.user_id === member.user_id ? 'ti' : mama.display_name}, primero.` : '.'}
      </p>
      <form className="cm-antojo" onSubmit={(e) => void apuntar(e)}>
        <input className="entrada" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Me apetece… (lentejas, algo con queso, sushi)" aria-label="Antojo" maxLength={120} />
        <button className="boton" disabled={texto.trim().length < 2}>Apuntar</button>
      </form>
      {antojos && antojos.length > 0 && (
        <ul className="cm-lista" aria-label="Antojos apuntados">
          {antojos.map((a) => (
            <li key={a.id}>
              <span>
                {a.texto} <small className="apagado">· {nombre(a.user_id)}</small>
              </span>
              <button className="cm-quitar" aria-label={`Quitar ${a.texto}`} onClick={() => void quitar(a)}>×</button>
            </li>
          ))}
        </ul>
      )}

      {pendientes.length > 0 && (
        <>
          <p className="ceja sm-hoja-ceja">Quedaron para la semana que viene</p>
          <p className="apagado">{pendientes.map((p) => p.titulo).join(' · ')}</p>
        </>
      )}

      <p className="ceja sm-hoja-ceja">Lo que sabemos de vosotros</p>
      {ops === null ? (
        <p className="apagado">Cargando…</p>
      ) : (
        <>
          {gente.map((g) => {
            const suyos = ops.filter((o) => o.user_id === g.user_id && o.fuente === 'voto')
            const grupos = VOTOS.filter(([v]) => v !== 0).map(([v, emoji, t]) => [emoji, t, suyos.filter((o) => o.voto === v)] as const).filter(([, , l]) => l.length)
            return (
              <div className="cm-persona" key={g.user_id}>
                <p>
                  <b>{g.user_id === member.user_id ? 'Tú' : g.display_name}</b>
                  {g.rol === 'mama' && <small className="sm-eligio mama"> · lo suyo cuenta el doble</small>}
                </p>
                {grupos.length ? grupos.map(([emoji, t, l]) => (
                  <div key={t} className="cm-grupo">
                    <span className="apagado">{emoji}{'\u00a0'}{t}</span>
                    <div className="opciones-chips">
                      {l.slice(0, 12).map((o) => (
                        <button key={o.id} type="button" className="chip cm-op" onClick={() => void olvidar([o])} aria-label={`Olvidar ${o.titulo}`}>
                          {o.titulo} <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )) : <p className="apagado">Aún nada: después de cada comida os preguntaré qué tal.</p>}
              </div>
            )
          })}
          {suelenCambiar.length > 0 && (
            <div className="cm-grupo">
              <span className="apagado">🔁 Lo cambiáis a menudo (sale menos)</span>
              <div className="opciones-chips">
                {suelenCambiar.map(([t, l]) => (
                  <button key={t} type="button" className="chip cm-op" onClick={() => void olvidar(l)} aria-label={`Olvidar ${t}`}>
                    {t} <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="apagado sm-pista">Toca un plato para que lo olvide si ya no es así.</p>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </Hoja>
  )
}
