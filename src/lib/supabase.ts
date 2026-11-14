import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export type Rol = 'mama' | 'papa' | 'otro'
export type Member = { user_id: string; household_id: string; display_name: string; rol: Rol | null }
export type Household = { id: string; name: string; invite_code: string; timezone: string }
