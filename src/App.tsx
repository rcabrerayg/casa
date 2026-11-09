import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Member } from './lib/supabase'
import Acceso from './pantallas/Acceso'
import Hogar from './pantallas/Hogar'
import Hoy from './pantallas/Hoy'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [member, setMember] = useState<Member | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) {
      setMember(session === undefined ? undefined : null)
      return
    }
    setMember(undefined)
    supabase
      .from('members')
      .select('user_id, household_id, display_name')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setMember(data ?? null))
  }, [userId, session])

  if (session === undefined || (session && member === undefined)) {
    return <main className="pantalla" aria-busy="true" />
  }
  if (!session) return <Acceso />
  if (!member) return <Hogar onListo={setMember} userId={session.user.id} />
  return <Hoy member={member} />
}
