import { useEffect, useState } from 'react'
import { cargar, conPendientes, cuando, dia, edad, escuchar, kilos, minutos, type BabyEvent, type Person } from '../lib/bebe'

type Fila = {
  dia: string
  tomas: number
  pecho: number
  pechoMin: number
  mlMama: number
  mlFormula: number
  pipis: number
  cacas: number
  extracciones: number
  mlSacados: number
  peso: number | null
}

function porDia(eventos: BabyEvent[]): Fila[] {
  const filas = new Map<string, Fila>()
  for (const e of [...eventos].reverse()) {
    const d = dia(e.at)
    const f =
      filas.get(d) ??
      { dia: d, tomas: 0, pecho: 0, pechoMin: 0, mlMama: 0, mlFormula: 0, pipis: 0, cacas: 0, extracciones: 0, mlSacados: 0, peso: null }
    if (e.kind === 'toma') {
      f.tomas++
      if (e.side === 'izq' || e.side === 'dcho') {
        f.pecho++
        if (e.ended_at) f.pechoMin += minutos(e.at, e.ended_at)
      }
      if (e.side === 'extraida') f.mlMama += e.ml ?? 0
      if (e.side === 'bib') f.mlFormula += e.ml ?? 0
    }
    if (e.kind === 'panal') {
      if (e.panal !== 'caca') f.pipis++
      if (e.panal !== 'pipi') f.cacas++
    }
    if (e.kind === 'extraccion') {
      f.extracciones++
      f.mlSacados += e.ml ?? 0
    }
    if (e.kind === 'peso' && e.gramos) f.peso = e.gramos
    filas.set(d, f)
  }
  return [...filas.values()].sort((a, b) => b.dia.localeCompare(a.dia))
}

const fecha = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

function texto(bebe: Person, filas: Fila[], ultimaCaca: BabyEvent | undefined, ahora: number) {
  const l = [`${bebe.name}${bebe.birth_at ? ` · ${edad(bebe.birth_at, ahora)}` : ''}`]
  if (ultimaCaca) l.push(`Última caca: ${cuando(ultimaCaca.at, ahora)}`)
  for (const f of filas) {
    const partes = [
      `${f.tomas} tomas`,
      f.mlMama ? `${f.mlMama} ml leche de mamá` : '',
      f.mlFormula ? `${f.mlFormula} ml fórmula` : '',
      f.pecho ? `${f.pecho} al pecho${f.pechoMin ? ` (${f.pechoMin} min)` : ''}` : '',
      `${f.pipis} pañales con pipí`,
      `${f.cacas} con caca`,
      f.extracciones ? `sacaleches ${f.extracciones} veces (${f.mlSacados} ml)` : '',
      f.peso ? `peso ${kilos(f.peso)}` : '',
    ].filter(Boolean)
    l.push(`${fecha(f.dia)}: ${partes.join(', ')}`)
  }
  return l.join('\n')
}

export default function Resumen({ bebe }: { bebe: Person }) {
  const [eventos, setEventos] = useState<BabyEvent[]>([])
  const [copiado, setCopiado] = useState('')
  const ahora = Date.now()

  useEffect(() => {
    const horas = bebe.birth_at ? Math.ceil((Date.now() - new Date(bebe.birth_at).getTime()) / 3600_000) + 24 : 24 * 30
    const cargarTodo = async () => setEventos(conPendientes(await cargar(bebe.id, horas)))
    void cargarTodo()
    return escuchar(bebe.id, () => void cargarTodo(), 'resumen')
  }, [bebe.id, bebe.birth_at])

  const filas = porDia(eventos)
  const ultimaCaca = eventos.find((e) => e.kind === 'panal' && e.panal !== 'pipi')
  const pesos = eventos.filter((e) => e.kind === 'peso')

  async function compartir() {
    const t = texto(bebe, filas, ultimaCaca, ahora)
    try {
      if (navigator.share) await navigator.share({ title: `Resumen de ${bebe.name}`, text: t })
      else {
        await navigator.clipboard.writeText(t)
        setCopiado('Copiado. Pégalo donde quieras.')
      }
    } catch {
      /* compartir cancelado */
    }
  }

  return (
    <>
      <section className="datos-clave">
        <div>
          <span className="ceja">Última caca</span>
          <b>{ultimaCaca ? cuando(ultimaCaca.at, ahora) : '—'}</b>
        </div>
        <div>
          <span className="ceja">Último peso</span>
          <b>{pesos[0]?.gramos ? kilos(pesos[0].gramos) : '—'}</b>
        </div>
      </section>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">Tomas</th>
              <th scope="col">Leche mamá</th>
              <th scope="col">Pipí</th>
              <th scope="col">Caca</th>
              <th scope="col">Fórmula</th>
              <th scope="col">Pecho</th>
              <th scope="col">Sacaleches</th>
              <th scope="col">Peso</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={9} style={{ color: 'var(--tinta-2)' }}>Aún no hay nada apuntado.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.dia}>
                <th scope="row">{fecha(f.dia)}</th>
                <td>{f.tomas}</td>
                <td>{f.mlMama ? `${f.mlMama} ml` : '—'}</td>
                <td>{f.pipis}</td>
                <td>{f.cacas}</td>
                <td>{f.mlFormula ? `${f.mlFormula} ml` : '—'}</td>
                <td>{f.pecho ? `${f.pecho}${f.pechoMin ? ` · ${f.pechoMin}′` : ''}` : '—'}</td>
                <td>{f.extracciones ? `${f.extracciones} · ${f.mlSacados} ml` : '—'}</td>
                <td>{f.peso ? kilos(f.peso) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota">Días naturales en hora de Canarias. El de hoy está en curso.</p>

      <button className="boton" onClick={compartir}>Compartir resumen</button>
      {copiado && <p role="status" className="nota">{copiado}</p>}
    </>
  )
}
