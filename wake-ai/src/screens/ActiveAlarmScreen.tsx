import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useWakeAIStore } from "@/state/store";
import { getPersonality } from "@/core/personality/personalities";
import { createAIProvider } from "@/core/agent/providerFactory";
import { ConversationAgent } from "@/core/agent/conversationAgent";
import { ExpoTextToSpeech } from "@/core/speech/tts";
import { createSpeechToText } from "@/core/speech/stt";
import { ExpoAudioPlayer } from "@/core/audio/audioPlayer";
import { resolveSoundSource } from "@/core/audio/soundLibrary";
import { evaluateConfirmation } from "@/core/alarm/wakeStateMachine";
import { classifyUtterance } from "@/core/intensity/intensityEngine";
import { memoryStore } from "@/core/memory/memoryStore";
import { morningAssistant, type MorningBriefing } from "@/core/morning/morningAssistant";
import { intensityColor, theme } from "@/theme";
import PulsingOrb from "@/components/PulsingOrb";
import GlowButton from "@/components/GlowButton";
import type { AlarmEvent, ConversationTurn, RepeatDay } from "@/types";

type Props = NativeStackScreenProps<RootStackParamList, "ActiveAlarm">;

const NO_DUERMAS_STEPS = 5;
const SILENCE_TICK_MS = 20000;
const SNOOZE_HOLD_MS = 1600;
const SNOOZE_MINUTES = 5;

export default function ActiveAlarmScreen({ navigation, route }: Props) {
  const { alarms, customPersonalities, settings } = useWakeAIStore();
  const alarm = useMemo(() => alarms.find((a) => a.id === route.params.alarmId), [alarms, route.params.alarmId]);

  const tts = useRef(new ExpoTextToSpeech()).current;
  const stt = useRef(createSpeechToText()).current;
  const player = useRef(new ExpoAudioPlayer()).current;

  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [intensity, setIntensity] = useState(alarm?.startingIntensity ?? 3);
  const [wakeState, setWakeState] = useState<"sleeping" | "waking" | "awake" | "confirmed_awake">("sleeping");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [snoozeHolding, setSnoozeHolding] = useState(false);
  const [now, setNow] = useState(new Date());
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null);

  const remainingActionsRef = useRef(NO_DUERMAS_STEPS);
  const startedAtRef = useRef(Date.now());
  const snoozeCountRef = useRef(0);
  const agentRef = useRef<ConversationAgent | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!alarm) return;
    const personality = getPersonality(alarm.personalityId, customPersonalities);
    const provider = createAIProvider(settings);
    const agent = new ConversationAgent(alarm, personality, provider, []);
    agentRef.current = agent;

    memoryStore.getMemoryHints(alarm.personalityId).then(() => {});

    const soundUri = resolveSoundSource(alarm.soundId, useWakeAIStore.getState().customSounds);
    if (soundUri) {
      player.play(soundUri, { loop: true, volumeRampSeconds: settings.progressiveVolume ? 30 : 0 }).catch(() => {});
    }

    agent.start().then((turn) => {
      setTurns([...agent.state.history]);
      setWakeState(agent.state.wakeState);
      setIntensity(agent.state.intensity);
      speak(turn.text, agent.state.intensity);
    });

    return () => {
      tts.stop();
      stt.stop();
      player.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarm?.id]);

  const speak = useCallback(
    (text: string, level: number) => {
      setSpeaking(true);
      if (level >= 8 && settings.hapticsEnabled) {
        Vibration.vibrate([0, 300, 150, 300]);
      }
      tts.speak(text, getPersonality(alarm!.personalityId, customPersonalities), level, () => setSpeaking(false));
    },
    [alarm, customPersonalities, settings.hapticsEnabled, tts]
  );

  // Auto-escalation while the user stays silent.
  useEffect(() => {
    if (!alarm || wakeState === "confirmed_awake") return;
    const timer = setInterval(async () => {
      const agent = agentRef.current;
      if (!agent || listening || speaking) return;
      const turn = await agent.handleSilenceTick();
      if (turn) {
        setTurns([...agent.state.history]);
        setIntensity(agent.state.intensity);
        speak(turn.text, agent.state.intensity);
      }
    }, SILENCE_TICK_MS);
    return () => clearInterval(timer);
  }, [alarm, wakeState, listening, speaking, speak]);

  async function submitUtterance(text: string) {
    const agent = agentRef.current;
    if (!agent || !text.trim()) return;

    const signal = classifyUtterance(text);
    if (signal === "compliance" && remainingActionsRef.current > 0) {
      remainingActionsRef.current -= 1;
    }

    const turn = await agent.handleUserUtterance(text);
    setTurns([...agent.state.history]);
    setIntensity(agent.state.intensity);

    let nextState = evaluateConfirmation(agent.state.wakeState, "voice", remainingActionsRef.current);
    if (alarm?.mode === "no_duermas" && remainingActionsRef.current > 0) {
      // Not done with the required sequence yet: cap at "awake".
      nextState = nextState === "confirmed_awake" ? "awake" : nextState;
    }
    setWakeState(nextState);
    if (nextState === "confirmed_awake") {
      agent.confirmAwake();
      await finishAlarm(agent);
    } else {
      speak(turn.text, agent.state.intensity);
    }
  }

  function handleMicPress() {
    if (!stt.isSupported) return;
    if (listening) {
      stt.stop();
      setListening(false);
      return;
    }
    setListening(true);
    stt.start(
      () => {},
      (finalText) => {
        setListening(false);
        submitUtterance(finalText);
      },
      () => setListening(false)
    );
  }

  function handleImAwakePress() {
    if (!alarm) return;
    if (wakeState === "sleeping" || wakeState === "waking") {
      setWakeState("awake");
      submitUtterance("Estoy despierto.");
      return;
    }
    if (alarm.mode === "no_duermas" && remainingActionsRef.current > 0) {
      return; // gated: finish the required sequence first
    }
    const agent = agentRef.current;
    if (agent) {
      agent.confirmAwake();
      setWakeState("confirmed_awake");
      finishAlarm(agent);
    }
  }

  async function finishAlarm(agent: ConversationAgent) {
    tts.stop();
    await player.stop();
    if (alarm) {
      const event: AlarmEvent = {
        id: `event_${Date.now()}`,
        alarmId: alarm.id,
        personalityId: alarm.personalityId,
        scheduledAt: startedAtRef.current,
        firstInteractionAt: agent.state.history.find((t) => t.speaker === "user")?.timestamp,
        confirmedAwakeAt: Date.now(),
        snoozeCount: snoozeCountRef.current,
        maxIntensityReached: agent.state.intensity,
        strategiesUsed: agent.state.strategiesUsed,
        dayOfWeek: new Date(startedAtRef.current).getDay() as RepeatDay,
        completed: true,
      };
      await memoryStore.recordEvent(event);
    }
    const b = await morningAssistant.buildBriefing(undefined, Date.now());
    setBriefing(b);
    speak(morningAssistant.toSpokenText(b), 1);
  }

  async function confirmSnooze() {
    if (!alarm) return;
    tts.stop();
    await player.stop();
    snoozeCountRef.current += 1;
    agentRef.current?.registerSnooze();
    setSnoozeHolding(false);
    navigation.goBack();
  }

  if (!alarm) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.body}>Esta alarma ya no existe.</Text>
        <GlowButton label="Volver" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  if (briefing) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.briefingContent}>
          <Text style={styles.confirmedLabel}>DESPIERTO CONFIRMADO</Text>
          <Text style={styles.briefText}>{morningAssistant.toSpokenText(briefing)}</Text>
          {briefing.errors.length > 0 && (
            <Text style={styles.briefError}>{briefing.errors.join(" ")}</Text>
          )}
          <GlowButton
            label="Reproducir música"
            onPress={() => {
              const soundUri = resolveSoundSource(alarm.soundId, useWakeAIStore.getState().customSounds);
              if (soundUri) player.play(soundUri, { loop: true });
            }}
            style={{ marginTop: 24 }}
          />
          <GlowButton label="Ir al inicio" variant="outline" onPress={() => navigation.replace("Home")} style={{ marginTop: 12 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const lastAgentTurn = [...turns].reverse().find((t) => t.speaker === "agent");
  const color = intensityColor(intensity);
  const pendingAction = agentRef.current?.state.pendingAction;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.clockWrap}>
        <Text style={styles.clock}>
          {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
        </Text>
        <Text style={styles.subLabel}>Estoy intentando despertarte.</Text>
      </View>

      <View style={styles.orbWrap}>
        <PulsingOrb intensity={intensity} speaking={speaking} />
      </View>

      <ScrollView style={styles.transcript} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
        {turns.slice(-6).map((t) => (
          <View key={t.id} style={[styles.bubble, t.speaker === "agent" ? styles.bubbleAgent : styles.bubbleUser]}>
            <Text style={styles.bubbleText}>{t.text}</Text>
          </View>
        ))}
      </ScrollView>

      {alarm.mode === "no_duermas" && pendingAction && (
        <View style={[styles.actionBanner, { borderColor: color }]}>
          <Text style={styles.actionLabel}>Acción requerida</Text>
          <Text style={styles.actionText}>{pendingAction}</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder={stt.isSupported ? "O escribí acá si preferís..." : "Escribí tu respuesta (mic no disponible acá)"}
          placeholderTextColor={theme.colors.textFaint}
          value={textDraft}
          onChangeText={setTextDraft}
          onSubmitEditing={() => {
            submitUtterance(textDraft);
            setTextDraft("");
          }}
        />
      </View>

      <View style={styles.actionsRow}>
        <GlowButton
          label={listening ? "Escuchando..." : "HABLAR CON WAKE AI"}
          variant={listening ? "danger" : "outline"}
          onPress={handleMicPress}
          style={styles.actionBtn}
        />
      </View>

      <View style={styles.bottomRow}>
        <Pressable
          onPressIn={() => setSnoozeHolding(true)}
          onPressOut={() => setSnoozeHolding(false)}
          onLongPress={confirmSnooze}
          delayLongPress={SNOOZE_HOLD_MS}
          style={styles.snoozeBtn}
        >
          <Text style={styles.snoozeText}>{snoozeHolding ? "Mantené para posponer..." : `Posponer ${SNOOZE_MINUTES} min`}</Text>
        </Pressable>
        <GlowButton
          label={
            wakeState === "awake" && (alarm.mode !== "no_duermas" || remainingActionsRef.current <= 0)
              ? "CONFIRMAR DESPIERTO"
              : "ESTOY DESPIERTO"
          }
          onPress={handleImAwakePress}
          style={styles.confirmBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 20, paddingTop: 12 },
  body: { color: theme.colors.text },
  clockWrap: { alignItems: "center", marginTop: 8 },
  clock: { color: theme.colors.text, fontSize: 56, fontWeight: "800", letterSpacing: -1 },
  subLabel: { color: theme.colors.textMuted, marginTop: 2 },
  orbWrap: { alignItems: "center", marginVertical: 16 },
  transcript: { maxHeight: 160 },
  bubble: { padding: 12, borderRadius: theme.radius.md, maxWidth: "88%" },
  bubbleAgent: { backgroundColor: theme.colors.surface, alignSelf: "flex-start", borderWidth: 1, borderColor: theme.colors.border },
  bubbleUser: { backgroundColor: theme.colors.primary, alignSelf: "flex-end" },
  bubbleText: { color: theme.colors.text, fontSize: 14 },
  actionBanner: { borderWidth: 1.5, borderRadius: theme.radius.md, padding: 12, marginTop: 8 },
  actionLabel: { color: theme.colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  actionText: { color: theme.colors.text, fontSize: 15, fontWeight: "700", marginTop: 2 },
  inputRow: { marginTop: 10 },
  textInput: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 12, color: theme.colors.text },
  actionsRow: { marginTop: 10 },
  actionBtn: { width: "100%" },
  bottomRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 8 },
  snoozeBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border },
  snoozeText: { color: theme.colors.textMuted, fontSize: 13 },
  confirmBtn: { flex: 1.4 },
  briefingContent: { padding: 24, paddingTop: 60, alignItems: "center" },
  confirmedLabel: { color: theme.colors.accent, fontWeight: "800", letterSpacing: 1, marginBottom: 16 },
  briefText: { color: theme.colors.text, fontSize: 18, textAlign: "center", lineHeight: 26 },
  briefError: { color: theme.colors.textFaint, fontSize: 12, marginTop: 12, textAlign: "center" },
});
