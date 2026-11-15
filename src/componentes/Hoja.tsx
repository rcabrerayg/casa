import { useEffect, useRef, type ReactNode } from 'react'

/** Panel inferior (bottom sheet). Se cierra tocando fuera, con «Cerrar» o con Escape. */
export default function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    document.addEventListener('keydown', tecla)
    const origen = document.activeElement as HTMLElement | null
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    caja.current?.focus()
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = antes
      origen?.focus?.()
    }
  }, [])

  return (
    <div className="hoja-fondo" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} ref={caja} tabIndex={-1}>
        <span className="asa" aria-hidden="true" />
        <div className="cabecera">
          <h2>{titulo}</h2>
          <button className="chip" onClick={onCerrar}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  )
}
