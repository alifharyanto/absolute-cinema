import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';

const STORAGE_KEY = 'absolute-cinema:visit-history';

export type VisitedMovie = {
  id: number;
  title: string;
  media_type: 'movie' | 'tv';
  poster_path: string | null;
  release_date?: string;
  vote_average: number;
  visitedAt: string;
};

type VisitHistoryContextValue = {
  history: VisitedMovie[];
  historyLoaded: boolean;
  addVisitedMovie: (movie: Omit<VisitedMovie, 'visitedAt'>) => void;
};

const VisitHistoryContext = createContext<VisitHistoryContextValue | null>(null);

function getMovieKey(movie: VisitedMovie) {
  return `${movie.media_type}:${movie.id}`;
}

function mergeHistory(movies: VisitedMovie[]) {
  const uniqueMovies = new Map<string, VisitedMovie>();
  for (const movie of movies) {
    const key = getMovieKey(movie);
    const current = uniqueMovies.get(key);
    if (!current || movie.visitedAt > current.visitedAt) {
      uniqueMovies.set(key, movie);
    }
  }
  return [...uniqueMovies.values()].sort((first, second) =>
    second.visitedAt.localeCompare(first.visitedAt),
  );
}

function isVisitedMovie(value: unknown): value is VisitedMovie {
  if (!value || typeof value !== 'object') return false;
  const movie = value as Partial<VisitedMovie>;
  return (
    typeof movie.id === 'number' &&
    typeof movie.title === 'string' &&
    (movie.media_type === 'movie' || movie.media_type === 'tv') &&
    (typeof movie.poster_path === 'string' || movie.poster_path === null) &&
    typeof movie.vote_average === 'number' &&
    typeof movie.visitedAt === 'string'
  );
}

export function VisitHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<VisitedMovie[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const historyRef = useRef<VisitedMovie[]>([]);
  const pendingVisitsRef = useRef<VisitedMovie[]>([]);
  const loadedRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persistHistory = useCallback((movies: VisitedMovie[]) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(movies)));
  }, []);

  useEffect(() => {
    let active = true;

    const restoreHistory = async () => {
      try {
        const storedHistory = await AsyncStorage.getItem(STORAGE_KEY);
        const parsedHistory: unknown = storedHistory ? JSON.parse(storedHistory) : [];
        const restoredMovies = Array.isArray(parsedHistory)
          ? parsedHistory.filter(isVisitedMovie)
          : [];
        if (!active) return;

        const restoredHistory = mergeHistory([
          ...pendingVisitsRef.current,
          ...restoredMovies,
        ]);
        historyRef.current = restoredHistory;
        setHistory(restoredHistory);
        loadedRef.current = true;
        setHistoryLoaded(true);
        if (pendingVisitsRef.current.length > 0) persistHistory(restoredHistory);
      } catch {
        if (!active) return;
        const pendingHistory = mergeHistory(pendingVisitsRef.current);
        historyRef.current = pendingHistory;
        setHistory(pendingHistory);
        loadedRef.current = true;
        setHistoryLoaded(true);
        if (pendingHistory.length > 0) persistHistory(pendingHistory);
      }
    };

    void restoreHistory();
    return () => {
      active = false;
    };
  }, [persistHistory]);

  const addVisitedMovie = useCallback(
    (movie: Omit<VisitedMovie, 'visitedAt'>) => {
      const visitedMovie = { ...movie, visitedAt: new Date().toISOString() };
      const nextHistory = mergeHistory([visitedMovie, ...historyRef.current]);
      historyRef.current = nextHistory;
      setHistory(nextHistory);

      if (loadedRef.current) {
        persistHistory(nextHistory);
      } else {
        pendingVisitsRef.current = mergeHistory([
          visitedMovie,
          ...pendingVisitsRef.current,
        ]);
      }
    },
    [persistHistory],
  );

  return (
    <VisitHistoryContext.Provider
      value={{ history, historyLoaded, addVisitedMovie }}>
      {children}
    </VisitHistoryContext.Provider>
  );
}

export function useVisitHistory() {
  const context = useContext(VisitHistoryContext);
  if (!context) {
    throw new Error('useVisitHistory must be used within VisitHistoryProvider.');
  }
  return context;
}