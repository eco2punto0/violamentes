/** Dark, futuristic, minimal palette — spec §13. Single source of truth for styling. */
export const theme = {
  colors: {
    background: "#05050A",
    surface: "#0F0F1A",
    surfaceRaised: "#171726",
    border: "#232336",
    primary: "#7C5CFF",
    primaryGlow: "#9C86FF",
    accent: "#3DE0C4",
    danger: "#FF5C7A",
    warning: "#FFB347",
    text: "#F4F3FF",
    textMuted: "#8C8AA3",
    textFaint: "#5B5972",
  },
  radius: { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 },
  spacing: (n: number) => n * 4,
  font: {
    display: { fontSize: 56, fontWeight: "700" as const, letterSpacing: -1 },
    title: { fontSize: 24, fontWeight: "700" as const },
    subtitle: { fontSize: 16, fontWeight: "600" as const },
    body: { fontSize: 15, fontWeight: "400" as const },
    caption: { fontSize: 12, fontWeight: "500" as const, letterSpacing: 0.5 },
  },
};

export const intensityColor = (level: number): string => {
  if (level <= 3) return theme.colors.accent;
  if (level <= 6) return theme.colors.primaryGlow;
  if (level <= 8) return theme.colors.warning;
  return theme.colors.danger;
};
