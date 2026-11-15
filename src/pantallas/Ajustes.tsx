import { useEffect, useState } from 'react'
import { supabase, type Household, type Member } from '../lib/supabase'
import { enablePush, pushState, sendTest, type PushState } from '../lib/push'
import AjustesAvisos from './AjustesAvisos'
import { IcoVolver } from '../componentes/Iconos'

const textoEstado: Record<PushState, string> = {
  on: 'Este móvil recibe avisos.',
  off: 'Este móvil todavía no recibe avisos.',
  denied: 'Los avisos están bloqueados en este móvil. Actívalos en los ajustes del sistema para Casa.',
  'needs-install': 'En iPhone, primero añade Casa a la pantalla de inicio: botón Compartir → «Añadir a pantalla de inicio». Luego ábrela desde el icono y vuelve aquí.',
  unsupported: 'Este navegador no admite avisos.',
}

export default function Ajustes({ member, onVolver }: { member: Member; onVolver: () => void }) {
  const [casa, setCasa] = useState<Household | null>(null)
  const [miembros, setMiembros] = useState<Member[]>([])
  const [estado, setEstado] = useState<PushState | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    supabase.from('households').select('id, name, invite_code, timezone').eq('id', member.household_id).single().then(({ data }) => setCasa(data))
    supabase.from('members').select('user_id, household_id, display_name, rol').eq('household_id', member.household_id).then(({ data }) => setMiembros(data ?? []))
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
      <div className="cabecera">
        <button className="volver" onClick={onVolver}>
          <IcoVolver />
          Volver
        </button>
      </div>
      <h1 className="titulo">Ajustes</h1>
      <p className="nota">Aquí decides qué te avisa y cuándo. Pocos avisos y solo los que sirven.</p>

      <section className="tarjeta-noche" aria-labelledby="avisos">
        <h2 id="avisos" className="ceja" style={{ margin: 0 }}>Avisos</h2>
        <p style={{ margin: 0, lineHeight: 1.5 }}>{estado ? textoEstado[estado] : '…'}</p>
        {estado === 'off' && (
          <button className="boton" onClick={activar} disabled={ocupado}>Activar avisos en este móvil</button>
        )}
        {estado === 'on' && (
          <button className="boton" onClick={probar} disabled={ocupado}>Enviar un aviso de prueba a los dos</button>
        )}
        {mensaje && <p role="status" style={{ margin: 0, fontSize: 15, color: '#CFCFD4' }}>{mensaje}</p>}
      </section>

      <AjustesAvisos member={member} />

      <section className="bloque">
        <h2 className="ceja">En casa</h2>
        <div>
          {miembros.map((m) => (
            <div className="fila" key={m.user_id}>
              <span style={{ width: 8, height: 8, background: m.user_id === member.user_id ? 'var(--senal)' : 'var(--tinta)' }} aria-hidden="true" />
              <span>{m.display_name}</span>
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

      <button className="boton secundario" onClick={() => supabase.auth.signOut()}>Salir de la cuenta</button>
    </main>
  )
}
