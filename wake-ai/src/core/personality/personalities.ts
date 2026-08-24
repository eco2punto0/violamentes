import type { PersonalityId, PersonalityProfile, Strategy } from "@/types";

export const BUILTIN_PERSONALITIES: Record<Exclude<PersonalityId, "custom">, PersonalityProfile> = {
  friend: {
    id: "friend",
    name: "Friend",
    tagline: "Tu amigo cercano. Cálido, directo, nunca te deja tirado.",
    tone: ["cercano", "cálido", "informal", "compinche"],
    voice: { pitch: 1.05, rate: 1.0 },
  },
  coach: {
    id: "coach",
    name: "Coach",
    tagline: "Entrenador. Te trata como a un atleta con objetivos.",
    tone: ["enérgico", "orientado a metas", "exigente pero justo"],
    voice: { pitch: 1.0, rate: 1.05 },
  },
  military: {
    id: "military",
    name: "Military",
    tagline: "Estilo militar. Intenso, corto, sin vueltas — nunca abusivo.",
    tone: ["seco", "disciplinado", "sin rodeos"],
    voice: { pitch: 0.85, rate: 1.15 },
  },
  comedian: {
    id: "comedian",
    name: "Comedian",
    tagline: "Usa el humor para bajarte la resistencia.",
    tone: ["irónico", "juguetón", "absurdo"],
    voice: { pitch: 1.15, rate: 1.05 },
  },
  motivator: {
    id: "motivator",
    name: "Motivator",
    tagline: "Inspiracional. Te conecta con el por qué.",
    tone: ["inspirador", "reflexivo", "cálido"],
    voice: { pitch: 1.0, rate: 0.95 },
  },
  strict: {
    id: "strict",
    name: "Strict",
    tagline: "Directo y firme. Cero negociación.",
    tone: ["firme", "seco", "sin humor"],
    voice: { pitch: 0.95, rate: 1.05 },
  },
};

/**
 * Phrase bank: [personality][strategy] -> template pool.
 * Templates use {slots} filled at generation time (see ruleBasedProvider.ts).
 * This is NOT a lookup of pre-recorded audio — it feeds the TTS engine live,
 * and gets combined with live context (snooze count, elapsed time, goal),
 * so the same template rarely produces the same spoken line twice in a row.
 */
export const PHRASE_BANK: Record<Exclude<PersonalityId, "custom">, Record<Strategy, string[]>> = {
  friend: {
    convencer: [
      "Dale hermano, levantate. Sé que cuesta pero vos podés.",
      "Vení, sentate conmigo un segundo. Ya está, ya casi.",
    ],
    motivar: ["Dale hermano, levantate. Hoy puede ser un buen día si arrancás bien.", "Vamos que se puede. Un paso a la vez."],
    humor: ["Che, la cama no se va a ninguna parte. Va a estar ahí esta noche, prometido.", "Otra vez peleando con la almohada, ¿eh?"],
    provocar: ["¿En serio otra vez la misma excusa que ayer?", "Ta, ta. Ya la escuché esa."],
    desafiar: ["A ver si hoy sos capaz de levantarte a la primera.", "Te apuesto a que no aguantás ni un minuto más ahí."],
    negociar: ["Bueno, un ratito más, pero después te sentás. Trato.", "Ok, pero contame algo mientras: ¿qué tenés hoy?"],
    insistir: ["Dale, dale, dale. Vamos.", "Ey. Ey. Seguís ahí. Vamos."],
    consecuencias: ["Eso dijiste ayer. Y terminaste levantándote casi una hora tarde.", "La última vez llegaste corriendo, ¿te acordás?"],
    objetivo_personal: ["Te acordás que querías {personalGoal}. Hoy es un buen día para arrancar.", "{personalGoal} no se hace solo, hermano."],
  },
  coach: {
    convencer: ["Vamos. Primer objetivo del día: salir de la cama.", "Este es el primer ejercicio del día y ya lo tenés armado."],
    motivar: ["Vos decidís cómo arranca tu día. Arranquemos fuerte.", "Cada día que te levantás rápido, ganás. Sumá una victoria más."],
    humor: ["El colchón no cuenta como rival serio, ¿o sí?", "Técnicamente ya perdiste el primer round contra la almohada."],
    provocar: ["¿Eso es todo lo que tenés hoy?", "Pensé que veníamos por más."],
    desafiar: ["Objetivo: pies al piso en 10 segundos. Empezamos a contar.", "A ver si superás tu marca de ayer."],
    negociar: ["Te doy 30 segundos, no más. Después seguimos con el plan.", "Un descanso corto, pero el plan sigue en pie."],
    insistir: ["Dale. Pies al piso. Ahora.", "Vamos, vamos, vamos. No aflojamos."],
    consecuencias: ["Cada minuto que perdés acá, lo perdés de tu entrenamiento real.", "Ayer perdiste el ritmo por esto mismo."],
    objetivo_personal: ["Tu objetivo era {personalGoal}. Este es el primer paso.", "{personalGoal} arranca acá, en este segundo."],
  },
  military: {
    convencer: ["Arriba. Ahora. Es la orden del día.", "Reporte de pie. Se acabó el descanso."],
    motivar: ["Cada soldado que se levanta rápido gana terreno. Ganá el tuyo.", "La disciplina empieza en este segundo."],
    humor: ["La cama no figura en el manual de operaciones.", "Rendirse ante una sábana no es una opción registrada."],
    provocar: ["¿Esa es tu mejor respuesta?", "Esperaba más disciplina."],
    desafiar: ["Diez segundos para estar sentado. Cuenta regresiva iniciada.", "Demostrá que podés cumplir la orden."],
    negociar: ["Treinta segundos. No más. Es el límite autorizado.", "Concedido un breve margen. Se acaba ya."],
    insistir: ["Arriba. Ahora.", "De pie. Repito: de pie."],
    consecuencias: ["La demora de ayer generó una salida tarde. No se repite.", "Cada segundo de más acá se paga después."],
    objetivo_personal: ["Su objetivo declarado fue {personalGoal}. Cúmplalo.", "{personalGoal} requiere que se levante ahora."],
  },
  comedian: {
    convencer: ["Vamos, la sábana ganó anoche. Hoy le toca perder a ella.", "Tu cama te ama pero no te conviene, créeme."],
    motivar: ["El día no arrancó todavía. Vos tenés el control remoto.", "Sos el protagonista, no podés faltar a tu propia película."],
    humor: ["Felicitaciones. Has vuelto a perder la batalla contra una sábana.", "Nivel del jefe final: tu almohada. Todavía no la venciste."],
    provocar: ["¿Esa excusa la escribiste vos o la reciclaste de ayer?", "Guau, qué creatividad para seguir durmiendo."],
    desafiar: ["A que no te levantás antes de que termine de hablar.", "Reto: un pie afuera de la cama. Ya."],
    negociar: ["Te doy cinco segundos de gracia, cómicos incluidos.", "Ok, un chiste más y después te sentás. Sin trampa."],
    insistir: ["Arriba, arriba, arriba. Se acabó el show de dormir.", "Función terminada. Bajá el telón de los ojos cerrados."],
    consecuencias: ["Ayer esto mismo te costó llegar corriendo en pijama mental.", "Spoiler: esto ya lo vivimos y no salió bien."],
    objetivo_personal: ["Recordá: querías {personalGoal}. Ese chiste no se cuenta solo.", "{personalGoal} te espera, no la cama."],
  },
  motivator: {
    convencer: ["El día todavía no empezó. Vos decidís cómo empieza.", "Este momento es tuyo. Usalo."],
    motivar: ["Cada mañana es una página en blanco. Escribí algo bueno.", "Lo que hagas en el próximo minuto define el resto del día."],
    humor: ["Hasta los héroes tienen que salir de la cama en algún momento.", "La motivación no llega acostado, dicen."],
    provocar: ["¿Vas a dejar que un colchón decida tu día?", "¿Eso es lo mejor que podés darle a hoy?"],
    desafiar: ["Demostrate a vos mismo que podés empezar distinto hoy.", "El primer desafío del día es este. Superalo."],
    negociar: ["Un minuto para respirar, después empezamos de verdad.", "Está bien, tomate un respiro. Pero el día sigue esperando."],
    insistir: ["Vamos. Este es el momento.", "No lo pienses más. Empezá."],
    consecuencias: ["Cada día que arrancás tarde, le restás tiempo a lo que querés lograr.", "Ayer lo sentiste: arrancar tarde te costó el resto del día."],
    objetivo_personal: ["Te acordás por qué querías {personalGoal}. Hoy es el día.", "{personalGoal} no espera a que estés listo. Empezá ahora."],
  },
  strict: {
    convencer: ["No. No hay cinco minutos más. Levantate.", "Es hora. No hay otra opción sobre la mesa."],
    motivar: ["Levantate y hacelo bien desde el primer minuto.", "Empezar ahora es la única opción razonable."],
    humor: ["No, esto no es negociable ni divertido. Levantate.", "El humor viene después de levantarte, no antes."],
    provocar: ["¿Vas a seguir postergando lo inevitable?", "Esto no mejora quedándote ahí."],
    desafiar: ["Tenés diez segundos. Usalos bien.", "Demostrá que podés cumplir lo que decidiste anoche."],
    negociar: ["Te doy 30 segundos. Es el único margen que doy.", "No hay negociación extendida. 30 segundos."],
    insistir: ["Levantate. Ahora.", "No. Levantate ya."],
    consecuencias: ["Cada demora de hoy se paga en tu horario de mañana.", "Ayer esto mismo te salió caro. No se repite."],
    objetivo_personal: ["Definiste {personalGoal} como prioridad. Actuá en consecuencia.", "{personalGoal} exige que te levantes ahora, no en un rato."],
  },
};

export function getPersonality(
  id: PersonalityId,
  customProfiles: PersonalityProfile[]
): PersonalityProfile {
  if (id === "custom") {
    return (
      customProfiles[0] ?? {
        id: "custom",
        name: "Custom",
        tagline: "Tu personalidad, tus reglas.",
        tone: ["personalizado"],
        voice: { pitch: 1.0, rate: 1.0 },
        isCustom: true,
      }
    );
  }
  return BUILTIN_PERSONALITIES[id];
}

export const ALL_BUILTIN_PERSONALITIES: PersonalityProfile[] = Object.values(BUILTIN_PERSONALITIES);
