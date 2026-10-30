import {
    Pressable,
    type PressableProps,
    type PressableStateCallbackType,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SmoothPressable({
  onPressIn,
  onPressOut,
  style,
  ...props
}: PressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const resolveStyle = (state: PressableStateCallbackType) => [
    typeof style === 'function' ? style(state) : style,
    animatedStyle,
  ];

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        scale.set(withSpring(0.97, { damping: 16, stiffness: 280 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, { damping: 14, stiffness: 240 }));
        onPressOut?.(event);
      }}
      style={resolveStyle}
    />
  );
}