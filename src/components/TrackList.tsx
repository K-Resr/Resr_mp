import React, {useState} from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  GripVertical,
  Heart,
  ListPlus,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
} from 'lucide-react';
import type {Playlist, Track} from '../types/music';
import {formatTime} from '../utils/formatTime';
import {TrackThumbnail} from './TrackThumbnail';

interface TrackListProps {
  tracks: Track[];
  activeEntryKey: string | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  playlists: Playlist[];
  emptyTitle?: string;
  emptyDescription?: string;
  removableFromPlaylist?: boolean;
  removableFromLiked?: boolean;
  reorderable?: boolean;
  isReorderMode?: boolean;
  onReorderTrack?: (fromIndex: number, toIndex: number) => void;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onTogglePlay: () => void;
  onToggleLike: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onOpenTrimModal: (track: Track) => void;
  onRemoveFromPlaylist?: (entryId: string) => void;
  onRemoveFromLiked?: (entryId: string) => void;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  activeEntryKey,
  currentTrackId,
  isPlaying,
  likedIds,
  playlists,
  emptyTitle = '표시할 트랙이 없습니다',
  emptyDescription = '유튜브에서 음악을 검색하거나 링크를 붙여넣어 보세요.',
  removableFromPlaylist = false,
  removableFromLiked = false,
  reorderable = false,
  isReorderMode = false,
  onReorderTrack,
  onPlayTrack,
  onTogglePlay,
  onToggleLike,
  onAddToQueue,
  onAddToPlaylist,
  onOpenTrimModal,
  onRemoveFromPlaylist,
  onRemoveFromLiked,
}) => {
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 backdrop-blur-sm px-6 py-14 text-center">
        <p className="text-base font-medium text-[#EEF4FF]">{emptyTitle}</p>
        <p className="mt-1.5 text-sm text-[#8CA1C4]">{emptyDescription}</p>
      </div>
    );
  }

  const canReorder = reorderable && Boolean(onReorderTrack) && tracks.length > 1;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    if (!canReorder) return;
    setDragFromIdx(idx);
    setDragOverIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    if (!canReorder || dragFromIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, toIdx: number) => {
    if (!canReorder || !onReorderTrack) return;
    e.preventDefault();
    const fallbackIdx = Number.parseInt(e.dataTransfer.getData('text/plain'), 10);
    const fromIdx = dragFromIdx !== null ? dragFromIdx : fallbackIdx;
    setDragFromIdx(null);
    setDragOverIdx(null);
    if (!Number.isNaN(fromIdx) && fromIdx !== toIdx) {
      onReorderTrack(fromIdx, toIdx);
    }
  };

  const handleDragEnd = () => {
    setDragFromIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="divide-y divide-sky-200/[0.08] border-t border-b border-sky-200/[0.08] rounded-xl bg-[#0B1324]/45 backdrop-blur-xs">
      {tracks.map((track, idx) => {
        const rowKey = track.entryId || `${track.id}-${idx}`;
        const isCurrent = track.entryId
          ? activeEntryKey === track.entryId
          : track.id === currentTrackId && !activeEntryKey?.startsWith('ent_');
        const isLiked = likedIds.has(track.id);
        const menuOpen = openMenuKey === rowKey;
        const hasTrim =
          typeof track.startSeconds === 'number' &&
          typeof track.endSeconds === 'number' &&
          track.endSeconds > track.startSeconds;

        const isBeingDragged = dragFromIdx === idx;
        const isDropTarget =
          dragFromIdx !== null && dragOverIdx === idx && dragFromIdx !== idx;
        const dropBorderClass = isDropTarget
          ? 'ring-2 ring-[#3B82F6] bg-[#2563EB]/15'
          : '';

        return (
          <div
            key={rowKey}
            draggable={canReorder}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`group relative flex items-center gap-2.5 sm:gap-4 px-2 sm:px-3 py-2.5 transition-colors rounded-lg ${
              isCurrent ? 'bg-[#13203B]/75' : 'hover:bg-[#13203B]/45'
            } ${isBeingDragged ? 'opacity-45' : ''} ${dropBorderClass}`}
          >
            {canReorder && (
              <span
                title="드래그해서 순서 이동"
                aria-hidden="true"
                className={`${
                  isReorderMode ? 'flex' : 'hidden sm:flex'
                } items-center justify-center w-6 h-8 text-[#5B7196] hover:text-[#EEF4FF] cursor-grab active:cursor-grabbing shrink-0`}
              >
                <GripVertical className="w-4 h-4" />
              </span>
            )}

            <span
              className={`${
                isReorderMode ? 'block w-6' : 'hidden sm:block w-7'
              } text-right text-xs font-mono tabular-nums text-[#5B7196] shrink-0`}
            >
              {String(idx + 1).padStart(2, '0')}
            </span>

            <button
              type="button"
              onClick={() => (isCurrent ? onTogglePlay() : onPlayTrack(track, tracks))}
              className="relative shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#3B82F6] rounded-lg"
              aria-label={isCurrent && isPlaying ? `${track.title} 일시 정지` : `${track.title} 재생`}
            >
              <TrackThumbnail
                src={track.thumbnail}
                alt={track.title}
                isLocal={track.source === 'local' || track.id.startsWith('local_')}
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
              onClick={() => (isCurrent ? onTogglePlay() : onPlayTrack(track, tracks))}
              className="flex-1 min-w-0 text-left cursor-pointer"
            >
              <p
                className={`text-sm font-medium truncate ${
                  isCurrent ? 'text-[#60A5FA]' : 'text-[#EEF4FF]'
                }`}
              >
                {track.title}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#8CA1C4] truncate">
                <span className="truncate">{track.channel}</span>
                {hasTrim && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#60A5FA] font-mono tabular-nums shrink-0">
                      구간 {formatTime(track.startSeconds!)}–{formatTime(track.endSeconds!)}
                    </span>
                  </>
                )}
                {track.clipLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#CBD5E1] shrink-0">{track.clipLabel}</span>
                  </>
                )}
                {!hasTrim && track.viewCountText && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{track.viewCountText}</span>
                  </>
                )}
              </div>
            </button>

            {isReorderMode && canReorder && onReorderTrack ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => onReorderTrack(idx, 0)}
                  aria-label="맨 위로 이동"
                  title="맨 위로 이동"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] disabled:opacity-30 text-[#EEF4FF] transition-colors cursor-pointer"
                >
                  <ChevronsUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => onReorderTrack(idx, idx - 1)}
                  aria-label="한 칸 위로 이동"
                  title="위로 이동"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] disabled:opacity-30 text-[#EEF4FF] transition-colors cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={idx === tracks.length - 1}
                  onClick={() => onReorderTrack(idx, idx + 1)}
                  aria-label="한 칸 아래로 이동"
                  title="아래로 이동"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] disabled:opacity-30 text-[#EEF4FF] transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            ) : (
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
                    title="플레이리스트에 빠른 추가 (중복 가능)"
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
                        전체 곡 바로 추가
                      </p>
                      {playlists.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-[#5B7196]">생성된 플레이리스트가 없습니다</p>
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

                {(removableFromPlaylist && onRemoveFromPlaylist && track.entryId) && (
                  <button
                    type="button"
                    onClick={() => onRemoveFromPlaylist(track.entryId!)}
                    aria-label="플레이리스트에서 제거"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#60A5FA] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {(removableFromLiked && onRemoveFromLiked && track.entryId) && (
                  <button
                    type="button"
                    onClick={() => onRemoveFromLiked(track.entryId!)}
                    aria-label="보관함 항목 삭제"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#60A5FA] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <span className="w-12 text-right text-xs font-mono tabular-nums text-[#8CA1C4] shrink-0">
                  {hasTrim
                    ? formatTime(track.endSeconds! - track.startSeconds!)
                    : track.duration || '0:00'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
