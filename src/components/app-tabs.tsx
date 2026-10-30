import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

const COLORS = {
  background: '#050B15',
  border: '#111C2B',
  active: '#F12B3D',
  inactive: '#94A3B8',
};

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          paddingTop: 7,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => (
            <SymbolView
              name={{
                ios: focused ? 'house.fill' : 'house',
                android: 'home',
                web: 'home',
              }}
              tintColor={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Tren',
          tabBarIcon: ({ color, focused }) => (
            <SymbolView
              name={{
                ios: focused ? 'chart.bar.fill' : 'chart.bar',
                android: 'bar_chart',
                web: 'bar_chart',
              }}
              tintColor={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Histori',
          tabBarIcon: ({ color, focused }) => (
            <SymbolView
              name={{
                ios: focused ? 'clock.arrow.circlepath' : 'clock',
                android: 'history',
                web: 'history',
              }}
              tintColor={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
