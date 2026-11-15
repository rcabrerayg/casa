import { Cargador } from '../componentes/Logo'
import { useEffect, useMemo, useState } from 'react'
import { cargarRecetario, ingredientesALista, marcarFavorito, ponerEnMenu, type Precio, type Receta } from '../lib/recetario'
import { menusVigentes, nombreSemana, type Menu } from '../lib/semana'
import { euros } from '../lib/super'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
type Filtro = 'favoritos' | 'oferta' | 'rapidas' | 'congela'
const FILTROS: [Filtro, string][] = [['favoritos', 'Favoritas'], ['oferta', 'De oferta'], ['rapidas', 'Rápidas'], ['congela', 'Se congelan']]
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export default function Recetario({ onIrALista, onIrAlMenu }: { onIrALista: () => void; onIrAlMenu: () => void }) {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof cargarRecetario>> | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [momento, setMomento] = useState<'almuerzo' | 'cena' | null>(null)
  const [cocina, setCocina] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Set<Filtro>>(new Set())
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    cargarRecetario().then(setDatos, (e: Error) => setError(e.message))
  }, [])

  const cocinas = useMemo(() => [...new Set((datos?.recetas ?? []).map((r) => r.cocina))].sort(), [datos])

  const lista = useMemo(() => {
    if (!datos) return []
    const t = norm(q.trim())
    return datos.recetas
      .filter((r) => !momento || r.momento === momento)
      .filter((r) => !cocina || r.cocina === cocina)
      .filter((r) => !t || norm(`${r.titulo} ${r.cocina} ${r.ingredientes.join(' ')}`).includes(t))
      .filter((r) => !filtros.has('favoritos') || datos.favoritos.has(r.id))
      .filter((r) => !filtros.has('oferta') || datos.precios.get(r.slug)?.en_oferta)
      .filter((r) => !filtros.has('rapidas') || r.minutos <= 30)
      .filter((r) => !filtros.has('congela') || r.congela)
      .sort((a, b) => Number(!!t && norm(b.titulo).includes(t)) - Number(!!t && norm(a.titulo).includes(t)) || Number(datos.favoritos.has(b.id)) - Number(datos.favoritos.has(a.id)) || a.titulo.localeCompare(b.titulo, 'es'))
  }, [datos, q, momento, cocina, filtros])

  async function cambiarFavorito(r: Receta) {
    if (!datos) return
    const si = !datos.favoritos.has(r.id)
    const favoritos = new Set(datos.favoritos)
    if (si) favoritos.add(r.id)
    else favoritos.delete(r.id)
    setDatos({ ...datos, favoritos })
    try {
      await marcarFavorito(r.id, si)
    } catch (e) {
      setDatos(datos)
      setError((e as Error).message)
    }
  }

  const alternar = (f: Filtro) => {
    const n = new Set(filtros)
    if (n.has(f)) n.delete(f)
    else n.add(f)
    setFiltros(n)
  }

  if (!datos) return error ? <p className="error">{error}</p> : <Cargador pantalla={false} />

  return (
    <>
      <div className="sp-buscar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca un plato o un ingrediente" aria-label="Buscar receta" />
      </div>
      <div className="opciones-chips" role="group" aria-label="Filtros">
        {(['almuerzo', 'cena'] as const).map((m) => (
          <button key={m} type="button" className={`chip${momento === m ? ' activo' : ''}`} aria-pressed={momento === m} onClick={() => setMomento(momento === m ? null : m)}>
            {m === 'almuerzo' ? 'Almuerzos' : 'Cenas'}
          </button>
        ))}
        {FILTROS.map(([f, etiqueta]) => (
          <button key={f} type="button" className={`chip${filtros.has(f) ? ' activo' : ''}`} aria-pressed={filtros.has(f)} onClick={() => alternar(f)}>
            {etiqueta}
          </button>
        ))}
      </div>
      <div className="opciones-chips rc-cocinas" role="group" aria-label="Cocina">
        {cocinas.map((c) => (
          <button key={c} type="button" className={`chip${cocina === c ? ' activo' : ''}`} aria-pressed={cocina === c} onClick={() => setCocina(cocina === c ? null : c)}>
            {mayuscula(c)}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <p className="ceja">{lista.length === 1 ? '1 receta' : `${lista.length} recetas`}</p>

      <section>
        {lista.map((r) => (
          <FilaReceta
            key={r.id}
            receta={r}
            precio={datos.precios.get(r.slug)}
            favorita={datos.favoritos.has(r.id)}
            abierta={abierta === r.id}
            onAbrir={() => setAbierta(abierta === r.id ? null : r.id)}
            onFavorito={() => void cambiarFavorito(r)}
            onIrALista={onIrALista}
            onIrAlMenu={onIrAlMenu}
          />
        ))}
        {!lista.length && <p className="apagado sm-intro">Nada con esos filtros.</p>}
      </section>
    </>
  )
}

type FilaProps = {
  receta: Receta
  precio?: Precio
  favorita: boolean
  abierta: boolean
  onAbrir: () => void
  onFavorito: () => void
  onIrALista: () => void
  onIrAlMenu: () => void
}

function FilaReceta({ receta: r, precio, favorita, abierta, onAbrir, onFavorito, onIrALista, onIrAlMenu }: FilaProps) {
  const [eligiendo, setEligiendo] = useState(false)
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function aLaLista() {
    setOcupado(true)
    setAviso('')
    try {
      const n = await ingredientesALista(r.slug)
      setAviso(`${n} ${n === 1 ? 'cosa añadida' : 'cosas añadidas'} a la lista (lo que manda en el plato; la despensa básica no).`)
    } catch (e) {
      setAviso((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const detalle = [mayuscula(r.cocina), `${r.minutos} min`, r.aparato].join(' · ')

  return (
    <div className="sm-plato">
      <div className="rc-cab">
        <button className="sm-plato-cab" onClick={onAbrir} aria-expanded={abierta}>
          <span className="sm-momento rc-coste">
            {precio ? `≈ ${euros(precio.coste)}` : r.momento}
            {precio?.en_oferta && <em>oferta</em>}
          </span>
          <span className="sp-nombre">
            {r.titulo}
            <small>
              {detalle}
              {r.coste === 'oferta' && !precio?.en_oferta && ' · mejor cuando esté de oferta'}
            </small>
          </span>
        </button>
        <button type="button" className={`rc-fav${favorita ? ' si' : ''}`} aria-pressed={favorita} aria-label={favorita ? 'Quitar de favoritas' : 'Marcar como favorita'} onClick={onFavorito}>
          {favorita ? '♥' : '♡'}
        </button>
      </div>
      {abierta && (
        <div className="sm-detalle">
          <p className="ceja">Para {r.raciones}{r.momento === 'cena' ? ' · cena ligera' : ''}</p>
          <ul>
            {r.ingredientes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <ol>
            {r.pasos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
          {r.truco && <p className="cursiva sm-consejo">{r.truco}</p>}
          {r.conservacion && <p className="apagado sm-pista">{r.conservacion}</p>}
          {precio?.ofertas.length ? <p className="apagado sm-pista">De oferta ahora: {precio.ofertas.join(', ')}.</p> : null}

          {eligiendo ? (
            <ElegirDia receta={r} onCancelar={() => setEligiendo(false)} onPuesto={(txt) => { setEligiendo(false); setAviso(txt) }} />
          ) : (
            <div className="sm-votos">
              <button type="button" className="chip" onClick={() => setEligiendo(true)}>Ponla en el menú</button>
              <button type="button" className="chip" onClick={() => void aLaLista()} disabled={ocupado}>Ingredientes a la lista</button>
            </div>
          )}
          {aviso && (
            <p role="status" className="sm-pista">
              {aviso}{' '}
              {aviso.includes('lista') ? (
                <button type="button" className="enlace" onClick={onIrALista}>Ver la lista</button>
              ) : aviso.startsWith('Puesta') ? (
                <button type="button" className="enlace" onClick={onIrAlMenu}>Ver el menú</button>
              ) : null}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ElegirDia({ receta, onCancelar, onPuesto }: { receta: Receta; onCancelar: () => void; onPuesto: (txt: string) => void }) {
  const [menus, setMenus] = useState<Menu[] | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [dia, setDia] = useState<number | null>(null)
  const [momento, setMomento] = useState<'almuerzo' | 'cena'>(receta.momento)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    void menusVigentes().then((ms) => {
      const listos = ms.filter((m) => m.estado === 'listo' && m.plan)
      setMenus(listos)
      setMenuId(listos[0]?.id ?? null)
    })
  }, [])

  if (!menus) return <Cargador pantalla={false} />
  if (!menus.length) {
    return (
      <p className="apagado sm-pista">
        Aún no hay menú para esta semana. Prepara uno en «Menú» y luego cambia el plato que quieras.{' '}
        <button type="button" className="enlace" onClick={onCancelar}>Vale</button>
      </p>
    )
  }
  const menu = menus.find((m) => m.id === menuId) ?? menus[0]
  const actual = dia != null ? menu.plan?.dias[dia]?.[momento]?.titulo : undefined

  async function poner() {
    if (dia == null) return
    setOcupado(true)
    setError('')
    try {
      await ponerEnMenu(menu.id, dia, momento, receta.slug)
      onPuesto(`Puesta el ${DIAS[dia].toLowerCase()} (${momento}). La lista de la compra se ajusta sola.`)
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }

  return (
    <div className="rc-elegir bloque">
      {menus.length > 1 && (
        <div className="opciones-chips" role="group" aria-label="Semana">
          {menus.map((m) => (
            <button key={m.id} type="button" className={`chip${m.id === menu.id ? ' activo' : ''}`} aria-pressed={m.id === menu.id} onClick={() => setMenuId(m.id)}>
              {nombreSemana(m.semana)}
            </button>
          ))}
        </div>
      )}
      <div className="opciones-chips" role="group" aria-label="Día">
        {DIAS.map((d, i) => (
          <button key={d} type="button" className={`chip${dia === i ? ' activo' : ''}`} aria-pressed={dia === i} onClick={() => setDia(i)}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>
      <div className="opciones-chips" role="group" aria-label="Comida">
        {(['almuerzo', 'cena'] as const).map((m) => (
          <button key={m} type="button" className={`chip${momento === m ? ' activo' : ''}`} aria-pressed={momento === m} onClick={() => setMomento(m)}>
            {m === 'almuerzo' ? 'Almuerzo' : 'Cena'}
          </button>
        ))}
      </div>
      {actual && <p className="apagado sm-pista">Sustituye a «{actual}».</p>}
      {error && <p className="error">{error}</p>}
      <div className="sm-acciones">
        <button type="button" className="boton" onClick={() => void poner()} disabled={dia == null || ocupado}>
          {dia == null ? 'Elige el día' : `Poner el ${DIAS[dia].toLowerCase()}`}
        </button>
        <button type="button" className="enlace" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}
