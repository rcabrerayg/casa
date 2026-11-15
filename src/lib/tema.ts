import { useEffect, useState } from 'react'
import { TZ } from './bebe'

const horaCanarias = () => Number(new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()))

/** De 21:00 a 08:00 en Canarias. */
export const esDeNoche = () => {
  const h = horaCanarias()
  return h >= 21 || h < 8
}

/**
 * Pone el modo oscuro en toda la app: de noche, si el sistema lo pide o si `forzar` (Darío va siempre en oscuro).
 * Se revisa cada minuto para cambiar solo a las 21:00 y a las 08:00.
 */
export function useTema(forzar: boolean) {
  const [noche, setNoche] = useState(esDeNoche)
  const [sistema, setSistema] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)

  useEffect(() => {
    const t = setInterval(() => setNoche(esDeNoche()), 60_000)
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const cambio = (e: MediaQueryListEvent) => setSistema(e.matches)
    mq?.addEventListener('change', cambio)
    return () => {
      clearInterval(t)
      mq?.removeEventListener('change', cambio)
    }
  }, [])

  const oscuro = forzar || noche || sistema
  useEffect(() => {
    const raiz = document.documentElement
    if (oscuro) raiz.dataset.tema = 'oscuro'
    else delete raiz.dataset.tema
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#121212' : '#F7F7F5')
  }, [oscuro])
  return oscuro
}
