import * as Calendar from "expo-calendar";
import * as Location from "expo-location";

export interface MorningBriefing {
  sleepDurationMinutes?: number;
  weather?: { tempC: number; description: string };
  firstEventToday?: { title: string; startTime: string };
  errors: string[]; // surfaced instead of pretending a section worked
}

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "despejado",
  1: "mayormente despejado",
  2: "parcialmente nublado",
  3: "nublado",
  45: "con niebla",
  51: "con llovizna",
  61: "con lluvia",
  71: "con nieve",
  80: "con chubascos",
  95: "con tormenta",
};

function describeWeatherCode(code: number): string {
  return WEATHER_CODE_DESCRIPTIONS[code] ?? "variable";
}

/**
 * Real integrations, no mocks: Open-Meteo (spec §9 clima) needs no API key,
 * so weather works out of the box once location permission is granted.
 * Calendar reads the device's actual first event today via expo-calendar.
 * Both are optional — a denied permission degrades that one section instead
 * of failing the whole briefing (§17: never fake what didn't actually work).
 */
export class MorningAssistant {
  async getWeather(): Promise<MorningBriefing["weather"]> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return undefined;
    const position = await Location.getCurrentPositionAsync({});
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&current=temperature_2m,weather_code`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = (await res.json()) as { current?: { temperature_2m: number; weather_code: number } };
    if (!data.current) return undefined;
    return { tempC: Math.round(data.current.temperature_2m), description: describeWeatherCode(data.current.weather_code) };
  }

  async getFirstEventToday(): Promise<MorningBriefing["firstEventToday"]> {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") return undefined;
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.length === 0) return undefined;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const events = await Calendar.getEventsAsync(
      calendars.map((c) => c.id),
      start,
      end
    );
    if (events.length === 0) return undefined;
    const first = events.sort((a, b) => new Date(a.startDate as string).getTime() - new Date(b.startDate as string).getTime())[0];
    const startTime = new Date(first.startDate as string).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return { title: first.title, startTime };
  }

  getSleepDurationMinutes(bedTimeMs: number | undefined, wokeUpMs: number): number | undefined {
    if (!bedTimeMs) return undefined;
    return Math.max(0, Math.round((wokeUpMs - bedTimeMs) / 60000));
  }

  async buildBriefing(bedTimeMs: number | undefined, wokeUpMs: number): Promise<MorningBriefing> {
    const errors: string[] = [];
    const [weather, firstEventToday] = await Promise.all([
      this.getWeather().catch(() => {
        errors.push("No se pudo obtener el clima.");
        return undefined;
      }),
      this.getFirstEventToday().catch(() => {
        errors.push("No se pudo leer el calendario.");
        return undefined;
      }),
    ]);

    return {
      sleepDurationMinutes: this.getSleepDurationMinutes(bedTimeMs, wokeUpMs),
      weather,
      firstEventToday,
      errors,
    };
  }

  toSpokenText(briefing: MorningBriefing): string {
    const parts: string[] = ["Buen día."];
    if (briefing.sleepDurationMinutes) {
      const h = Math.floor(briefing.sleepDurationMinutes / 60);
      const m = briefing.sleepDurationMinutes % 60;
      parts.push(`Dormiste ${h > 0 ? `${h} horas y ` : ""}${m} minutos.`);
    }
    if (briefing.firstEventToday) {
      parts.push(`Hoy tenés "${briefing.firstEventToday.title}" a las ${briefing.firstEventToday.startTime}.`);
    }
    if (briefing.weather) {
      parts.push(`Hay ${briefing.weather.tempC} grados y está ${briefing.weather.description}.`);
    }
    parts.push("¿Querés que te ponga música?");
    return parts.join(" ");
  }
}

export const morningAssistant = new MorningAssistant();
