import type { ComponentRef, ReactNode, RefObject } from 'react';
import { BlurView, type BlurTint } from 'expo-blur';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type LiquidGlassProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: BlurTint;
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
};

function LiquidGlassSurface({
  children,
  style,
  intensity = 70,
  tint = 'dark',
  blurTarget,
}: LiquidGlassProps) {
  return (
    <BlurView
      blurTarget={blurTarget}
      blurMethod={
        Platform.OS === 'android' && blurTarget
          ? 'dimezisBlurViewSdk31Plus'
          : undefined
      }
      intensity={intensity}
      tint={tint}
      style={[styles.surface, style]}>
      <View pointerEvents="none" style={styles.tintOverlay} />
      {children}
    </BlurView>
  );
}

export function LiquidGlassContainer(props: LiquidGlassProps) {
  return <LiquidGlassSurface {...props} />;
}

export function LiquidGlassCard({
  style,
  ...props
}: LiquidGlassProps) {
  return <LiquidGlassSurface {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  tintOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  card: {
    padding: 18,
  },
});
