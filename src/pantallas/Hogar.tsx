import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Props = { userId: string; onListo: () => void }

export default function Hogar({ onListo }: Props) {
  const [modo, setModo] = useState<'crear' | 'unirse'>('crear')
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { data, error } =
      modo === 'crear'
        ? await supabase.rpc('create_household', { p_name: 'Casa', p_display_name: nombre })
        : await supabase.rpc('join_household', { p_code: codigo, p_display_name: nombre })
    setEnviando(false)
    if (error) {
      setError(error.message.includes('Código') ? 'Ese código no existe. Revísalo.' : error.message)
      return
    }
    void data
    onListo()
  }

  return (
    <main className="pantalla" style={{ justifyContent: 'center' }}>
      <p className="ceja">Primer paso</p>
      <h1 className="titular">
        {modo === 'crear' ? 'Vuestra casa,' : 'Únete a'}
        <br />
        <span className="cursiva">{modo === 'crear' ? 'empieza aquí.' : 'tu casa.'}</span>
      </h1>
      <form onSubmit={enviar} className="bloque" style={{ gap: 14 }}>
        <div className="campo">
          <label htmlFor="nombre">¿Cómo te llamamos?</label>
          <input id="nombre" required maxLength={40} autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        {modo === 'unirse' && (
          <div className="campo">
            <label htmlFor="codigo">Código de la casa (te lo da quien la creó)</label>
            <input id="codigo" required autoCapitalize="none" autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="boton" type="submit" disabled={enviando}>
          {modo === 'crear' ? 'Crear la casa' : 'Unirme'}
        </button>
      </form>
      <button className="enlace" type="button" onClick={() => setModo(modo === 'crear' ? 'unirse' : 'crear')}>
        {modo === 'crear' ? 'Me han dado un código' : 'Prefiero crear una casa nueva'}
      </button>
    </main>
  )
}
