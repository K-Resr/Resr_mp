import type {
  PlayHistoryEntry,
  Playlist,
  SearchHistoryEntry,
  TasteProfileSummary,
  Track,
} from '../types/music';

interface MoodMatcher {
  label: string;
  querySeed: string;
  patterns: string[];
}

const MOOD_MATCHERS: MoodMatcher[] = [
  {
    label: 'Lo-Fi · 칠 비트',
    querySeed: 'lofi hip hop chill beats playlist',
    patterns: ['lofi', 'lo-fi', '로파이', 'chill', 'beats', 'study', '집중', '비트'],
  },
  {
    label: '발라드 · 감성',
    querySeed: '한국 감성 발라드 추천 플레이리스트',
    patterns: ['발라드', 'ballad', '이별', '감성', '새벽', '위로', '밤', '눈물'],
  },
  {
    label: 'K-Pop · R&B',
    querySeed: 'kpop r&b chill trending songs playlist',
    patterns: ['kpop', 'k-pop', '아이돌', 'r&b', '알앤비', 'soul', '소울', '뉴진스', 'newjeans', 'aespa', '아이유', 'iu'],
  },
  {
    label: '인디 · 어쿠스틱',
    querySeed: '한국 인디 어쿠스틱 음악 모음',
    patterns: ['인디', 'indie', '어쿠스틱', 'acoustic', '포크', 'folk', '기타', '잔잔'],
  },
  {
    label: '밴드 · 록',
    querySeed: '한국 밴드 록 명곡 플레이리스트',
    patterns: ['밴드', 'band', 'rock', '록', '페스티벌', '데이식스', 'day6', '실리카겔', 'qwer', '잔나비'],
  },
  {
    label: '재즈 · 피아노',
    querySeed: 'late night jazz piano instrumental music',
    patterns: ['재즈', 'jazz', '피아노', 'piano', '연주곡', 'instrumental', '카페', 'bossa'],
  },
  {
    label: '힙합 · 그루브',
    querySeed: '감성 힙합 알앤비 그루브 플레이리스트',
    patterns: ['힙합', 'hiphop', 'hip-hop', 'rap', '랩', '그루브', 'groove', '쇼미'],
  },
  {
    label: '시티팝 · J-Pop',
    querySeed: 'jpop city pop night drive playlist',
    patterns: ['jpop', 'j-pop', '시티팝', 'city pop', 'citypop', '일본', 'yoasobi', '요아소비', 'kenshi', '유우리'],
  },
  {
    label: 'OST · 드라마/애니',
    querySeed: '감성 드라마 영화 애니 ost 명곡 모음',
    patterns: ['ost', '사운드트랙', 'soundtrack', '드라마', '애니', '영화'],
  },
];

const STOPWORDS = new Set([
  'official',
  'video',
  'music',
  'audio',
  'lyrics',
  'lyric',
  'live',
  'ver',
  'version',
  'feat',
  'prod',
  'mv',
  'm/v',
  'hd',
  '4k',
  'playlist',
  '플레이리스트',
  '가사',
  '노래',
  '모음',
  '음악',
  '음원',
  '라이브',
  '공식',
  '뮤직비디오',
  '영상',
  '채널',
  'youtube',
  'topic',
  'officialaudio',
  'officialvideo',
  'the',
  'and',
  'with',
  'for',
  'from',
  'full',
  'mix',
]);

function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\[\]\(\)「」『』<>【】\/\\|·•"'`~!@#$%^&*_=+?:;,.]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function isUrlText(text: string): boolean {
  return /^https?:\/\//i.test(text) || /youtube\.com|youtu\.be/i.test(text);
}

export function analyzeUserTaste({
  likedTracks,
  playlists,
  searchHistory,
  playHistory,
}: {
  likedTracks: Track[];
  playlists: Playlist[];
  searchHistory: SearchHistoryEntry[];
  playHistory: PlayHistoryEntry[];
}): TasteProfileSummary {
  const channelScores = new Map<string, {display: string; score: number}>();
  const keywordScores = new Map<string, number>();
  const moodScores = new Map<string, {matcher: MoodMatcher; score: number}>();
  const knownTrackIdSet = new Set<string>();

  const addChannelScore = (channelName: string, weight: number) => {
    const clean = channelName.trim();
    if (!clean || clean.toLowerCase() === 'youtube') return;
    const key = clean.toLowerCase().replace(/\s*-\s*topic$/i, '').trim() || clean.toLowerCase();
    const existing = channelScores.get(key);
    if (existing) {
      existing.score += weight;
    } else {
      channelScores.set(key, {display: clean.replace(/\s*-\s*topic$/i, '').trim() || clean, score: weight});
    }
  };

  const inspectText = (text: string, weight: number) => {
    if (!text) return;
    const lower = text.toLowerCase();
    for (const matcher of MOOD_MATCHERS) {
      if (matcher.patterns.some((p) => lower.includes(p))) {
        const prev = moodScores.get(matcher.label);
        if (prev) {
          prev.score += weight;
        } else {
          moodScores.set(matcher.label, {matcher, score: weight});
        }
      }
    }
    for (const tok of extractTokens(text)) {
      keywordScores.set(tok, (keywordScores.get(tok) || 0) + weight);
    }
  };

  let playCountTotal = 0;
  for (let i = 0; i < playHistory.length; i++) {
    const item = playHistory[i];
    knownTrackIdSet.add(item.id);
    playCountTotal += item.playCount;
    const recencyFactor = Math.max(0.7, 1.5 - i * 0.04);
    const weight = Math.min(12, item.playCount * 2.4) * recencyFactor;
    addChannelScore(item.channel, weight);
    inspectText(`${item.title} ${item.channel}`, weight);
  }

  for (const track of likedTracks) {
    if (track.source === 'local' || track.id.startsWith('local_')) continue;
    knownTrackIdSet.add(track.id);
    addChannelScore(track.channel, 4.5);
    inspectText(`${track.title} ${track.channel}`, 3.5);
  }

  let playlistTracksCount = 0;
  for (const pl of playlists) {
    for (const track of pl.tracks) {
      if (track.source === 'local' || track.id.startsWith('local_')) continue;
      playlistTracksCount++;
      knownTrackIdSet.add(track.id);
      addChannelScore(track.channel, 3.2);
      inspectText(`${track.title} ${track.channel}`, 2.5);
    }
  }

  let meaningfulSearchCount = 0;
  for (let i = 0; i < searchHistory.length; i++) {
    const entry = searchHistory[i];
    if (entry.searchType === 'url' || isUrlText(entry.query)) continue;
    meaningfulSearchCount++;
    const recencyWeight = Math.max(1.2, 4.0 - i * 0.25);
    if (entry.searchType === 'channel') {
      addChannelScore(entry.query, recencyWeight * 1.4);
    }
    inspectText(entry.query, recencyWeight);
  }

  const totalSignalsCount =
    playCountTotal + likedTracks.length + playlistTracksCount + meaningfulSearchCount;

  if (totalSignalsCount === 0) {
    return {
      hasSignals: false,
      totalSignalsCount: 0,
      playCountTotal: 0,
      likedCount: likedTracks.length,
      playlistTracksCount,
      searchCount: meaningfulSearchCount,
      topChannels: [],
      topMoodLabels: [],
      topKeywords: [],
      discoveryQueries: [],
      tasteTokens: [],
      knownTrackIds: [],
    };
  }

  const topChannels = [...channelScores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((c) => c.display);

  const sortedMoods = [...moodScores.values()].sort((a, b) => b.score - a.score);
  const topMoodLabels = sortedMoods.slice(0, 3).map((m) => m.matcher.label);

  const channelLowerSet = new Set(topChannels.map((c) => c.toLowerCase()));
  const topKeywords = [...keywordScores.entries()]
    .filter(([tok]) => !channelLowerSet.has(tok))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tok]) => tok);

  const discoveryQueries: string[] = [];
  const pushQuery = (q: string) => {
    const clean = q.trim();
    if (clean && !discoveryQueries.includes(clean)) {
      discoveryQueries.push(clean);
    }
  };

  if (topChannels[0]) {
    pushQuery(`${topChannels[0]} 추천 노래 모음`);
  }
  if (sortedMoods[0]) {
    pushQuery(sortedMoods[0].matcher.querySeed);
  } else if (topKeywords.length >= 2) {
    pushQuery(`${topKeywords[0]} ${topKeywords[1]} 노래 추천`);
  } else if (topKeywords[0]) {
    pushQuery(`${topKeywords[0]} 추천 플레이리스트`);
  }

  if (topChannels[1]) {
    pushQuery(`${topChannels[1]} 플레이리스트 노래`);
  } else if (sortedMoods[1]) {
    pushQuery(sortedMoods[1].matcher.querySeed);
  } else if (topKeywords[0]) {
    pushQuery(`${topKeywords[0]} 비슷한 느낌 노래`);
  }

  if (discoveryQueries.length === 0) {
    pushQuery('감성 플레이리스트 추천 노래 모음');
  }

  const tasteTokens = Array.from(
    new Set([
      ...topChannels.map((c) => c.toLowerCase()),
      ...topKeywords.map((k) => k.toLowerCase()),
    ]),
  ).slice(0, 10);

  return {
    hasSignals: true,
    totalSignalsCount,
    playCountTotal,
    likedCount: likedTracks.length,
    playlistTracksCount,
    searchCount: meaningfulSearchCount,
    topChannels,
    topMoodLabels,
    topKeywords,
    discoveryQueries: discoveryQueries.slice(0, 3),
    tasteTokens,
    knownTrackIds: [...knownTrackIdSet].slice(0, 100),
  };
}
