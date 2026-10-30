import { LiquidGlassContainer } from '@/components/liquid-glass';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { useRouter } from 'expo-router';
import {
    createElement,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const PROFILE_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w185';
const TMDB_API_KEY =
  process.env.EXPO_PUBLIC_TMDB_API_KEY || 'c60f91fd78775ac4921ecfa40524159c';

type Movie = {
  id: number;
  title: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  media_type?: 'movie' | 'tv';
};

type MovieResponse = {
  results: Movie[];
};

type MultiMediaItem = {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
};

type MultiMediaResponse = {
  results: MultiMediaItem[];
};

function toMovieItems(results: MultiMediaItem[]): Movie[] {
  return results.flatMap((item) => {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') {
      return [];
    }

    return [{
      id: item.id,
      title: item.title || item.name || 'Untitled',
      name: item.name,
      overview: item.overview || '',
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average || 0,
      release_date: item.release_date || item.first_air_date || '',
      media_type: item.media_type,
    }];
  });
}

type TvShow = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  first_air_date?: string;
};

type TvResponse = {
  results: TvShow[];
};

type TrailerVideo = {
  key: string;
  site: string;
  type: string;
  official: boolean;
};

type TrailerResponse = {
  results: TrailerVideo[];
};

type MoviePerson = {
  id: number;
  name: string;
  character?: string;
  job?: string;
  profile_path: string | null;
};

type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};

type WatchRegion = {
  link?: string;
  flatrate?: WatchProvider[];
  free?: WatchProvider[];
  ads?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
};

type MovieDetails = {
  credits?: {
    cast: MoviePerson[];
    crew: MoviePerson[];
  };
  status?: string;
  created_by?: MoviePerson[];
  original_language?: string;
  spoken_languages?: {
    english_name: string;
    iso_639_1: string;
    name: string;
  }[];
  'watch/providers'?: {
    results: Record<string, WatchRegion>;
  };
};

const PROVIDER_CATEGORIES = [
  { key: 'flatrate', label: 'Streaming' },
  { key: 'free', label: 'Free' },
  { key: 'ads', label: 'Free with ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
] as const;

function getMovieStatusLabel(status?: string) {
  switch (status) {
    case 'Released':
      return 'Released';
    case 'Post Production':
      return 'Post-production';
    case 'In Production':
      return 'In production';
    case 'Planned':
      return 'Planned';
    case 'Canceled':
      return 'Canceled';
    case 'Rumored':
      return 'Rumored';
    default:
      return status || 'Not available';
  }
}

const SECTIONS = [
  {
    id: 'theater',
    title: 'Sedang Tayang di Bioskop',
    endpoint: '/movie/now_playing?region=ID',
    mediaType: 'movie',
  },
  {
    id: 'tv',
    title: 'Sedang Tayang di TV',
    endpoint: '/tv/on_the_air',
    mediaType: 'tv',
  },
  {
    id: 'cartoons',
    title: 'Film Animasi',
    endpoint: '/discover/movie?with_genres=16',
    mediaType: 'movie',
  },
  { id: 'popular', title: 'Film Populer', endpoint: '/movie/popular', mediaType: 'movie' },
  { id: 'top-rated', title: 'Rating Tertinggi', endpoint: '/movie/top_rated', mediaType: 'movie' },
  {
    id: 'action',
    title: 'Film Action',
    endpoint: '/discover/movie?with_genres=28',
    mediaType: 'movie',
  },
  {
    id: 'comedies',
    title: 'Film Komedi',
    endpoint: '/discover/movie?with_genres=35',
    mediaType: 'movie',
  },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

async function fetchFromTmdb<T>(
  endpoint: string,
  signal?: AbortSignal,
): Promise<T> {
  if (!TMDB_API_KEY) {
    throw new Error(
      'TMDB API key is missing. Add EXPO_PUBLIC_TMDB_API_KEY to your .env file.',
    );
  }

  const [path, query] = endpoint.split('?', 2);
  const response = await fetch(
    `${TMDB_BASE_URL}${path}?api_key=${encodeURIComponent(TMDB_API_KEY)}${query ? `&${query}` : ''}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(`TMDB request failed (HTTP ${response.status}).`);
  }

  return (await response.json()) as T;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unknown error occurred.';
}

function MovieCard({
  movie,
  onPress,
}: {
  movie: Movie;
  onPress: (movie: Movie) => void;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const width = useIsHydrated() ? viewportWidth : 390;
  const cardWidth = width >= 900 ? 150 : width >= 600 ? 128 : 108;
  const posterHeight = cardWidth * 1.48;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View details for ${movie.title}`}
      onPress={() => onPress(movie)}
      style={({ pressed }) => [
        styles.movieCard,
        { width: cardWidth },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.posterFrame, { width: cardWidth, height: posterHeight }]}>
        {movie.poster_path ? (
          <Image
            source={{ uri: `${IMAGE_BASE_URL}${movie.poster_path}` }}
            style={[styles.poster, { width: cardWidth, height: posterHeight }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.poster,
              styles.posterFallback,
              { width: cardWidth, height: posterHeight },
            ]}>
            <Text style={styles.posterFallbackText}>Poster unavailable</Text>
          </View>
        )}
        <View style={styles.mediaBadge}>
          <Text style={styles.mediaBadgeText}>
            {movie.media_type === 'tv' ? 'SERIES' : 'MOVIE'}
          </Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.movieTitle}>
        {movie.title}
      </Text>
      <Text style={styles.movieRating}>★ {movie.vote_average.toFixed(1)}</Text>
    </Pressable>
  );
}

function PersonPortrait({
  person,
  subtitle,
}: {
  person: MoviePerson;
  subtitle: string;
}) {
  return (
    <View style={styles.personCard}>
      {person.profile_path ? (
        <Image
          source={{ uri: `${PROFILE_IMAGE_BASE_URL}${person.profile_path}` }}
          style={styles.personPhoto}
        />
      ) : (
        <View style={[styles.personPhoto, styles.personFallback]}>
          <Text style={styles.personInitial}>{person.name.charAt(0)}</Text>
        </View>
      )}
      <Text numberOfLines={2} style={styles.personName}>
        {person.name}
      </Text>
      <Text numberOfLines={2} style={styles.personRole}>
        {subtitle}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroError, setHeroError] = useState('');
  const [sectionMovies, setSectionMovies] = useState<
    Partial<Record<SectionId, Movie[]>>
  >({});
  const [sectionErrors, setSectionErrors] = useState<
    Partial<Record<SectionId, string>>
  >({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const [trailer, setTrailer] = useState<TrailerVideo | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerError, setTrailerError] = useState('');
  const [movieCredits, setMovieCredits] = useState<MovieDetails | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState('');
  const [myList, setMyList] = useState<number[]>([]);
  const trendingListRef = useRef<FlatList<Movie> | null>(null);
  const currentHeroIndex = useRef(0);
  const { width: viewportWidth } = useWindowDimensions();
  const screenWidth = useIsHydrated() ? viewportWidth : 390;
  const heroHeight = Math.min(Math.max(screenWidth * 0.74, 290), 520);
  const isSearching = searchText.trim().length > 0;

  const loadCatalog = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    setHeroError('');
    setSectionErrors({});
    const requests = [
      fetchFromTmdb<MultiMediaResponse>('/trending/all/day?language=en-US'),
      ...SECTIONS.map((section) =>
        fetchFromTmdb<MovieResponse | TvResponse>(
          `${section.endpoint}${section.endpoint.includes('?') ? '&' : '?'}language=en-US`,
        ),
      ),
    ];
    const results = await Promise.allSettled(requests);
    const [trendingResult, ...sectionResults] = results;

    if (trendingResult.status === 'fulfilled') {
      setTrendingMovies(
        toMovieItems((trendingResult.value as MultiMediaResponse).results).slice(0, 3),
      );
      setHeroIndex(0);
      currentHeroIndex.current = 0;
      trendingListRef.current?.scrollToOffset({ offset: 0, animated: false });
    } else {
      setHeroError(getErrorMessage(trendingResult.reason));
    }

    const nextMovies: Partial<Record<SectionId, Movie[]>> = {};
    const nextErrors: Partial<Record<SectionId, string>> = {};
    sectionResults.forEach((result, index) => {
      const section = SECTIONS[index];
      if (result.status === 'fulfilled') {
        const response = result.value;
        nextMovies[section.id] =
          section.mediaType === 'tv'
            ? (response as TvResponse).results.map((show) => ({
              id: show.id,
              title: show.name,
              overview: show.overview,
              poster_path: show.poster_path,
              backdrop_path: show.backdrop_path,
              vote_average: show.vote_average,
              release_date: show.first_air_date,
              media_type: 'tv',
            }))
            : (response as MovieResponse).results.map((movie) => ({
              ...movie,
              media_type: 'movie',
            }));
      } else {
        nextErrors[section.id] = getErrorMessage(result.reason);
      }
    });
    setSectionMovies(nextMovies);
    setSectionErrors(nextErrors);
    setInitialLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void loadCatalog(), 0);
    return () => clearTimeout(timeout);
  }, [loadCatalog]);

  useEffect(() => {
    if (trendingMovies.length < 2 || isSearching || selectedMovie) {
      return;
    }

    const interval = setInterval(() => {
      const nextIndex = (currentHeroIndex.current + 1) % trendingMovies.length;
      currentHeroIndex.current = nextIndex;
      setHeroIndex(nextIndex);
      trendingListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }, 5500);

    return () => clearInterval(interval);
  }, [trendingMovies.length, isSearching, selectedMovie]);

useEffect(() => {
    const query = searchText.trim();
    if (!query) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSearchLoading(true);
      setSearchError('');

      // Menggunakan /search/multi agar bisa mencari Film sekaligus Drakor / TV Show
      void fetchFromTmdb<MultiMediaResponse>(
        `/search/multi?language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`,
        controller.signal,
      )
        .then((response) => {
          setSearchResults(toMovieItems(response.results));
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setSearchError(getErrorMessage(error));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearchLoading(false);
          }
        });
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [searchText]);

  useEffect(() => {
    if (!selectedMovie) {
      return;
    }

    const controller = new AbortController();
    const mediaPath = selectedMovie.media_type === 'tv' ? 'tv' : 'movie';

    const loadMovieDetails = async () => {
      try {
        const [videosResult, creditsResult] = await Promise.allSettled([
          fetchFromTmdb<TrailerResponse>(
            `/${mediaPath}/${selectedMovie.id}/videos?language=en-US`,
            controller.signal,
          ),
          fetchFromTmdb<MovieDetails>(
            `/${mediaPath}/${selectedMovie.id}?language=en-US&append_to_response=credits,watch/providers`,
            controller.signal,
          ),
        ]);

        if (controller.signal.aborted) return;

        if (creditsResult.status === 'fulfilled') {
          setMovieCredits(creditsResult.value);
        } else {
          setCreditsError(getErrorMessage(creditsResult.reason));
        }

        if (videosResult.status === 'rejected') {
          throw videosResult.reason;
        }

        let videos = videosResult.value.results.filter(
          (video) => video.site === 'YouTube' && video.type === 'Trailer',
        );
        if (videos.length === 0) {
          const englishResponse = await fetchFromTmdb<TrailerResponse>(
            `/${mediaPath}/${selectedMovie.id}/videos?language=en-US`,
            controller.signal,
          );
          videos = englishResponse.results.filter(
            (video) => video.site === 'YouTube' && video.type === 'Trailer',
          );
        }
        videos.sort((first, second) => Number(second.official) - Number(first.official));
        setTrailer(videos[0] ?? null);
      } catch (error) {
        if (!controller.signal.aborted) {
          setTrailerError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setTrailerLoading(false);
          setCreditsLoading(false);
        }
      }
    };

    void loadMovieDetails();
    return () => controller.abort();
  }, [selectedMovie]);

  const openMovie = useCallback((movie: Movie) => {
    Keyboard.dismiss();
    setTrailer(null);
    setTrailerError('');
    setTrailerLoading(true);
    setMovieCredits(null);
    setCreditsError('');
    setCreditsLoading(true);
    setSelectedMovie(movie);
  }, []);

  const watchMovie = useCallback((movie: Movie) => {
    Keyboard.dismiss();
    const type =
      movie.media_type === 'tv'
        ? 'tv'
        : movie.media_type === 'movie'
          ? 'movie'
          : movie.title
            ? 'movie'
            : movie.name
              ? 'tv'
              : 'movie';

    router.push({
      pathname: '/watch/[id]',
      params: {
        id: String(movie.id),
        type,
      },
    });
  }, [router]);

  const toggleMyList = useCallback((movie: Movie) => {
    setMyList((current) =>
      current.includes(movie.id)
        ? current.filter((id) => id !== movie.id)
        : [...current, movie.id],
    );
  }, []);

  const trailerMarkup = trailer
    ? `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000"><iframe width="100%" height="100%" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?playsinline=1" title="Trailer YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></body></html>`
    : '';
  const directors = [
    ...(movieCredits?.created_by ?? []),
    ...(movieCredits?.credits?.crew.filter((member) => member.job === 'Director') ?? []),
  ].filter(
    (person, index, people) =>
      people.findIndex((candidate) => candidate.id === person.id) === index,
  );
  const cast = movieCredits?.credits?.cast ?? [];
  const indonesiaProviders = movieCredits?.['watch/providers']?.results.ID;
  const displayedProviders = PROVIDER_CATEGORIES.flatMap((category) =>
    (indonesiaProviders?.[category.key] ?? []).map((provider) => ({
      ...provider,
      categoryLabel: category.label,
    })),
  )
    .filter(
      (provider, index, providers) =>
        providers.findIndex(
          (candidate) => candidate.provider_id === provider.provider_id,
        ) === index,
    )
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.brand}>
            Absolute<Text style={styles.brandAccent}>cinema</Text>
          </Text>
        </View>
        <View style={styles.searchField}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search movies"
            nativeID="movie-search-input"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(text) => {
              setSearchText(text);
              setSearchResults([]);
              setSearchError('');
              setSearchLoading(Boolean(text.trim()));
            }}
            placeholder="Cari film, aktor, genre..."
            placeholderTextColor={COLORS.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchText}
          />
          {searchLoading && <ActivityIndicator color={COLORS.red} size="small" />}
          {searchText.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => {
                setSearchText('');
                setSearchResults([]);
                setSearchError('');
                setSearchLoading(false);
                Keyboard.dismiss();
              }}
              style={styles.clearSearch}>
              <Text style={styles.clearSearchText}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            tintColor={COLORS.red}
            colors={[COLORS.red]}
            refreshing={refreshing}
            onRefresh={() => void loadCatalog(true)}
          />
        }>
        {isSearching ? (
          <View style={styles.searchSection}>
            <Text style={styles.sectionTitle}>Hasil Pencarian</Text>
            {searchLoading && (
              <ActivityIndicator color={COLORS.red} style={styles.inlineLoader} />
            )}
            {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
            {!searchLoading && !searchError && searchResults.length === 0 ? (
              <Text style={styles.helperText}>Film tidak ditemukan.</Text>
            ) : null}
            <View style={styles.movieStrip}>
              <View style={styles.searchMovieGrid}>
                {searchResults.map((movie) => (
                  <MovieCard key={`${movie.media_type}-${movie.id}`} movie={movie} onPress={watchMovie} />
                ))}
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.heroContainer}>
              {trendingMovies.length > 0 ? (
                <>
                  <FlatList
                    ref={trendingListRef}
                    data={trendingMovies}
                    horizontal
                    pagingEnabled
                    bounces={false}
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(movie) => String(movie.id)}
                    getItemLayout={(_, index) => ({
                      length: screenWidth,
                      offset: screenWidth * index,
                      index,
                    })}
                    onMomentumScrollEnd={(
                      event: NativeSyntheticEvent<NativeScrollEvent>,
                    ) => {
                      const index = Math.round(
                        event.nativeEvent.contentOffset.x / screenWidth,
                      );
                      currentHeroIndex.current = index;
                      setHeroIndex(index);
                    }}
                    renderItem={({ item }) => {
                      const content = (
                        <>
                          <View style={styles.heroShade} />
                          <HeroContent
                            movie={item}
                            inList={myList.includes(item.id)}
                            onPlay={() => openMovie(item)}
                            onToggleList={() => toggleMyList(item)}
                          />
                        </>
                      );

                      return item.backdrop_path ? (
                        <View
                          style={[styles.hero, { width: screenWidth, height: heroHeight }]}>
                          <Image
                            source={{
                              uri: `${IMAGE_BASE_URL}${item.backdrop_path}`,
                            }}
                            resizeMode="cover"
                            style={StyleSheet.absoluteFill}
                          />
                          {content}
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.hero,
                            styles.heroFallback,
                            { width: screenWidth, height: heroHeight },
                          ]}>
                          {content}
                        </View>
                      );
                    }}
                  />
                  <View style={styles.heroPagination}>
                    {trendingMovies.map((movie, index) => (
                      <Pressable
                        key={movie.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Show trending item ${index + 1}`}
                        onPress={() => {
                          currentHeroIndex.current = index;
                          setHeroIndex(index);
                          trendingListRef.current?.scrollToIndex({
                            index,
                            animated: true,
                          });
                        }}
                        style={[
                          styles.heroDot,
                          index === heroIndex && styles.heroDotActive,
                        ]}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <View style={[styles.hero, styles.heroFallback, { height: heroHeight }]}>
                  <View style={styles.heroShade} />
                  <View style={styles.heroMessage}>
                    {initialLoading ? (
                      <ActivityIndicator color={COLORS.red} size="large" />
                    ) : (
                      <Text style={styles.errorText}>
                        {heroError || 'Trending movies are unavailable.'}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            {SECTIONS.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {sectionErrors[section.id] ? (
                  <Text style={styles.errorText}>{sectionErrors[section.id]}</Text>
                ) : null}
                {!sectionMovies[section.id] && initialLoading ? (
                  <ActivityIndicator color={COLORS.red} style={styles.inlineLoader} />
                ) : null}
                <FlatList
                  data={sectionMovies[section.id] ?? []}
                  keyExtractor={(movie) => String(movie.id)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.movieStrip}
                  contentContainerStyle={styles.movieList}
                  renderItem={({ item }) => <MovieCard movie={item} onPress={watchMovie} />}
                />
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal
        visible={selectedMovie !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setSelectedMovie(null);
        }}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close details"
            onPress={() => {
              setSelectedMovie(null);
            }}
            style={styles.modalBackdrop}
          />
          <LiquidGlassContainer
            intensity={55}
            tint="dark"
            style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => {
                setSelectedMovie(null);
              }}
              style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
            {selectedMovie && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalContent}>
                <View style={styles.detailHeading}>
                  {selectedMovie.poster_path ? (
                    <Image
                      source={{ uri: `${IMAGE_BASE_URL}${selectedMovie.poster_path}` }}
                      style={styles.detailPoster}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.detailPoster, styles.posterFallback]} />
                  )}
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailTitle}>{selectedMovie.title}</Text>
                    <Text style={styles.detailRating}>
                      ★ {selectedMovie.vote_average.toFixed(1)} / 10
                    </Text>
                    <Text style={styles.detailYear}>
                      Release: {selectedMovie.release_date || 'Unknown'}
                    </Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Watch ${selectedMovie.title}`}
                  onPress={() => {
                    if (!selectedMovie) return;

                    watchMovie(selectedMovie);
                    setSelectedMovie(null);
                  }}
                  style={({ pressed }) => [
                    styles.watchNowButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.watchNowText}>KLIK DETAIL HERE</Text>
                </Pressable>

                <Text style={styles.trailerTitle}>Trailer</Text>
                {trailerLoading ? (
                  <ActivityIndicator color={COLORS.red} style={styles.trailerLoader} />
                ) : trailer ? (
                  <View style={styles.webViewFrame}>
                    {Platform.OS === 'web' ? (
                      createElement('iframe', {
                        allow:
                          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                        allowFullScreen: true,
                        title: `Trailer ${selectedMovie.title}`,
                        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?playsinline=1&controls=1`,
                        style: {
                          width: '100%',
                          height: '100%',
                          border: 0,
                        },
                      })
                    ) : (
                      <WebView
                        allowsInlineMediaPlayback
                        javaScriptEnabled
                        mediaPlaybackRequiresUserAction
                        originWhitelist={['https://www.youtube-nocookie.com']}
                        source={{ html: trailerMarkup }}
                        style={styles.webView}
                      />
                    )}
                  </View>
                ) : (
                  <Text style={styles.helperText}>
                    {trailerError || 'No YouTube trailer is available for this title.'}
                  </Text>
                )}
                {trailerError && trailer ? (
                  <Text style={styles.errorText}>{trailerError}</Text>
                ) : null}
                <View style={styles.creditsBlock}>
                  <View style={styles.metadataRow}>
                    <Text style={styles.creditLabel}>
                      {selectedMovie.media_type === 'tv' ? 'TV STATUS' : 'MOVIE STATUS'}
                    </Text>
                    <Text style={styles.metadataValue}>
                      {creditsLoading
                        ? 'Loading...'
                        : getMovieStatusLabel(movieCredits?.status)}
                    </Text>
                  </View>
                  <View style={[styles.metadataRow, styles.metadataSpacing]}>
                    <Text style={styles.creditLabel}>LANGUAGE</Text>
                    <Text style={styles.metadataValue}>
                      {creditsLoading
                        ? 'Loading...'
                        : `${movieCredits?.original_language?.toUpperCase() ?? '—'} · ${movieCredits?.spoken_languages
                          ?.map(
                            (language) =>
                              language.english_name || language.iso_639_1.toUpperCase(),
                          )
                          .join(', ') || 'Not available'
                        }`}
                    </Text>
                  </View>
                  <Text style={[styles.creditLabel, styles.peopleSectionTitle]}>
                    {selectedMovie.media_type === 'tv' ? 'CREATOR / DIRECTOR' : 'DIRECTOR'}
                  </Text>
                  {creditsLoading ? (
                    <ActivityIndicator color={COLORS.red} size="small" />
                  ) : directors.length > 0 ? (
                    <FlatList
                      data={directors}
                      horizontal
                      keyExtractor={(person) => String(person.id)}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.peopleList}
                      renderItem={({ item }) => (
                        <PersonPortrait
                          person={item}
                          subtitle={selectedMovie.media_type === 'tv' ? 'Creator' : 'Director'}
                        />
                      )}
                    />
                  ) : (
                    <Text style={styles.creditValue}>Not available</Text>
                  )}
                  <Text style={[styles.creditLabel, styles.peopleSectionTitle]}>
                    CAST
                  </Text>
                  {creditsLoading ? (
                    <ActivityIndicator color={COLORS.red} size="small" />
                  ) : cast.length > 0 ? (
                    <FlatList
                      data={cast.slice(0, 12)}
                      horizontal
                      keyExtractor={(person) => String(person.id)}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.peopleList}
                      renderItem={({ item }) => (
                        <PersonPortrait
                          person={item}
                          subtitle={item.character || 'Cast member'}
                        />
                      )}
                    />
                  ) : (
                    <Text style={styles.creditValue}>Not available</Text>
                  )}
                  {creditsError ? (
                    <Text style={styles.helperText}>{creditsError}</Text>
                  ) : null}
                  <Text style={[styles.creditLabel, styles.peopleSectionTitle]}>
                    AVAILABLE ON
                  </Text>
                  {creditsLoading ? (
                    <ActivityIndicator color={COLORS.red} size="small" />
                  ) : (
                    <View style={styles.providerList}>
                      {displayedProviders.map((provider) => (
                        <View
                          key={provider.provider_id}
                          style={styles.providerItem}>
                          {provider.logo_path ? (
                            <Image
                              source={{
                                uri: `${PROFILE_IMAGE_BASE_URL}${provider.logo_path}`,
                              }}
                              style={styles.providerLogo}
                              accessibilityLabel={provider.provider_name}
                            />
                          ) : (
                            <View style={styles.providerLogoFallback}>
                              <Text style={styles.providerInitial}>
                                {provider.provider_name.charAt(0)}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.providerName}>
                            {provider.provider_name}
                          </Text>
                          <Text style={styles.providerCategory}>
                            {provider.categoryLabel}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {!creditsLoading &&
                    displayedProviders.length === 0 && (
                      <Text style={styles.creditValue}>
                        Streaming information is unavailable in Indonesia.
                      </Text>
                    )}
                  {displayedProviders.length > 0 ? (
                    <Text style={styles.attribution}>
                      Streaming information provided by JustWatch via TMDB.
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.overviewTitle}>Overview</Text>
                <Text style={styles.overview}>
                  {selectedMovie.overview || 'No overview available.'}
                </Text>
              </ScrollView>
            )}
          </LiquidGlassContainer>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function HeroContent({
  movie,
  inList,
  onPlay,
  onToggleList,
}: {
  movie: Movie;
  inList: boolean;
  onPlay: () => void;
  onToggleList: () => void;
}) {
  return (
    <View style={styles.heroContent}>
      <View style={styles.heroCopy}>
        <Text style={styles.trendingLabel}>UNGGULAN</Text>
        <Text numberOfLines={2} style={styles.heroTitle}>
          {movie.title}
        </Text>
        <Text style={styles.heroRating}>★ {movie.vote_average.toFixed(1)} / 10</Text>
        <Text numberOfLines={3} style={styles.heroOverview}>
          {movie.overview || 'No overview available.'}
        </Text>
        <View style={styles.heroActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onPlay}
            style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
            <Text style={styles.playButtonText}>▶  Tonton Trailer</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onToggleList}
            style={({ pressed }) => [
              styles.myListButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.myListButtonText}>
              {inList ? '✓  Daftar Saya' : '+  Daftar Saya'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const COLORS = {
  background: '#050B15',
  red: '#F12B3D',
  text: '#FFFFFF',
  muted: '#94A3B8',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    zIndex: 2,
    elevation: 2,
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: '#111C2B',
  },
  headerTop: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    height: 34,
    justifyContent: 'center',
  },
  brand: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  brandAccent: {
    color: COLORS.red,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  searchField: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 44,
    alignSelf: 'center',
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    color: '#A5B2C4',
    fontSize: 22,
    lineHeight: 26,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    paddingVertical: 8,
    borderWidth: 0,
    outlineWidth: 0,
  },
  clearSearch: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  clearSearchText: {
    color: COLORS.muted,
    fontSize: 24,
    lineHeight: 26,
  },
  scrollContent: {
    paddingBottom: 34,
  },
  heroContainer: {
    marginBottom: 24,
  },
  heroPagination: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
  },
  heroDotActive: {
    width: 20,
    backgroundColor: COLORS.red,
  },
  hero: {
    justifyContent: 'flex-end',
    backgroundColor: '#101827',
  },
  heroFallback: {
    justifyContent: 'center',
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 8, 17, 0.52)',
  },
  heroContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 52,
  },
  heroCopy: {
    width: '100%',
    maxWidth: 520,
  },
  heroMessage: {
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  trendingLabel: {
    color: '#FF7A86',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37,
    maxWidth: 520,
  },
  heroRating: {
    color: '#FFD166',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  heroOverview: {
    color: '#D5DCE7',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 500,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
    gap: 9,
  },
  playButton: {
    minHeight: 40,
    paddingHorizontal: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.text,
    borderRadius: 12,
  },
  playButtonText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
  },
  myListButton: {
    minHeight: 40,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 26, 41, 0.9)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 12,
  },
  myListButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    marginBottom: 25,
  },
  searchSection: {
    minHeight: 380,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingTop: 18,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginHorizontal: 20,
    marginBottom: 13,
  },
  movieList: {
    paddingHorizontal: 20,
    gap: 13,
    paddingBottom: 6,
  },
  searchMovieGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 13,
    paddingBottom: 6,
  },
  movieStrip: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  movieCard: {
    width: 108,
  },
  posterFrame: {
    position: 'relative',
  },
  poster: {
    width: 108,
    height: 160,
    borderRadius: 11,
    backgroundColor: '#111C2B',
  },
  mediaBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(5, 11, 21, 0.88)',
  },
  mediaBadgeText: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  posterFallbackText: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  movieTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 8,
    minHeight: 32,
  },
  movieRating: {
    color: '#FFD166',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  inlineLoader: {
    marginVertical: 18,
  },
  errorText: {
    color: '#FF8A8A',
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginHorizontal: 20,
    marginVertical: 10,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 940,
    maxHeight: '88%',
    minHeight: '58%',
    backgroundColor: 'rgba(10, 18, 30, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666666',
    marginTop: 10,
  },
  closeButton: {
    position: 'absolute',
    zIndex: 2,
    right: 16,
    top: 16,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: 27,
    lineHeight: 29,
  },
  modalContent: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 36,
  },
  detailHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 28,
    gap: 14,
  },
  detailPoster: {
    width: 92,
    height: 138,
    borderRadius: 6,
    backgroundColor: '#292929',
  },
  detailCopy: {
    flex: 1,
  },
  detailTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 27,
  },
  detailRating: {
    color: '#FFD166',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  detailYear: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  watchNowButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    borderRadius: 8,
    backgroundColor: COLORS.red,
  },
  watchNowButtonDisabled: {
    opacity: 0.45,
  },
  watchNowText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  creditsBlock: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#101A29',
    borderWidth: 1,
    borderColor: '#1D293A',
  },
  creditLabel: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  actorsLabel: {
    marginTop: 14,
  },
  creditValue: {
    color: '#E5E5E5',
    fontSize: 14,
    lineHeight: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  metadataSpacing: {
    marginTop: 12,
  },
  metadataValue: {
    flex: 1,
    color: '#E5E5E5',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
  },
  peopleSectionTitle: {
    marginTop: 18,
  },
  peopleList: {
    gap: 12,
    paddingRight: 6,
  },
  personCard: {
    width: 82,
    alignItems: 'center',
  },
  personPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#343434',
  },
  personFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitial: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  personName: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 7,
  },
  personRole: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  providerCategory: {
    color: '#E5E5E5',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
  },
  providerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerItem: {
    width: 82,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  providerLogo: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#343434',
  },
  providerLogoFallback: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#343434',
  },
  providerInitial: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  providerName: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  attribution: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 12,
  },
  overviewTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 22,
    marginBottom: 8,
  },
  overview: {
    color: '#D2D2D2',
    fontSize: 14,
    lineHeight: 22,
  },
  trailerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 12,
  },
  trailerLoader: {
    height: 110,
  },
  webViewFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pressed: {
    opacity: 0.78,
  },
});