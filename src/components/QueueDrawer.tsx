import React, {useState} from 'react';
import {ChevronDown, ChevronUp, GripVertical, Trash2, X} from 'lucide-react';
import type {Track} from '../types/music';
import {formatTime} from '../utils/formatTime';
import {TrackThumbnail} from './TrackThumbnail';

interface QueueDrawerProps {
  isOpen: boolean;
  queue: Track[];
  activeEntryKey: string | null;
  currentTrackId: string | null;
  onClose: () => void;
  onPlayAt: (track: Track) => void;
  onReorderAt: (fromIndex: number, toIndex: number) => void;
  onRemoveAt: (index: number) => void;
  onClearQueue: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  queue,
  activeEntryKey,
  currentTrackId,
  onClose,
  onPlayAt,
  onReorderAt,
  onRemoveAt,
  onClearQueue,
}) => {
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const canReorder = queue.length > 1;

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
    if (!canReorder) return;
    e.preventDefault();
    const fallbackIdx = Number.parseInt(e.dataTransfer.getData('text/plain'), 10);
    const fromIdx = dragFromIdx !== null ? dragFromIdx : fallbackIdx;
    setDragFromIdx(null);
    setDragOverIdx(null);
    if (!Number.isNaN(fromIdx) && fromIdx !== toIdx) {
      onReorderAt(fromIdx, toIdx);
    }
  };

  const handleDragEnd = () => {
    setDragFromIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-[#0B1324]/95 backdrop-blur-md border-l border-sky-200/10 h-full flex flex-col pb-24">
        <div className="px-5 py-4 border-b border-sky-200/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#EEF4FF]">재생 대기열</h2>
            <p className="text-xs text-[#8CA1C4] font-mono tabular-nums mt-0.5">
              총 {queue.length}곡{canReorder ? ' · 드래그 또는 화살표로 순서 변경' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                type="button"
                onClick={onClearQueue}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#8CA1C4] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                비우기
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="대기열 닫기"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-sky-200/[0.07] px-3 py-1">
          {queue.length === 0 ? (
            <div className="py-16 text-center px-4">
              <p className="text-sm font-medium text-[#EEF4FF]">대기열이 비어 있습니다</p>
              <p className="mt-1 text-xs text-[#8CA1C4]">
                트랙을 재생하거나 대기열에 추가하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            queue.map((item, idx) => {
              const key = item.entryId || `${item.id}-q-${idx}`;
              const isCurrent = item.entryId
                ? activeEntryKey === item.entryId
                : item.id === currentTrackId;
              const hasTrim =
                typeof item.startSeconds === 'number' &&
                typeof item.endSeconds === 'number' &&
                item.endSeconds > item.startSeconds;
              const isBeingDragged = dragFromIdx === idx;
              const isDropTarget =
                dragFromIdx !== null && dragOverIdx === idx && dragFromIdx !== idx;

              return (
                <div
                  key={key}
                  draggable={canReorder}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 py-2.5 px-2 rounded-lg transition-colors ${
                    isCurrent ? 'bg-[#2563EB]/15' : 'hover:bg-[#13203B]/45'
                  } ${isBeingDragged ? 'opacity-45' : ''} ${
                    isDropTarget ? 'ring-2 ring-[#3B82F6] bg-[#2563EB]/20' : ''
                  }`}
                >
                  {canReorder && (
                    <span
                      title="드래그하여 대기 순서 이동"
                      aria-hidden="true"
                      className="flex items-center justify-center w-5 h-8 text-[#5B7196] hover:text-[#EEF4FF] cursor-grab active:cursor-grabbing shrink-0"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                  )}

                  <span className="w-5 text-right text-[11px] font-mono tabular-nums text-[#5B7196] shrink-0">
                    {idx + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => onPlayAt(item)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <TrackThumbnail
                      src={item.thumbnail}
                      alt={item.title}
                      isLocal={item.source === 'local' || item.id.startsWith('local_')}
                      className="w-10 h-10"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate ${
                          isCurrent ? 'text-[#60A5FA]' : 'text-[#EEF4FF]'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-[#8CA1C4] truncate">
                        {item.channel}
                        {hasTrim
                          ? ` · 구간 ${formatTime(item.startSeconds!)}–${formatTime(item.endSeconds!)}`
                          : ''}
                      </p>
                    </div>
                  </button>

                  {canReorder && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => onReorderAt(idx, idx - 1)}
                        aria-label={`${item.title} 한 칸 위로 이동`}
                        title="위로 이동"
                        className="min-h-[34px] min-w-[30px] flex items-center justify-center rounded-md text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B] disabled:opacity-25 transition-colors cursor-pointer"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === queue.length - 1}
                        onClick={() => onReorderAt(idx, idx + 1)}
                        aria-label={`${item.title} 한 칸 아래로 이동`}
                        title="아래로 이동"
                        className="min-h-[34px] min-w-[30px] flex items-center justify-center rounded-md text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B] disabled:opacity-25 transition-colors cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <span className="hidden sm:inline text-xs font-mono tabular-nums text-[#5B7196] shrink-0">
                    {hasTrim
                      ? formatTime(item.endSeconds! - item.startSeconds!)
                      : item.duration}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRemoveAt(idx)}
                    aria-label={`${item.title} 대기열에서 제거`}
                    className="min-h-[34px] min-w-[32px] flex items-center justify-center rounded-lg text-[#5B7196] hover:text-[#60A5FA] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
