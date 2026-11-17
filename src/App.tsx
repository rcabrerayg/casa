import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Member } from './lib/supabase'
import type { Person } from './lib/bebe'
import { useTema } from './lib/tema'
import Acceso from './pantallas/Acceso'
import Hogar from './pantallas/Hogar'
import AltaBebe from './pantallas/AltaBebe'
import Ahora from './pantallas/Ahora'
import Bebe, { type Panel } from './pantallas/Bebe'
import Super, { type VistaComida } from './pantallas/Super'
import Ajustes from './pantallas/Ajustes'
import { IcoAhora, IcoBiberon, IcoComida } from './componentes/Iconos'
import { Cargador } from './componentes/Logo'

type Casa = { member: Member; bebe: Person | null; mama: string }
type Seccion = 'ahora' | 'dario' | 'comida'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [casa, setCasa] = useState<Casa | null | undefined>(undefined)
  const [seccion, setSeccion] = useState<Seccion>('ahora')
  const [ajustes, setAjustes] = useState(false)
  // Lo que pide «Ahora» al saltar a otra sección: abrir un panel de Darío o un apartado de Comida.
  const [panel, setPanel] = useState<Panel | null>(null)
  const [vistaComida, setVistaComida] = useState<VistaComida | null>(null)
  // Plato que «Ahora» pide abrir en el menú (con su receta).
  const [focoPlato, setFocoPlato] = useState<{ dia: number; momento: 'almuerzo' | 'cena' } | null>(null)

  useTema(!!casa?.bebe && seccion === 'dario' && !ajustes)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const cargarCasa = useCallback(async () => {
    if (!userId) return setCasa(null)
    const { data: member } = await supabase
      .from('members')
      .select('user_id, household_id, display_name, rol')
      .eq('user_id', userId)
      .maybeSingle()
    if (!member) return setCasa(null)
    const [{ data: bebes }, { data: mamas }] = await Promise.all([
      supabase.from('people').select('id, household_id, name, kind, birth_at').eq('kind', 'bebe').order('created_at').limit(1),
      supabase.from('members').select('display_name').eq('rol', 'mama').limit(1),
    ])
    setCasa({ member: member as Member, bebe: (bebes?.[0] as Person) ?? null, mama: mamas?.[0]?.display_name ?? 'mamá' })
  }, [userId])

  useEffect(() => {
    if (session === undefined) return
    setCasa(undefined)
    void cargarCasa()
  }, [session, cargarCasa])

  // Al cambiar de sección, arriba del todo.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [seccion, ajustes])

  if (session === undefined || (session && casa === undefined)) return <Cargador />
  if (!session) return <Acceso />
  if (!casa) return <Hogar userId={session.user.id} onListo={() => void cargarCasa()} />
  if (!casa.member.rol || !casa.bebe) return <AltaBebe member={casa.member} bebe={casa.bebe} onListo={() => void cargarCasa()} />

  if (ajustes) return <Ajustes member={casa.member} onVolver={() => setAjustes(false)} />

  const ir = (s: Seccion) => {
    setSeccion(s)
    if (s !== 'dario') setPanel(null)
  }

  return (
    <div className="app">
      {seccion === 'ahora' && (
        <Ahora
          member={casa.member}
          bebe={casa.bebe}
          mama={casa.mama}
          onAjustes={() => setAjustes(true)}
          onBebe={(p) => {
            setPanel(p)
            setSeccion('dario')
          }}
          onComida={(v, foco) => {
            setVistaComida(v)
            setFocoPlato(foco ?? null)
            setSeccion('comida')
          }}
        />
      )}
      {seccion === 'dario' && <Bebe member={casa.member} bebe={casa.bebe} mama={casa.mama} panelInicial={panel} onPanelAbierto={() => setPanel(null)} />}
      {seccion === 'comida' && <Super member={casa.member} vistaInicial={vistaComida} onVistaUsada={() => setVistaComida(null)} foco={focoPlato} onFocoUsado={() => setFocoPlato(null)} />}
      <nav className="pie-nav" aria-label="Secciones">
        <button aria-current={seccion === 'ahora' ? 'page' : undefined} onClick={() => ir('ahora')}>
          <IcoAhora />
          Ahora
        </button>
        <button aria-current={seccion === 'dario' ? 'page' : undefined} onClick={() => ir('dario')}>
          <IcoBiberon />
          {casa.bebe.name}
        </button>
        <button aria-current={seccion === 'comida' ? 'page' : undefined} onClick={() => ir('comida')}>
          <IcoComida />
          Comida
        </button>
      </nav>
    </div>
  )
}
