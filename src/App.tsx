import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Member } from './lib/supabase'
import type { Person } from './lib/bebe'
import Acceso from './pantallas/Acceso'
import Hogar from './pantallas/Hogar'
import AltaBebe from './pantallas/AltaBebe'
import Bebe from './pantallas/Bebe'
import Hoy from './pantallas/Hoy'
import Resumen from './pantallas/Resumen'
import Super from './pantallas/Super'

type Casa = { member: Member; bebe: Person | null; mama: string }

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [casa, setCasa] = useState<Casa | null | undefined>(undefined)
  const [vista, setVista] = useState<'bebe' | 'resumen' | 'super' | 'hoy'>('bebe')

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

  if (session === undefined || (session && casa === undefined)) return <main className="pantalla" aria-busy="true" />
  if (!session) return <Acceso />
  if (!casa) return <Hogar userId={session.user.id} onListo={() => void cargarCasa()} />
  if (!casa.member.rol || !casa.bebe) return <AltaBebe member={casa.member} bebe={casa.bebe} onListo={() => void cargarCasa()} />

  return (
    <div className={vista === 'bebe' ? 'noche' : undefined}>
      {vista === 'bebe' && <Bebe member={casa.member} bebe={casa.bebe} mama={casa.mama} />}
      {vista === 'resumen' && <Resumen bebe={casa.bebe} />}
      {vista === 'super' && <Super member={casa.member} />}
      {vista === 'hoy' && <Hoy member={casa.member} />}
      <nav className="pie-nav cuatro" aria-label="Secciones">
        <button aria-current={vista === 'bebe' ? 'page' : undefined} onClick={() => setVista('bebe')}>{casa.bebe.name}</button>
        <button aria-current={vista === 'resumen' ? 'page' : undefined} onClick={() => setVista('resumen')}>Resumen</button>
        <button aria-current={vista === 'super' ? 'page' : undefined} onClick={() => setVista('super')}>Comida</button>
        <button aria-current={vista === 'hoy' ? 'page' : undefined} onClick={() => setVista('hoy')}>Casa y avisos</button>
      </nav>
    </div>
  )
}
