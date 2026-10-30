import { useRouter } from 'expo-router';
import { StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SmoothPressable } from '@/components/smooth-pressable';
import { useVisitHistory } from '@/components/visit-history';

const COLORS = {
  background: '#050B15',
  surface: '#101A29',
  border: '#1D293A',
  red: '#F12B3D',
  text: '#FFFFFF',
  muted: '#94A3B8',
};

export default function AccountScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { history, historyLoaded, addVisitedMovie } = useVisitHistory();
  const imageWidth = width >= 600 ? 112 : 84;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <Animated.ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>ABSOLUTE CINEMA</Text>
        <Text style={styles.title}>Histori</Text>
        <Text style={styles.subtitle}>Film dan serial yang pernah Anda buka</Text>

        {!historyLoaded ? (
          <Text style={styles.emptyText}>Memuat histori...</Text>
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Belum ada histori</Text>
            <Text style={styles.emptyText}>Film yang Anda buka akan tersimpan di sini.</Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {history.map((movie, index) => (
              <Animated.View
                key={`${movie.media_type}:${movie.id}`}
                entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(260)}>
                <SmoothPressable
                  accessibilityRole="button"
                  accessibilityLabel={`Buka ${movie.title}`}
                  onPress={() => {
                    addVisitedMovie({
                      id: movie.id,
                      title: movie.title,
                      media_type: movie.media_type,
                      poster_path: movie.poster_path,
                      release_date: movie.release_date,
                      vote_average: movie.vote_average,
                    });
                    router.push({
                      pathname: '/watch/[id]',
                      params: { id: String(movie.id), type: movie.media_type },
                    });
                  }}
                  style={styles.historyItem}>
                  {movie.poster_path ? (
                    <Animated.Image
                      source={{ uri: `https://image.tmdb.org/t/p/w185${movie.poster_path}` }}
                      style={[styles.poster, { width: imageWidth, height: imageWidth * 1.48 }]}
                      resizeMode="cover"
                      accessibilityLabel={`Poster ${movie.title}`}
                    />
                  ) : (
                    <View
                      style={[
                        styles.poster,
                        styles.posterFallback,
                        { width: imageWidth, height: imageWidth * 1.48 },
                      ]}
                    />
                  )}
                  <View style={styles.movieInfo}>
                    <Text numberOfLines={2} style={styles.movieTitle}>
                      {movie.title}
                    </Text>
                    <Text style={styles.movieMeta}>
                      {movie.media_type === 'tv' ? 'Serial TV' : 'Film'}
                      {movie.release_date ? ` · ${movie.release_date.slice(0, 4)}` : ''}
                    </Text>
                    <Text style={styles.rating}>★ {movie.vote_average.toFixed(1)}</Text>
                    <Text style={styles.visitedAt}>
                      {new Date(movie.visitedAt).toLocaleDateString('id-ID')}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </SmoothPressable>
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  eyebrow: { color: COLORS.red, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: COLORS.muted, fontSize: 14, marginTop: 5 },
  historyList: { gap: 10, marginTop: 22 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 116,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
  },
  poster: { borderRadius: 4, backgroundColor: '#1D293A' },
  posterFallback: { borderWidth: 1, borderColor: COLORS.border },
  movieInfo: { flex: 1, marginLeft: 12 },
  movieTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  movieMeta: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  rating: { color: '#FFD166', fontSize: 12, fontWeight: '700', marginTop: 7 },
  visitedAt: { color: COLORS.muted, fontSize: 10, marginTop: 5 },
  chevron: { color: COLORS.muted, fontSize: 26, paddingHorizontal: 4 },
  emptyState: {
    alignItems: 'center',
    marginTop: 64,
    paddingHorizontal: 20,
  },
  emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  emptyText: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 7, textAlign: 'center' },
});