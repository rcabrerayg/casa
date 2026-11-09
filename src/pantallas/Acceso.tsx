import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Acceso() {
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { error } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setEnviando(false)
    if (error) setError(modo === 'entrar' ? 'Email o contraseña incorrectos.' : error.message)
  }

  return (
    <main className="pantalla" style={{ justifyContent: 'center' }}>
      <p className="ceja">Casa</p>
      <h1 className="titular">
        Lo de casa,
        <br />
        <span className="cursiva">sin ruido.</span>
      </h1>
      <form onSubmit={enviar} className="bloque" style={{ gap: 14 }}>
        <div className="campo">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="password">Contraseña {modo === 'registro' && '(mínimo 10 caracteres)'}</label>
          <input
            id="password"
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            minLength={10}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="boton" type="submit" disabled={enviando}>
          {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
      <button className="enlace" type="button" onClick={() => setModo(modo === 'entrar' ? 'registro' : 'entrar')}>
        {modo === 'entrar' ? 'Es la primera vez: crear cuenta' : 'Ya tengo cuenta: entrar'}
      </button>
    </main>
  )
}
