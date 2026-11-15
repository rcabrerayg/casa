/**
 * RDR: Rubén, Darío y Rut. La R grande, la D (Darío) pequeña y en coral, la R mediana.
 * Mismo dibujo que los iconos de pantalla de inicio (public/icons) y el cargador de index.html.
 */
export function Letras({ fondo = true }: { fondo?: boolean }) {
  return (
    <>
      {fondo && <rect width="100" height="100" rx="22" fill="#181818" />}
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontFamily="'Space Grotesk', system-ui, sans-serif"
        fontWeight="600"
        letterSpacing="-1.5"
        fill="#F2F2F0"
      >
        <tspan fontSize="52">R</tspan>
        <tspan fontSize="26" fill="#FF8A65">D</tspan>
        <tspan fontSize="38">R</tspan>
      </text>
    </>
  )
}

/** Minilogo para cabeceras. */
export function Logo({ tam = 32 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 100 100" role="img" aria-label="Casa de Rubén, Darío y Rut">
      <Letras />
    </svg>
  )
}

/** Cargador: el logo con las letras respirando una tras otra. */
export function Cargador() {
  return (
    <main className="cargador" aria-busy="true" aria-label="Cargando">
      <svg width="88" height="88" viewBox="0 0 100 100" aria-hidden="true">
        <Letras />
      </svg>
    </main>
  )
}
