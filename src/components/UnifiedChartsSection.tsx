import React, {useMemo, useState} from 'react';
import {
  BarChart3,
  Heart,
  ListPlus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Scissors,
} from 'lucide-react';
import type {
  ChartPlatformSource,
  Playlist,
  Track,
  UnifiedChartEntry,
  UnifiedChartResponse,
} from '../types/music';
import {TrackThumbnail} from './TrackThumbnail';

interface UnifiedChartsSectionProps {
  data: UnifiedChartResponse | null;
  isLoading: boolean;
  error: string | null;
  activeEntryKey: string | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  playlists: Playlist[];
  onRefresh: () => void;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onPlayAll: (tracks: Track[]) => void;
  onTogglePlay: () => void;
  onToggleLike: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onOpenTrimModal: (track: Track) => void;
  onSearchFallback: (query: string) => void;
}

const PLATFORM_LABELS: Array<{id: 'all' | ChartPlatformSource; label: string}> = [
  {id: 'all', label: '통합 순위'},
  {id: 'melon', label: 'Melon'},
  {id: 'genie', label: 'Genie'},
  {id: 'flo', label: 'FLO'},
  {id: 'vibe', label: 'VIBE'},
  {id: 'apple', label: 'Apple Music'},
];

export const UnifiedChartsSection: React.FC<UnifiedChartsSectionProps> = ({
  data,
  isLoading,
  error,
  activeEntryKey,
  currentTrackId,
  isPlaying,
  likedIds,
  playlists,
  onRefresh,
  onPlayTrack,
  onPlayAll,
  onTogglePlay,
  onToggleLike,
  onAddToQueue,
  onAddToPlaylist,
  onOpenTrimModal,
  onSearchFallback,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | ChartPlatformSource>('all');
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    const entries = data?.entries || [];
    if (selectedPlatform === 'all') return entries;
    return entries
      .filter((entry) => entry.platforms.some((p) => p.source === selectedPlatform))
      .sort((a, b) => {
        const rankA =
          a.platforms.find((p) => p.source === selectedPlatform)?.rank ?? 999;
        const rankB =
          b.platforms.find((p) => p.source === selectedPlatform)?.rank ?? 999;
        return rankA - rankB;
      });
  }, [data?.entries, selectedPlatform]);

  const playableList = useMemo(
    () =>
      filteredEntries
        .map((e) => e.track)
        .filter((t): t is Track => t !== null),
    [filteredEntries],
  );

  const updatedLabel = useMemo(() => {
    if (!data?.updatedAt) return '';
    return new Date(data.updatedAt).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [data?.updatedAt]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#93C5FD]">다중 플랫폼 실시간 분석</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#EEF4FF] [text-wrap:balance]">
            실시간 통합 인기 차트
          </h1>
          <p className="mt-1.5 text-sm text-[#8CA1C4]">
            {data && data.activeSources.length > 0 ? (
              <>
                {data.activeSources.map((s) => s.label).join(' · ')} 실시간 순위를 통합 분석
                {updatedLabel ? ` · ${updatedLabel} 기준` : ''}
              </>
            ) : (
              'Melon · Genie · FLO · VIBE · Apple Music 실시간 인기곡을 교차 분석합니다.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={onRefresh}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#0B1324]/85 border border-sky-200/12 hover:bg-[#13203B] disabled:opacity-50 text-xs font-medium text-[#EEF4FF] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#60A5FA] ${isLoading ? 'animate-spin' : ''}`} />
            <span>실시간 재분석</span>
          </button>

          <button
            type="button"
            disabled={playableList.length === 0 || isLoading}
            onClick={() => onPlayAll(playableList)}
            className="min-h-[42px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-sm font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer shadow-lg shadow-[#2563EB]/20"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>차트 전체 재생</span>
          </button>
        </div>
      </div>

      {/* Interactive Platform Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {PLATFORM_LABELS.map((tab) => {
          const active = selectedPlatform === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedPlatform(tab.id)}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#0B1324]/80 border border-sky-200/[0.08] text-[#8CA1C4] hover:text-white hover:bg-[#13203B]/80'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="divide-y divide-sky-200/[0.08] rounded-xl border border-sky-200/[0.08] bg-[#0B1324]/50">
          {Array.from({length: 8}).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
              <div className="w-7 h-5 rounded bg-[#13203B]" />
              <div className="w-12 h-12 rounded-lg bg-[#13203B]" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/5 rounded bg-[#13203B]" />
                <div className="h-3 w-1/3 rounded bg-[#13203B]/70" />
              </div>
              <div className="w-16 h-4 rounded bg-[#13203B]/60" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-sky-200/12 bg-[#0B1324]/80 px-6 py-12 text-center space-y-3">
          <BarChart3 className="w-8 h-8 text-[#60A5FA] mx-auto" />
          <p className="text-sm font-medium text-[#EEF4FF]">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[40px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-medium text-white cursor-pointer"
          >
            다시 분석하기
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#EEF4FF]">표시할 차트 항목이 없습니다</p>
          <p className="mt-1 text-xs text-[#8CA1C4]">
            다른 플랫폼 탭을 선택하거나 실시간 재분석 버튼을 눌러 보세요.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-sky-200/[0.08] border-t border-b border-sky-200/[0.08] rounded-xl bg-[#0B1324]/45 backdrop-blur-xs">
          {filteredEntries.map((entry: UnifiedChartEntry, idx) => {
            const track = entry.track;
            const rowKey = `chart-${entry.unifiedRank}-${track?.id || entry.title}`;
            const isCurrent = Boolean(
              track &&
                (track.entryId
                  ? activeEntryKey === track.entryId
                  : track.id === currentTrackId && !activeEntryKey?.startsWith('ent_')),
            );
            const isLiked = track ? likedIds.has(track.id) : false;
            const menuOpen = openMenuKey === rowKey;
            const displayedRank =
              selectedPlatform === 'all'
                ? entry.unifiedRank
                : entry.platforms.find((p) => p.source === selectedPlatform)?.rank ?? idx + 1;

            const platformSummary = entry.platforms
              .map((p) => `${p.label} #${p.rank}`)
              .join(' · ');

            return (
              <div
                key={rowKey}
                className={`group relative flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 transition-colors rounded-lg ${
                  isCurrent ? 'bg-[#13203B]/75' : 'hover:bg-[#13203B]/45'
                }`}
              >
                <div className="w-8 sm:w-9 text-center shrink-0">
                  <span
                    className={`text-sm font-mono tabular-nums font-semibold ${
                      displayedRank <= 3 ? 'text-[#60A5FA]' : 'text-[#8CA1C4]'
                    }`}
                  >
                    {String(displayedRank).padStart(2, '0')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!track) {
                      onSearchFallback(`${entry.title} ${entry.artist}`);
                      return;
                    }
                    if (isCurrent) {
                      onTogglePlay();
                    } else {
                      onPlayTrack(track, playableList);
                    }
                  }}
                  aria-label={
                    isCurrent && isPlaying
                      ? `${entry.title} 일시 정지`
                      : `${entry.title} 재생`
                  }
                  className="relative shrink-0 cursor-pointer rounded-lg"
                >
                  <TrackThumbnail
                    src={entry.albumArt || track?.thumbnail || ''}
                    alt={entry.title}
                    className="w-12 h-12"
                  />
                  <span
                    className={`absolute inset-0 rounded-lg bg-[#050914]/65 flex items-center justify-center transition-opacity ${
                      isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="w-4 h-4 text-white fill-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!track) {
                      onSearchFallback(`${entry.title} ${entry.artist}`);
                      return;
                    }
                    if (isCurrent) {
                      onTogglePlay();
                    } else {
                      onPlayTrack(track, playableList);
                    }
                  }}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <p
                    className={`text-sm font-medium truncate ${
                      isCurrent ? 'text-[#60A5FA]' : 'text-[#EEF4FF]'
                    }`}
                  >
                    {entry.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#8CA1C4] truncate">
                    {entry.artist}
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums text-[#93C5FD]">
                      {platformSummary}
                    </span>
                  </p>
                </button>

                <span className="hidden md:inline-block text-xs font-mono tabular-nums text-[#5B7196] shrink-0">
                  {entry.platformCount}개 차트 · {entry.score}점
                </span>

                {track ? (
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenTrimModal(track)}
                      aria-label="구간 자르기 및 저장"
                      title="구간 자르기 · 플레이리스트 저장"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
                    >
                      <Scissors className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleLike(track)}
                      aria-label={isLiked ? '좋아요 취소' : '좋아요'}
                      className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                        isLiked ? 'text-[#60A5FA]' : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#60A5FA]' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onAddToQueue(track)}
                      aria-label="대기열에 추가"
                      title="대기열에 추가"
                      className="min-h-[40px] min-w-[40px] hidden sm:flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
                    >
                      <ListPlus className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuKey(menuOpen ? null : rowKey)}
                        aria-label="플레이리스트에 추가"
                        title="플레이리스트에 추가"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      {menuOpen && (
                        <div className="absolute right-0 top-11 z-30 w-56 max-h-60 overflow-y-auto overscroll-contain rounded-xl bg-[#0B1324] border border-sky-200/15 py-1.5 shadow-2xl">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuKey(null);
                              onOpenTrimModal(track);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-medium text-[#60A5FA] hover:bg-[#13203B] flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                            <span>특정 구간 잘라서 등록...</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onAddToQueue(track);
                              setOpenMenuKey(null);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-[#EEF4FF] hover:bg-[#13203B] transition-colors cursor-pointer sm:hidden"
                          >
                            대기열에 추가
                          </button>
                          <p className="px-3 py-1 mt-1 border-t border-sky-200/[0.08] text-[11px] font-medium text-[#8CA1C4]">
                            플레이리스트에 바로 추가
                          </p>
                          {playlists.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-[#5B7196]">
                              생성된 플레이리스트가 없습니다
                            </p>
                          ) : (
                            playlists.map((pl) => (
                              <button
                                key={pl.id}
                                type="button"
                                onClick={() => {
                                  onAddToPlaylist(pl.id, track);
                                  setOpenMenuKey(null);
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-[#EEF4FF] hover:bg-[#13203B] truncate transition-colors cursor-pointer"
                              >
                                {pl.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSearchFallback(`${entry.title} ${entry.artist}`)}
                    className="px-3 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-xs font-medium text-[#EEF4FF] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    검색하여 재생
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
