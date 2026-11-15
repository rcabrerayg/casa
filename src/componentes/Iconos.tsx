// Iconos de línea, 24 px, del rediseño.
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export const IcoAhora = () => (
  <svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const IcoBiberon = ({ size = 24 }: { size?: number }) => (
  <svg {...base} width={size} height={size}><path d="M9 2h6M10 2v3L8 8v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2-3V2M8 12h8" /></svg>
)
export const IcoComida = () => (
  <svg {...base}><path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3" /></svg>
)
export const IcoPanal = () => (
  <svg {...base} width={26} height={26}><path d="M3 8h18l-2 9a3 3 0 0 1-3 2H8a3 3 0 0 1-3-2L3 8zM8 8a4 4 0 0 0 8 0" /></svg>
)
export const IcoLuna = () => (
  <svg {...base} width={26} height={26}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
)
export const IcoGota = () => (
  <svg {...base} width={26} height={26}><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z" /></svg>
)
export const IcoFlecha = () => (
  <svg {...base} width={18} height={18} strokeWidth={1.4} className="flecha"><path d="M9 6l6 6-6 6" /></svg>
)
export const IcoVolver = () => (
  <svg {...base} width={20} height={20}><path d="M15 6l-6 6 6 6" /></svg>
)
export const IcoAjustes = () => (
  <svg {...base} width={22} height={22} strokeWidth={1.4}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
