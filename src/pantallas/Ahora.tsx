import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Member } from '../lib/supabase'
import {
  TZ, cadaSaca, cargar, conPendientes, edad, enCurso, escuchar, hace, hora, minutos, proxima, queFue, vaciarCola, SACAR_CADA_MIN,
  type BabyEvent, type Person,
} from '../lib/bebe'
import { mensajes } from '../lib/animo'
import { lunesDeEstaSemana, menusVigentes, type Plato } from '../lib/semana'
import { cargarLista, escucharLista, euros, NOMBRE, repartir, type Linea } from '../lib/super'
import { IcoAjustes, IcoFlecha } from '../componentes/Iconos'
import type { Panel } from './Bebe'
import type { VistaComida } from './Super'

type Props = {
  member: Member
  bebe: Person
  mama: string
  onAjustes: () => void
  onBebe: (p: Panel | null) => void
  onComida: (v: VistaComida) => void
}

function cabecera(ms: number) {
  const parte = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...o }).format(new Date(ms))
  const h = Number(parte({ hour: 'numeric', hour12: false }))
  const dia = parte({ weekday: 'long' })
  return {
    fecha: `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${parte({ day: 'numeric' })} · ${parte({ month: 'long' })}`,
    saludo: h < 6 ? 'Buenas noches,' : h < 14 ? 'Buenos días,' : h < 21 ? 'Buenas tardes,' : 'Buenas noches,',
    hora: h,
  }
}

/** Índice del día de hoy (0 = lunes) dentro de la semana que empieza en `semana`. */
function indiceHoy(semana: string) {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  return Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${semana}T12:00:00Z`)) / 86400_000)
}

export default function Ahora({ member, bebe, mama, onAjustes, onBebe, onComida }: Props) {
  const [eventos, setEventos] = useState<BabyEvent[]>([])
  const [cargado, setCargado] = useState(false)
  const [ahora, setAhora] = useState(Date.now())
  const [plato, setPlato] = useState<{ momento: 'almuerzo' | 'cena'; plato: Plato } | null>(null)
  const [compra, setCompra] = useState<Linea[]>([])
  const [cada, setCada] = useState(SACAR_CADA_MIN)
  const c = cabecera(ahora)
  const momento = c.hora < 16 ? 'almuerzo' : 'cena'

  const cargarBebe = useCallback(async () => {
    await vaciarCola()
    setEventos(conPendientes(await cargar(bebe.id)))
    setCargado(true)
    setAhora(Date.now())
  }, [bebe.id])

  const cargarCompra = useCallback(async () => {
    try {
      const r = await cargarLista()
      setCompra(repartir(r.items.filter((i) => !i.comprado_at), r.productos))
    } catch {
      setCompra([])
    }
  }, [])

  useEffect(() => {
    void cargarBebe()
    void cargarCompra()
    void cadaSaca(member.household_id).then(setCada)
    const pararBebe = escuchar(bebe.id, () => void cargarBebe(), 'ahora')
    const pararLista = escucharLista(member.household_id, () => void cargarCompra(), 'ahora')
    const visible = () => document.visibilityState === 'visible' && void cargarBebe()
    document.addEventListener('visibilitychange', visible)
    const online = () => {
      void cargarBebe()
      void cargarCompra()
    }
    window.addEventListener('online', online)
    const tic = setInterval(() => setAhora(Date.now()), 30_000)
    return () => {
      pararBebe()
      pararLista()
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('online', online)
      clearInterval(tic)
    }
  }, [bebe.id, member.household_id, cargarBebe, cargarCompra])

  useEffect(() => {
    void menusVigentes().then((ms) => {
      const m = ms.find((x) => x.semana === lunesDeEstaSemana() && x.estado === 'listo' && x.plan)
      const d = m?.plan?.dias[indiceHoy(m.semana)]
      setPlato(d ? { momento, plato: d[momento] } : null)
    })
  }, [momento])

  const tomas = eventos.filter((e) => e.kind === 'toma')
  const ultima = tomas[0]
  const actual = enCurso(ultima, ahora) ? ultima : undefined
  const prox = proxima(tomas, ahora)
  const ultimaExt = eventos.find((e) => e.kind === 'extraccion')
  const tocaSacar = !!ultimaExt && minutos(ultimaExt.at, ahora) >= cada
  const esMama = member.rol === 'mama'
  const animo = useMemo(
    () => mensajes({ esMama, mama, bebe: bebe.name, birthAt: bebe.birth_at, eventos, ahora })[0],
    [esMama, mama, bebe.name, bebe.birth_at, eventos, ahora],
  )
  const total = compra.reduce((s, l) => s + (l.producto ? l.producto.precio * l.item.cantidad : 0), 0)
  const supers = [...new Set(compra.map((l) => l.super).filter(Boolean))].map((s) => NOMBRE[s!])

  return (
    <main className="pantalla">
      <div className="cabecera">
        <p className="ceja">{c.fecha}</p>
        <button className="icono-boton" aria-label="Ajustes" onClick={onAjustes}>
          <IcoAjustes />
        </button>
      </div>
      <h1 className="titulo" style={{ marginTop: -6 }}>
        {c.saludo} <span className="cursiva">{member.display_name}.</span>
      </h1>

      <section className="tarjeta-noche" aria-label={bebe.name}>
        <div className="cabecera" style={{ minHeight: 0, alignItems: 'baseline' }}>
          <span className="ceja">{bebe.name}{bebe.birth_at ? ` · ${edad(bebe.birth_at, ahora)}` : ''}</span>
          {prox && !actual && <span style={{ fontSize: 14, color: '#A3A3AB' }}>próxima hacia las {hora(prox)}</span>}
        </div>
        <div className="ahora-toma">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="gran-numero">{actual ? `${minutos(actual.at, ahora)} min` : ultima ? hace(ultima.at, ahora) : '—'}</span>
            <span style={{ fontSize: 15, color: '#CFCFD4' }}>
              {actual ? 'dando el pecho ahora' : ultima ? 'desde la última toma' : cargado ? 'aún no hay tomas apuntadas' : 'cargando…'}
            </span>
          </div>
          {ultima && !actual && <span className="ahora-que">{queFue(ultima)}</span>}
        </div>
        {actual ? (
          <button className="boton senal grande" onClick={() => onBebe(null)}>Ver la toma en curso</button>
        ) : (
          <div className="dos">
            <button className="boton senal grande" onClick={() => onBebe('comer')}>Apuntar toma</button>
            <button className="boton secundario grande" onClick={() => onBebe('panal')}>Pañal</button>
          </div>
        )}
      </section>

      {tocaSacar && (
        <button className="tarjeta con-flecha" onClick={() => onBebe('saca')}>
          <span className="cuadro" aria-hidden="true" />
          <span className="cuerpo">
            <span style={{ fontWeight: 500 }}>
              {esMama ? 'Tu sacaleches' : `Sacaleches de ${mama}`} · hace {hace(ultimaExt!.at, ahora)}
            </span>
            <span className="detalle">{esMama ? 'Cuando puedas, sin prisa.' : 'Buen momento para prepararle el sacaleches y agua.'}</span>
          </span>
          <IcoFlecha />
        </button>
      )}

      {animo && <p className="animo-frase">{animo.texto}</p>}

      {plato && (
        <button className="tarjeta" onClick={() => onComida('menu')}>
          <span className="ceja">{plato.momento === 'almuerzo' ? 'Almuerzo' : 'Cena'} de hoy</span>
          <span className="grande">{plato.plato.titulo}</span>
          <span className="detalle">{[`${plato.plato.minutos} min`, plato.plato.aparato, 'ver receta'].filter(Boolean).join(' · ')}</span>
        </button>
      )}

      {compra.length > 0 && (
        <button className="tarjeta con-flecha" onClick={() => onComida('lista')}>
          <span className="cuerpo">
            <span className="ceja">Compra</span>
            <span className="grande">
              {compra.length} {compra.length === 1 ? 'cosa pendiente' : 'cosas pendientes'}
            </span>
            {(supers.length > 0 || total > 0) && (
              <span className="detalle">{[supers.join(' y '), total > 0 ? `≈ ${euros(total)}` : ''].filter(Boolean).join(' · ')}</span>
            )}
          </span>
          <IcoFlecha />
        </button>
      )}
    </main>
  )
}
