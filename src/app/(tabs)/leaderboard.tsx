import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w185';
const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;

type TrendingMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date?: string;
  vote_average: number;
  popularity: number;
};

type TrendingResponse = {
  results: TrendingMovie[];
};

const COLORS = {
  background: '#050B15',
  surface: '#101A29',
  border: '#1D293A',
  red: '#F12B3D',
  text: '#FFFFFF',
  muted: '#94A3B8',
  gold: '#FFD166',
};

export default function LeaderboardScreen() {
  const [movies, setMovies] = useState<TrendingMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTrending = useCallback(async (signal: AbortSignal) => {
    if (!TMDB_API_KEY) {
      setError('TMDB API key belum dikonfigurasi.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/trending/movie/week?language=id-ID&api_key=${encodeURIComponent(TMDB_API_KEY)}`,
        { signal },
      );
      if (!response.ok) {
        throw new Error(`Permintaan data gagal (HTTP ${response.status}).`);
      }
      const data = (await response.json()) as TrendingResponse;
      setMovies(data.results);
      setError('');
    } catch (requestError) {
      if (!signal.aborted) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Data tren tidak dapat dimuat.',
        );
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadTrending(controller.signal);
    return () => controller.abort();
  }, [loadTrending]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ABSOLUTE CINEMA</Text>
        <Text style={styles.title}>Lagi ramai</Text>
        <Text style={styles.subtitle}>Film yang sedang tren minggu ini</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Peringkat tren TMDB, bukan jumlah penonton.</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.red} size="large" style={styles.loader} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoading(true);
                const controller = new AbortController();
                void loadTrending(controller.signal);
              }}
              style={styles.retryButton}>
              <Text style={styles.retryText}>Coba lagi</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {movies.map((movie, index) => (
              <View key={movie.id} style={styles.movieRow}>
                <Text style={[styles.rank, index < 3 && styles.topRank]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                {movie.poster_path ? (
                  <Image
                    source={{ uri: `${IMAGE_BASE_URL}${movie.poster_path}` }}
                    style={styles.poster}
                    resizeMode="cover"
                    accessibilityLabel={`Poster ${movie.title}`}
                  />
                ) : (
                  <View style={[styles.poster, styles.posterFallback]} />
                )}
                <View style={styles.movieInfo}>
                  <Text numberOfLines={2} style={styles.movieTitle}>
                    {movie.title}
                  </Text>
                  <Text style={styles.movieMeta}>
                    {movie.release_date?.slice(0, 4) || 'Tahun tidak tersedia'}
                  </Text>
                  <View style={styles.metrics}>
                    <Text style={styles.rating}>★ {movie.vote_average.toFixed(1)}</Text>
                    <Text style={styles.popularity}>
                      Popularitas {Math.round(movie.popularity)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  eyebrow: { color: COLORS.red, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: COLORS.text, fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: COLORS.muted, fontSize: 14, marginTop: 5 },
  notice: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
  },
  noticeText: { color: COLORS.muted, fontSize: 11 },
  loader: { marginTop: 64 },
  emptyState: { alignItems: 'center', marginTop: 54 },
  error: { color: '#FF8A8A', fontSize: 14, textAlign: 'center' },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: COLORS.red,
  },
  retryText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  list: { marginTop: 22, borderTopWidth: 1, borderTopColor: COLORS.border },
  movieRow: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rank: { width: 40, color: COLORS.muted, fontSize: 20, fontWeight: '800' },
  topRank: { color: COLORS.red },
  poster: { width: 56, height: 84, borderRadius: 5, backgroundColor: COLORS.surface },
  posterFallback: { borderWidth: 1, borderColor: COLORS.border },
  movieInfo: { flex: 1, marginLeft: 13 },
  movieTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  movieMeta: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  rating: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },
  popularity: { color: COLORS.muted, fontSize: 11 },
});