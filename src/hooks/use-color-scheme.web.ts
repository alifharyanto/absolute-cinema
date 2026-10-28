import { useColorScheme as useRNColorScheme } from 'react-native';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

export function useColorScheme() {
  const hasHydrated = useIsHydrated();
  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
