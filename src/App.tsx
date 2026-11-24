import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  Check,
  Compass,
  FileAudio,
  Headphones,
  Library,
  Link2,
  ListMusic,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Repeat1,
  Scissors,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {BackgroundGuideModal} from './components/BackgroundGuideModal';
import {ChannelDetailView} from './components/ChannelDetailView';
import {ChannelResultsGrid} from './components/ChannelResultsGrid';
import {GoogleAccountButton} from './components/GoogleAccountButton';
import {MobileNowPlayingModal} from './components/MobileNowPlayingModal';
import {MyFilesSection} from './components/MyFilesSection';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PlayerBar} from './components/PlayerBar';
import {PWAInstallButton} from './components/PWAInstallButton';
import {QueueDrawer} from './components/QueueDrawer';
import {SearchBarWithHistory} from './components/SearchBarWithHistory';
import {Sidebar} from './components/Sidebar';
import {TrackList} from './components/TrackList';
import {TrimAndSaveModal} from './components/TrimAndSaveModal';
import {UnifiedChartsSection} from './components/UnifiedChartsSection';
import {YouTubePlayerEngine, type YouTubeEngineHandle} from './components/YouTubePlayerEngine';
import {useBackgroundKeepAlive} from './hooks/useBackgroundKeepAlive';
import {useMediaSession} from './hooks/useMediaSession';
import {auth, signInWithGoogle, signOutGoogle} from './lib/firebase';
import {
  addLikedTrackCloud,
  addPersonalTrackCloud,
  addTracksToPlaylistCloud,
  clearSearchHistoryCloud,
  createPlaylistCloud,
  deletePersonalTrackCloud,
  deletePlaylistCloud,
  ensureAndLoadUserPreferences,
  makeEntryId,
  mergeLocalLibraryToCloud,
  recordPlayHistoryCloud,
  removeLikedTrackCloud,
  removeSearchHistoryCloud,
  removeTrackFromPlaylistCloud,
  renamePlaylistCloud,
  reorderPlaylistTracksCloud,
  saveSearchHistoryCloud,
  saveUserPreferences,
  subscribeLikedTracks,
  subscribePersonalTracks,
  subscribePlayHistory,
  subscribePlaylists,
  subscribeSearchHistory,
  updatePersonalTrackCloud,
} from './services/firestoreLibrary';
import {
  deleteLocalAudioBlob,
  formatTrackDurationLabel,
  isSupportedAudioFile,
  listAvailableLocalTrackIds,
  makeLocalTrackId,
  migrateGuestAudioBlobsToUser,
  readAudioFileDuration,
  saveLocalAudioBlob,
  stripAudioExtension,
} from './services/localAudioStore';
import type {
  ChannelDetailData,
  CuratedMood,
  NavSection,
  PlayHistoryEntry,
  Playlist,
  RepeatMode,
  SearchHistoryEntry,
  SearchMode,
  SearchSort,
  Track,
  UnifiedChartResponse,
  VideoSurfaceMode,
  YouTubeChannel,
} from './types/music';
import {formatTime} from './utils/formatTime';
import {analyzeUserTaste} from './utils/tasteAnalyzer';

const STARRY_BACKDROP_IMG = '/src/assets/images/app_starry_backdrop_1795390659040.jpg';
const HERO_STUDIO_IMG = '/src/assets/images/hero_starry_night_1795390659348.jpg';
const COVER_AMBIENT_IMG = '/src/assets/images/cover_starry_jazz_1795390658823.jpg';
const COVER_LOFI_IMG = '/src/assets/images/cover_starry_lofi_1795390659716.jpg';

const MOOD_TABS: Array<{id: CuratedMood; label: string; subtitle: string}> = [
  {id: 'recommended', label: '추천 믹스', subtitle: '지금 듣기 좋은 감성 트랙'},
  {id: 'lofi', label: 'Lo-Fi 집중', subtitle: '작업과 독서에 어울리는 비트'},
  {id: 'kpop', label: 'K-Pop 칠', subtitle: '부드러운 보컬과 R&B 사운드'},
  {id: 'jazz', label: '심야 재즈', subtitle: '어쿠스틱 피아노와 브러시 드럼'},
  {id: 'indie', label: '인디 어쿠스틱', subtitle: '담백한 한국 인디 음악 모음'},
];

const STORAGE_KEYS = {
  LIKED: 'velo_liked_tracks_v1',
  PLAYLISTS: 'velo_playlists_v1',
  PERSONAL_TRACKS: 'velo_personal_tracks_v1',
  AUTO_TRIM_IMPORT: 'velo_auto_trim_import_v1',
  VOLUME: 'velo_volume_v1',
  KEEP_ALIVE: 'velo_bg_keep_alive_v1',
  REPEAT: 'velo_repeat_mode_v1',
  SHUFFLE: 'velo_shuffle_v1',
  HISTORY: 'velo_search_history_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isYouTubeUrlOrId(text: string): boolean {
  const trimmed = text.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return true;
  return /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(trimmed);
}

function getTrackKey(track: Track): string {
  return track.entryId || track.id;
}

function shuffleTracksFisherYates(tracks: Track[], anchorFirstKey?: string): Track[] {
  const arr = [...tracks];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (anchorFirstKey) {
    const idx = arr.findIndex((t) => getTrackKey(t) === anchorFirstKey);
    if (idx > 0) {
      [arr[0], arr[idx]] = [arr[idx], arr[0]];
    }
  }
  return arr;
}

export default function App() {
  const engineRef = useRef<YouTubeEngineHandle | null>(null);
  const userPausedRef = useRef<boolean>(false);
  const syncedUidRef = useRef<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeSection, setActiveSection] = useState<NavSection>('explore');
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<CuratedMood>('recommended');

  const mainScrollRef = useRef<HTMLElement | null>(null);
  const searchSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreSearchRef = useRef<boolean>(false);

  const [curatedTracks, setCuratedTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('music');
  const [searchSort, setSearchSort] = useState<SearchSort>('relevance');
  const [searchResults, setSearchResults] = useState<Track[] | null>(null);
  const [searchUniquePool, setSearchUniquePool] = useState<Track[]>([]);
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
  const [searchRepeatingMode, setSearchRepeatingMode] = useState(false);
  const [isLoadingMoreSearch, setIsLoadingMoreSearch] = useState(false);
  const [channelResults, setChannelResults] = useState<YouTubeChannel[] | null>(null);
  const [activeChannelView, setActiveChannelView] = useState<ChannelDetailData | null>(null);

  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [localLikedTracks, setLocalLikedTracks] = useState<Track[]>(() =>
    readStorage<Track[]>(STORAGE_KEYS.LIKED, []),
  );
  const [localPlaylists, setLocalPlaylists] = useState<Playlist[]>(() =>
    readStorage<Playlist[]>(STORAGE_KEYS.PLAYLISTS, []),
  );
  const [localPersonalTracks, setLocalPersonalTracks] = useState<Track[]>(() =>
    readStorage<Track[]>(STORAGE_KEYS.PERSONAL_TRACKS, []),
  );
  const [localHistory, setLocalHistory] = useState<SearchHistoryEntry[]>(() =>
    readStorage<SearchHistoryEntry[]>(STORAGE_KEYS.HISTORY, []),
  );

  const [cloudLikedTracks, setCloudLikedTracks] = useState<Track[]>([]);
  const [cloudPlaylists, setCloudPlaylists] = useState<Playlist[]>([]);
  const [cloudPersonalTracks, setCloudPersonalTracks] = useState<Track[]>([]);
  const [cloudHistory, setCloudHistory] = useState<SearchHistoryEntry[]>([]);
  const [cloudPlayHistory, setCloudPlayHistory] = useState<PlayHistoryEntry[]>([]);
  const [availableLocalBlobIds, setAvailableLocalBlobIds] = useState<Set<string>>(new Set());
  const [isUploadingPersonalFiles, setIsUploadingPersonalFiles] = useState(false);
  const [autoTrimOnImport, setAutoTrimOnImport] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_KEYS.AUTO_TRIM_IMPORT, true),
  );
  const [personalizedRefreshSeed, setPersonalizedRefreshSeed] = useState(0);
  const [isPersonalizedMix, setIsPersonalizedMix] = useState(false);

  const likedTracks = user ? cloudLikedTracks : localLikedTracks;
  const playlists = user ? cloudPlaylists : localPlaylists;
  const personalTracks = user ? cloudPersonalTracks : localPersonalTracks;
  const searchHistory = user ? cloudHistory : localHistory;
  const ownerScope = user?.uid || 'guest';

  const [baseQueue, setBaseQueue] = useState<Track[]>([]);
  const [shuffledQueue, setShuffledQueue] = useState<Track[]>([]);
  const [playbackSource, setPlaybackSource] = useState<'single' | 'playlist'>('single');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [activeEntryKey, setActiveEntryKey] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(() =>
    readStorage<number>(STORAGE_KEYS.VOLUME, 85),
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(() =>
    readStorage<RepeatMode>(STORAGE_KEYS.REPEAT, 'all'),
  );

  // A-B Segment Loop within a single song
  const [abLoopEnabled, setAbLoopEnabled] = useState(false);
  const [abStart, setAbStart] = useState(0);
  const [abEnd, setAbEnd] = useState(0);

  const [videoMode, setVideoMode] = useState<VideoSurfaceMode>('audio');
  const [audioPipelineMode, setAudioPipelineMode] = useState<'native-audio' | 'iframe'>('iframe');
  const [backgroundKeepAlive, setBackgroundKeepAlive] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_KEYS.KEEP_ALIVE, true),
  );

  const [chartsData, setChartsData] = useState<UnifiedChartResponse | null>(null);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [chartsError, setChartsError] = useState<string | null>(null);

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHeaderVolumeOpen, setIsHeaderVolumeOpen] = useState(false);
  const headerVolumeRef = useRef<HTMLDivElement | null>(null);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [trimModalState, setTrimModalState] = useState<{
    track: Track | null;
    startSec?: number;
    endSec?: number;
    isImportFlow?: boolean;
    importQueue?: Track[];
    importTotal?: number;
    defaultPlaylistIds?: string[];
  }>({track: null});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showMobilePlaylistCreator, setShowMobilePlaylistCreator] = useState(false);
  const [isRenamingPlaylist, setIsRenamingPlaylist] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isPlaylistReorderMode, setIsPlaylistReorderMode] = useState(false);
  const [isPlaylistFilePickerOpen, setIsPlaylistFilePickerOpen] = useState(false);
  const playlistDirectFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeQueue = useMemo(
    () => (isShuffle && shuffledQueue.length > 0 ? shuffledQueue : baseQueue),
    [isShuffle, shuffledQueue, baseQueue],
  );

  // Build algorithmic preferred channels & personalized keywords from user's library & history
  const preferredChannels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of likedTracks) {
      counts.set(t.channel, (counts.get(t.channel) || 0) + 2);
    }
    for (const pl of playlists) {
      for (const t of pl.tracks) {
        counts.set(t.channel, (counts.get(t.channel) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [likedTracks, playlists]);

  const personalizedKeywords = useMemo(() => {
    const out: string[] = [];
    for (const ch of preferredChannels.slice(0, 3)) {
      out.push(`${ch} 노래 모음`);
    }
    if (out.length < 4) {
      for (const fallback of ['어쿠스틱 플레이리스트', '감성 발라드 라이브', 'Lo-Fi 비트', '심야 재즈 피아노']) {
        if (out.length >= 5) break;
        if (!out.includes(fallback)) out.push(fallback);
      }
    }
    return out;
  }, [preferredChannels]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3400);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LIKED, JSON.stringify(localLikedTracks));
  }, [localLikedTracks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(localPlaylists));
  }, [localPlaylists]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PERSONAL_TRACKS, JSON.stringify(localPersonalTracks));
  }, [localPersonalTracks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(localHistory));
  }, [localHistory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOLUME, JSON.stringify(volume));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KEEP_ALIVE, JSON.stringify(backgroundKeepAlive));
  }, [backgroundKeepAlive]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REPEAT, JSON.stringify(repeatMode));
  }, [repeatMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHUFFLE, JSON.stringify(isShuffle));
  }, [isShuffle]);

  const refreshAvailableLocalBlobs = useCallback(async (scope: string) => {
    const ids = await listAvailableLocalTrackIds(scope);
    setAvailableLocalBlobIds(ids);
  }, []);

  useEffect(() => {
    refreshAvailableLocalBlobs(ownerScope);
  }, [ownerScope, refreshAvailableLocalBlobs]);

  // Firebase Auth & Firestore subscriptions
  useEffect(() => {
    let unsubLiked: (() => void) | null = null;
    let unsubPlaylists: (() => void) | null = null;
    let unsubPersonal: (() => void) | null = null;
    let unsubHistory: (() => void) | null = null;
    let unsubPlayHistory: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubLiked) {
        unsubLiked();
        unsubLiked = null;
      }
      if (unsubPlaylists) {
        unsubPlaylists();
        unsubPlaylists = null;
      }
      if (unsubPersonal) {
        unsubPersonal();
        unsubPersonal = null;
      }
      if (unsubHistory) {
        unsubHistory();
        unsubHistory = null;
      }
      if (unsubPlayHistory) {
        unsubPlayHistory();
        unsubPlayHistory = null;
      }

      setUser(firebaseUser);
      setAuthLoading(false);

      if (!firebaseUser) {
        syncedUidRef.current = null;
        setCloudLikedTracks([]);
        setCloudPlaylists([]);
        setCloudPersonalTracks([]);
        setCloudHistory([]);
        setCloudPlayHistory([]);
        refreshAvailableLocalBlobs('guest');
        return;
      }

      try {
        const prefs = await ensureAndLoadUserPreferences(firebaseUser, {
          repeatMode,
          isShuffle: false,
          backgroundKeepAlive,
        });
        setRepeatMode(prefs.repeatMode);
        setBackgroundKeepAlive(prefs.backgroundKeepAlive);

        if (syncedUidRef.current !== firebaseUser.uid) {
          syncedUidRef.current = firebaseUser.uid;
          await migrateGuestAudioBlobsToUser(firebaseUser.uid);
          const savedLocalPlaylists = readStorage<Playlist[]>(STORAGE_KEYS.PLAYLISTS, []);
          const savedLocalLiked = readStorage<Track[]>(STORAGE_KEYS.LIKED, []);
          const savedLocalPersonal = readStorage<Track[]>(STORAGE_KEYS.PERSONAL_TRACKS, []);
          if (
            savedLocalPlaylists.length > 0 ||
            savedLocalLiked.length > 0 ||
            savedLocalPersonal.length > 0
          ) {
            await mergeLocalLibraryToCloud(
              firebaseUser.uid,
              savedLocalPlaylists,
              savedLocalLiked,
              savedLocalPersonal,
            );
          }
        }

        await refreshAvailableLocalBlobs(firebaseUser.uid);

        unsubLiked = subscribeLikedTracks(
          firebaseUser.uid,
          (tracks) => setCloudLikedTracks(tracks),
          () => showToast('좋아요 목록 동기화 중 오류가 발생했습니다.'),
        );
        unsubPlaylists = subscribePlaylists(
          firebaseUser.uid,
          (pls) => setCloudPlaylists(pls),
          () => showToast('플레이리스트 동기화 중 오류가 발생했습니다.'),
        );
        unsubPersonal = subscribePersonalTracks(
          firebaseUser.uid,
          (tracks) => setCloudPersonalTracks(tracks),
          () => showToast('내 파일 트랙 동기화 중 오류가 발생했습니다.'),
        );
        unsubHistory = subscribeSearchHistory(
          firebaseUser.uid,
          (items) => setCloudHistory(items),
          () => showToast('검색 기록 동기화 중 오류가 발생했습니다.'),
        );
        unsubPlayHistory = subscribePlayHistory(
          firebaseUser.uid,
          (items) => setCloudPlayHistory(items),
          () => showToast('재생 취향 동기화 중 오류가 발생했습니다.'),
        );
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      unsubAuth();
      if (unsubLiked) unsubLiked();
      if (unsubPlaylists) unsubPlaylists();
      if (unsubPersonal) unsubPersonal();
      if (unsubHistory) unsubHistory();
      if (unsubPlayHistory) unsubPlayHistory();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const signedInUser = await signInWithGoogle();
      showToast(`${signedInUser.displayName || 'Google'} 계정과 연동되었습니다.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup-closed-by-user')) return;
      showToast('Google 로그인을 완료하지 못했습니다.');
    }
  }, [showToast]);

  const handleGoogleSignOut = useCallback(async () => {
    try {
      await signOutGoogle();
      showToast('Google 계정 연동을 해제했습니다.');
    } catch {
      showToast('로그아웃 중 오류가 발생했습니다.');
    }
  }, [showToast]);

  const likedIds = useMemo(() => new Set(likedTracks.map((t) => t.id)), [likedTracks]);

  // Analyze in-app musical taste strictly for Google-signed-in users
  const tasteProfile = useMemo(() => {
    if (!user) return null;
    return analyzeUserTaste({
      likedTracks: cloudLikedTracks,
      playlists: cloudPlaylists,
      searchHistory: cloudHistory,
      playHistory: cloudPlayHistory,
    });
  }, [user, cloudLikedTracks, cloudPlaylists, cloudHistory, cloudPlayHistory]);

  const tasteQuerySignature = tasteProfile?.hasSignals
    ? tasteProfile.discoveryQueries.join('|')
    : '';
  const tasteLatestRef = useRef(tasteProfile);
  tasteLatestRef.current = tasteProfile;

  // Load curated tracks (or personalized Recommended Mix for signed-in Google users)
  useEffect(() => {
    let cancelled = false;
    setIsLoadingTracks(true);
    setFetchError(null);

    const activeTaste = tasteLatestRef.current;
    const shouldUsePersonalized =
      selectedMood === 'recommended' && Boolean(user) && Boolean(activeTaste?.hasSignals);

    const loader = shouldUsePersonalized
      ? fetch('/api/youtube/personalized', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            queries: activeTaste!.discoveryQueries,
            preferredChannels: activeTaste!.topChannels,
            tasteTokens: activeTaste!.tasteTokens,
            knownIds: activeTaste!.knownTrackIds,
          }),
        }).then(async (res) => {
          const data = (await res.json()) as {tracks?: Track[]; error?: string};
          if (!res.ok) throw new Error(data.error || '맞춤 추천 트랙을 불러오지 못했습니다.');
          return {tracks: data.tracks || [], personalized: true};
        })
      : fetch(`/api/youtube/curated?mood=${encodeURIComponent(selectedMood)}`).then(async (res) => {
          const data = (await res.json()) as {tracks?: Track[]; error?: string};
          if (!res.ok) throw new Error(data.error || '트랙을 불러오지 못했습니다.');
          return {tracks: data.tracks || [], personalized: false};
        });

    loader
      .then(({tracks, personalized}) => {
        if (!cancelled) {
          setCuratedTracks(tracks);
          setIsPersonalizedMix(personalized);
          setIsLoadingTracks(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIsPersonalizedMix(false);
          setFetchError(err instanceof Error ? err.message : '유튜브 트랙 연결 실패');
          setIsLoadingTracks(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMood, user?.uid, tasteQuerySignature, personalizedRefreshSeed]);

  const loadUnifiedCharts = useCallback(async (forceRefresh = false) => {
    setIsLoadingCharts(true);
    setChartsError(null);
    try {
      const url = forceRefresh ? '/api/charts/unified?refresh=1' : '/api/charts/unified';
      const res = await fetch(url);
      const data = (await res.json()) as UnifiedChartResponse & {error?: string};
      if (!res.ok) {
        throw new Error(data.error || '실시간 통합 차트를 불러오지 못했습니다.');
      }
      setChartsData(data);
    } catch (err) {
      setChartsError(
        err instanceof Error ? err.message : '실시간 통합 차트를 불러오지 못했습니다.',
      );
    } finally {
      setIsLoadingCharts(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'charts' && !chartsData && !isLoadingCharts) {
      loadUnifiedCharts(false);
    }
  }, [activeSection, chartsData, isLoadingCharts, loadUnifiedCharts]);

  const {unlockAndPlay: unlockKeepAlive, stopKeepAlive} = useBackgroundKeepAlive({
    enabled: backgroundKeepAlive,
    active: Boolean(currentTrack) && !isUserPaused,
    mode: audioPipelineMode,
    onHeartbeat: () => engineRef.current?.tickWatchdog(),
  });

  const beginPlaybackForTrack = useCallback(
    (track: Track) => {
      const entryKey = track.entryId || `${track.id}__${Date.now()}`;
      userPausedRef.current = false;
      setIsUserPaused(false);
      unlockKeepAlive();
      setCurrentTrack(track);
      setActiveEntryKey(entryKey);
      setCurrentTime(track.startSeconds || 0);
      setDuration(track.durationSeconds || 0);
      setAbLoopEnabled(false);
      setAbStart(track.startSeconds || 0);
      setAbEnd(track.endSeconds || 0);
      setIsPlaying(true);

      const isLocalPrivate = track.source === 'local' || track.id.startsWith('local_');
      if (user?.uid && !isLocalPrivate) {
        recordPlayHistoryCloud(user.uid, track).catch(() => {
          // Non-blocking playback history logging
        });
      }
    },
    [unlockKeepAlive, user?.uid],
  );

  // Clicking a single song outside playlists queues ONLY that track (no unwanted multi-video queue)
  const playSingleTrack = useCallback(
    (track: Track) => {
      setPlaybackSource('single');
      setIsShuffle(false);
      setShuffledQueue([]);
      setBaseQueue([track]);
      beginPlaybackForTrack(track);
    },
    [beginPlaybackForTrack],
  );

  // Explicit "전체 재생" on Explore mix / Channel / Library plays sequentially without shuffle
  const playListSequentially = useCallback(
    (track: Track, list: Track[]) => {
      const effectiveList = list.length > 0 ? list : [track];
      setPlaybackSource('single');
      setIsShuffle(false);
      setShuffledQueue([]);
      setBaseQueue(effectiveList);
      beginPlaybackForTrack(track);
    },
    [beginPlaybackForTrack],
  );

  // Inside a custom Playlist: always keeps original playlist order untouched; shuffle only when selected
  const playFromPlaylist = useCallback(
    (track: Track, playlistTracks: Track[]) => {
      const effectiveList = playlistTracks.length > 0 ? playlistTracks : [track];
      setPlaybackSource('playlist');
      setIsShuffle(false);
      setShuffledQueue([]);
      setBaseQueue(effectiveList);
      beginPlaybackForTrack(track);
    },
    [beginPlaybackForTrack],
  );

  const playPlaylistShuffled = useCallback(
    (list: Track[]) => {
      if (list.length === 0) return;
      const shuffled = shuffleTracksFisherYates(list);
      setPlaybackSource('playlist');
      setIsShuffle(true);
      setBaseQueue(list);
      setShuffledQueue(shuffled);
      beginPlaybackForTrack(shuffled[0]);
      showToast('플레이리스트 순서를 유지한 채 랜덤 셔플 재생을 시작했습니다.');
    },
    [beginPlaybackForTrack, showToast],
  );

  const handleTogglePlay = useCallback(() => {
    if (!currentTrack) return;
    const ytState = engineRef.current?.getPlayerState() ?? -1;
    const actuallyPlaying = ytState === 1 || (isPlaying && !userPausedRef.current);
    if (actuallyPlaying) {
      userPausedRef.current = true;
      setIsUserPaused(true);
      stopKeepAlive();
      engineRef.current?.pause();
      setIsPlaying(false);
    } else {
      userPausedRef.current = false;
      setIsUserPaused(false);
      unlockKeepAlive();
      engineRef.current?.play();
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying, stopKeepAlive, unlockKeepAlive]);

  const handleDismissPlayer = useCallback(() => {
    userPausedRef.current = true;
    setIsUserPaused(true);
    engineRef.current?.stop();
    stopKeepAlive();
    setCurrentTrack(null);
    setActiveEntryKey(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAbLoopEnabled(false);
    setAbStart(0);
    setAbEnd(0);
    setIsMobilePlayerOpen(false);
    setVideoMode('audio');
    setBaseQueue([]);
    setShuffledQueue([]);
    setIsShuffle(false);
    setPlaybackSource('single');
  }, [stopKeepAlive]);

  const handleNext = useCallback(() => {
    if (!currentTrack || activeQueue.length === 0) return;

    if (repeatMode === 'one') {
      const start = currentTrack.startSeconds || 0;
      userPausedRef.current = false;
      setIsUserPaused(false);
      unlockKeepAlive();
      setCurrentTime(start);
      engineRef.current?.seekTo(start);
      engineRef.current?.play();
      setIsPlaying(true);
      return;
    }

    const curKey = activeEntryKey || getTrackKey(currentTrack);
    const idx = activeQueue.findIndex((t) => getTrackKey(t) === curKey);
    if (idx === -1) {
      beginPlaybackForTrack(activeQueue[0]);
      return;
    }

    if (idx + 1 < activeQueue.length) {
      beginPlaybackForTrack(activeQueue[idx + 1]);
    } else if (repeatMode === 'all' && activeQueue.length > 0) {
      if (playbackSource === 'playlist' && isShuffle && baseQueue.length > 1) {
        const reshuffled = shuffleTracksFisherYates(baseQueue);
        if (getTrackKey(reshuffled[0]) === curKey && reshuffled.length > 1) {
          [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
        }
        setShuffledQueue(reshuffled);
        beginPlaybackForTrack(reshuffled[0]);
      } else {
        beginPlaybackForTrack(activeQueue[0]);
      }
    } else {
      setIsPlaying(false);
    }
  }, [
    currentTrack,
    activeEntryKey,
    activeQueue,
    baseQueue,
    repeatMode,
    playbackSource,
    isShuffle,
    beginPlaybackForTrack,
    unlockKeepAlive,
  ]);

  const handlePrev = useCallback(() => {
    if (!currentTrack || activeQueue.length === 0) return;
    const minStart = currentTrack.startSeconds || 0;
    if (currentTime > minStart + 3) {
      engineRef.current?.seekTo(minStart);
      setCurrentTime(minStart);
      return;
    }
    const curKey = activeEntryKey || getTrackKey(currentTrack);
    const idx = activeQueue.findIndex((t) => getTrackKey(t) === curKey);
    const prevIndex = idx <= 0 ? activeQueue.length - 1 : idx - 1;
    const prevTrack = activeQueue[prevIndex];
    if (prevTrack) {
      beginPlaybackForTrack(prevTrack);
    }
  }, [currentTrack, activeEntryKey, activeQueue, currentTime, beginPlaybackForTrack]);

  const handleSeek = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    engineRef.current?.seekTo(seconds);
  }, []);

  const handlePlayerError = useCallback(
    (code: number) => {
      const isLocalCurrent = Boolean(
        currentTrack && (currentTrack.source === 'local' || currentTrack.id.startsWith('local_')),
      );

      if (isLocalCurrent) {
        const msg =
          code === 404
            ? '이 기기에 원본 오디오 파일이 연결되어 있지 않습니다. 내 파일 트랙에서 파일을 다시 연결해 주세요.'
            : '내 오디오 파일을 재생하지 못했습니다.';
        if (activeQueue.length <= 1) {
          setIsPlaying(false);
          showToast(msg);
          return;
        }
        showToast(`${msg} 다음 곡으로 이동합니다.`);
        if (repeatMode === 'one') {
          setRepeatMode('all');
        }
        handleNext();
        return;
      }

      if (activeQueue.length <= 1) {
        setIsPlaying(false);
        showToast(
          code === 101 || code === 150
            ? '게시자가 외부 재생을 제한한 영상입니다. 다른 곡을 선택해 주세요.'
            : '이 영상을 재생할 수 없습니다. 다른 곡을 선택해 주세요.',
        );
        return;
      }
      if (code === 101 || code === 150) {
        showToast('게시자가 외부 임베드를 제한한 영상입니다. 다음 곡으로 건너뜁니다.');
      } else {
        showToast('트랙 재생 중 오류가 발생해 다음 곡으로 이동합니다.');
      }
      if (repeatMode === 'one') {
        setRepeatMode('all');
      }
      handleNext();
    },
    [activeQueue.length, currentTrack, handleNext, repeatMode, showToast],
  );

  useMediaSession({
    track: currentTrack,
    isPlaying,
    isUserPaused,
    currentTime,
    duration: duration || currentTrack?.durationSeconds || 0,
    onPlay: () => {
      userPausedRef.current = false;
      setIsUserPaused(false);
      unlockKeepAlive();
      engineRef.current?.play();
      setIsPlaying(true);
    },
    onPause: () => {
      userPausedRef.current = true;
      setIsUserPaused(true);
      stopKeepAlive();
      engineRef.current?.pause();
      setIsPlaying(false);
    },
    onPrev: handlePrev,
    onNext: handleNext,
    onSeekTo: handleSeek,
  });

  const recordSearchHistory = useCallback(
    async (queryText: string, searchType: 'keyword' | 'channel' | 'url') => {
      const clean = queryText.trim();
      if (!clean) return;
      if (user) {
        saveSearchHistoryCloud(user.uid, clean, searchType).catch(console.error);
        return;
      }
      setLocalHistory((prev) => {
        const filtered = prev.filter(
          (item) => !(item.query === clean && item.searchType === searchType),
        );
        return [
          {
            id: `sh_${Date.now()}`,
            query: clean,
            searchType,
            updatedAt: Date.now(),
          },
          ...filtered,
        ].slice(0, 20);
      });
    },
    [user],
  );

  const executeSearch = useCallback(
    async (
      rawQuery: string,
      modeOverride?: SearchMode,
      sortOverride?: SearchSort,
    ) => {
      const q = rawQuery.trim();
      if (!q) return;

      const effectiveMode = modeOverride || searchMode;
      const effectiveSort = sortOverride || searchSort;

      setActiveSection('explore');
      setActiveChannelView(null);
      setIsLoadingTracks(true);
      setFetchError(null);
      setSubmittedQuery(q);

      try {
        if (isYouTubeUrlOrId(q)) {
          recordSearchHistory(q, 'url');
          const res = await fetch(`/api/youtube/resolve?url=${encodeURIComponent(q)}`);
          const data = (await res.json()) as {
            type?: 'track' | 'playlist';
            title?: string;
            tracks?: Track[];
            primaryTrack?: Track;
            error?: string;
          };
          if (!res.ok) throw new Error(data.error || '유튜브 링크를 확인할 수 없습니다.');

          const resolvedTracks = data.tracks || [];
          if (resolvedTracks.length === 0) {
            throw new Error('재생 가능한 트랙을 찾지 못했습니다.');
          }

          if (data.type === 'playlist') {
            const plTitle = data.title || '가져온 유튜브 재생목록';
            if (user) {
              const newId = await createPlaylistCloud(user.uid, plTitle, resolvedTracks);
              setActivePlaylistId(newId);
            } else {
              const entries = resolvedTracks.map((t) => ({...t, entryId: makeEntryId(t.id)}));
              const newPl: Playlist = {
                id: `pl_${Date.now()}`,
                name: plTitle,
                tracks: entries,
                createdAt: Date.now(),
              };
              setLocalPlaylists((prev) => [newPl, ...prev]);
              setActivePlaylistId(newPl.id);
            }
            setActiveSection('playlist');
            playFromPlaylist(data.primaryTrack || resolvedTracks[0], resolvedTracks);
            showToast(`재생목록 "${plTitle}" (${resolvedTracks.length}곡)을 가져왔습니다.`);
          } else {
            setChannelResults(null);
            setSearchResults(resolvedTracks);
            setSearchUniquePool(resolvedTracks);
            setSearchNextCursor(null);
            setSearchRepeatingMode(false);
            playSingleTrack(resolvedTracks[0]);
            showToast('유튜브 링크를 불러와 재생을 시작했습니다.');
          }
        } else {
          recordSearchHistory(q, effectiveMode === 'channel' ? 'channel' : 'keyword');
          setSearchNextCursor(null);
          setSearchRepeatingMode(false);
          setSearchUniquePool([]);
          const params = new URLSearchParams({
            q,
            mode: effectiveMode,
            sort: effectiveSort,
            preferredChannels: preferredChannels.join(','),
          });
          const res = await fetch(`/api/youtube/search?${params.toString()}`);
          const data = (await res.json()) as {
            tracks?: Track[];
            channels?: YouTubeChannel[];
            nextCursor?: string | null;
            error?: string;
          };
          if (!res.ok) throw new Error(data.error || '검색 중 오류가 발생했습니다.');

          if (effectiveMode === 'channel') {
            setSearchResults(null);
            setSearchUniquePool([]);
            setSearchNextCursor(null);
            setChannelResults(data.channels || []);
          } else {
            const rawList = data.tracks || [];
            const seenIds = new Set<string>();
            const uniqueList = rawList.filter((t) => {
              if (seenIds.has(t.id)) return false;
              seenIds.add(t.id);
              return true;
            });
            setChannelResults(null);
            setSearchResults(uniqueList);
            setSearchUniquePool(uniqueList);
            setSearchNextCursor(data.nextCursor || null);
            setSearchRepeatingMode(!data.nextCursor && uniqueList.length > 0);
          }
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : '요청을 처리하지 못했습니다.');
      } finally {
        setIsLoadingTracks(false);
      }
    },
    [
      searchMode,
      searchSort,
      preferredChannels,
      user,
      recordSearchHistory,
      playFromPlaylist,
      playSingleTrack,
      showToast,
    ],
  );

  const appendRandomizedBatch = useCallback((pool: Track[], currentList: Track[]): Track[] => {
    if (pool.length === 0) return currentList;
    const shuffled = shuffleTracksFisherYates(pool);
    const lastId = currentList[currentList.length - 1]?.id;
    if (lastId && shuffled.length > 1 && shuffled[0].id === lastId) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    const batch = shuffled.slice(0, Math.min(20, shuffled.length)).map((t) => ({...t}));
    return [...currentList, ...batch];
  }, []);

  const handleLoadMoreSearch = useCallback(async () => {
    if (loadingMoreSearchRef.current || !submittedQuery || searchResults === null) return;
    if (isYouTubeUrlOrId(submittedQuery)) return;

    loadingMoreSearchRef.current = true;
    setIsLoadingMoreSearch(true);

    try {
      if (searchNextCursor && !searchRepeatingMode) {
        const excludeIds = searchUniquePool.map((t) => t.id).slice(-80);
        const params = new URLSearchParams({
          q: submittedQuery,
          mode: searchMode,
          sort: searchSort,
          cursor: searchNextCursor,
          preferredChannels: preferredChannels.join(','),
          excludeIds: excludeIds.join(','),
        });
        const res = await fetch(`/api/youtube/search?${params.toString()}`);
        const data = (await res.json()) as {
          tracks?: Track[];
          nextCursor?: string | null;
        };

        const existingIds = new Set(searchUniquePool.map((t) => t.id));
        const incomingUnique = (data.tracks || []).filter((t) => {
          if (existingIds.has(t.id)) return false;
          existingIds.add(t.id);
          return true;
        });

        if (incomingUnique.length > 0) {
          const nextPool = [...searchUniquePool, ...incomingUnique];
          setSearchUniquePool(nextPool);
          setSearchResults((prev) => [...(prev || []), ...incomingUnique]);
          const hasAnotherCursor = Boolean(data.nextCursor);
          setSearchNextCursor(data.nextCursor || null);
          if (!hasAnotherCursor) {
            setSearchRepeatingMode(true);
          }
          return;
        }

        // No more unseen results from YouTube continuation -> transition smoothly to randomized repeat
        setSearchNextCursor(null);
        setSearchRepeatingMode(true);
        setSearchResults((prev) => appendRandomizedBatch(searchUniquePool, prev || []));
        return;
      }

      if (searchUniquePool.length > 0) {
        setSearchRepeatingMode(true);
        setSearchResults((prev) => appendRandomizedBatch(searchUniquePool, prev || []));
      }
    } catch {
      if (searchUniquePool.length > 0) {
        setSearchRepeatingMode(true);
        setSearchResults((prev) => appendRandomizedBatch(searchUniquePool, prev || []));
      }
    } finally {
      loadingMoreSearchRef.current = false;
      setIsLoadingMoreSearch(false);
    }
  }, [
    submittedQuery,
    searchResults,
    searchNextCursor,
    searchRepeatingMode,
    searchUniquePool,
    searchMode,
    searchSort,
    preferredChannels,
    appendRandomizedBatch,
  ]);

  // YouTube-like automatic scroll loading for search results
  useEffect(() => {
    const sentinel = searchSentinelRef.current;
    if (
      !sentinel ||
      activeSection !== 'explore' ||
      searchResults === null ||
      channelResults !== null ||
      activeChannelView !== null ||
      isLoadingTracks ||
      isYouTubeUrlOrId(submittedQuery) ||
      searchResults.length >= 400
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMoreSearch();
        }
      },
      {
        root: mainScrollRef.current,
        rootMargin: '320px',
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    activeSection,
    searchResults,
    channelResults,
    activeChannelView,
    isLoadingTracks,
    submittedQuery,
    handleLoadMoreSearch,
  ]);

  const handleOpenChannel = async (ch: YouTubeChannel) => {
    setIsLoadingTracks(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/youtube/channel/${encodeURIComponent(ch.channelId)}`);
      const data = (await res.json()) as Partial<ChannelDetailData> & {
        tracks?: Track[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || '채널 정보를 불러오지 못했습니다.');
      const videos = data.videos || data.tracks || [];
      const playlistsList = data.playlists || [];
      const releasesList = data.releases || [];
      setActiveChannelView({
        channelId: ch.channelId,
        channelTitle: data.channelTitle || ch.title,
        subscriberText: data.subscriberText || ch.subscriberText || '',
        thumbnail: ch.thumbnail || data.thumbnail || '',
        videos,
        playlists: playlistsList,
        releases: releasesList,
        hasReleases: Boolean(data.hasReleases || releasesList.length > 0),
      });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '채널 로딩 실패');
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSubmittedQuery('');
    setSearchResults(null);
    setSearchUniquePool([]);
    setSearchNextCursor(null);
    setSearchRepeatingMode(false);
    setChannelResults(null);
    setActiveChannelView(null);
    setFetchError(null);
  };

  const handleDeleteHistoryItem = (historyId: string) => {
    if (user) {
      removeSearchHistoryCloud(user.uid, historyId).catch(console.error);
    } else {
      setLocalHistory((prev) => prev.filter((item) => item.id !== historyId));
    }
  };

  const handleClearHistory = () => {
    if (user) {
      clearSearchHistoryCloud(user.uid).catch(console.error);
    } else {
      setLocalHistory([]);
    }
  };

  const handleToggleLike = useCallback(
    async (track: Track) => {
      const matchingEntries = likedTracks.filter((t) => t.id === track.id);
      if (user) {
        try {
          if (matchingEntries.length > 0 && !track.entryId) {
            for (const entry of matchingEntries) {
              if (entry.entryId) {
                await removeLikedTrackCloud(user.uid, entry.entryId);
              }
            }
            showToast('좋아요 보관함에서 제거했습니다.');
          } else {
            await addLikedTrackCloud(user.uid, {...track, entryId: makeEntryId(track.id)});
            showToast('좋아요 보관함에 저장했습니다.');
          }
        } catch {
          showToast('좋아요 상태를 저장하지 못했습니다.');
        }
        return;
      }

      setLocalLikedTracks((prev) => {
        if (matchingEntries.length > 0 && !track.entryId) {
          showToast('좋아요 보관함에서 제거했습니다.');
          return prev.filter((t) => t.id !== track.id);
        }
        showToast('좋아요 보관함에 저장했습니다.');
        return [{...track, entryId: makeEntryId(track.id)}, ...prev];
      });
    },
    [user, likedTracks, showToast],
  );

  const handleRemoveFromLikedEntry = useCallback(
    async (entryId: string) => {
      if (user) {
        try {
          await removeLikedTrackCloud(user.uid, entryId);
          showToast('보관함에서 제거했습니다.');
        } catch {
          showToast('항목을 제거하지 못했습니다.');
        }
        return;
      }
      setLocalLikedTracks((prev) => prev.filter((t) => t.entryId !== entryId));
      showToast('보관함에서 제거했습니다.');
    },
    [user, showToast],
  );

  const handleAddToQueue = useCallback(
    (track: Track) => {
      const queuedEntry: Track = {...track, entryId: makeEntryId(track.id)};
      setBaseQueue((prev) => [...prev, queuedEntry]);
      if (isShuffle) {
        setShuffledQueue((prev) => [...prev, queuedEntry]);
      }
      showToast('재생 대기열에 추가했습니다.');
    },
    [isShuffle, showToast],
  );

  const handleAddManyToQueue = useCallback(
    (tracksToAdd: Track[]) => {
      if (tracksToAdd.length === 0) return;
      const queuedEntries = tracksToAdd.map((t) => ({...t, entryId: makeEntryId(t.id)}));
      setBaseQueue((prev) => [...prev, ...queuedEntries]);
      if (isShuffle) {
        setShuffledQueue((prev) => [...prev, ...queuedEntries]);
      }
      showToast(`${tracksToAdd.length}곡을 재생 대기열에 추가했습니다.`);
    },
    [isShuffle, showToast],
  );

  const handleSaveCollectionAsPlaylist = useCallback(
    async (name: string, tracksToSave: Track[]) => {
      const cleanName = name.trim() || '저장된 채널 묶음';
      const readyEntries = tracksToSave.map((t) => ({...t, entryId: makeEntryId(t.id)}));
      if (user) {
        try {
          const newId = await createPlaylistCloud(user.uid, cleanName);
          if (readyEntries.length > 0) {
            await addTracksToPlaylistCloud(user.uid, newId, readyEntries, 0);
          }
          showToast(`"${cleanName}" (${readyEntries.length}곡) 플레이리스트로 저장했습니다.`);
        } catch {
          showToast('플레이리스트로 저장하지 못했습니다.');
        }
        return;
      }

      const newPl: Playlist = {
        id: `pl_${Date.now()}`,
        name: cleanName,
        tracks: readyEntries,
        createdAt: Date.now(),
      };
      setLocalPlaylists((prev) => [newPl, ...prev]);
      showToast(`"${cleanName}" (${readyEntries.length}곡) 플레이리스트로 저장했습니다.`);
    },
    [user, showToast],
  );

  const handleReorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (isShuffle && shuffledQueue.length > 0) {
        setShuffledQueue((prev) => {
          if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
          const next = [...prev];
          const [moved] = next.splice(fromIndex, 1);
          if (!moved) return prev;
          next.splice(toIndex, 0, moved);
          return next;
        });
        return;
      }
      setBaseQueue((prev) => {
        if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return prev;
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [isShuffle, shuffledQueue.length],
  );

  const handleCreatePlaylist = async (name: string): Promise<string | null> => {
    if (user) {
      try {
        const newId = await createPlaylistCloud(user.uid, name);
        setActivePlaylistId(newId);
        setActiveSection('playlist');
        showToast(`"${name}" 플레이리스트를 생성했습니다.`);
        return newId;
      } catch {
        showToast('플레이리스트를 생성하지 못했습니다.');
        return null;
      }
    }

    const newPl: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      tracks: [],
      createdAt: Date.now(),
    };
    setLocalPlaylists((prev) => [newPl, ...prev]);
    setActivePlaylistId(newPl.id);
    setActiveSection('playlist');
    showToast(`"${name}" 플레이리스트를 만들었습니다.`);
    return newPl.id;
  };

  const handleRenamePlaylist = async (playlistId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (user) {
      try {
        await renamePlaylistCloud(user.uid, playlistId, trimmed);
        showToast('플레이리스트 이름을 변경했습니다.');
      } catch {
        showToast('이름 변경 중 오류가 발생했습니다.');
      }
    } else {
      setLocalPlaylists((prev) =>
        prev.map((pl) => (pl.id === playlistId ? {...pl, name: trimmed} : pl)),
      );
      showToast('플레이리스트 이름을 변경했습니다.');
    }
    setIsRenamingPlaylist(false);
  };

  const handleDeletePlaylist = async (id: string) => {
    if (user) {
      try {
        await deletePlaylistCloud(user.uid, id);
      } catch {
        showToast('플레이리스트 삭제 중 오류가 발생했습니다.');
        return;
      }
    } else {
      setLocalPlaylists((prev) => prev.filter((p) => p.id !== id));
    }

    if (activePlaylistId === id) {
      setActivePlaylistId(null);
      setActiveSection('explore');
    }
    showToast('플레이리스트를 삭제했습니다.');
  };

  // Supports adding the exact same song multiple times into any playlist!
  const handleAddTracksToPlaylist = useCallback(
    async (playlistId: string, entries: Track[]) => {
      const target = playlists.find((p) => p.id === playlistId);
      const readyEntries = entries.map((t) => ({...t, entryId: makeEntryId(t.id)}));

      if (user) {
        try {
          await addTracksToPlaylistCloud(
            user.uid,
            playlistId,
            readyEntries,
            target ? target.tracks.length : 0,
          );
        } catch {
          showToast('플레이리스트에 곡을 추가하지 못했습니다.');
        }
        return;
      }

      setLocalPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId ? {...pl, tracks: [...pl.tracks, ...readyEntries]} : pl,
        ),
      );
    },
    [playlists, user, showToast],
  );

  const handleConfirmTrimAndSave = async ({
    track,
    useTrim,
    startSeconds,
    endSeconds,
    clipLabel,
    alsoSaveFull,
    saveToLiked,
    targetPlaylistIds,
  }: {
    track: Track;
    useTrim: boolean;
    startSeconds: number;
    endSeconds: number;
    clipLabel: string;
    alsoSaveFull: boolean;
    saveToLiked: boolean;
    targetPlaylistIds: string[];
  }) => {
    const entriesToSave: Track[] = [];

    if (useTrim) {
      entriesToSave.push({
        ...track,
        entryId: makeEntryId(track.id),
        startSeconds,
        endSeconds,
        clipLabel: clipLabel || `${formatTime(startSeconds)}–${formatTime(endSeconds)} 구간`,
      });
    }
    if (!useTrim || alsoSaveFull) {
      entriesToSave.push({
        id: track.id,
        entryId: makeEntryId(track.id),
        title: track.title,
        channel: track.channel,
        channelId: track.channelId,
        duration: track.duration,
        durationSeconds: track.durationSeconds,
        thumbnail: track.thumbnail,
        viewCountText: track.viewCountText,
        ...(track.source ? {source: track.source} : {}),
        ...(track.fileName ? {fileName: track.fileName} : {}),
        ...(typeof track.fileSize === 'number' ? {fileSize: track.fileSize} : {}),
      });
    }

    if (saveToLiked) {
      for (const entry of entriesToSave) {
        if (user) {
          await addLikedTrackCloud(user.uid, entry);
        } else {
          setLocalLikedTracks((prev) => [entry, ...prev]);
        }
      }
    }

    for (const plId of targetPlaylistIds) {
      await handleAddTracksToPlaylist(plId, entriesToSave);
    }

    if (useTrim && alsoSaveFull) {
      showToast('선택한 구간과 전체 곡을 동시에 등록했습니다.');
    } else if (useTrim) {
      showToast(`구간 (${formatTime(startSeconds)}–${formatTime(endSeconds)})을 등록했습니다.`);
    } else {
      showToast('전체 곡을 등록했습니다.');
    }
  };

  const handleRemoveFromPlaylist = async (playlistId: string, entryId: string) => {
    if (user) {
      try {
        await removeTrackFromPlaylistCloud(user.uid, playlistId, entryId);
        showToast('플레이리스트에서 항목을 제거했습니다.');
      } catch {
        showToast('항목을 제거하지 못했습니다.');
      }
      return;
    }

    setLocalPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? {...pl, tracks: pl.tracks.filter((t) => (t.entryId || t.id) !== entryId)}
          : pl,
      ),
    );
  };

  const handleReorderPlaylistTrack = useCallback(
    async (playlistId: string, fromIndex: number, toIndex: number) => {
      const target = playlists.find((p) => p.id === playlistId);
      if (!target) return;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= target.tracks.length ||
        toIndex >= target.tracks.length
      ) {
        return;
      }

      const reordered = [...target.tracks];
      const [moved] = reordered.splice(fromIndex, 1);
      if (!moved) return;
      reordered.splice(toIndex, 0, moved);

      // Keep active sequential playlist queue aligned with the user's new order
      if (playbackSource === 'playlist' && baseQueue.length === target.tracks.length) {
        const targetKeys = new Set(target.tracks.map((t) => t.entryId || t.id));
        const samePlaylistQueue = baseQueue.every((t) => targetKeys.has(t.entryId || t.id));
        if (samePlaylistQueue) {
          setBaseQueue(reordered);
        }
      }

      if (user) {
        try {
          const orderedEntryIds = reordered.map((t) => t.entryId || t.id);
          await reorderPlaylistTracksCloud(user.uid, playlistId, orderedEntryIds);
        } catch {
          showToast('플레이리스트 순서를 저장하지 못했습니다.');
        }
        return;
      }

      setLocalPlaylists((prev) =>
        prev.map((pl) => (pl.id === playlistId ? {...pl, tracks: reordered} : pl)),
      );
    },
    [playlists, playbackSource, baseQueue, user, showToast],
  );

  useEffect(() => {
    setIsPlaylistReorderMode(false);
    setIsPlaylistFilePickerOpen(false);
  }, [activePlaylistId, activeSection]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUTO_TRIM_IMPORT, JSON.stringify(autoTrimOnImport));
  }, [autoTrimOnImport]);

  const closeOrAdvanceTrimModal = useCallback(() => {
    setTrimModalState((prev) => {
      if (prev.importQueue && prev.importQueue.length > 0) {
        const [nextTrack, ...rest] = prev.importQueue;
        return {
          track: nextTrack,
          isImportFlow: true,
          importQueue: rest,
          importTotal: prev.importTotal,
          defaultPlaylistIds: prev.defaultPlaylistIds,
        };
      }
      return {track: null};
    });
  }, []);

  const handleUploadPersonalFiles = useCallback(
    async (files: FileList | File[], targetPlaylistId?: string) => {
      const list = Array.from(files);
      const validFiles = list.filter((f) => isSupportedAudioFile(f));
      if (validFiles.length === 0) {
        showToast('MP3, WAV, M4A, AAC, OGG, FLAC 등 오디오 파일만 등록할 수 있습니다.');
        return;
      }

      setIsUploadingPersonalFiles(true);
      const addedTracks: Track[] = [];
      try {
        for (const file of validFiles) {
          const trackId = makeLocalTrackId();
          const durationSec = await readAudioFileDuration(file);
          await saveLocalAudioBlob(ownerScope, trackId, file, file.name);
          const track: Track = {
            id: trackId,
            title: stripAudioExtension(file.name),
            channel: '내 파일',
            duration: formatTrackDurationLabel(durationSec),
            durationSeconds: durationSec,
            thumbnail: '',
            source: 'local',
            fileName: file.name,
            fileSize: file.size,
          };
          addedTracks.push(track);
          if (user) {
            await addPersonalTrackCloud(user.uid, track);
          } else {
            setLocalPersonalTracks((prev) => [track, ...prev]);
          }
        }

        await refreshAvailableLocalBlobs(ownerScope);

        if (addedTracks.length > 0 && autoTrimOnImport) {
          setTrimModalState({
            track: addedTracks[0],
            isImportFlow: true,
            importQueue: addedTracks.slice(1),
            importTotal: addedTracks.length,
            defaultPlaylistIds: targetPlaylistId ? [targetPlaylistId] : undefined,
          });
          showToast(
            addedTracks.length > 1
              ? `내 음악 ${addedTracks.length}개를 불러왔습니다. 순서대로 구간을 잘라 등록해 주세요.`
              : '내 음악을 불러왔습니다. 원하는 구간을 잘라 등록해 주세요.',
          );
          return;
        }

        if (targetPlaylistId && addedTracks.length > 0) {
          await handleAddTracksToPlaylist(targetPlaylistId, addedTracks);
          showToast(
            `내 사운드 트랙 ${addedTracks.length}개를 저장하고 플레이리스트에 추가했습니다.`,
          );
        } else {
          showToast(
            `내 사운드 트랙 ${addedTracks.length}개를 나만의 비공개 트랙으로 저장했습니다.`,
          );
        }
      } catch (err) {
        console.error(err);
        showToast('오디오 파일을 저장하는 중 오류가 발생했습니다.');
      } finally {
        setIsUploadingPersonalFiles(false);
      }
    },
    [ownerScope, user, autoTrimOnImport, refreshAvailableLocalBlobs, handleAddTracksToPlaylist, showToast],
  );

  const handleRelinkPersonalFile = useCallback(
    async (trackId: string, file: File) => {
      if (!isSupportedAudioFile(file)) {
        showToast('지원하지 않는 오디오 형식입니다.');
        return;
      }
      try {
        const durationSec = await readAudioFileDuration(file);
        await saveLocalAudioBlob(ownerScope, trackId, file, file.name);
        await refreshAvailableLocalBlobs(ownerScope);
        if (!user && durationSec > 0) {
          setLocalPersonalTracks((prev) =>
            prev.map((t) =>
              t.id === trackId
                ? {
                    ...t,
                    duration: formatTrackDurationLabel(durationSec),
                    durationSeconds: durationSec,
                    fileName: file.name,
                    fileSize: file.size,
                  }
                : t,
            ),
          );
        }
        showToast('원본 오디오 파일을 이 기기에 연결했습니다.');
      } catch {
        showToast('파일 연결에 실패했습니다.');
      }
    },
    [ownerScope, user, refreshAvailableLocalBlobs, showToast],
  );

  const handleUpdatePersonalTrackMeta = useCallback(
    async (trackId: string, title: string, channel: string) => {
      const cleanTitle = title.trim();
      const cleanChannel = channel.trim() || '내 파일';
      if (!cleanTitle) return;
      if (user) {
        try {
          await updatePersonalTrackCloud(user.uid, trackId, {
            title: cleanTitle,
            channel: cleanChannel,
          });
          showToast('트랙 정보를 수정했습니다.');
        } catch {
          showToast('트랙 정보를 수정하지 못했습니다.');
        }
        return;
      }
      setLocalPersonalTracks((prev) =>
        prev.map((t) =>
          t.id === trackId ? {...t, title: cleanTitle, channel: cleanChannel} : t,
        ),
      );
      showToast('트랙 정보를 수정했습니다.');
    },
    [user, showToast],
  );

  const handleDeletePersonalTrack = useCallback(
    async (trackId: string) => {
      if (user) {
        try {
          await deletePersonalTrackCloud(user.uid, trackId);
        } catch {
          showToast('트랙을 삭제하지 못했습니다.');
          return;
        }
      } else {
        setLocalPersonalTracks((prev) => prev.filter((t) => t.id !== trackId));
      }
      await deleteLocalAudioBlob(ownerScope, trackId);
      await refreshAvailableLocalBlobs(ownerScope);
      showToast('내 사운드 트랙을 삭제했습니다.');
    },
    [user, ownerScope, refreshAvailableLocalBlobs, showToast],
  );

  const handleToggleShuffle = useCallback(() => {
    if (playbackSource !== 'playlist') {
      showToast('랜덤 셔플은 플레이리스트 재생 중에만 사용할 수 있습니다.');
      return;
    }
    setIsShuffle((prev) => {
      const next = !prev;
      if (next && baseQueue.length > 0) {
        setShuffledQueue(
          shuffleTracksFisherYates(baseQueue, activeEntryKey || currentTrack?.id),
        );
      } else {
        setShuffledQueue([]);
      }
      showToast(
        next
          ? '플레이리스트 순서를 유지한 채 랜덤 셔플을 켰습니다.'
          : '플레이리스트 원래 순서로 순차 재생합니다.',
      );
      return next;
    });
  }, [playbackSource, baseQueue, activeEntryKey, currentTrack?.id, showToast]);

  const handleCycleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const next: RepeatMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      if (user) {
        saveUserPreferences(user.uid, {repeatMode: next}).catch(console.error);
      }
      const msg =
        next === 'one'
          ? '현재 음악 한 곡 반복 재생이 켜졌습니다.'
          : next === 'all'
            ? '플레이리스트 전체 반복 재생이 켜졌습니다.'
            : '반복 재생을 껐습니다.';
      showToast(msg);
      return next;
    });
  }, [user, showToast]);

  const handleToggleKeepAlive = useCallback(() => {
    setBackgroundKeepAlive((prev) => {
      const next = !prev;
      if (user) {
        saveUserPreferences(user.uid, {backgroundKeepAlive: next}).catch(console.error);
      }
      showToast(
        next
          ? '백그라운드 오디오 세션 유지가 활성화되었습니다.'
          : '백그라운드 오디오 세션 유지를 껐습니다.',
      );
      return next;
    });
  }, [user, showToast]);

  // A-B Segment Loop handlers
  const handleSetAbStart = useCallback(() => {
    const startVal = Math.floor(currentTime);
    setAbStart(startVal);
    if (abEnd <= startVal) {
      const maxDur = duration || currentTrack?.durationSeconds || startVal + 30;
      setAbEnd(Math.min(maxDur, startVal + 20));
    }
    showToast(`구간 시작(A)을 ${formatTime(startVal)}로 지정했습니다.`);
  }, [currentTime, abEnd, duration, currentTrack?.durationSeconds, showToast]);

  const handleSetAbEnd = useCallback(() => {
    const endVal = Math.max(abStart + 1, Math.floor(currentTime));
    setAbEnd(endVal);
    setAbLoopEnabled(true);
    engineRef.current?.seekTo(abStart);
    showToast(`구간 끝(B) ${formatTime(endVal)} 지정 · A-B 구간 반복을 시작합니다.`);
  }, [abStart, currentTime, showToast]);

  const handleToggleAbLoop = useCallback(() => {
    if (abEnd <= abStart) {
      showToast('먼저 A 시작과 B 끝 위치를 지정해 주세요.');
      return;
    }
    setAbLoopEnabled((prev) => {
      const next = !prev;
      if (next) {
        engineRef.current?.seekTo(abStart);
      }
      showToast(next ? '한 곡 내 구간 반복이 켜졌습니다.' : '구간 반복을 껐습니다.');
      return next;
    });
  }, [abStart, abEnd, showToast]);

  const handleResetAbLoop = useCallback(() => {
    setAbLoopEnabled(false);
    setAbStart(0);
    setAbEnd(0);
    showToast('구간 반복 설정을 초기화했습니다.');
  }, [showToast]);

  const handleVolumeChange = useCallback(
    (nextVol: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(nextVol)));
      setVolume(clamped);
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
      }
      engineRef.current?.setVolume(clamped);
    },
    [isMuted],
  );

  const handleToggleMute = useCallback(() => {
    setIsMuted((prevMuted) => {
      const nextMuted = !prevMuted;
      if (nextMuted) {
        engineRef.current?.setVolume(0);
      } else {
        const targetVol = volume > 0 ? volume : 50;
        if (volume === 0) setVolume(50);
        engineRef.current?.setVolume(targetVol);
      }
      return nextMuted;
    });
  }, [volume]);

  useEffect(() => {
    if (!isHeaderVolumeOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (headerVolumeRef.current && !headerVolumeRef.current.contains(e.target as Node)) {
        setIsHeaderVolumeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isHeaderVolumeOpen]);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) || null,
    [playlists, activePlaylistId],
  );

  const displayedExploreTracks = searchResults !== null ? searchResults : curatedTracks;
  const activeMoodMeta = MOOD_TABS.find((m) => m.id === selectedMood) || MOOD_TABS[0];

  const handleCycleVideoMode = () => {
    setVideoMode((prev) => (prev === 'audio' ? 'mini' : prev === 'mini' ? 'theater' : 'audio'));
  };

  const repeatLabel =
    repeatMode === 'one'
      ? '한 곡 반복'
      : repeatMode === 'all'
        ? '전체 반복'
        : '반복 끔';

  const upcomingPrefetchIds = useMemo(() => {
    if (!currentTrack || activeQueue.length <= 1) return [];
    const curKey = activeEntryKey || getTrackKey(currentTrack);
    const idx = activeQueue.findIndex((t) => getTrackKey(t) === curKey);
    if (idx === -1) return activeQueue.slice(0, 2).map((t) => t.id);
    const nextTracks = [
      activeQueue[idx + 1],
      activeQueue[idx + 2],
      ...(repeatMode === 'all' && idx === activeQueue.length - 1 ? [activeQueue[0]] : []),
    ].filter((t): t is Track => Boolean(t));
    return nextTracks.map((t) => t.id);
  }, [currentTrack, activeQueue, activeEntryKey, repeatMode]);

  return (
    <div className="relative h-[100dvh] w-full flex overflow-hidden bg-[#050914] text-[#EEF4FF]">
      {/* Subtle starry night sky backdrop behind the entire app */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img
          src={STARRY_BACKDROP_IMG}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover opacity-[0.26] scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050914]/75 via-[#050914]/55 to-[#040812]/90" />
      </div>

      <OfflineIndicator />

      <Sidebar
        activeSection={activeSection}
        activePlaylistId={activePlaylistId}
        playlists={playlists}
        likedCount={likedTracks.length}
        personalCount={personalTracks.length}
        user={user}
        authLoading={authLoading}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
        onSelectSection={(sec, plId) => {
          setActiveSection(sec);
          setActivePlaylistId(plId || null);
          setIsRenamingPlaylist(false);
        }}
        onCreatePlaylist={handleCreatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onOpenBackgroundGuide={() => setIsGuideOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10">
        {/* Clean 3-zone Top Header with Autocomplete Search & History */}
        <header className="shrink-0 relative z-30 border-b border-sky-200/[0.08] bg-[#050914]/75 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 lg:hidden shrink-0">
            <span className="text-lg font-bold tracking-tight text-[#EEF4FF] whitespace-nowrap">
              Resr mp
            </span>
          </div>

          <SearchBarWithHistory
            query={searchQuery}
            searchMode={searchMode}
            history={searchHistory}
            personalizedKeywords={personalizedKeywords}
            onQueryChange={setSearchQuery}
            onModeChange={(mode) => {
              setSearchMode(mode);
              if (submittedQuery && !isYouTubeUrlOrId(submittedQuery)) {
                executeSearch(submittedQuery, mode);
              }
            }}
            onExecuteSearch={(q, modeOverride) => executeSearch(q, modeOverride)}
            onClearSearch={handleClearSearch}
            onDeleteHistoryItem={handleDeleteHistoryItem}
            onClearHistory={handleClearHistory}
          />

          <div className="flex items-center gap-2 shrink-0">
            {activeQueue.length > 0 && (
              <button
                type="button"
                onClick={() => setIsQueueOpen(true)}
                aria-label="재생 대기열 열기"
                className="lg:hidden min-h-[38px] px-2.5 flex items-center gap-1 rounded-lg bg-[#0B1324]/85 border border-sky-200/12 text-xs font-mono tabular-nums text-[#EEF4FF] cursor-pointer"
              >
                <ListMusic className="w-4 h-4 text-[#60A5FA]" />
                <span>{activeQueue.length}</span>
              </button>
            )}
            <div className="lg:hidden">
              <GoogleAccountButton
                user={user}
                authLoading={authLoading}
                onSignIn={handleGoogleSignIn}
                onSignOut={handleGoogleSignOut}
                compact
              />
            </div>
            <div className="hidden sm:block lg:hidden">
              <PWAInstallButton compact />
            </div>

            {/* App-level Volume Control Popover in Header */}
            <div ref={headerVolumeRef} className="relative">
              <button
                type="button"
                onClick={() => setIsHeaderVolumeOpen((prev) => !prev)}
                aria-label="앱 자체 음량 조절"
                title="앱 자체 음량 조절"
                className={`min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 flex items-center gap-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isHeaderVolumeOpen
                    ? 'border-[#3B82F6]/60 bg-[#2563EB]/20 text-white'
                    : 'border-sky-200/12 bg-[#0B1324]/85 hover:bg-[#13203B] text-[#EEF4FF]'
                }`}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#60A5FA] shrink-0" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#60A5FA] shrink-0" />
                )}
                <span className="font-mono tabular-nums">
                  {isMuted ? '0%' : `${volume}%`}
                </span>
              </button>

              {isHeaderVolumeOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#0B1324]/95 backdrop-blur-md border border-sky-200/15 shadow-2xl p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#EEF4FF]">앱 자체 음량</span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-[#60A5FA]">
                      {isMuted ? '음소거 (0%)' : `${volume}%`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      aria-label={isMuted ? '음소거 해제' : '음소거'}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-[#050914] border border-sky-200/12 text-[#EEF4FF] hover:border-sky-200/30 cursor-pointer"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4 text-[#60A5FA]" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      aria-label="앱 자체 음량 슬라이더"
                      className="velo-range flex-1 h-5"
                      style={{
                        backgroundImage: `linear-gradient(to right, #3B82F6 ${isMuted ? 0 : volume}%, rgba(186,230,253,0.16) ${isMuted ? 0 : volume}%)`,
                        backgroundSize: '100% 4px',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 30, 60, 100].map((preset) => {
                      const active =
                        preset === 0 ? isMuted || volume === 0 : !isMuted && volume === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (preset === 0) {
                              setIsMuted(true);
                              engineRef.current?.setVolume(0);
                            } else {
                              handleVolumeChange(preset);
                            }
                          }}
                          className={`py-1.5 rounded-lg text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#2563EB] text-white font-semibold'
                              : 'bg-[#050914] border border-sky-200/[0.08] text-[#CBD5E1] hover:border-sky-200/25'
                          }`}
                        >
                          {preset === 0 ? '음소거' : `${preset}%`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              aria-label="음량 및 백그라운드 설정"
              title="음량 및 백그라운드 설정"
              className="flex min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3.5 items-center gap-2 rounded-lg border border-sky-200/12 bg-[#0B1324]/85 hover:bg-[#13203B] text-xs font-medium text-[#EEF4FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Headphones className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span className="hidden sm:inline">백그라운드 설정</span>
            </button>
          </div>
        </header>

        {/* Scrollable Main Content — expands downward whenever PlayerBar is hidden */}
        <main
          ref={mainScrollRef}
          className={`flex-1 overflow-y-auto px-4 sm:px-8 pt-6 ${
            currentTrack ? 'pb-48 lg:pb-36' : 'pb-20 lg:pb-10'
          }`}
        >
          <div className="max-w-6xl mx-auto space-y-8">
            {activeSection === 'explore' && (
              <>
                {searchResults === null && channelResults === null && !activeChannelView && (
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    <div className="lg:col-span-8 relative rounded-2xl overflow-hidden border border-sky-200/12 bg-[#0B1324] min-h-[240px] flex flex-col justify-end p-6 sm:p-8 shadow-2xl">
                      <img
                        src={HERO_STUDIO_IMG}
                        alt="밤하늘의 별빛 배경"
                        className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050914] via-[#050914]/65 to-[#050914]/20" />
                      <div className="relative z-10 max-w-xl">
                        <p className="text-xs font-medium text-[#93C5FD]">
                          나만의 플레이리스트
                        </p>
                        <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-[#EEF4FF] [text-wrap:balance]">
                          플레이리스트를 제작하고 백그라운드 재생
                        </h1>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={curatedTracks.length === 0}
                            onClick={() =>
                              curatedTracks[0] &&
                              playListSequentially(curatedTracks[0], curatedTracks)
                            }
                            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-sm font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer shadow-lg shadow-[#2563EB]/25"
                          >
                            <Play className="w-4 h-4 fill-white" />
                            <span>추천 믹스 전체 재생</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSection('playlists')}
                            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B1324]/70 hover:bg-[#13203B]/90 border border-sky-200/15 text-sm font-medium text-[#EEF4FF] backdrop-blur-sm flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <ListMusic className="w-4 h-4 text-[#60A5FA]" />
                            <span>내 플레이리스트 ({playlists.length})</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedMood('lofi')}
                        className="group relative rounded-2xl overflow-hidden border border-sky-200/10 bg-[#0B1324]/80 backdrop-blur-sm p-4 flex items-center gap-4 text-left hover:border-sky-300/30 hover:bg-[#13203B]/70 transition-colors cursor-pointer"
                      >
                        <img
                          src={COVER_LOFI_IMG}
                          alt="Lo-Fi 집중 세션 커버"
                          className="w-16 h-16 rounded-xl object-cover shrink-0 border border-sky-200/15"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#EEF4FF] truncate">딥 포커스 Lo-Fi</p>
                          <p className="mt-0.5 text-xs text-[#8CA1C4] truncate">
                            작업·공부용 인스트루멘탈
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedMood('jazz')}
                        className="group relative rounded-2xl overflow-hidden border border-sky-200/10 bg-[#0B1324]/80 backdrop-blur-sm p-4 flex items-center gap-4 text-left hover:border-sky-300/30 hover:bg-[#13203B]/70 transition-colors cursor-pointer"
                      >
                        <img
                          src={COVER_AMBIENT_IMG}
                          alt="심야 재즈 커버"
                          className="w-16 h-16 rounded-xl object-cover shrink-0 border border-sky-200/15"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#EEF4FF] truncate">심야 재즈 아카이브</p>
                          <p className="mt-0.5 text-xs text-[#8CA1C4] truncate">
                            어쿠스틱 피아노 · 무드
                          </p>
                        </div>
                      </button>
                    </div>
                  </section>
                )}

                {activeChannelView ? (
                  <ChannelDetailView
                    channel={activeChannelView}
                    activeEntryKey={activeEntryKey}
                    currentTrackId={currentTrack?.id || null}
                    isPlaying={isPlaying}
                    likedIds={likedIds}
                    playlists={playlists}
                    onBack={() => setActiveChannelView(null)}
                    onPlayTrack={(tr) => playSingleTrack(tr)}
                    onPlaySequential={(tr, list) => playListSequentially(tr, list)}
                    onTogglePlay={handleTogglePlay}
                    onToggleLike={handleToggleLike}
                    onAddToQueue={handleAddToQueue}
                    onAddManyToQueue={handleAddManyToQueue}
                    onAddToPlaylist={(plId, tr) => {
                      handleAddTracksToPlaylist(plId, [tr]);
                      showToast('플레이리스트에 추가했습니다.');
                    }}
                    onSaveCollectionAsPlaylist={handleSaveCollectionAsPlaylist}
                    onOpenTrimModal={(tr) => setTrimModalState({track: tr})}
                  />
                ) : channelResults !== null ? (
                  <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-[#EEF4FF]">
                          &ldquo;{submittedQuery}&rdquo; 채널 검색 결과
                        </h2>
                        <p className="text-xs text-[#8CA1C4] mt-0.5 font-mono tabular-nums">
                          {channelResults.length}개 채널
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="px-3 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-xs font-medium text-[#CBD5E1] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        추천 목록으로
                      </button>
                    </div>

                    {isLoadingTracks ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Array.from({length: 4}).map((_, i) => (
                          <div key={i} className="h-20 rounded-2xl bg-[#0B1324]/80" />
                        ))}
                      </div>
                    ) : (
                      <ChannelResultsGrid
                        channels={channelResults}
                        onSelectChannel={handleOpenChannel}
                      />
                    )}
                  </section>
                ) : (
                  <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {searchResults !== null ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <div>
                            <h2 className="text-xl font-semibold text-[#EEF4FF]">
                              &ldquo;{submittedQuery}&rdquo; 검색 결과
                            </h2>
                            <p className="text-xs text-[#8CA1C4] mt-0.5 font-mono tabular-nums">
                              표시 {searchResults.length}곡 (고유 {searchUniquePool.length}곡) ·{' '}
                              {searchSort === 'relevance'
                                ? '음악 알고리즘 추천순'
                                : searchSort === 'popular'
                                  ? '조회수 인기순'
                                  : '최신 업로드순'}
                              {searchRepeatingMode ? ' · 랜덤 순환 이어보기' : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearSearch}
                            className="px-3 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-xs font-medium text-[#CBD5E1] transition-colors whitespace-nowrap cursor-pointer"
                          >
                            추천 목록으로
                          </button>
                        </div>
                      ) : (
                        <div>
                          <h2 className="text-xl font-semibold text-[#EEF4FF] flex items-center gap-2">
                            <span>
                              {selectedMood === 'recommended' && user && isPersonalizedMix
                                ? `${user.displayName ? `${user.displayName}님의 ` : ''}맞춤 추천 믹스`
                                : activeMoodMeta.label}
                            </span>
                            {selectedMood === 'recommended' && user && isPersonalizedMix && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2563EB]/20 text-[11px] font-medium text-[#60A5FA]">
                                <Sparkles className="w-3 h-3" />
                                취향 분석
                              </span>
                            )}
                          </h2>
                          <p className="text-xs text-[#8CA1C4] mt-0.5">
                            {selectedMood === 'recommended' && user && tasteProfile?.hasSignals
                              ? '이 앱에서의 재생·좋아요·플레이리스트·검색 기록을 분석해 선곡했습니다'
                              : activeMoodMeta.subtitle}
                          </p>
                        </div>
                      )}

                      {searchResults !== null ? (
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B1324]/80 backdrop-blur-sm border border-sky-200/[0.08] overflow-x-auto">
                          {(
                            [
                              {id: 'relevance', label: '알고리즘 추천순'},
                              {id: 'popular', label: '인기순'},
                              {id: 'recent', label: '최신순'},
                            ] as Array<{id: SearchSort; label: string}>
                          ).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                setSearchSort(tab.id);
                                executeSearch(submittedQuery, searchMode, tab.id);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                searchSort === tab.id
                                  ? 'bg-[#2563EB] text-white'
                                  : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B1324]/80 backdrop-blur-sm border border-sky-200/[0.08] overflow-x-auto">
                          {MOOD_TABS.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setSelectedMood(tab.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                selectedMood === tab.id
                                  ? 'bg-[#2563EB] text-white'
                                  : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {searchResults === null && selectedMood === 'recommended' && (
                      user ? (
                        <div className="rounded-2xl border border-sky-200/10 bg-[#0B1324]/80 backdrop-blur-sm px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#EEF4FF]">
                              <Sparkles className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
                              <span>Google 연동 계정 맞춤 취향 분석</span>
                              {tasteProfile?.hasSignals && (
                                <span className="text-[11px] font-mono tabular-nums text-[#8CA1C4]">
                                  (재생 {tasteProfile.playCountTotal}회 · 좋아요 {tasteProfile.likedCount}곡 · 플레이리스트 {tasteProfile.playlistTracksCount}곡 · 검색 {tasteProfile.searchCount}건)
                                </span>
                              )}
                            </div>
                            {tasteProfile?.hasSignals ? (
                              <p className="text-xs text-[#8CA1C4] leading-relaxed">
                                {tasteProfile.topChannels.length > 0 && (
                                  <span>
                                    선호 아티스트/채널:{' '}
                                    <strong className="text-[#EEF4FF] font-medium">
                                      {tasteProfile.topChannels.slice(0, 3).join(', ')}
                                    </strong>
                                  </span>
                                )}
                                {tasteProfile.topChannels.length > 0 &&
                                  (tasteProfile.topMoodLabels.length > 0 || tasteProfile.topKeywords.length > 0) && (
                                    <span className="mx-1.5">·</span>
                                  )}
                                {tasteProfile.topMoodLabels.length > 0 ? (
                                  <span>
                                    주요 무드:{' '}
                                    <strong className="text-[#EEF4FF] font-medium">
                                      {tasteProfile.topMoodLabels.slice(0, 2).join(', ')}
                                    </strong>
                                  </span>
                                ) : (
                                  tasteProfile.topKeywords.length > 0 && (
                                    <span>
                                      관심 키워드:{' '}
                                      <strong className="text-[#EEF4FF] font-medium">
                                        {tasteProfile.topKeywords.slice(0, 3).join(', ')}
                                      </strong>
                                    </span>
                                  )
                                )}
                              </p>
                            ) : (
                              <p className="text-xs text-[#8CA1C4]">
                                아직 이 앱에 쌓인 재생·보관함·검색 데이터가 없어 기본 추천 믹스를 표시하고 있습니다. 곡을 재생하거나 저장하면 취향에 맞춰 자동 선곡됩니다.
                              </p>
                            )}
                          </div>
                          {tasteProfile?.hasSignals && (
                            <button
                              type="button"
                              onClick={() => {
                                setPersonalizedRefreshSeed((n) => n + 1);
                                showToast('최근 취향 데이터를 반영해 추천 믹스를 새로 고쳤습니다.');
                              }}
                              className="shrink-0 self-start sm:self-center min-h-[36px] px-3 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-xs font-medium text-[#EEF4FF] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>취향 재분석</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-sky-200/10 bg-[#0B1324]/80 backdrop-blur-sm px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#EEF4FF]">
                              Google 계정 연동 시 내 취향 기반 추천 믹스 제공
                            </p>
                            <p className="mt-0.5 text-xs text-[#8CA1C4]">
                              현재는 일반 추천 믹스가 표시됩니다. Google 연동을 하면 이 앱에서의 재생·보관함·검색 취향을 분석해 맞춤 추천해 드립니다.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            className="shrink-0 self-start sm:self-center min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Google 계정 연동
                          </button>
                        </div>
                      )
                    )}

                    {fetchError && (
                      <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-[#FCA5A5]">
                        {fetchError}
                      </div>
                    )}

                    {isLoadingTracks ? (
                      <div className="divide-y divide-sky-200/[0.08] border-t border-b border-sky-200/[0.08] rounded-xl bg-[#0B1324]/45">
                        {Array.from({length: 6}).map((_, i) => (
                          <div key={i} className="flex items-center gap-4 px-3 py-3">
                            <div className="w-12 h-12 rounded-lg bg-[#13203B]" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3.5 w-2/3 rounded bg-[#13203B]" />
                              <div className="h-3 w-1/3 rounded bg-[#0B1324]" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <TrackList
                          tracks={displayedExploreTracks}
                          activeEntryKey={activeEntryKey}
                          currentTrackId={currentTrack?.id || null}
                          isPlaying={isPlaying}
                          likedIds={likedIds}
                          playlists={playlists}
                          onPlayTrack={(tr) => playSingleTrack(tr)}
                          onTogglePlay={handleTogglePlay}
                          onToggleLike={handleToggleLike}
                          onAddToQueue={handleAddToQueue}
                          onAddToPlaylist={(plId, tr) => {
                            handleAddTracksToPlaylist(plId, [tr]);
                            showToast('플레이리스트에 추가했습니다.');
                          }}
                          onOpenTrimModal={(tr) => setTrimModalState({track: tr})}
                        />

                        {searchResults !== null &&
                          searchResults.length > 0 &&
                          !isYouTubeUrlOrId(submittedQuery) && (
                            <div
                              ref={searchSentinelRef}
                              className="pt-4 pb-2 flex flex-col items-center gap-2"
                            >
                              <button
                                type="button"
                                disabled={isLoadingMoreSearch}
                                onClick={handleLoadMoreSearch}
                                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0B1324]/85 hover:bg-[#13203B] border border-sky-200/15 text-xs font-medium text-[#EEF4FF] transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {isLoadingMoreSearch
                                  ? '검색 결과 불러오는 중...'
                                  : searchRepeatingMode
                                    ? '랜덤 추천 결과 계속 보기'
                                    : '검색 결과 더 보기'}
                              </button>
                            </div>
                          )}
                      </>
                    )}
                  </section>
                )}
              </>
            )}

            {activeSection === 'charts' && (
              <UnifiedChartsSection
                data={chartsData}
                isLoading={isLoadingCharts}
                error={chartsError}
                activeEntryKey={activeEntryKey}
                currentTrackId={currentTrack?.id || null}
                isPlaying={isPlaying}
                likedIds={likedIds}
                playlists={playlists}
                onRefresh={() => loadUnifiedCharts(true)}
                onPlayTrack={(tr, list) => playListSequentially(tr, list)}
                onPlayAll={(tracks) => tracks[0] && playListSequentially(tracks[0], tracks)}
                onTogglePlay={handleTogglePlay}
                onToggleLike={handleToggleLike}
                onAddToQueue={handleAddToQueue}
                onAddToPlaylist={(plId, tr) => {
                  handleAddTracksToPlaylist(plId, [tr]);
                  showToast('플레이리스트에 추가했습니다.');
                }}
                onOpenTrimModal={(tr) => setTrimModalState({track: tr})}
                onSearchFallback={(q) => executeSearch(q)}
              />
            )}

            {activeSection === 'myfiles' && (
              <MyFilesSection
                tracks={personalTracks}
                availableBlobIds={availableLocalBlobIds}
                playlists={playlists}
                likedIds={likedIds}
                activeEntryKey={activeEntryKey}
                currentTrackId={currentTrack?.id || null}
                isPlaying={isPlaying}
                isUploading={isUploadingPersonalFiles}
                isSignedIn={Boolean(user)}
                autoTrimOnImport={autoTrimOnImport}
                onToggleAutoTrimOnImport={setAutoTrimOnImport}
                onUploadFiles={(files) => handleUploadPersonalFiles(files)}
                onRelinkFile={handleRelinkPersonalFile}
                onPlayTrack={(tr, list) => playListSequentially(tr, list)}
                onTogglePlay={handleTogglePlay}
                onToggleLike={handleToggleLike}
                onAddToQueue={handleAddToQueue}
                onAddToPlaylist={(plId, tr) => {
                  handleAddTracksToPlaylist(plId, [tr]);
                  showToast('플레이리스트에 내 사운드 트랙을 추가했습니다.');
                }}
                onOpenTrimModal={(tr) => setTrimModalState({track: tr})}
                onUpdateTrackMeta={handleUpdatePersonalTrackMeta}
                onDeleteTrack={handleDeletePersonalTrack}
              />
            )}

            {activeSection === 'playlists' && (
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[#EEF4FF]">내 플레이리스트 목록</h1>
                    <p className="mt-1 text-sm text-[#8CA1C4] font-mono tabular-nums">
                      총 {playlists.length}개 플레이리스트 · 셔플은 플레이리스트 내에서만 동작하며 설정한 순서는 그대로 유지됩니다
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMobilePlaylistCreator((v) => !v)}
                    className="min-h-[42px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-sm font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>새 플레이리스트 만들기</span>
                  </button>
                </div>

                {showMobilePlaylistCreator && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newPlaylistName.trim()) return;
                      handleCreatePlaylist(newPlaylistName.trim());
                      setNewPlaylistName('');
                      setShowMobilePlaylistCreator(false);
                    }}
                    className="flex gap-2 max-w-md"
                  >
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="플레이리스트 이름 입력"
                      autoFocus
                      className="flex-1 rounded-xl bg-[#0B1324] border border-sky-200/12 px-3.5 py-2.5 text-sm text-[#EEF4FF] placeholder-[#5B7196] focus:outline-none focus:border-[#3B82F6]"
                    />
                    <button
                      type="submit"
                      className="px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-medium text-white whitespace-nowrap cursor-pointer"
                    >
                      만들기
                    </button>
                  </form>
                )}

                {playlists.length === 0 ? (
                  <div className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 backdrop-blur-sm px-6 py-14 text-center space-y-3">
                    <p className="text-base font-medium text-[#EEF4FF]">
                      아직 만든 플레이리스트가 없습니다
                    </p>
                    <p className="text-sm text-[#8CA1C4]">
                      새 플레이리스트를 만들고 원하는 곡이나 구간 클립을 자유롭게 담아보세요.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {playlists.map((pl) => {
                      const coverThumb = pl.tracks[0]?.thumbnail;
                      return (
                        <div
                          key={pl.id}
                          className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 backdrop-blur-sm hover:border-sky-200/25 p-4 flex flex-col justify-between gap-4 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActivePlaylistId(pl.id);
                              setActiveSection('playlist');
                            }}
                            className="flex items-center gap-3.5 text-left min-w-0 cursor-pointer"
                          >
                            {coverThumb ? (
                              <img
                                src={coverThumb}
                                alt={pl.name}
                                referrerPolicy="no-referrer"
                                className="w-16 h-16 rounded-xl object-cover bg-[#13203B] shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-[#13203B] border border-sky-200/[0.08] flex items-center justify-center shrink-0">
                                <ListMusic className="w-6 h-6 text-[#8CA1C4]" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <h2 className="text-base font-semibold text-[#EEF4FF] truncate">
                                {pl.name}
                              </h2>
                              <p className="mt-0.5 text-xs font-mono tabular-nums text-[#8CA1C4]">
                                수록곡 {pl.tracks.length}개
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-sky-200/[0.08]">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={pl.tracks.length === 0}
                                onClick={() =>
                                  pl.tracks[0] && playFromPlaylist(pl.tracks[0], pl.tracks)
                                }
                                className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>재생</span>
                              </button>
                              <button
                                type="button"
                                disabled={pl.tracks.length === 0}
                                onClick={() => playPlaylistShuffled(pl.tracks)}
                                className="px-3 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] disabled:opacity-40 text-xs font-medium text-[#EEF4FF] flex items-center gap-1.5 cursor-pointer"
                              >
                                <Shuffle className="w-3.5 h-3.5" />
                                <span>셔플</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeletePlaylist(pl.id)}
                              aria-label={`${pl.name} 삭제`}
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#60A5FA] hover:bg-[#13203B] cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeSection === 'library' && (
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[#EEF4FF]">좋아요 보관함</h1>
                    <p className="mt-1 text-sm text-[#8CA1C4] font-mono tabular-nums">
                      저장된 항목 {likedTracks.length}개
                      {user ? ' · Google 계정 동기화 중' : ' · 로컬 저장'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {likedTracks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => playListSequentially(likedTracks[0], likedTracks)}
                        className="min-h-[42px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-sm font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>전체 재생</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveSection('playlists')}
                      className="min-h-[42px] px-4 rounded-xl bg-[#0B1324]/85 border border-sky-200/12 hover:bg-[#13203B] text-sm font-medium text-[#EEF4FF] flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <ListMusic className="w-4 h-4" />
                      <span>플레이리스트 목록</span>
                    </button>
                  </div>
                </div>

                <TrackList
                  tracks={likedTracks}
                  activeEntryKey={activeEntryKey}
                  currentTrackId={currentTrack?.id || null}
                  isPlaying={isPlaying}
                  likedIds={likedIds}
                  playlists={playlists}
                  removableFromLiked
                  emptyTitle="아직 보관함에 저장된 곡이 없습니다"
                  emptyDescription="트랙의 하트 또는 가위(구간 자르기) 버튼을 눌러 저장해 보세요."
                  onPlayTrack={(tr) => playSingleTrack(tr)}
                  onTogglePlay={handleTogglePlay}
                  onToggleLike={handleToggleLike}
                  onAddToQueue={handleAddToQueue}
                  onAddToPlaylist={(plId, tr) => {
                    handleAddTracksToPlaylist(plId, [tr]);
                    showToast('플레이리스트에 추가했습니다.');
                  }}
                  onOpenTrimModal={(tr) => setTrimModalState({track: tr})}
                  onRemoveFromLiked={handleRemoveFromLikedEntry}
                />
              </section>
            )}

            {activeSection === 'playlist' && activePlaylist && (
              <section className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveSection('playlists')}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#0B1324]/85 border border-sky-200/12 hover:bg-[#13203B] text-xs font-medium text-[#EEF4FF] flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>플레이리스트 목록으로</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#8CA1C4]">
                      커스텀 플레이리스트 {user ? '· Google 클라우드 동기화' : ''}
                    </p>
                    {isRenamingPlaylist ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRenamePlaylist(activePlaylist.id, renameDraft);
                        }}
                        className="mt-1.5 flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          autoFocus
                          className="rounded-lg bg-[#0B1324] border border-sky-200/15 px-3 py-1.5 text-lg font-bold text-[#EEF4FF] focus:outline-none focus:border-[#3B82F6]"
                        />
                        <button
                          type="submit"
                          aria-label="이름 저장"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[#2563EB] text-white cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsRenamingPlaylist(false)}
                          aria-label="취소"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[#13203B] text-[#EEF4FF] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="mt-1 flex items-center gap-2.5">
                        <h1 className="text-2xl font-bold text-[#EEF4FF] truncate">
                          {activePlaylist.name}
                        </h1>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameDraft(activePlaylist.name);
                            setIsRenamingPlaylist(true);
                          }}
                          aria-label="플레이리스트 이름 수정"
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B] cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-[#8CA1C4] font-mono tabular-nums">
                      총 {activePlaylist.tracks.length}개 항목 · 랜덤 셔플 시에도 저장된 순서는 변경되지 않습니다
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activePlaylist.tracks.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            playFromPlaylist(activePlaylist.tracks[0], activePlaylist.tracks)
                          }
                          className="min-h-[42px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-sm font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>순차 재생</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => playPlaylistShuffled(activePlaylist.tracks)}
                          className="min-h-[42px] px-4 rounded-xl bg-[#0B1324]/85 border border-sky-200/12 hover:bg-[#13203B] text-sm font-medium text-[#EEF4FF] flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Shuffle className="w-4 h-4" />
                          <span>랜덤 셔플</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleCycleRepeat}
                      className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                        repeatMode !== 'off'
                          ? 'bg-[#2563EB]/20 border-[#3B82F6]/45 text-[#60A5FA]'
                          : 'bg-[#0B1324]/85 border-sky-200/12 text-[#8CA1C4] hover:text-[#EEF4FF]'
                      }`}
                    >
                      {repeatMode === 'one' ? (
                        <Repeat1 className="w-4 h-4" />
                      ) : (
                        <Repeat className="w-4 h-4" />
                      )}
                      <span>{repeatLabel}</span>
                    </button>
                    {activePlaylist.tracks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setIsPlaylistReorderMode((prev) => !prev)}
                        className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                          isPlaylistReorderMode
                            ? 'bg-[#2563EB] border-[#2563EB] text-white'
                            : 'bg-[#0B1324]/85 border-sky-200/12 text-[#EEF4FF] hover:bg-[#13203B]'
                        }`}
                      >
                        {isPlaylistReorderMode ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4" />
                        )}
                        <span>{isPlaylistReorderMode ? '순서 편집 완료' : '순서 편집'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsPlaylistFilePickerOpen((prev) => !prev)}
                      className={`min-h-[42px] px-4 rounded-xl border text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                        isPlaylistFilePickerOpen
                          ? 'bg-[#2563EB]/20 border-[#3B82F6]/45 text-[#60A5FA]'
                          : 'bg-[#0B1324]/85 border-sky-200/12 hover:bg-[#13203B] text-[#EEF4FF]'
                      }`}
                    >
                      <FileAudio className="w-4 h-4" />
                      <span>내 파일 넣기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('explore')}
                      className="min-h-[42px] px-4 rounded-xl bg-[#0B1324]/85 border border-sky-200/12 hover:bg-[#13203B] text-sm font-medium text-[#EEF4FF] flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>곡 더 찾기</span>
                    </button>
                  </div>
                </div>

                {isPlaylistFilePickerOpen && (
                  <div className="rounded-2xl border border-[#3B82F6]/30 bg-[#0B1324]/85 backdrop-blur-sm p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#EEF4FF]">
                          내 오디오 파일을 이 플레이리스트에 바로 담기
                        </p>
                        <p className="text-xs text-[#8CA1C4]">
                          나만 들을 수 있는 비공개 사운드 트랙을 올리거나 기존 내 파일에서 골라 담을 수 있습니다.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={playlistDirectFileInputRef}
                          type="file"
                          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.opus,.mp4"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleUploadPersonalFiles(e.target.files, activePlaylist.id);
                              e.target.value = '';
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={isUploadingPersonalFiles}
                          onClick={() => playlistDirectFileInputRef.current?.click()}
                          className="min-h-[36px] px-3 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-xs font-medium text-white flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingPersonalFiles ? '저장 중...' : '새 파일 올려서 바로 추가'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPlaylistFilePickerOpen(false)}
                          aria-label="내 파일 패널 닫기"
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-[#13203B] text-[#8CA1C4] hover:text-[#EEF4FF] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {personalTracks.length === 0 ? (
                      <p className="text-xs text-[#8CA1C4] py-2">
                        아직 저장된 내 파일이 없습니다. 오른쪽 위 &ldquo;새 파일 올려서 바로 추가&rdquo; 버튼을 눌러 파일을 추가해 보세요.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {personalTracks.map((pt) => (
                          <div
                            key={pt.id}
                            className="flex items-center justify-between gap-2 rounded-xl bg-[#050914] border border-sky-200/[0.08] px-3 py-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileAudio className="w-4 h-4 text-[#60A5FA] shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[#EEF4FF] truncate">
                                  {pt.title}
                                </p>
                                <p className="text-[11px] font-mono tabular-nums text-[#8CA1C4]">
                                  {pt.duration}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setTrimModalState({
                                    track: pt,
                                    defaultPlaylistIds: [activePlaylist.id],
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-[11px] font-medium text-white flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <Scissors className="w-3 h-3" />
                                <span>잘라 담기</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddTracksToPlaylist(activePlaylist.id, [pt]);
                                  showToast(`"${pt.title}"을(를) 플레이리스트에 추가했습니다.`);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-[11px] font-medium text-[#EEF4FF] transition-colors whitespace-nowrap cursor-pointer"
                              >
                                + 전체
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isPlaylistReorderMode && activePlaylist.tracks.length > 1 && (
                  <div className="rounded-xl border border-[#3B82F6]/35 bg-[#2563EB]/15 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#EEF4FF]">
                    <span>
                      곡 왼쪽을 드래그하거나 오른쪽 위/아래 버튼으로 플레이리스트 재생 순서를 바꿀 수 있습니다.
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPlaylistReorderMode(false)}
                      className="px-2.5 py-1 rounded-lg bg-[#2563EB] text-white font-medium whitespace-nowrap cursor-pointer"
                    >
                      완료
                    </button>
                  </div>
                )}

                <TrackList
                  tracks={activePlaylist.tracks}
                  activeEntryKey={activeEntryKey}
                  currentTrackId={currentTrack?.id || null}
                  isPlaying={isPlaying}
                  likedIds={likedIds}
                  playlists={playlists}
                  removableFromPlaylist
                  reorderable
                  isReorderMode={isPlaylistReorderMode}
                  onReorderTrack={(fromIdx, toIdx) =>
                    handleReorderPlaylistTrack(activePlaylist.id, fromIdx, toIdx)
                  }
                  emptyTitle="플레이리스트가 비어 있습니다"
                  emptyDescription="검색 화면에서 가위(구간 자르기) 또는 + 버튼을 눌러 곡이나 특정 구간을 등록하세요."
                  onPlayTrack={(tr, list) => playFromPlaylist(tr, list)}
                  onTogglePlay={handleTogglePlay}
                  onToggleLike={handleToggleLike}
                  onAddToQueue={handleAddToQueue}
                  onAddToPlaylist={(plId, tr) => {
                    handleAddTracksToPlaylist(plId, [tr]);
                    showToast('플레이리스트에 추가했습니다.');
                  }}
                  onOpenTrimModal={(tr) => setTrimModalState({track: tr})}
                  onRemoveFromPlaylist={(entryId) =>
                    handleRemoveFromPlaylist(activePlaylist.id, entryId)
                  }
                />
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Persistent Player Engine (YouTube + Private Local Audio) */}
      <YouTubePlayerEngine
        ref={engineRef}
        videoId={currentTrack?.id || null}
        trackSource={currentTrack?.source}
        ownerScope={ownerScope}
        activeEntryKey={activeEntryKey}
        prefetchVideoIds={upcomingPrefetchIds}
        clipStart={currentTrack?.startSeconds}
        clipEnd={currentTrack?.endSeconds}
        abLoopEnabled={abLoopEnabled}
        abStart={abStart}
        abEnd={abEnd}
        videoMode={videoMode}
        volume={volume}
        isMuted={isMuted}
        backgroundKeepAlive={backgroundKeepAlive}
        userPausedRef={userPausedRef}
        onAudioModeChange={setAudioPipelineMode}
        onPlayingChange={setIsPlaying}
        onProgress={(cur, dur) => {
          setCurrentTime(cur);
          if (dur > 0) setDuration(dur);
        }}
        onEnded={handleNext}
        onError={handlePlayerError}
        onCloseTheater={() => setVideoMode('audio')}
      />

      {/* Persistent Player Bar (auto-hides when no track is playing) */}
      <PlayerBar
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        canShuffle={playbackSource === 'playlist'}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        abLoopEnabled={abLoopEnabled}
        abStart={abStart}
        abEnd={abEnd}
        videoMode={videoMode}
        backgroundKeepAlive={backgroundKeepAlive}
        isLiked={currentTrack ? likedIds.has(currentTrack.id) : false}
        queueCount={activeQueue.length}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onCycleRepeat={handleCycleRepeat}
        onSetAbStart={handleSetAbStart}
        onSetAbEnd={handleSetAbEnd}
        onToggleAbLoop={handleToggleAbLoop}
        onResetAbLoop={handleResetAbLoop}
        onSaveCurrentClip={() => {
          if (!currentTrack) return;
          setTrimModalState({
            track: {...currentTrack, durationSeconds: duration || currentTrack.durationSeconds},
            startSec: abStart,
            endSec: abEnd > abStart ? abEnd : undefined,
          });
        }}
        onCycleVideoMode={handleCycleVideoMode}
        onToggleBackgroundKeepAlive={handleToggleKeepAlive}
        onToggleLike={() => currentTrack && handleToggleLike(currentTrack)}
        onToggleQueue={() => setIsQueueOpen((o) => !o)}
        onOpenMobilePlayer={() => setIsMobilePlayerOpen(true)}
        onDismiss={handleDismissPlayer}
      />

      {/* Mobile Bottom Tab Navigation */}
      <nav
        aria-label="모바일 내비게이션"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-[#050914]/90 backdrop-blur-md border-t border-sky-200/10 grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => setActiveSection('explore')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            activeSection === 'explore' ? 'text-[#60A5FA]' : 'text-[#8CA1C4]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span>탐색</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('charts')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            activeSection === 'charts' ? 'text-[#60A5FA]' : 'text-[#8CA1C4]'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span>인기차트</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('playlists')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            activeSection === 'playlists' || activeSection === 'playlist'
              ? 'text-[#60A5FA]'
              : 'text-[#8CA1C4]'
          }`}
        >
          <ListMusic className="w-5 h-5" />
          <span>플레이리스트</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('myfiles')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            activeSection === 'myfiles' ? 'text-[#60A5FA]' : 'text-[#8CA1C4]'
          }`}
        >
          <FileAudio className="w-5 h-5" />
          <span>내 파일</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('library')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            activeSection === 'library' ? 'text-[#60A5FA]' : 'text-[#8CA1C4]'
          }`}
        >
          <Library className="w-5 h-5" />
          <span>보관함</span>
        </button>
      </nav>

      <MobileNowPlayingModal
        isOpen={isMobilePlayerOpen}
        track={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        canShuffle={playbackSource === 'playlist'}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        abLoopEnabled={abLoopEnabled}
        abStart={abStart}
        abEnd={abEnd}
        backgroundKeepAlive={backgroundKeepAlive}
        isLiked={currentTrack ? likedIds.has(currentTrack.id) : false}
        volume={volume}
        isMuted={isMuted}
        onClose={() => setIsMobilePlayerOpen(false)}
        onDismiss={handleDismissPlayer}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onCycleRepeat={handleCycleRepeat}
        onSetAbStart={handleSetAbStart}
        onSetAbEnd={handleSetAbEnd}
        onToggleAbLoop={handleToggleAbLoop}
        onSaveCurrentClip={() => {
          if (!currentTrack) return;
          setTrimModalState({
            track: {...currentTrack, durationSeconds: duration || currentTrack.durationSeconds},
            startSec: abStart,
            endSec: abEnd > abStart ? abEnd : undefined,
          });
        }}
        onToggleBackgroundKeepAlive={handleToggleKeepAlive}
        onToggleLike={() => currentTrack && handleToggleLike(currentTrack)}
        onOpenQueue={() => setIsQueueOpen(true)}
      />

      <TrimAndSaveModal
        isOpen={trimModalState.track !== null}
        track={trimModalState.track}
        playlists={playlists}
        activePlaybackTrackId={currentTrack?.id || null}
        activePlaybackTime={currentTime}
        initialStartSeconds={trimModalState.startSec}
        initialEndSeconds={trimModalState.endSec}
        isImportFlow={Boolean(trimModalState.isImportFlow)}
        importProgress={
          trimModalState.isImportFlow && trimModalState.importTotal
            ? {
                current:
                  trimModalState.importTotal - (trimModalState.importQueue?.length || 0),
                total: trimModalState.importTotal,
              }
            : null
        }
        defaultPlaylistIds={trimModalState.defaultPlaylistIds}
        onClose={closeOrAdvanceTrimModal}
        onPreviewRange={(tr, startSec) => {
          if (currentTrack?.id === tr.id) {
            userPausedRef.current = false;
            setIsUserPaused(false);
            handleSeek(startSec);
            unlockKeepAlive();
            engineRef.current?.play();
          } else {
            playSingleTrack({...tr, startSeconds: startSec});
          }
        }}
        onCreatePlaylist={handleCreatePlaylist}
        onConfirmSave={handleConfirmTrimAndSave}
      />

      <QueueDrawer
        isOpen={isQueueOpen}
        queue={activeQueue}
        activeEntryKey={activeEntryKey}
        currentTrackId={currentTrack?.id || null}
        onClose={() => setIsQueueOpen(false)}
        onPlayAt={(track) => beginPlaybackForTrack(track)}
        onReorderAt={handleReorderQueue}
        onRemoveAt={(idx) => {
          const target = activeQueue[idx];
          if (!target) return;
          const targetKey = getTrackKey(target);
          setBaseQueue((prev) => prev.filter((t) => getTrackKey(t) !== targetKey));
          setShuffledQueue((prev) => prev.filter((t) => getTrackKey(t) !== targetKey));
        }}
        onClearQueue={() => {
          setBaseQueue([]);
          setShuffledQueue([]);
        }}
      />

      <BackgroundGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        keepAliveEnabled={backgroundKeepAlive}
        onToggleKeepAlive={handleToggleKeepAlive}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
      />

      {toastMessage && (
        <div
          role="status"
          className="fixed top-20 right-4 sm:right-8 z-50 rounded-xl bg-[#0B1324]/95 backdrop-blur-md border border-sky-200/20 px-4 py-2.5 text-xs font-medium text-[#EEF4FF] shadow-2xl"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
