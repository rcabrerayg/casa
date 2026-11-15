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
  'Pecho, sacaleches, jeringa o biberón: lo importante es que {bebe} come y tú te cuidas.',
  'Que duela no significa que lo estés haciendo mal. Las grietas tienen arreglo; pedir ayuda es parte del camino.',
  'Cada ml que te sacas es tuyo y de {bebe}. Cuenta todo, lo poco también.',
  'Tus ganas de darle el pecho ya son una forma de cuidarle. Hoy le alimentas igual, de otra manera.',
  'Proteger tus pezones para volver al pecho cuando se curen es una decisión valiente y sensata.',
  'Tu marido y {bebe} te quieren con locura. Hoy, mañana y siempre.',
  'En casa valoramos muchísimo todo lo que haces por {bebe}. Cada esfuerzo se ve y se agradece.',
  'Gracias por cada noche, cada toma y cada ml. Esta familia va bien porque tú la sostienes con amor.',
  '{bebe} reconoce tu olor, tu voz y tu latido. Para él, tú eres casa.',
  'Cuando {bebe} se calma en tus brazos, es porque contigo se siente a salvo.',
  'Algún día le contaremos a {bebe} todo lo que hiciste por él estas semanas. Y estará muy orgulloso de su madre.',
  'Eres más fuerte de lo que crees y más querida de lo que imaginas.',
  'No estás sola: somos un equipo, y tú eres el corazón.',
  'Lo que haces ahora mismo es amor en estado puro.',
  'Qué suerte tiene {bebe} de tenerte como madre.',
  'Mira lo que habéis creado juntos. Es precioso, y tú también.',
  'Hoy también lo estás haciendo genial, aunque estés cansada.',
  'Tu sonrisa es lo primero que {bebe} está aprendiendo a buscar.',
  'Estamos muy orgullosos de ti. Mucho.',
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
  'Lava y prepara el sacaleches para que ella no tenga que pensar en ello.',
  'Cuando se saque leche, siéntate con ella o tráele agua y algo de picar.',
  'Dale tú la leche con la jeringa y deja que ella cierre los ojos un rato.',
  'Pide cita con la matrona o una asesora de lactancia por las grietas: quítale esa gestión.',
  'Recuérdale que cada ml cuenta, aunque hoy salga poco.',
  'Dile hoy que la quieres y que estás orgulloso de ella. En voz alta y mirándola.',
  'Dale las gracias por algo que haya hecho por {bebe} hoy. Lo notará.',
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
  const ext = h24.filter((e) => e.kind === 'extraccion')
  const mlExt = ext.reduce((a, e) => a + (e.ml ?? 0), 0)

  if (c.esMama) {
    if (noche >= 2 && horaLocal(c.ahora) < 13) ctx.push(`Esta noche ha habido ${noche} tomas. Nadie lo ha visto, pero aquí queda: lo estás haciendo.`)
    if (dias !== null && dias >= 1) ctx.push(`{bebe} cumple hoy ${dias} ${dias === 1 ? 'día' : 'días'}. Y tú, ${dias} ${dias === 1 ? 'día' : 'días'} como madre. Qué viaje.`)
    if (dias !== null && dias >= 2 && dias <= 10)
      ctx.push('Estos días las hormonas bajan de golpe y es normal tener lágrimas sin motivo. No estás sola. Si pesa demasiado o dura más de un par de semanas, cuéntaselo a la matrona.')
    if (tomas >= 6) ctx.push(`${tomas} tomas en 24 horas. Eso es dedicación pura.`)
    if (ext.length >= 1)
      ctx.unshift(
        mlExt > 0
          ? `Hoy te has sacado ${mlExt} ml para {bebe}. Eso es amor del bueno.`
          : `Llevas ${ext.length} ${ext.length === 1 ? 'extracción' : 'extracciones'} hoy. Cada una cuenta, salga lo que salga.`,
      )
  } else {
    if (noche >= 2 && horaLocal(c.ahora) < 13) ctx.push(`Esta noche ha habido ${noche} tomas. Hoy recuérdale a {mama} lo bien que lo ha hecho.`)
    if (mlExt > 0) ctx.unshift(`{mama} se ha sacado hoy ${mlExt} ml para {bebe}. Díselo: lo estás viendo y es enorme.`)
    if (dias !== null && dias >= 2 && dias <= 10)
      ctx.push('Estos días son de bajón hormonal. Si la ves llorar sin motivo, es normal: lo que más ayuda es que estés cerca y le quites carga.')
  }

  const base = c.esMama ? paraElla : paraEl
  // Orden estable por franja de 3 horas: no cambia a cada vistazo.
  const franja = Math.floor(c.ahora / (3 * 3600_000))
  const rotada = base.map((_, i) => base[(i + franja) % base.length])
  return [...ctx, ...rotada].map((t) => ({ texto: sub(t), para: c.esMama ? `Para ti, ${c.mama}` : `Para ${c.mama}` }))
}
