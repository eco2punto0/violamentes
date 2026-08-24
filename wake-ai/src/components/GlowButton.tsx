import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";
import { theme } from "@/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
}

export default function GlowButton({ label, onPress, variant = "primary", disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <Text style={[styles.label, variant === "outline" || variant === "ghost" ? { color: theme.colors.text } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: "#0A0A12", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.4 },
});

const variantStyles: Record<string, ViewStyle> = {
  primary: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  danger: { backgroundColor: theme.colors.danger },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: theme.colors.border },
  ghost: { backgroundColor: "transparent" },
};
