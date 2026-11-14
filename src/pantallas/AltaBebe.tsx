import { useState, type FormEvent } from 'react'
import { supabase, type Member, type Rol } from '../lib/supabase'
import type { Person } from '../lib/bebe'

type Props = { member: Member; bebe: Person | null; onListo: () => void }

export default function AltaBebe({ member, bebe, onListo }: Props) {
  const [rol, setRol] = useState<Rol | null>(member.rol)
  const [nombre, setNombre] = useState('')
  const [nacio, setNacio] = useState('2026-11-11T07:31')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!rol) return setError('Elige quién eres.')
    setError('')
    setEnviando(true)
    const r1 = await supabase.from('members').update({ rol }).eq('user_id', member.user_id)
    if (r1.error) {
      setEnviando(false)
      return setError(r1.error.message)
    }
    if (!bebe) {
      const at = new Date(nacio)
      const r2 = await supabase.from('people').insert({
        household_id: member.household_id,
        name: nombre.trim(),
        kind: 'bebe',
        birth_at: at.toISOString(),
        birth_date: nacio.slice(0, 10),
      })
      if (r2.error) {
        setEnviando(false)
        return setError(r2.error.message)
      }
    }
    onListo()
  }

  return (
    <main className="pantalla" style={{ justifyContent: 'center' }}>
      <p className="ceja">{bebe ? `Ya está ${bebe.name}` : 'Ha llegado'}</p>
      <h1 className="titular">
        {bebe ? 'Una cosa' : 'Hola,'}
        <br />
        <span className="cursiva">{bebe ? 'antes de entrar.' : 'peque.'}</span>
      </h1>
      <form onSubmit={enviar} className="bloque" style={{ gap: 18 }}>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="bloque">
          <legend className="campo" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--tinta-2)' }}>¿Quién eres?</span>
          </legend>
          <div className="opciones">
            {(
              [
                ['mama', 'Mamá'],
                ['papa', 'Papá'],
                ['otro', 'Otra persona'],
              ] as const
            ).map(([v, t]) => (
              <label key={v}>
                <input type="radio" name="rol" value={v} checked={rol === v} onChange={() => setRol(v)} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        {!bebe && (
          <>
            <div className="campo">
              <label htmlFor="nombre-bebe">¿Cómo se llama?</label>
              <input id="nombre-bebe" required maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="nacio">Nació el</label>
              <input id="nacio" type="datetime-local" required value={nacio} onChange={(e) => setNacio(e.target.value)} />
            </div>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="boton" type="submit" disabled={enviando}>Entrar</button>
      </form>
    </main>
  )
}
