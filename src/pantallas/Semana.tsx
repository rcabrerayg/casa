import { Cargador } from '../componentes/Logo'
import Hoja from '../componentes/Hoja'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Member } from '../lib/supabase'
import {
  VOTOS, APARATOS, cargarPrefs, sinConfirmar, cargarOpiniones, escucharMenus, misVotos, sinCocinar, yaTocaba, GUSTOS, guardarPrefs, pasarALista, pedirReceta, planear, PREFS_INICIALES, lunesDeEstaSemana, menusVigentes, nombreSemana, ponerPlato, rehacerCompra, sincronizar, titulosRecetario, intercambiarDias,
  type Menu, type Plato, type Prefs, type Receta, type TituloReceta, type Voto,
} from '../lib/semana'
import { ponerEnMenu } from '../lib/recetario'
import { Gustos, PreguntaComida } from './Comimos'
import { euros, NOMBRE, SUPERS } from '../lib/super'

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Antojos: cada uno filtra el recetario por sus etiquetas.
const ANTOJOS: [string, string[]][] = [
  ['Algo rápido', ['Rápido']],
  ['Ligero', ['Ligero']],
  ['De cuchara', ['Legumbres', 'Guisos de cuchara']],
  ['Pasta o arroz', ['Pasta y arroz']],
  ['Pescado', ['Pescado']],
  ['Pollo', ['Pollo']],
  ['Verdura', ['Vegetariano', 'Verduras']],
  ['Un capricho', ['Plato de cocinero', 'Receta de la casa']],
]

type CambiarProps = { menu: Menu; dia: number; momento: 'almuerzo' | 'cena'; plato: Plato; member: Member; onCerrar: () => void }

/** «¿Qué te apetece?»: una receta del recetario, lo que escribáis, comer fuera, lo que haya en casa o cambiarlo de día. */
function CambiarPlato({ menu, dia, momento, plato, member, onCerrar }: CambiarProps) {
  const [texto, setTexto] = useState('')
  const [antojo, setAntojo] = useState<string | null>(null)
  const [recetas, setRecetas] = useState<TituloReceta[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  // Si lo eligió la mamá y ahora lo cambia otro, antes se pregunta con cariño.
  const deElla = plato.elegido?.rol === 'mama' && plato.elegido.uid !== member.user_id
  const [confirmado, setConfirmado] = useState(!deElla)
  const [deDia, setDeDia] = useState(false)

  useEffect(() => {
    titulosRecetario().then(setRecetas, (e: Error) => setError(e.message))
  }, [])

  const t = norm(texto.trim())
  const etiquetas = ANTOJOS.find(([n]) => n === antojo)?.[1]
  const sugeridas = t.length < 2 && !etiquetas ? [] : recetas
    .filter((r) => r.titulo !== plato.titulo)
    .filter((r) => t.length < 2 || t.split(/\s+/).every((w) => norm(r.titulo).includes(w)))
    .filter((r) => !etiquetas || r.etiquetas.some((e) => etiquetas.includes(e)))
    .sort((a, b) => Number(b.momento === momento) - Number(a.momento === momento) || Number(norm(b.titulo).startsWith(t)) - Number(norm(a.titulo).startsWith(t)) || a.minutos - b.minutos)
    .slice(0, etiquetas ? 6 : 5)

  async function hacer(f: () => Promise<unknown>) {
    setOcupado(true)
    setError('')
    try {
      await f()
      onCerrar()
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }

  const escrito = texto.trim()
  const corto = (x: string) => (x.length > 26 ? `${x.slice(0, 26)}…` : x)
  const nombreMomento = momento === 'almuerzo' ? 'almuerzo' : 'cena'
  const yaEsta = (titulo: string) => {
    const i = menu.plan!.dias.findIndex((d) => d.almuerzo.titulo === titulo || d.cena.titulo === titulo)
    return i < 0 ? undefined : i
  }
  const otros = menu.plan!.dias.map((d, i) => ({ i, plato: d[momento] })).filter((x) => x.i !== dia)
  // Tres ideas de un toque: del recetario, para este momento, que no estén ya en el menú; cambian según el día.
  const rapidas = recetas
    .filter((r) => r.momento === momento && r.titulo !== plato.titulo && yaEsta(r.titulo) === undefined)
    .sort((a, b) => a.minutos - b.minutos || a.titulo.localeCompare(b.titulo))
    .slice(0, 15)
  const ideas = rapidas.length <= 3 ? rapidas : [0, 1, 2].map((k) => rapidas[(dia * 3 + k) % rapidas.length])

  return (
    <Hoja titulo="¿Qué te apetece?" onCerrar={onCerrar}>
      <p className="apagado sm-hoja-sub">
        {DIAS[dia]}, {nombreMomento} · ahora: {plato.titulo}
      </p>
      {!confirmado ? (
        <div className="sm-de-ella">
          <p>
            Este plato lo eligió <b>{plato.elegido!.nombre}</b>. ¿Seguro que quieres cambiarlo? Le llegará un aviso.
          </p>
          <div className="sm-votos">
            <button className="boton" onClick={() => setConfirmado(true)}>Sí, cambiarlo</button>
            <button className="boton claro" onClick={onCerrar}>Mejor lo dejo</button>
          </div>
        </div>
      ) : (
        <div className="sm-cambiar">
          {!texto && !antojo && ideas.length > 0 && (
            <ul className="sm-sugeridas" aria-label="Ideas">
              {ideas.map((r) => (
                <li key={r.slug}>
                  <button className="sm-sugerida" disabled={ocupado} onClick={() => void hacer(() => ponerEnMenu(menu.id, dia, momento, r.slug))}>
                    <span>{r.titulo}</span>
                    <small>{r.minutos} min</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="opciones-chips">
            <button className="chip" disabled={ocupado} onClick={() => void hacer(() => ponerPlato(menu.id, dia, momento, 'Lo que haya en casa', { sinCompra: true }))}>
              Lo que haya
            </button>
            <button className="chip" disabled={ocupado} onClick={() => void hacer(() => ponerPlato(menu.id, dia, momento, escrito ? `Comemos fuera · ${escrito}` : 'Comemos fuera', { fuera: true }))}>
              Fuera
            </button>
            <button className="chip" disabled={ocupado} onClick={() => void hacer(() => ponerPlato(menu.id, dia, momento, escrito ? `Pedimos a domicilio · ${escrito}` : 'Pedimos a domicilio', { fuera: true }))}>
              Pedimos
            </button>
          </div>

          <input
            className="campo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Otra cosa: escribe o elige abajo…"
            aria-label="Nuevo plato"
            maxLength={120}
          />
          <div className="opciones-chips" role="group" aria-label="Antojos">
            {ANTOJOS.map(([n]) => (
              <button key={n} type="button" className={`chip${antojo === n ? ' activo' : ''}`} aria-pressed={antojo === n} onClick={() => setAntojo(antojo === n ? null : n)}>
                {n}
              </button>
            ))}
          </div>
          {sugeridas.length > 0 ? (
            <ul className="sm-sugeridas" aria-label="Del recetario">
              {sugeridas.map((r) => (
                <li key={r.slug}>
                  <button className="sm-sugerida" disabled={ocupado} onClick={() => void hacer(() => ponerEnMenu(menu.id, dia, momento, r.slug))}>
                    <span>{r.titulo}</span>
                    <small>
                      {r.minutos} min{r.momento !== momento ? ` · mejor de ${r.momento}` : ''}
                      {yaEsta(r.titulo) !== undefined && ` · ya está el ${DIAS[yaEsta(r.titulo)!].toLowerCase()}`}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (etiquetas || t.length >= 2) && <p className="apagado sm-pista">Nada así en el recetario.</p>}
          {escrito.length >= 2 && (
            <button className="boton" disabled={ocupado} onClick={() => void hacer(() => ponerPlato(menu.id, dia, momento, escrito))}>
              Poner «{corto(escrito)}»
            </button>
          )}

          <button className="enlace" onClick={() => setDeDia(!deDia)} aria-expanded={deDia}>
            {deDia ? 'Ocultar' : 'O cambiarlo de día'}
          </button>
          {deDia && (
            <ul className="sm-sugeridas" aria-label="Cambiar de día">
              {otros.map(({ i, plato: p }) => (
                <li key={i}>
                  <button className="sm-sugerida" disabled={ocupado} onClick={() => void hacer(() => intercambiarDias(menu.id, momento, dia, i))}>
                    <span>{DIAS[i]}: {p.titulo}</span>
                    <small>se cambian los dos</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="apagado sm-pista">La lista se ajusta sola.</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </Hoja>
  )
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const fechaISO = (iso: string, mas = 0) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + mas)
  return d.toISOString().slice(0, 10)
}
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
          <button key={o} type="button" className={`chip${on ? ' activo' : ''}`} aria-pressed={on} onClick={() => onCambio(on ? valor.filter((x) => x !== o) : [...valor, o])}>
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
          <label htmlFor="presupuesto">€ por semana</label>
          <input id="presupuesto" type="number" inputMode="decimal" min={10} max={500} step={5} value={p.presupuesto} onChange={(e) => cambia('presupuesto', Number(e.target.value))} />
        </div>
        <div className="campo">
          <label htmlFor="personas">Personas</label>
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

type FilaProps = {
  menu: Menu
  member: Member
  dia: number
  momento: 'almuerzo' | 'cena'
  plato: Plato
  voto?: Voto
  onOpinado: (titulo: string, v: Voto | null) => void
  /** Abrirlo ya con la receta (viene de «Ahora»). */
  foco?: boolean
}

function FilaPlato({ menu, member, dia, momento, plato, voto, onOpinado, foco }: FilaProps) {
  const menuId = menu.id
  const fuera = sinCocinar(plato)
  const pasado = yaTocaba(menu.semana, dia, momento)
  const pregunta = !fuera && !plato.hecho && pasado
  const [abierto, setAbierto] = useState(!!foco)
  // Recién marcado como comido: la fila sigue mostrando el voto aunque el menú ya se haya recargado.
  const [votando, setVotando] = useState(false)
  const [sinVoto, setSinVoto] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [receta, setReceta] = useState<Receta | undefined>(plato.receta)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  const verPasos = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setReceta(await pedirReceta(menuId, dia, momento))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [menuId, dia, momento])

  // Al abrir un plato se ve la receta sin otro toque.
  useEffect(() => {
    if (abierto && !receta && !fuera && !cargando && !error) void verPasos()
  }, [abierto, receta, fuera, cargando, error, verPasos])
  useEffect(() => {
    if (foco) caja.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [foco])

  const marca = voto != null ? VOTOS.find(([v]) => v === voto)?.[1] : null
  const ligera = momento === 'cena' && plato.etiquetas.includes('Ligero')
  const origen = plato.etiquetas.includes('Fuera') ? 'fuera de casa'
    : plato.etiquetas.includes('Sin compra') ? 'todo en casa'
    : plato.elegido ? `lo eligió ${plato.elegido.uid === member.user_id ? 'tú' : plato.elegido.nombre}`
    : plato.recetario ? 'de la casa'
    : plato.etiquetas.includes('A mano') ? 'a vuestro gusto' : ''
  const meta = [plato.minutos > 0 && `${plato.minutos} min`, plato.aparato && !fuera && !/vitro|inducci/i.test(plato.aparato) ? plato.aparato.split(' o ')[0].toLowerCase() : '', origen].filter(Boolean).join(' · ')
  return (
    <article className="sm-tarjeta" ref={caja}>
      <span className="ceja">
        {momento === 'almuerzo' ? 'Almuerzo' : 'Cena'}{ligera ? ' · ligera' : ''}{plato.hecho?.si ? ' · comido ✓' : ''}
      </span>
      <span className="sm-t-titulo">
        {plato.titulo}
        {marca && <span className={`sm-voto-marca${voto! < 0 ? ' no' : ''}`}> {marca}</span>}
      </span>
      {meta && <span className="sm-t-meta">{meta}</span>}
      {(!fuera || !pasado) && (
        <div className="sm-t-botones">
          {!fuera && (
            <button className="boton" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
              {abierto ? 'Ocultar receta' : 'Ver receta'}
            </button>
          )}
          {!pasado && (
            <button className="boton claro" onClick={() => setCambiando(true)} aria-label={`Cambiar ${plato.titulo}`}>Cambiar</button>
          )}
        </div>
      )}
      {(pregunta || votando) && (
        <PreguntaComida
          menu={menu}
          p={{ dia, momento, plato: votando ? { ...plato, hecho: { si: true, at: '', por: member.user_id } } : plato }}
          variante="fila"
          voto={voto}
          onOpinado={onOpinado}
          onSi={() => setVotando(true)}
          onListo={() => setVotando(false)}
        />
      )}
      {cambiando && <CambiarPlato menu={menu} dia={dia} momento={momento} plato={plato} member={member} onCerrar={() => setCambiando(false)} />}
      {abierto && (
        <div className="sm-detalle">
          {plato.ingredientes.length > 0 && (
            <ul>
              {plato.ingredientes.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {receta && (
            <>
              <ol>
                {receta.pasos.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
              {receta.consejo && <p className="cursiva sm-consejo">{receta.consejo}</p>}
            </>
          )}
          {!receta && cargando && <p className="apagado">Escribiendo la receta…</p>}
          {error && (
            <>
              <p className="error">{error}</p>
              <button className="chip" onClick={() => void verPasos()}>Probar otra vez</button>
            </>
          )}
        </div>
      )}
      {plato.hecho?.si && voto == null && !votando && !pregunta && !fuera && !sinVoto && (
        <PreguntaComida menu={menu} p={{ dia, momento, plato }} variante="fila" voto={voto} onOpinado={onOpinado} onListo={() => setSinVoto(true)} />
      )}
    </article>
  )
}

type Foco = { dia: number; momento: 'almuerzo' | 'cena' }

export default function Semana({ member, onIrALista, foco, onFocoUsado, onRecetario }: { member: Member; onIrALista: () => void; foco?: Foco | null; onFocoUsado?: () => void; onRecetario?: () => void }) {
  const [prefs, setPrefs] = useState<Prefs | null | undefined>(undefined)
  const [editando, setEditando] = useState(false)
  const [menus, setMenus] = useState<Menu[] | undefined>(undefined)
  const [elegida, setElegida] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verCompra, setVerCompra] = useState(false)
  const [dia, setDia] = useState<number | null>(null)
  // El plato que pidió abrir «Ahora»: se usa una vez.
  const [abrir] = useState(foco ?? null)
  useEffect(() => {
    if (foco) onFocoUsado?.()
  }, [foco, onFocoUsado])
  const [votos, setVotos] = useState<Map<string, Voto>>(new Map())
  const [gustos, setGustos] = useState(false)

  useEffect(() => {
    void cargarOpiniones().then((ops) => setVotos(misVotos(ops, member.user_id)), () => {})
  }, [member.user_id])

  function opinado(titulo: string, v: Voto | null) {
    setVotos((x) => {
      const n = new Map(x)
      if (v == null) n.delete(titulo)
      else n.set(titulo, v)
      return n
    })
  }

  const recargar = useCallback(async () => setMenus(await menusVigentes()), [])

  useEffect(() => {
    void cargarPrefs().then(setPrefs)
    void recargar()
    return escucharMenus(member.household_id, () => void recargar())
  }, [member.household_id, recargar])

  // Si quedaron cambios sin ajustar en la compra (app cerrada a medias, función caída), se retoma al abrir.
  const retomados = useRef(new Set<string>())
  useEffect(() => {
    for (const m of menus ?? []) {
      const parado = !m.sincronizando_at || Date.now() - new Date(m.sincronizando_at).getTime() > 3 * 60_000
      if ((m.plan?.cambios?.length ?? 0) > 0 && parado && !m.error && !retomados.current.has(m.id)) {
        retomados.current.add(m.id)
        sincronizar(m.id)
      }
      // Menús de antes del menú dinámico: la compra se pone al día sola, sin pedirlo.
      if (m.estado === 'listo' && m.plan?.compra_vieja && !m.paso && !m.error && !retomados.current.has(`c-${m.id}`)) {
        retomados.current.add(`c-${m.id}`)
        rehacerCompra(m.id).catch((e: Error) => setAviso(e.message))
      }
    }
  }, [menus])

  async function nuevo() {
    setAviso('')
    setOcupado(true)
    try {
      await planear()
      setElegida(null)
      await recargar()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function aLaLista(m: Menu) {
    setOcupado(true)
    try {
      const r = await pasarALista(m)
      if (r.deCasa.length) setAviso(`${r.anadidos} cosas a la lista. Ya en casa, no se compran: ${r.deCasa.join(', ').toLowerCase()}.`)
      else onIrALista()
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  if (prefs === undefined || menus === undefined) return <Cargador pantalla={false} />

  // Por defecto: lo que se acaba de pedir (o se está haciendo); si no, la semana en curso.
  const esteLunes = lunesDeEstaSemana()
  const hoyIdx = Math.round((Date.parse(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Canary' }).format(new Date())}T12:00:00Z`) - Date.parse(`${esteLunes}T12:00:00Z`)) / 86400_000)
  const reciente = [...menus].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const porDefecto = reciente && (reciente.estado !== 'listo' || Date.now() - new Date(reciente.created_at).getTime() < 10 * 60_000)
    ? reciente
    : menus.find((m) => m.semana === esteLunes) ?? menus[0]
  const menu: Menu | null = menus.find((m) => m.semana === elegida) ?? porDefecto ?? null

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
  const vieja = !!listo && !!menu.plan!.compra_vieja
  // Ajustando: la lista se adapta a un plato cambiado, o un menú antiguo pone su compra al día.
  const ajustando = !!listo && !menu.error && ((menu.plan!.cambios?.length ?? 0) > 0 || vieja)
  const estaSemana = !!listo && menu.semana === esteLunes
  // Los días que ya pasaron se pliegan: al abrir se ve hoy.
  // Día que se ve: el elegido en la tira; si no, el que pidió «Ahora» o hoy.
  const diaVisto = dia ?? abrir?.dia ?? (estaSemana ? Math.max(0, Math.min(hoyIdx, 6)) : 0)

  return (
    <>
      {menus.length > 1 && (
        <div className="opciones-chips sm-semanas" role="group" aria-label="Semana">
          {menus.map((m) => (
            <button key={m.semana} type="button" className={`chip${m.id === menu?.id ? ' activo' : ''}`} aria-pressed={m.id === menu?.id} onClick={() => { setElegida(m.semana); setDia(null) }}>
              {nombreSemana(m.semana)}
            </button>
          ))}
        </div>
      )}
      {generando ? (
        <section className="sm-cocinando" aria-live="polite">
          <span className="sm-punto" aria-hidden="true" />
          <p className="cursiva">{menu.paso ?? 'Preparando'}…</p>
          <small>Tarda un minuto. Puedes salir; queda guardado.</small>
        </section>
      ) : listo ? (
        <>
          <div className="sm-tira" role="tablist" aria-label="Día">
            {menu.plan!.dias.map((_, i) => {
              const hoy = estaSemana && i === hoyIdx
              const falta = sinConfirmar(menu).some((x) => x.dia === i)
              return (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === diaVisto}
                  aria-label={`${DIAS[i]} ${fechaCorta(menu.semana, i)}${hoy ? ', hoy' : ''}${falta ? ', sin confirmar' : ''}`}
                  className={`sm-tira-dia${hoy ? ' hoy' : ''}${falta ? ' falta' : ''}`}
                  onClick={() => setDia(i)}
                >
                  <span>{'LMXJVSD'[i]}</span>
                  <b>{Number(fechaISO(menu.semana, i).slice(8))}</b>
                </button>
              )
            })}
          </div>

          {(ajustando || menu.error) && (
            <section className="sm-ajustando" role="status">
              {ajustando ? (
                <>
                  <span className="sm-punto" aria-hidden="true" />
                  <p>Poniendo la compra al día…</p>
                </>
              ) : (
                <>
                  <p className="error">{menu.error}</p>
                  {vieja ? (
                    <button className="chip" onClick={() => { retomados.current.delete(`c-${menu.id}`); rehacerCompra(menu.id).catch((e: Error) => setAviso(e.message)) }}>Reintentar</button>
                  ) : (menu.plan!.cambios?.length ?? 0) > 0 && <button className="chip" onClick={() => sincronizar(menu.id)}>Reintentar</button>}
                </>
              )}
            </section>
          )}

          {(['almuerzo', 'cena'] as const).map((m) => {
            const plato = menu.plan!.dias[diaVisto][m]
            return (
              <FilaPlato key={`${diaVisto}-${m}-${plato.titulo}`} menu={menu} member={member} dia={diaVisto} momento={m} plato={plato} voto={votos.get(plato.titulo)} onOpinado={opinado} foco={abrir?.dia === diaVisto && abrir.momento === m} />
            )
          })}

          <section className="sm-semana" aria-label="Coste de la semana">
            <p>
              <span>Semana</span>
              <span className={`sm-semana-cifra${pasado ? ' pasado' : ''}`}>{euros(menu.total ?? 0)} <small>de {euros(prefs.presupuesto)}</small></span>
            </p>
            <span className="sm-barra" aria-hidden="true">
              <span className={pasado ? 'pasado' : ''} style={{ width: `${Math.min(100, ((menu.total ?? 0) / prefs.presupuesto) * 100)}%` }} />
            </span>
          </section>
          {onRecetario && <button className="boton claro ancho sm-recetario" onClick={onRecetario}>Buscar en el recetario</button>}
          <div className="sm-acciones">
            <button className="chip" onClick={() => void aLaLista(menu)} disabled={ocupado || ajustando}>Pasar a la lista</button>
            <button className="chip" onClick={() => setGustos(true)}>Antojos y gustos</button>
            <button className="chip" onClick={() => void nuevo()} disabled={ocupado}>Otra semana</button>
            <button className="chip" onClick={() => setEditando(true)}>Tu cocina</button>
          </div>

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
          {menu?.estado === 'error' ? menu.error : 'Aún no hay menú. Lo preparo en un minuto.'}
        </p>
      )}

      {aviso && <p role="status" className="aviso" onClick={() => setAviso('')}>{aviso}</p>}

      {!generando && !listo && (
        <div className="sm-acciones">
          <button className="boton grande ancho" onClick={() => void nuevo()} disabled={ocupado}>Preparar la semana</button>
          <button className="chip" onClick={() => setEditando(true)}>Tu cocina</button>
          {onRecetario && <button className="chip" onClick={onRecetario}>Recetario</button>}
        </div>
      )}
      {gustos && <Gustos member={member} menu={menu} onCerrar={() => setGustos(false)} />}
    </>
  )
}
