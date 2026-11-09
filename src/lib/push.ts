import { supabase } from './supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

function toUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

export async function enablePush(householdId: string) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('No hay permiso para avisos. Puedes darlo en los ajustes del móvil.')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(VAPID) }))
  const j = sub.toJSON()
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error('El navegador no devolvió una suscripción válida.')

  const { data: existing } = await supabase.from('push_subscriptions').select('id').eq('endpoint', j.endpoint).maybeSingle()
  if (existing) return
  const { error } = await supabase.from('push_subscriptions').insert({
    household_id: householdId,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
  })
  if (error) throw new Error('No se pudo guardar este móvil: ' + error.message)
}

export async function sendTest(): Promise<{ devices: number; sent: number; failed: number }> {
  const { data, error } = await supabase.functions.invoke('send-test-push', { method: 'POST' })
  if (error) throw new Error('No se pudo enviar la prueba.')
  return data
}
