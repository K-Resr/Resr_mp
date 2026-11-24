export interface Track {
  entryId?: string;
  id: string;
  title: string;
  channel: string;
  channelId?: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  viewCountText?: string;
  startSeconds?: number;
  endSeconds?: number;
  clipLabel?: string;
  source?: 'youtube' | 'local';
  fileName?: string;
  fileSize?: number;
}

export interface YouTubeChannel {
  channelId: string;
  title: string;
  handle: string;
  subscriberText: string;
  thumbnail: string;
  description: string;
}

export type ChannelCollectionKind = 'playlist' | 'release';

export interface ChannelCollectionItem {
  id: string;
  kind: ChannelCollectionKind;
  title: string;
  subtitle: string;
  videoCountText: string;
  thumbnail: string;
  seedVideoId?: string;
  channelTitle?: string;
  tracks?: Track[];
}

export interface ChannelDetailData {
  channelId: string;
  channelTitle: string;
  subscriberText: string;
  thumbnail: string;
  videos: Track[];
  playlists: ChannelCollectionItem[];
  releases: ChannelCollectionItem[];
  hasReleases: boolean;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  searchType: 'keyword' | 'channel' | 'url';
  updatedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  tracks: Track[];
  createdAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type NavSection = 'explore' | 'charts' | 'playlists' | 'myfiles' | 'library' | 'playlist';

export type CuratedMood = 'recommended' | 'lofi' | 'kpop' | 'jazz' | 'indie';

export type VideoSurfaceMode = 'audio' | 'mini' | 'theater';

export type SearchMode = 'music' | 'all' | 'channel';

export type SearchSort = 'relevance' | 'popular' | 'recent';

export type ChartPlatformSource = 'melon' | 'genie' | 'flo' | 'vibe' | 'apple';

export interface ChartPlatformRank {
  source: ChartPlatformSource;
  label: string;
  rank: number;
}

export interface UnifiedChartEntry {
  unifiedRank: number;
  title: string;
  artist: string;
  albumArt: string;
  score: number;
  platformCount: number;
  platforms: ChartPlatformRank[];
  track: Track | null;
}

export interface UnifiedChartResponse {
  updatedAt: number;
  activeSources: Array<{source: ChartPlatformSource; label: string; count: number}>;
  entries: UnifiedChartEntry[];
}

export interface PlayHistoryEntry {
  id: string;
  title: string;
  channel: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  playCount: number;
  lastPlayedAt: number;
}

export interface TasteProfileSummary {
  hasSignals: boolean;
  totalSignalsCount: number;
  playCountTotal: number;
  likedCount: number;
  playlistTracksCount: number;
  searchCount: number;
  topChannels: string[];
  topMoodLabels: string[];
  topKeywords: string[];
  discoveryQueries: string[];
  tasteTokens: string[];
  knownTrackIds: string[];
}
