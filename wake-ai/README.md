# WAKE AI

> "No te despierta. Se asegura de que te levantes."

Agente de voz que despierta al usuario conversando con él — no una app de
alarma que reproduce un archivo de audio. Este documento explica la
arquitectura, las decisiones técnicas y, siguiendo la regla más importante
del brief, **qué funciona de verdad hoy y qué tiene limitaciones reales**.

## 1. Cómo correrlo

```bash
cd wake-ai
npm install

# Web (la forma más rápida de probar el loop de voz completo, incluye STT real
# vía Web Speech API):
npm run web

# Android/iOS con Expo Go (sin STT nativo, ver §4):
npm start

# Build de desarrollo con STT nativo real (requiere Android Studio / Xcode):
npm run android
npm run ios
```

`npm run typecheck` corre `tsc --noEmit` (usado para verificar este proyecto
antes de cada entrega — cero errores en el estado actual).

## 2. Arquitectura (spec §14)

```
src/
  types/               contratos de dominio compartidos por todo lo demás
  core/
    personality/        BUILTIN_PERSONALITIES + PHRASE_BANK (plantillas)
    intensity/           motor de niveles 1-10 y elección de estrategia
    agent/               IAIProvider (interfaz) + 2 implementaciones + orquestador
    speech/              ITextToSpeech / ISpeechToText (interfaces) + impls
    audio/               IAudioPlayer (interfaz) + expo-av + biblioteca de sonidos
    alarm/               IAlarmScheduler (interfaz) + expo-notifications + máquina de estados
    memory/               aprendizaje persistente (AsyncStorage) + insights
    stats/                funciones puras: eventos -> métricas del dashboard
    storage/              wrapper tipado sobre AsyncStorage
    morning/              clima (Open-Meteo) + calendario + resumen hablado
  state/                 store global (zustand) — única fuente de verdad de UI
  navigation/             stack de React Navigation
  screens/, components/  UI
```

**Regla de diseño**: cada proveedor externo (IA, STT, TTS, audio, alarmas)
está detrás de una interfaz (`IAIProvider`, `ISpeechToText`,
`ITextToSpeech`, `IAudioPlayer`, `IAlarmScheduler`). Nada en `screens/` o
`state/` importa un SDK externo directamente — importa la interfaz y una
fábrica (`providerFactory.ts`, `createSpeechToText()`, etc.) decide la
implementación concreta. Esto es lo que permite, por ejemplo, cambiar el
motor de IA de "reglas offline" a "Claude real" con un toggle en Ajustes sin
tocar ninguna pantalla (spec §14/§15).

## 3. El ciclo de conversación (spec §4)

```
MICRÓFONO → STT (texto) → ConversationAgent.handleUserUtterance()
   → IntensityEngine (clasifica la respuesta, decide próximo nivel/estrategia)
   → IAIProvider.generateReply() (arma el texto)
   → TTS.speak()
```

`ConversationAgent` (`core/agent/conversationAgent.ts`) es el objeto que
vive durante toda una alarma activa: mantiene el historial de turnos, el
nivel de intensidad actual, el conteo de posposiciones y decide cuándo el
usuario pasó de `sleeping` a `confirmed_awake`.

### Motor de intensidad, no solo volumen (spec §2)

`core/intensity/intensityEngine.ts` implementa la tabla de 10 niveles del
brief (SUAVE → MODO EXTREMO) y, más importante, **no escala solo por
tiempo**: clasifica cada respuesta del usuario como `resistance`,
`compliance` o `neutral` (regex sobre frases típicas en español rioplatense
— "cinco minutos", "estoy cansado", "listo", "ya me levanté", etc.) y sube,
baja o mantiene el nivel según eso. El nivel 9 ("usa lo que históricamente
funcionó") lee `memoryHints`, generados por `MemoryStore.getMemoryHints()` a
partir de qué estrategias llevaron a un despertar completado en el pasado.

### Dos proveedores de IA intercambiables (spec §15/§17)

- **`RuleBasedAIProvider`** (default, siempre funciona, cero configuración):
  arma cada línea en tiempo real combinando el banco de frases de la
  personalidad activa (`core/personality/personalities.ts`) con el contexto
  vivo (cuántas veces pospuso, objetivo personal, minutos transcurridos).
  No es un array de audios pregrabados: la variación viene de la
  combinación estrategia × personalidad × slots, y el resultado se lee en
  voz alta con TTS real. Funciona sin conexión y sin costo.
- **`AnthropicAIProvider`** (opt-in, requiere que el usuario pegue su propia
  API key en Ajustes): arma un system prompt con exactamente los campos que
  pide el brief (hora actual, hora objetivo, intensidad, historial,
  personalidad, veces pospuesto, tiempo transcurrido, objetivo personal,
  memoria) y llama a `api.anthropic.com/v1/messages` directo desde el
  dispositivo. Incluye reglas de seguridad explícitas en el prompt (nada de
  amenazas reales, humillación extrema o instrucciones peligrosas). Si la
  llamada falla (sin red, key inválida), `providerFactory.ts` cae
  automáticamente al proveedor offline en vez de romper la alarma.

## 4. Limitaciones reales (spec §17 — esto no se esconde)

| Área | Qué funciona hoy | Limitación real |
|---|---|---|
| **Texto a voz** | `expo-speech` funciona nativo en Expo Go y en builds, sin configuración | El catálogo de voces/idiomas depende del motor TTS del sistema operativo |
| **Voz a texto** | Funciona hoy en **web** (`npm run web`, Web Speech API) y en una **build de desarrollo** nativa (`expo-speech-recognition`) | **No funciona dentro de Expo Go** en iOS/Android: es un módulo nativo, Expo Go no permite módulos nativos de terceros. La app lo detecta y muestra un campo de texto como alternativa en vez de fingir que escucha |
| **Notificaciones/alarma programada** | `expo-notifications` dispara notificaciones locales exactas incluso con la app en background o el teléfono bloqueado | El SO puede demorar unos minutos el disparo si aplica optimizaciones agresivas de batería (Doze en Android, App Refresh restringido en iOS). No hay forma de evitar esto sin un módulo nativo tipo `AlarmManager` — la interfaz `IAlarmScheduler` está preparada para ese swap el día que se necesite |
| **Sonidos de la biblioteca** | Importar sonidos propios desde el dispositivo funciona 100% (`expo-document-picker` + `expo-file-system`) | El catálogo integrado (Relax, Rock, etc.) **no trae archivos de música con copyright de terceros** — son metadatos; hay que agregar archivos propios/con licencia en `assets/sounds/` (instrucciones en ese directorio). La UI marca cada sonido sin archivo como "necesita archivo" en vez de simular que suena |
| **Clima / calendario del asistente de mañana** | Clima real vía Open-Meteo (sin API key) usando la ubicación del dispositivo; calendario real vía `expo-calendar` leyendo el primer evento del día | Ambos dependen de que el usuario otorgue permiso; si lo niega, esa sección del resumen simplemente no aparece (no se inventa un dato) |
| **IA con LLM real** | Funciona con una API key de Anthropic propia del usuario | Requiere conexión a internet y tiene costo por request; por eso no es el modo default |

## 5. Estado de ánimo / máquina de estados (spec §6)

`core/alarm/wakeStateMachine.ts`: `sleeping → waking → awake →
confirmed_awake`. Un solo tap en "Estoy despierto" alcanza para pasar a
`awake`, pero llegar a `confirmed_awake` (lo único que cuenta como alarma
completada en las estadísticas) requiere una señal más fuerte: una
respuesta de voz/texto, o — en modo "No me dejes dormir" — completar la
secuencia de acciones pedidas.

## 6. Modo "No me dejes dormir" (spec §7)

`RuleBasedAIProvider` mantiene una secuencia fija (sentate → parate → andá
a la ventana → agua → lavate la cara). Cada acción completada (detectada
por el clasificador de "compliance" sobre la respuesta del usuario)
descuenta un contador; `ActiveAlarmScreen` no habilita la confirmación
final de "despierto" hasta que el contador llega a cero.

## 7. Fricción en "posponer" (spec §11)

El botón de posponer no es un tap simple: hay que mantenerlo presionado
~1.6s (`onLongPress` + `delayLongPress`), y mientras tanto el agente ya
respondió con una línea de la estrategia `negociar`/`consecuencias`. Esto
cumple el pedido explícito del brief de que posponer no sea "demasiado
fácil".

## 8. Memoria y estadísticas (spec §8/§12)

Cada ciclo de alarma completado se guarda como un `AlarmEvent` en
AsyncStorage (`core/memory/memoryStore.ts`). `core/stats/statsEngine.ts` son
funciones puras que convierten esos eventos en las métricas del dashboard
(promedio para despertarse, racha, personalidad más efectiva, mejor/peor
día). `MemoryStore.getInsights()` genera el tipo de sugerencia del brief
("noté que los lunes necesitás más intensidad, ¿activo Coach
automáticamente?") comparando la intensidad promedio por día contra el
promedio general — y el botón de esa sugerencia aplica el cambio de verdad
sobre las alarmas existentes, no es decorativo.

## 9. MVP vs. resto del roadmap (spec §16)

Implementado en este MVP:
1. Crear alarma (hora, días, personalidad, intensidad, sonido, modo, objetivo) ✅
2. Programar la alarma con notificaciones locales reales ✅
3. Reproducir sonido (con volumen progresivo) ✅
4. Conversar por voz con el agente ✅ (con las limitaciones de STT documentadas en §4)
5. Speech-to-text (web + build nativa) ✅
6. IA genera respuesta dinámica (offline por defecto, LLM real opt-in) ✅
7. Text-to-speech real ✅
8. Motor de niveles de intensidad adaptativo ✅
9. 6 personalidades + personalidad custom ✅
10. Confirmación de que el usuario despertó (máquina de estados) ✅
11. Estadísticas básicas + memoria/insights ✅

Pendiente para después del MVP (spec §16, segunda etapa): wearables,
detección de actividad vía sensores de movimiento, automatizaciones más
avanzadas, sincronización entre dispositivos.
