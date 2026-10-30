import { useLocalSearchParams, useRouter } from 'expo-router';
import { createElement, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Fallback API Key agar build APK standalone tidak 401
const TMDB_API_KEY =
  process.env.EXPO_PUBLIC_TMDB_API_KEY || 'c60f91fd78775ac4921ecfa40524159c';

// Script Pemblokir Pop-up (Aman Tanpa Merusak Class UI Player VidLink)
const INJECTED_SAFE_ADBLOCK_JS = `
  (function() {
    window.open = function() { return null; };
    window.onbeforeunload = function() { return null; };

    // Sembunyikan khusus iframe iklan tanpa merusak div internal player
    const style = document.createElement('style');
    style.innerHTML = \`
      iframe[src*="ads"], iframe[src*="doubleclick"], .popunder, .popup {
        display: none !important;
        pointer-events: none !important;
      }
    \`;
    if (document.head) {
      document.head.appendChild(style);
    }
  })();
  true;
`;

type SeasonInfo = {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
};

type MoviePerson = {
  id: number;
  name: string;
  job?: string;
  character?: string;
};

type DetailData = {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: SeasonInfo[];
  created_by?: MoviePerson[];
  credits?: {
    cast: MoviePerson[];
    crew: MoviePerson[];
  };
};

export default function WatchScreen() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();

  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State Season & Episode (Khusus TV / Drakor)
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  // Reset Season & Episode setiap kali ID film/series berganti
  useEffect(() => {
    setSelectedSeason(1);
    setSelectedEpisode(1);
  }, [id, mediaType]);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${TMDB_BASE_URL}/${mediaType}/${id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits`
        );
        if (!res.ok) throw new Error('Gagal mengambil data detail film');
        const json = await res.json();
        setData(json);

        if (json.seasons && json.seasons.length > 0) {
          const validSeason = json.seasons.find((s: SeasonInfo) => s.season_number > 0);
          if (validSeason) {
            setSelectedSeason(validSeason.season_number);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat memuat data');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id, mediaType]);

  // Single URL Pemutar VidLink
  const embedUrl =
    mediaType === 'tv'
      ? `https://vidlink.pro/tv/${id}/${selectedSeason}/${selectedEpisode}`
      : `https://vidlink.pro/movie/${id}`;

  const title = data?.title || data?.name || 'Watch Movie';
  const releaseDate = data?.release_date || data?.first_air_date || 'Tidak diketahui';

  const directors = [
    ...(data?.created_by ?? []),
    ...(data?.credits?.crew?.filter((member) => member.job === 'Director') ?? []),
  ]
    .map((p) => p.name)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

  const mainCast = data?.credits?.cast
    ?.slice(0, 4)
    .map((actor) => actor.name)
    .join(', ');

  const currentSeasonObj = data?.seasons?.find(
    (s) => s.season_number === selectedSeason
  );
  const totalEpisodesInCurrentSeason = currentSeasonObj?.episode_count || 12;
  const validSeasons = data?.seasons?.filter((s) => s.season_number > 0) || [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />

      {/* Header Tombol Kembali */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Kembali</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. EMBED VIDEO PLAYER VIDLINK */}
        <View style={styles.playerContainer}>
          {Platform.OS === 'web' ? (
            createElement('iframe', {
              allowFullScreen: true,
              allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
              referrerPolicy: 'no-referrer',
              title: title,
              src: embedUrl,
              style: {
                width: '100%',
                height: '100%',
                border: 0,
              },
            })
          ) : (
            <WebView
              key={embedUrl}
              source={{ uri: embedUrl }}
              style={{ flex: 1 }}
              originWhitelist={['*']}
              allowsFullscreenVideo={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              injectedJavaScriptBeforeContentLoaded={INJECTED_SAFE_ADBLOCK_JS}
              
              // KHUSUS VIDLINK: IZINKAN DATA: URI AGAR WARNING KUNING DAN PLAYER CRASH HILANG
              onShouldStartLoadWithRequest={(request) => {
                const url = request.url;

                // 1. Izinkan skema internal data:, blob:, dan about:
                if (
                  url.startsWith('data:') ||
                  url.startsWith('blob:') ||
                  url.startsWith('about:')
                ) {
                  return true;
                }

                const lowerUrl = url.toLowerCase();

                // 2. Filter domain resmi VidLink
                const isAllowed =
                  lowerUrl.includes('vidlink.pro') ||
                  lowerUrl.includes('vapi') ||
                  lowerUrl === 'about:blank';

                return isAllowed;
              }}
            />
          )}
        </View>

        {/* 2. INFO DETAIL FILM */}
        {loading ? (
          <ActivityIndicator color="#F12B3D" style={{ marginTop: 30 }} size="large" />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : data ? (
          <View style={styles.infoSection}>
            <View style={styles.headerRow}>
              {data.poster_path ? (
                <Image
                  source={{ uri: `${IMAGE_BASE_URL}${data.poster_path}` }}
                  style={styles.smallPoster}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.smallPoster, styles.posterFallback]}>
                  <Text style={styles.fallbackText}>No Poster</Text>
                </View>
              )}

              <View style={styles.headerDetails}>
                <Text style={styles.title}>{title}</Text>

                <Text style={styles.rating}>
                  ★ {data.vote_average.toFixed(1)} / 10
                </Text>

                <Text style={styles.metaText}>
                  <Text style={styles.metaLabel}>Rilis: </Text>
                  {releaseDate}
                </Text>

                {directors ? (
                  <Text style={styles.metaText} numberOfLines={2}>
                    <Text style={styles.metaLabel}>Sutradara: </Text>
                    {directors}
                  </Text>
                ) : null}

                {mainCast ? (
                  <Text style={styles.metaText} numberOfLines={2}>
                    <Text style={styles.metaLabel}>Aktor: </Text>
                    {mainCast}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Selector Season & Episode (Khusus TV / Drakor) */}
            {mediaType === 'tv' && (
              <View style={styles.episodesContainer}>
                {validSeasons.length > 1 && (
                  <View style={styles.seasonSection}>
                    <Text style={styles.sectionHeaderTitle}>Pilih Season:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                      {validSeasons.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            setSelectedSeason(s.season_number);
                            setSelectedEpisode(1);
                          }}
                          style={[
                            styles.seasonChip,
                            selectedSeason === s.season_number && styles.activeSeasonChip,
                          ]}>
                          <Text
                            style={[
                              styles.seasonChipText,
                              selectedSeason === s.season_number && styles.activeChipText,
                            ]}>
                            Season {s.season_number}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.sectionHeaderTitle}>Pilih Episode:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                  {Array.from({ length: totalEpisodesInCurrentSeason }, (_, i) => i + 1).map((ep) => (
                    <Pressable
                      key={ep}
                      onPress={() => setSelectedEpisode(ep)}
                      style={[
                        styles.episodeButton,
                        selectedEpisode === ep && styles.activeEpisodeButton,
                      ]}>
                      <Text
                        style={[
                          styles.episodeButtonText,
                          selectedEpisode === ep && styles.activeChipText,
                        ]}>
                        Eps {ep}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Sinopsis */}
            <Text style={styles.synopsisTitle}>Sinopsis</Text>
            <Text style={styles.synopsisText}>
              {data.overview || 'Tidak ada sinopsis tersedia.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B15',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111C2B',
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backText: {
    color: '#F12B3D',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  infoSection: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  smallPoster: {
    width: 110,
    height: 162,
    borderRadius: 8,
    backgroundColor: '#111C2B',
  },
  posterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  headerDetails: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
    marginBottom: 6,
  },
  rating: {
    color: '#FFD166',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  metaText: {
    color: '#D2D2D2',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  metaLabel: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  episodesContainer: {
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#111C2B',
  },
  seasonSection: {
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  horizontalList: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  seasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#101A29',
    borderWidth: 1,
    borderColor: '#1D293A',
    marginRight: 8,
  },
  activeSeasonChip: {
    backgroundColor: '#F12B3D',
    borderColor: '#F12B3D',
  },
  seasonChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  episodeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#101A29',
    borderWidth: 1,
    borderColor: '#1D293A',
    marginRight: 8,
    minWidth: 58,
    alignItems: 'center',
  },
  activeEpisodeButton: {
    backgroundColor: '#F12B3D',
    borderColor: '#F12B3D',
  },
  episodeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeChipText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  synopsisTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  synopsisText: {
    color: '#D2D2D2',
    fontSize: 14,
    lineHeight: 22,
  },
  errorText: {
    color: '#FF8A8A',
    fontSize: 14,
    padding: 20,
    textAlign: 'center',
  },
});