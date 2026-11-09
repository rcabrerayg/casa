import { useEffect, useState } from 'react'
import { supabase, type Household, type Member } from '../lib/supabase'
import { enablePush, pushState, sendTest, type PushState } from '../lib/push'

const TZ = 'Atlantic/Canary'

function hoy() {
  const d = new Date()
  const parte = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...o }).format(d)
  const hora = Number(parte({ hour: 'numeric', hour12: false }))
  return {
    dia: parte({ day: 'numeric' }),
    ceja: `${parte({ weekday: 'long' })} · ${parte({ month: 'long' })}`,
    saludo: hora < 6 ? 'Buenas noches,' : hora < 14 ? 'Buenos días,' : hora < 21 ? 'Buenas tardes,' : 'Buenas noches,',
  }
}

const textoEstado: Record<PushState, string> = {
  on: 'Este móvil recibe avisos.',
  off: 'Este móvil todavía no recibe avisos.',
  denied: 'Los avisos están bloqueados en este móvil. Actívalos en los ajustes del sistema para Casa.',
  'needs-install': 'En iPhone, primero añade Casa a la pantalla de inicio: botón Compartir → «Añadir a pantalla de inicio». Luego ábrela desde el icono y vuelve aquí.',
  unsupported: 'Este navegador no admite avisos.',
}

export default function Hoy({ member }: { member: Member }) {
  const f = hoy()
  const [casa, setCasa] = useState<Household | null>(null)
  const [miembros, setMiembros] = useState<Member[]>([])
  const [estado, setEstado] = useState<PushState | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    supabase.from('households').select('id, name, invite_code, timezone').eq('id', member.household_id).single().then(({ data }) => setCasa(data))
    supabase.from('members').select('user_id, household_id, display_name').eq('household_id', member.household_id).then(({ data }) => setMiembros(data ?? []))
    pushState().then(setEstado)
  }, [member.household_id])

  async function activar() {
    setMensaje('')
    setOcupado(true)
    try {
      await enablePush(member.household_id)
      setEstado(await pushState())
      setMensaje('Listo. Prueba a enviar un aviso.')
    } catch (e) {
      setMensaje((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function probar() {
    setMensaje('')
    setOcupado(true)
    try {
      const r = await sendTest()
      setMensaje(r.devices === 0 ? 'Ningún móvil tiene los avisos activados todavía.' : `Enviado a ${r.sent} de ${r.devices} móviles.`)
    } catch (e) {
      setMensaje((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const otros = miembros.filter((m) => m.user_id !== member.user_id)

  return (
    <main className="pantalla">
      <p className="ceja">{f.ceja}</p>
      <div className="portada">
        <span className="dia">{f.dia}</span>
        <h1>
          {f.saludo}
          <br />
          <span className="cursiva">{member.display_name}.</span>
        </h1>
      </div>
      <p className="apagado" style={{ margin: '-6px 0 0', fontSize: 15, lineHeight: 1.5 }}>
        Casa está en obras: de momento solo comprobamos que los avisos llegan a los dos móviles.
      </p>

      <section className="tarjeta-noche" aria-labelledby="avisos">
        <h2 id="avisos" className="ceja" style={{ margin: 0 }}>Avisos</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{estado ? textoEstado[estado] : '…'}</p>
        {estado === 'off' && (
          <button className="boton" onClick={activar} disabled={ocupado}>Activar avisos en este móvil</button>
        )}
        {estado === 'on' && (
          <button className="boton" onClick={probar} disabled={ocupado}>Enviar un aviso de prueba a los dos</button>
        )}
        {mensaje && <p role="status" style={{ margin: 0, fontSize: 14, color: '#CFCFD4' }}>{mensaje}</p>}
      </section>

      <section className="bloque">
        <h2 className="ceja">En casa</h2>
        <div>
          {miembros.map((m) => (
            <div className="fila" key={m.user_id}>
              <span style={{ width: 8, height: 8, background: m.user_id === member.user_id ? 'var(--senal)' : 'var(--tinta)' }} aria-hidden="true" />
              <span style={{ fontSize: 16 }}>{m.display_name}</span>
            </div>
          ))}
        </div>
        {otros.length === 0 && casa && (
          <div className="aviso">
            <p style={{ margin: '0 0 6px' }}>Para que entre la otra persona: que abra Casa, cree su cuenta, pulse «Me han dado un código» y escriba este:</p>
            <span className="codigo">{casa.invite_code}</span>
          </div>
        )}
      </section>

      <button className="enlace" style={{ alignSelf: 'flex-start' }} onClick={() => supabase.auth.signOut()}>Salir</button>
    </main>
  )
}
