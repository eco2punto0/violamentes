import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { intensityColor, theme } from "@/theme";

interface Props {
  intensity: number; // 1-10
  speaking?: boolean;
  size?: number;
}

/**
 * The "AI is alive in here" visual (spec §11/§13): a pulsing glow that
 * breathes faster and glows more intensely as the wake intensity climbs.
 * Built on the core Animated API (no extra native deps required).
 */
export default function PulsingOrb({ intensity, speaking, size = 220 }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const color = intensityColor(intensity);

  useEffect(() => {
    const duration = Math.max(350, 1100 - intensity * 70);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [intensity, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, speaking ? 1.15 : 1.05] });
  const outerScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const outerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2, borderColor: color, transform: [{ scale: outerScale }], opacity: outerOpacity },
        ]}
      />
      <Animated.View
        style={[
          styles.core,
          {
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: (size * 0.62) / 2,
            backgroundColor: color,
            shadowColor: color,
            transform: [{ scale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 2 },
  core: {
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 20,
    opacity: 0.9,
  },
});
