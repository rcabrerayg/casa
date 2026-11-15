/**
 * RDR bajo un tejado coral: la casa de Rubén (R grande), Darío (D pequeña, en coral) y Rut (R mediana).
 * Dibujado a trazo, sin depender de ninguna fuente. Mismo dibujo que public/icons y el cargador de index.html.
 */
export const LOGO = {
  tejado: 'M8 44 L50 14 L92 44',
  rGrande: 'M17 83 V48 H29 A8.75 8.75 0 0 1 29 65.5 H17 M28 65.5 L39 83',
  d: 'M47 62 H49.5 A10.5 10.5 0 0 1 49.5 83 H47 Z',
  rMediana: 'M66.5 83 V55 H76 A7 7 0 0 1 76 69 H66.5 M75 69 L84 83',
}

export function Trazos({ fondo = true }: { fondo?: boolean }) {
  return (
    <>
      {fondo && <rect width="100" height="100" rx="22" fill="#181818" />}
      <g fill="none" stroke="#F2F2F0" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path className="logo-tejado" d={LOGO.tejado} pathLength={1} stroke="#FF8A65" />
        <path className="logo-letra" d={LOGO.rGrande} />
        <path className="logo-letra" d={LOGO.d} stroke="#FF8A65" />
        <path className="logo-letra" d={LOGO.rMediana} />
      </g>
    </>
  )
}

/** Minilogo para cabeceras. */
export function Logo({ tam = 32 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 100 100" role="img" aria-label="Casa de Rubén, Darío y Rut">
      <Trazos />
    </svg>
  )
}

/** Cargador: el tejado se dibuja y las letras respiran una tras otra. */
export function Cargador({ pantalla = true }: { pantalla?: boolean }) {
  return (
    <div className={pantalla ? 'cargador' : 'cargador en-linea'} role="status" aria-label="Cargando">
      <svg width={pantalla ? 88 : 56} height={pantalla ? 88 : 56} viewBox="0 0 100 100" aria-hidden="true">
        <Trazos />
      </svg>
    </div>
  )
}
