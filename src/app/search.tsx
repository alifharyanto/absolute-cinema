import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';
const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;

type Movie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date?: string;
  vote_average: number;
};

type MovieResponse = { results: Movie[] };

const COLORS = {
  background: '#050B15',
  surface: '#101A29',
  border: '#1D293A',
  red: '#F12B3D',
  text: '#FFFFFF',
  muted: '#94A3B8',
  gold: '#FFD166',
};

export default function SearchScreen() {
  const { width: viewportWidth } = useWindowDimensions();
  const columnCount = viewportWidth >= 900 ? 6 : viewportWidth >= 600 ? 4 : 3;
  const cardWidth = (viewportWidth - 40 - 12 * (columnCount - 1)) / columnCount;
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setMovies([]);
      setError('');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      if (!TMDB_API_KEY) {
        setError('TMDB API key belum dikonfigurasi.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      fetch(
        `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(term)}&language=id-ID&include_adult=false&api_key=${encodeURIComponent(TMDB_API_KEY)}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error(`Pencarian gagal (HTTP ${response.status}).`);
          return (await response.json()) as MovieResponse;
        })
        .then((response) => setMovies(response.results))
        .catch((requestError: unknown) => {
          if (!controller.signal.aborted) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : 'Pencarian tidak dapat dilakukan.',
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ABSOLUTE CINEMA</Text>
        <Text style={styles.title}>Cari film</Text>
        <View style={styles.searchField}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Cari judul film"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(text) => {
              setQuery(text);
              setMovies([]);
              setError('');
              setLoading(Boolean(text.trim()));
            }}
            placeholder="Masukkan judul film"
            placeholderTextColor={COLORS.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {loading ? <ActivityIndicator color={COLORS.red} size="small" /> : null}
        </View>

        {!query.trim() ? (
          <Text style={styles.message}>Temukan film berdasarkan judul.</Text>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : loading ? (
          <Text style={styles.message}>Mencari film...</Text>
        ) : movies.length === 0 ? (
          <Text style={styles.message}>Film tidak ditemukan.</Text>
        ) : (
          <View style={styles.grid}>
            {movies.map((movie) => (
              <View key={movie.id} style={[styles.movieCard, { width: cardWidth }]}>
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
                <Text numberOfLines={2} style={styles.movieTitle}>
                  {movie.title}
                </Text>
                <Text style={styles.movieMeta}>
                  {movie.release_date?.slice(0, 4) || '—'} · ★ {movie.vote_average.toFixed(1)}
                </Text>
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
  searchField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  searchIcon: { color: COLORS.muted, fontSize: 22, marginRight: 10 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14, paddingVertical: 10 },
  message: { color: COLORS.muted, fontSize: 14, marginTop: 24 },
  error: { color: '#FF8A8A', fontSize: 14, marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  movieCard: { flexGrow: 0 },
  poster: {
    width: '100%',
    aspectRatio: 0.68,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
  },
  posterFallback: { borderWidth: 1, borderColor: COLORS.border },
  movieTitle: { color: COLORS.text, fontSize: 12, fontWeight: '700', lineHeight: 16, marginTop: 7 },
  movieMeta: { color: COLORS.gold, fontSize: 11, marginTop: 4 },
});