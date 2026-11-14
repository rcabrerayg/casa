// Mensajes de ánimo para la mamá. Cálidos y honestos: sin presión sobre cómo
// alimentar, sin "tienes que", sin consejos médicos.
import { TZ, type BabyEvent } from './bebe'

type Ctx = {
  esMama: boolean
  mama: string
  bebe: string
  birthAt: string | null
  eventos: BabyEvent[]
  ahora: number
}

const paraElla = [
  'Tu cuerpo ha hecho algo enorme. Se merece tiempo, calma y nada de prisas.',
  '{bebe} no necesita una madre perfecta. Te necesita a ti, tal como eres hoy.',
  'Cada toma, cada cambio, cada noche en vela cuenta aunque nadie la vea. Aquí sí se ve.',
  'Descansar también es cuidar de {bebe}.',
  'Pedir ayuda no es fallar: es organizar el equipo.',
  'Hoy basta con lo básico: {bebe} comido, tú con agua y algo de comer. Lo demás puede esperar.',
  '{bebe} está aprendiendo a conocerte y tú a {bebe}. Cada uno a su ritmo, y está bien.',
  'Si hoy cuesta, es porque es difícil, no porque lo estés haciendo mal.',
  'Lo que sientes es válido, sea lo que sea.',
  'Ha sido un camino difícil y aquí estás. Eso dice muchísimo de ti.',
  'La mejor forma de alimentar a {bebe} es la que os funciona a los dos.',
  'Te mereces el mismo cuidado que le das a {bebe}.',
  'No hay que ganarse el descanso. Si puedes dormir un rato, duerme.',
  'Mírate con la ternura con la que miras a {bebe}.',
]

const paraEl = [
  'Díselo hoy en voz alta: lo está haciendo muy bien.',
  'Llévale agua y algo de comer sin que tenga que pedirlo.',
  'Encárgate tú del próximo cambio para que pueda descansar un rato seguido.',
  'Agradécele algo concreto de hoy, no en general.',
  'Las visitas, las gestionas tú: que ella decida si hoy hay o no.',
  'Pregúntale cómo está ella, no solo cómo está {bebe}.',
  'Si llora, no hace falta arreglar nada. Acompáñala.',
  'Que hoy no tenga que pensar en nada de casa. Eso lo llevas tú.',
  'Recuérdale lo que ha superado para llegar hasta aquí.',
]

const horaLocal = (ms: number) => Number(new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date(ms)))

function tomasNoche(eventos: BabyEvent[], ahora: number) {
  // Tomas entre las 00:00 y las 07:00 de las últimas 14 horas.
  return eventos.filter((e) => {
    const t = new Date(e.at).getTime()
    return e.kind === 'toma' && ahora - t < 14 * 3600_000 && horaLocal(t) < 7
  }).length
}

export type Mensaje = { texto: string; para: string }

/** Devuelve los mensajes posibles ahora, los de contexto primero. */
export function mensajes(c: Ctx): Mensaje[] {
  const sub = (s: string) => s.replaceAll('{bebe}', c.bebe).replaceAll('{mama}', c.mama)
  const ctx: string[] = []
  const dias = c.birthAt ? Math.floor((c.ahora - new Date(c.birthAt).getTime()) / 86400_000) : null
  const noche = tomasNoche(c.eventos, c.ahora)
  const h24 = c.eventos.filter((e) => c.ahora - new Date(e.at).getTime() < 86400_000)
  const tomas = h24.filter((e) => e.kind === 'toma').length

  if (c.esMama) {
    if (noche >= 2 && horaLocal(c.ahora) < 13) ctx.push(`Esta noche ha habido ${noche} tomas. Nadie lo ha visto, pero aquí queda: lo estás haciendo.`)
    if (dias !== null && dias >= 1) ctx.push(`{bebe} cumple hoy ${dias} ${dias === 1 ? 'día' : 'días'}. Y tú, ${dias} ${dias === 1 ? 'día' : 'días'} como madre. Qué viaje.`)
    if (dias !== null && dias >= 2 && dias <= 10)
      ctx.push('Estos días las hormonas bajan de golpe y es normal tener lágrimas sin motivo. No estás sola. Si pesa demasiado o dura más de un par de semanas, cuéntaselo a la matrona.')
    if (tomas >= 6) ctx.push(`${tomas} tomas en 24 horas. Eso es dedicación pura.`)
  } else {
    if (noche >= 2 && horaLocal(c.ahora) < 13) ctx.push(`Esta noche ha habido ${noche} tomas. Hoy recuérdale a {mama} lo bien que lo ha hecho.`)
    if (dias !== null && dias >= 2 && dias <= 10)
      ctx.push('Estos días son de bajón hormonal. Si la ves llorar sin motivo, es normal: lo que más ayuda es que estés cerca y le quites carga.')
  }

  const base = c.esMama ? paraElla : paraEl
  // Orden estable por franja de 3 horas: no cambia a cada vistazo.
  const franja = Math.floor(c.ahora / (3 * 3600_000))
  const rotada = base.map((_, i) => base[(i + franja) % base.length])
  return [...ctx, ...rotada].map((t) => ({ texto: sub(t), para: c.esMama ? `Para ti, ${c.mama}` : `Para ${c.mama}` }))
}
