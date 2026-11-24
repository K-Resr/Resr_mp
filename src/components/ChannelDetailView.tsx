import React, {useCallback, useEffect, useState} from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Disc3,
  FolderPlus,
  ListMusic,
  ListPlus,
  Loader2,
  Play,
  RefreshCw,
  Video,
} from 'lucide-react';
import type {
  ChannelCollectionItem,
  ChannelDetailData,
  Playlist,
  Track,
} from '../types/music';
import {TrackList} from './TrackList';
import {TrackThumbnail} from './TrackThumbnail';

type ChannelTab = 'videos' | 'playlists' | 'releases';

interface ChannelDetailViewProps {
  channel: ChannelDetailData;
  activeEntryKey: string | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  playlists: Playlist[];
  onBack: () => void;
  onPlayTrack: (track: Track) => void;
  onPlaySequential: (track: Track, list: Track[]) => void;
  onTogglePlay: () => void;
  onToggleLike: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddManyToQueue: (tracks: Track[]) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onSaveCollectionAsPlaylist: (name: string, tracks: Track[]) => void;
  onOpenTrimModal: (track: Track) => void;
}

export const ChannelDetailView: React.FC<ChannelDetailViewProps> = ({
  channel,
  activeEntryKey,
  currentTrackId,
  isPlaying,
  likedIds,
  playlists,
  onBack,
  onPlayTrack,
  onPlaySequential,
  onTogglePlay,
  onToggleLike,
  onAddToQueue,
  onAddManyToQueue,
  onAddToPlaylist,
  onSaveCollectionAsPlaylist,
  onOpenTrimModal,
}) => {
  const [activeTab, setActiveTab] = useState<ChannelTab>('videos');
  const [selectedCollection, setSelectedCollection] = useState<ChannelCollectionItem | null>(null);
  const [collectionTracksMap, setCollectionTracksMap] = useState<Record<string, Track[]>>({});
  const [loadingCollectionId, setLoadingCollectionId] = useState<string | null>(null);
  const [quickPlayingId, setQuickPlayingId] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab('videos');
    setSelectedCollection(null);
    setCollectionTracksMap({});
    setLoadingCollectionId(null);
    setQuickPlayingId(null);
    setCollectionError(null);
  }, [channel.channelId]);

  const loadCollectionTracks = useCallback(
    async (item: ChannelCollectionItem): Promise<Track[]> => {
      const existing = collectionTracksMap[item.id];
      if (existing && existing.length > 0) {
        return existing;
      }
      if (item.tracks && item.tracks.length > 0) {
        setCollectionTracksMap((prev) => ({...prev, [item.id]: item.tracks!}));
        return item.tracks;
      }

      const params = new URLSearchParams();
      if (item.seedVideoId) params.set('seedVideoId', item.seedVideoId);
      params.set('channelTitle', item.channelTitle || channel.channelTitle);

      const res = await fetch(
        `/api/youtube/playlist/${encodeURIComponent(item.id)}?${params.toString()}`,
      );
      const data = (await res.json()) as {tracks?: Track[]; error?: string};
      if (!res.ok) {
        throw new Error(data.error || '묶인 영상 목록을 불러오지 못했습니다.');
      }
      const fetchedTracks = (data.tracks || []).map((t) => ({
        ...t,
        channel: t.channel === 'YouTube' ? channel.channelTitle : t.channel,
      }));
      setCollectionTracksMap((prev) => ({...prev, [item.id]: fetchedTracks}));
      return fetchedTracks;
    },
    [channel.channelTitle, collectionTracksMap],
  );

  const handleOpenCollection = async (item: ChannelCollectionItem) => {
    setSelectedCollection(item);
    setCollectionError(null);
    if (collectionTracksMap[item.id]?.length) return;

    setLoadingCollectionId(item.id);
    try {
      await loadCollectionTracks(item);
    } catch (err) {
      setCollectionError(
        err instanceof Error ? err.message : '묶인 영상 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoadingCollectionId(null);
    }
  };

  const handleQuickPlayCollection = async (
    e: React.MouseEvent,
    item: ChannelCollectionItem,
  ) => {
    e.stopPropagation();
    setQuickPlayingId(item.id);
    setCollectionError(null);
    try {
      const tracks = await loadCollectionTracks(item);
      if (tracks.length > 0) {
        onPlaySequential(tracks[0], tracks);
      } else {
        setSelectedCollection(item);
        setCollectionError('이 묶음에서 재생 가능한 영상을 찾지 못했습니다.');
      }
    } catch (err) {
      setSelectedCollection(item);
      setCollectionError(
        err instanceof Error ? err.message : '재생목록을 불러오지 못했습니다.',
      );
    } finally {
      setQuickPlayingId(null);
    }
  };

  const selectedTracks = selectedCollection ? collectionTracksMap[selectedCollection.id] || [] : [];

  return (
    <section className="space-y-5">
      {/* Channel Header */}
      <div className="rounded-2xl border border-sky-200/10 bg-[#0B1324]/85 backdrop-blur-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="채널 검색 결과로 돌아가기"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white shrink-0 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <TrackThumbnail
            src={channel.thumbnail}
            alt={channel.channelTitle}
            className="w-14 h-14 rounded-full shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-[#8CA1C4]">
              {channel.subscriberText || 'YouTube 채널'}
            </p>
            <h2 className="text-xl font-bold text-[#EEF4FF] truncate">
              {channel.channelTitle}
            </h2>
            <p className="text-xs font-mono tabular-nums text-[#8CA1C4] mt-0.5 truncate">
              영상 {channel.videos.length}개 · 재생목록 {channel.playlists.length}개 ·{' '}
              {channel.hasReleases
                ? `발표곡 ${channel.releases.length}개`
                : '발표곡 없음'}
            </p>
          </div>
        </div>

        {activeTab === 'videos' && !selectedCollection && channel.videos.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onPlaySequential(channel.videos[0], channel.videos)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-sm font-medium text-white flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>영상 전체 재생</span>
            </button>
          </div>
        )}
      </div>

      {/* 3 Organized Channel Tabs: 영상 / 재생목록 / 발표곡 */}
      <div
        role="tablist"
        aria-label="채널 콘텐츠 분류"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-sky-200/10 bg-[#0B1324]/80 p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'videos'}
          onClick={() => {
            setActiveTab('videos');
            setSelectedCollection(null);
            setCollectionError(null);
          }}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'videos'
              ? 'bg-[#2563EB] text-white'
              : 'text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-white/[0.04]'
          }`}
        >
          <Video className="w-4 h-4 shrink-0" />
          <span>영상</span>
          <span
            className={`font-mono tabular-nums text-xs ${
              activeTab === 'videos' ? 'text-sky-100' : 'text-[#5B7196]'
            }`}
          >
            {channel.videos.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'playlists'}
          onClick={() => {
            setActiveTab('playlists');
            setSelectedCollection(null);
            setCollectionError(null);
          }}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'playlists'
              ? 'bg-[#2563EB] text-white'
              : 'text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-white/[0.04]'
          }`}
        >
          <ListMusic className="w-4 h-4 shrink-0" />
          <span>재생목록</span>
          <span
            className={`font-mono tabular-nums text-xs ${
              activeTab === 'playlists' ? 'text-sky-100' : 'text-[#5B7196]'
            }`}
          >
            {channel.playlists.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'releases'}
          onClick={() => {
            setActiveTab('releases');
            setSelectedCollection(null);
            setCollectionError(null);
          }}
          className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'releases'
              ? 'bg-[#2563EB] text-white'
              : 'text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-white/[0.04]'
          }`}
        >
          <Disc3 className="w-4 h-4 shrink-0" />
          <span>발표곡</span>
          <span
            className={`font-mono tabular-nums text-xs ${
              activeTab === 'releases' ? 'text-sky-100' : 'text-[#5B7196]'
            }`}
          >
            {channel.releases.length > 0 ? channel.releases.length : '없음'}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'videos' ? (
        <TrackList
          tracks={channel.videos}
          activeEntryKey={activeEntryKey}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          likedIds={likedIds}
          playlists={playlists}
          onPlayTrack={onPlayTrack}
          onTogglePlay={onTogglePlay}
          onToggleLike={onToggleLike}
          onAddToQueue={onAddToQueue}
          onAddToPlaylist={onAddToPlaylist}
          onOpenTrimModal={onOpenTrimModal}
        />
      ) : selectedCollection ? (
        /* Grouped Playlist / Release Detail View preserving bundled tracks */
        <div className="space-y-4">
          <div className="rounded-2xl border border-sky-200/10 bg-[#0B1324]/85 backdrop-blur-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedCollection(null);
                  setCollectionError(null);
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-[#EEF4FF] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  {selectedCollection.kind === 'release'
                    ? '발표곡 목록으로'
                    : '재생목록 목록으로'}
                </span>
              </button>
              <span className="text-xs font-mono tabular-nums text-[#8CA1C4]">
                {selectedTracks.length > 0
                  ? `수록 영상 ${selectedTracks.length}개`
                  : selectedCollection.videoCountText}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <TrackThumbnail
                src={selectedCollection.thumbnail}
                alt={selectedCollection.title}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-medium text-[#60A5FA]">
                  {selectedCollection.kind === 'release'
                    ? '공식 발표곡 · 묶음 트랙'
                    : '채널 재생목록 · 묶음 영상'}
                </p>
                <h3 className="text-lg sm:text-xl font-bold text-[#EEF4FF] [text-wrap:balance]">
                  {selectedCollection.title}
                </h3>
                <p className="text-xs text-[#8CA1C4]">
                  {channel.channelTitle} · {selectedCollection.subtitle} ·{' '}
                  {selectedCollection.videoCountText}
                </p>

                {selectedTracks.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPlaySequential(selectedTracks[0], selectedTracks)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs sm:text-sm font-medium text-white flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>묶음 전체 재생</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveCollectionAsPlaylist(selectedCollection.title, selectedTracks)
                      }
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-sky-200/15 bg-[#13203B]/90 hover:bg-[#1A2B4E] text-xs sm:text-sm font-medium text-[#EEF4FF] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      <FolderPlus className="w-4 h-4 text-[#60A5FA]" />
                      <span>내 플레이리스트로 저장</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddManyToQueue(selectedTracks)}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-sky-200/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs sm:text-sm font-medium text-[#CBD5E1] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      <ListPlus className="w-4 h-4" />
                      <span>대기열에 담기</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loadingCollectionId === selectedCollection.id ? (
            <div className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 px-6 py-12 text-center space-y-3">
              <Loader2 className="w-6 h-6 text-[#60A5FA] animate-spin mx-auto" />
              <p className="text-sm text-[#8CA1C4]">
                묶여 있는 영상 순서를 그대로 불러오는 중입니다...
              </p>
            </div>
          ) : collectionError ? (
            <div className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 px-6 py-10 text-center space-y-3">
              <p className="text-sm text-rose-300">{collectionError}</p>
              <button
                type="button"
                onClick={() => handleOpenCollection(selectedCollection)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>다시 불러오기</span>
              </button>
            </div>
          ) : (
            <TrackList
              tracks={selectedTracks}
              activeEntryKey={activeEntryKey}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              likedIds={likedIds}
              playlists={playlists}
              onPlayTrack={(tr) => onPlaySequential(tr, selectedTracks)}
              onTogglePlay={onTogglePlay}
              onToggleLike={onToggleLike}
              onAddToQueue={onAddToQueue}
              onAddToPlaylist={onAddToPlaylist}
              onOpenTrimModal={onOpenTrimModal}
            />
          )}
        </div>
      ) : (
        /* Collection Grid for Playlists or Releases */
        (() => {
          const items =
            activeTab === 'playlists' ? channel.playlists : channel.releases;
          const isReleases = activeTab === 'releases';

          if (items.length === 0) {
            return (
              <div className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 backdrop-blur-sm px-6 py-14 text-center">
                <p className="text-base font-medium text-[#EEF4FF]">
                  {isReleases
                    ? '등록된 공식 발표곡이 없습니다'
                    : '공개된 재생목록이 없습니다'}
                </p>
                <p className="mt-1.5 text-sm text-[#8CA1C4]">
                  {isReleases
                    ? '이 채널에는 YouTube 공식 발표곡(앨범·싱글) 탭이 없거나 비어 있습니다.'
                    : '이 채널에서 만든 재생목록이 아직 없습니다.'}
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {items.map((item) => {
                const isQuickLoading = quickPlayingId === item.id;
                const cachedCount = collectionTracksMap[item.id]?.length;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenCollection(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenCollection(item);
                      }
                    }}
                    className="group rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 hover:bg-[#0F1B33]/90 hover:border-sky-300/25 p-3.5 flex flex-col gap-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
                  >
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#13203B]">
                      <TrackThumbnail
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-mono tabular-nums font-medium text-[#EEF4FF]">
                          {cachedCount ? `${cachedCount}곡` : item.videoCountText}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleQuickPlayCollection(e, item)}
                          aria-label={`${item.title} 바로 전체 재생`}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-medium text-white flex items-center gap-1.5 shadow-md whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                        >
                          {isQuickLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-white" />
                          )}
                          <span>전체 재생</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2 min-w-0 px-0.5">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-[#EEF4FF] line-clamp-2 group-hover:text-white">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs text-[#8CA1C4] truncate">
                          {item.subtitle} · {item.videoCountText}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#5B7196] group-hover:text-[#EEF4FF] shrink-0 mt-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </section>
  );
};
