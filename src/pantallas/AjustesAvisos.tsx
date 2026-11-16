import { useEffect, useState } from 'react'
import { supabase, type Member } from '../lib/supabase'

type Prefs = { aviso_tomas: boolean; aviso_saca: boolean | null; aviso_noche: boolean; aviso_comidas: boolean }
type Casa = { toma_cada_min: number; saca_cada_min: number }

const horas = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m}` : `${h} h`
}

export default function AjustesAvisos({ member }: { member: Member }) {
  const [p, setP] = useState<Prefs | null>(null)
  const [c, setC] = useState<Casa | null>(null)
  const [guardado, setGuardado] = useState('')

  useEffect(() => {
    supabase.from('members').select('aviso_tomas, aviso_saca, aviso_noche, aviso_comidas').eq('user_id', member.user_id).single().then(({ data }) => setP(data))
    supabase.from('households').select('toma_cada_min, saca_cada_min').eq('id', member.household_id).single().then(({ data }) => setC(data))
  }, [member.user_id, member.household_id])

  const sacaActivo = p ? (p.aviso_saca ?? member.rol === 'mama') : false

  async function cambiarPrefs(cambio: Partial<Prefs>) {
    if (!p) return
    setP({ ...p, ...cambio })
    const { error } = await supabase.from('members').update(cambio).eq('user_id', member.user_id)
    setGuardado(error ? 'No se ha podido guardar.' : 'Guardado.')
  }

  async function cambiarCasa(cambio: Partial<Casa>) {
    if (!c) return
    setC({ ...c, ...cambio })
    const { error } = await supabase.from('households').update(cambio).eq('id', member.household_id)
    setGuardado(error ? 'No se ha podido guardar.' : 'Guardado para los dos.')
  }

  if (!p || !c) return null

  return (
    <section className="bloque" aria-labelledby="ajustes-avisos">
      <h2 id="ajustes-avisos" className="ceja">Qué me avisa</h2>
      <div className="ajustes">
        <label className="interruptor">
          <span>
            <b>Tomas</b>
            <small>Un aviso cuando pasen {horas(c.toma_cada_min)} desde la última</small>
          </span>
          <input type="checkbox" checked={p.aviso_tomas} onChange={(e) => cambiarPrefs({ aviso_tomas: e.target.checked })} />
        </label>
        <label className="interruptor">
          <span>
            <b>Sacaleches</b>
            <small>Un aviso suave a las {horas(c.saca_cada_min)} sin extraer</small>
          </span>
          <input type="checkbox" checked={sacaActivo} onChange={(e) => cambiarPrefs({ aviso_saca: e.target.checked })} />
        </label>
        <label className="interruptor">
          <span>
            <b>Comidas</b>
            <small>«¿Qué tal?» a las 16:00 y a las 22:00, para que el menú aprenda y la lista cuadre</small>
          </span>
          <input type="checkbox" checked={p.aviso_comidas} onChange={(e) => cambiarPrefs({ aviso_comidas: e.target.checked })} />
        </label>
        <label className="interruptor">
          <span>
            <b>También de noche</b>
            <small>Entre las 00:00 y las 07:00</small>
          </span>
          <input type="checkbox" checked={p.aviso_noche} onChange={(e) => cambiarPrefs({ aviso_noche: e.target.checked })} />
        </label>
        <div className="campo">
          <label htmlFor="toma-cada">Avisar de toma a las (para los dos)</label>
          <select id="toma-cada" value={c.toma_cada_min} onChange={(e) => cambiarCasa({ toma_cada_min: Number(e.target.value) })}>
            {[120, 150, 180, 210, 240].map((m) => <option key={m} value={m}>{horas(m)}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="saca-cada">Avisar de sacaleches a las (para los dos)</label>
          <select id="saca-cada" value={c.saca_cada_min} onChange={(e) => cambiarCasa({ saca_cada_min: Number(e.target.value) })}>
            {[150, 180, 210, 240, 300].map((m) => <option key={m} value={m}>{horas(m)}</option>)}
          </select>
        </div>
      </div>
      <p className="nota">
        Solo llega un aviso por cada hueco: no se repite hasta que apuntéis la siguiente toma o extracción.
        {guardado && ` ${guardado}`}
      </p>
    </section>
  )
}
