import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Check, Keyboard, Play, Plus, Scissors, SlidersHorizontal, X} from 'lucide-react';
import type {Playlist, Track} from '../types/music';
import {formatTime} from '../utils/formatTime';
import {TrackThumbnail} from './TrackThumbnail';

type TrimInputMode = 'slider' | 'typing';

interface TrimAndSaveModalProps {
  isOpen: boolean;
  track: Track | null;
  playlists: Playlist[];
  activePlaybackTrackId: string | null;
  activePlaybackTime: number;
  initialStartSeconds?: number;
  initialEndSeconds?: number;
  isImportFlow?: boolean;
  importProgress?: {current: number; total: number} | null;
  defaultPlaylistIds?: string[];
  onClose: () => void;
  onPreviewRange: (track: Track, startSec: number) => void;
  onCreatePlaylist: (name: string) => Promise<string | null>;
  onConfirmSave: (options: {
    track: Track;
    useTrim: boolean;
    startSeconds: number;
    endSeconds: number;
    clipLabel: string;
    alsoSaveFull: boolean;
    saveToLiked: boolean;
    targetPlaylistIds: string[];
  }) => Promise<void>;
}

interface ParsedTimeResult {
  seconds: number | null;
  error: string | null;
}

function parseFlexibleTimeInput(raw: string, maxSec: number): ParsedTimeResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {seconds: null, error: '시간을 입력해주세요. (예: 1:25 또는 85)'};
  }

  // Korean duration syntax: e.g. "1시간 2분 30초", "1분 30초", "45초"
  if (/[시간분초]/.test(trimmed)) {
    const korMatch =
      /^(?:(\d+)\s*시간\s*)?(?:(\d+)\s*분\s*)?(?:(\d+)\s*초\s*)?$/.exec(trimmed);
    if (!korMatch || (!korMatch[1] && !korMatch[2] && !korMatch[3])) {
      return {seconds: null, error: '예: 1분 30초, 1:30 또는 90 형식으로 입력해주세요.'};
    }
    const h = Number.parseInt(korMatch[1] || '0', 10);
    const m = Number.parseInt(korMatch[2] || '0', 10);
    const s = Number.parseInt(korMatch[3] || '0', 10);
    const total = h * 3600 + m * 60 + s;
    if (total > maxSec) {
      return {
        seconds: null,
        error: `전체 길이(${formatTime(maxSec)}) 이하로 입력해주세요.`,
      };
    }
    return {seconds: total, error: null};
  }

  // Pure integer seconds: e.g. "90"
  if (/^\d+$/.test(trimmed)) {
    const total = Number.parseInt(trimmed, 10);
    if (total > maxSec) {
      return {
        seconds: null,
        error: `전체 길이(${formatTime(maxSec)}) 이하로 입력해주세요.`,
      };
    }
    return {seconds: total, error: null};
  }

  // Colon format: mm:ss or hh:mm:ss
  if (/^\d+(?::\d{1,2}){1,2}$/.test(trimmed)) {
    const parts = trimmed.split(':').map((p) => Number.parseInt(p, 10));
    let total = 0;
    if (parts.length === 3) {
      if (parts[1] >= 60 || parts[2] >= 60) {
        return {seconds: null, error: '분과 초는 0~59 사이로 입력해주세요.'};
      }
      total = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      if (parts[1] >= 60) {
        return {seconds: null, error: '초는 0~59 사이로 입력해주세요.'};
      }
      total = parts[0] * 60 + parts[1];
    }
    if (total > maxSec) {
      return {
        seconds: null,
        error: `전체 길이(${formatTime(maxSec)}) 이하로 입력해주세요.`,
      };
    }
    return {seconds: total, error: null};
  }

  return {seconds: null, error: '예: 1:25, 85, 1분 25초 형식으로 입력해주세요.'};
}

export const TrimAndSaveModal: React.FC<TrimAndSaveModalProps> = ({
  isOpen,
  track,
  playlists,
  activePlaybackTrackId,
  activePlaybackTime,
  initialStartSeconds,
  initialEndSeconds,
  isImportFlow = false,
  importProgress = null,
  defaultPlaylistIds,
  onClose,
  onPreviewRange,
  onCreatePlaylist,
  onConfirmSave,
}) => {
  const maxDuration = useMemo(() => {
    if (!track) return 300;
    return track.durationSeconds > 0 ? track.durationSeconds : 300;
  }, [track]);

  const [useTrim, setUseTrim] = useState(true);
  const [trimInputMode, setTrimInputMode] = useState<TrimInputMode>('slider');
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(60);
  const [startText, setStartText] = useState('0:00');
  const [endText, setEndText] = useState('1:00');
  const [clipLabel, setClipLabel] = useState('');
  const [alsoSaveFull, setAlsoSaveFull] = useState(true);
  const [saveToLiked, setSaveToLiked] = useState(false);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [newPlName, setNewPlName] = useState('');
  const [isCreatingPl, setIsCreatingPl] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !track) {
      lastInitKeyRef.current = null;
      return;
    }

    const initKey = `${track.id}__${track.entryId || ''}__${initialStartSeconds ?? ''}__${initialEndSeconds ?? ''}__${isImportFlow ? '1' : '0'}__${(defaultPlaylistIds || []).join(',')}`;
    if (lastInitKeyRef.current === initKey) {
      return;
    }
    lastInitKeyRef.current = initKey;

    const total = track.durationSeconds > 0 ? track.durationSeconds : 300;
    const initStart =
      typeof initialStartSeconds === 'number'
        ? Math.max(0, Math.min(total - 1, Math.floor(initialStartSeconds)))
        : typeof track.startSeconds === 'number'
          ? track.startSeconds
          : 0;
    const defaultEnd = Math.min(total, Math.max(initStart + 30, Math.floor(total * 0.5)));
    const initEnd =
      typeof initialEndSeconds === 'number' && initialEndSeconds > initStart
        ? Math.min(total, Math.floor(initialEndSeconds))
        : typeof track.endSeconds === 'number' && track.endSeconds > initStart
          ? Math.min(total, track.endSeconds)
          : defaultEnd;

    const validDefaultPlaylists = (defaultPlaylistIds || []).filter((id) =>
      playlists.some((pl) => pl.id === id),
    );
    const initialPlaylists =
      validDefaultPlaylists.length > 0
        ? validDefaultPlaylists
        : playlists.length > 0
          ? [playlists[0].id]
          : [];

    setUseTrim(true);
    setStartSec(initStart);
    setEndSec(initEnd);
    setStartText(formatTime(initStart));
    setEndText(formatTime(initEnd));
    setClipLabel(track.clipLabel || '');
    // When importing a local file, the full track is already saved in My Files, so default to trimmed clip only
    setAlsoSaveFull(!isImportFlow);
    setSaveToLiked(initialPlaylists.length === 0);
    setSelectedPlaylistIds(initialPlaylists);
    setErrorMsg(null);
  }, [isOpen, track, initialStartSeconds, initialEndSeconds, isImportFlow, defaultPlaylistIds, playlists]);

  if (!isOpen || !track) return null;

  const isSamePlayingTrack = activePlaybackTrackId === track.id;

  const parsedStartResult = parseFlexibleTimeInput(startText, maxDuration - 1);
  const parsedEndResult = parseFlexibleTimeInput(endText, maxDuration);

  const effectiveStart =
    trimInputMode === 'typing' && parsedStartResult.seconds !== null
      ? parsedStartResult.seconds
      : startSec;
  const effectiveEnd =
    trimInputMode === 'typing' && parsedEndResult.seconds !== null
      ? parsedEndResult.seconds
      : endSec;

  const typingOrderInvalid =
    trimInputMode === 'typing' &&
    parsedStartResult.seconds !== null &&
    parsedEndResult.seconds !== null &&
    parsedEndResult.seconds <= parsedStartResult.seconds;

  const hasTypingError =
    trimInputMode === 'typing' &&
    (Boolean(parsedStartResult.error) || Boolean(parsedEndResult.error) || typingOrderInvalid);

  const updateStart = (val: number) => {
    const clamped = Math.max(0, Math.min(endSec - 1, Math.floor(val)));
    setStartSec(clamped);
    setStartText(formatTime(clamped));
  };

  const updateEnd = (val: number) => {
    const clamped = Math.max(startSec + 1, Math.min(maxDuration, Math.floor(val)));
    setEndSec(clamped);
    setEndText(formatTime(clamped));
  };

  const handleTypingStartChange = (nextText: string) => {
    setStartText(nextText);
    setErrorMsg(null);
    const res = parseFlexibleTimeInput(nextText, maxDuration - 1);
    if (res.seconds !== null && res.seconds < effectiveEnd) {
      setStartSec(res.seconds);
    }
  };

  const handleTypingEndChange = (nextText: string) => {
    setEndText(nextText);
    setErrorMsg(null);
    const res = parseFlexibleTimeInput(nextText, maxDuration);
    if (res.seconds !== null && res.seconds > effectiveStart) {
      setEndSec(res.seconds);
    }
  };

  const handleModeSwitch = (nextMode: TrimInputMode) => {
    if (nextMode === 'slider') {
      // Sync valid typed values before switching back to slider view
      const safeStart = Math.max(
        0,
        Math.min(maxDuration - 1, parsedStartResult.seconds ?? startSec),
      );
      const safeEnd = Math.max(
        safeStart + 1,
        Math.min(maxDuration, parsedEndResult.seconds ?? endSec),
      );
      setStartSec(safeStart);
      setEndSec(safeEnd);
      setStartText(formatTime(safeStart));
      setEndText(formatTime(safeEnd));
    } else {
      setStartText(formatTime(startSec));
      setEndText(formatTime(endSec));
    }
    setTrimInputMode(nextMode);
    setErrorMsg(null);
  };

  const applyClipDurationPreset = (durationDeltaSec: number | 'full') => {
    const baseStart =
      parsedStartResult.seconds !== null
        ? Math.max(0, Math.min(maxDuration - 1, parsedStartResult.seconds))
        : startSec;
    const nextEnd =
      durationDeltaSec === 'full'
        ? maxDuration
        : Math.min(maxDuration, Math.max(baseStart + 1, baseStart + durationDeltaSec));
    setStartSec(baseStart);
    setStartText(formatTime(baseStart));
    setEndSec(nextEnd);
    setEndText(formatTime(nextEnd));
    setErrorMsg(null);
  };

  const handleTogglePlaylist = (id: string) => {
    setSelectedPlaylistIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleCreateInlinePlaylist = async () => {
    const trimmed = newPlName.trim();
    if (!trimmed) return;
    setIsCreatingPl(true);
    const createdId = await onCreatePlaylist(trimmed);
    setIsCreatingPl(false);
    setNewPlName('');
    if (createdId) {
      setSelectedPlaylistIds((prev) => (prev.includes(createdId) ? prev : [createdId, ...prev]));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveToLiked && selectedPlaylistIds.length === 0) {
      setErrorMsg('저장할 좋아요 보관함 또는 플레이리스트를 하나 이상 선택해주세요.');
      return;
    }

    let finalStart = startSec;
    let finalEnd = endSec;

    if (useTrim && trimInputMode === 'typing') {
      if (parsedStartResult.error || parsedStartResult.seconds === null) {
        setErrorMsg(`시작 시간: ${parsedStartResult.error || '올바른 시간을 입력해주세요.'}`);
        return;
      }
      if (parsedEndResult.error || parsedEndResult.seconds === null) {
        setErrorMsg(`끝 시간: ${parsedEndResult.error || '올바른 시간을 입력해주세요.'}`);
        return;
      }
      finalStart = parsedStartResult.seconds;
      finalEnd = parsedEndResult.seconds;
    }

    if (useTrim && finalEnd <= finalStart) {
      setErrorMsg('구간 끝 시간은 시작 시간보다 커야 합니다.');
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      await onConfirmSave({
        track,
        useTrim,
        startSeconds: finalStart,
        endSeconds: finalEnd,
        clipLabel: clipLabel.trim(),
        alsoSaveFull: useTrim ? alsoSaveFull : false,
        saveToLiked,
        targetPlaylistIds: selectedPlaylistIds,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const visualStart = Math.max(0, Math.min(maxDuration - 1, effectiveStart));
  const visualEnd = Math.max(visualStart + 1, Math.min(maxDuration, effectiveEnd));
  const startPct = maxDuration > 0 ? (visualStart / maxDuration) * 100 : 0;
  const endPct = maxDuration > 0 ? (visualEnd / maxDuration) * 100 : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-xl max-h-[90dvh] flex flex-col rounded-2xl bg-[#0B1324] border border-sky-200/15 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-sky-200/[0.08]">
          <div className="flex items-center gap-3 min-w-0">
            <TrackThumbnail
              src={track.thumbnail}
              alt={track.title}
              isLocal={track.source === 'local' || track.id.startsWith('local_')}
              className="w-12 h-12"
            />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#EEF4FF] truncate">{track.title}</h2>
              <p className="text-xs text-[#8CA1C4] truncate mt-0.5">
                {track.channel} · 전체 길이 {formatTime(maxDuration)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-5">
          {isImportFlow && (
            <div className="rounded-xl border border-[#3B82F6]/35 bg-[#2563EB]/15 px-3.5 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#EEF4FF]">
                  가져온 음악 구간 자르기
                </p>
                <p className="mt-0.5 text-[11px] text-[#CBD5E1]">
                  원하는 부분만 잘라서 플레이리스트나 보관함에 담으세요. 전체 원본은 내 파일에 저장되어 있습니다.
                </p>
              </div>
              {importProgress && importProgress.total > 1 && (
                <span className="shrink-0 px-2 py-0.5 rounded-md bg-[#2563EB] text-[11px] font-mono tabular-nums font-semibold text-white">
                  {importProgress.current} / {importProgress.total}
                </span>
              )}
            </div>
          )}

          {/* Save type selector */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#050914] border border-sky-200/[0.08]">
            <button
              type="button"
              onClick={() => setUseTrim(true)}
              className={`min-h-[40px] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                useTrim ? 'bg-[#2563EB] text-white' : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>특정 구간 자르기</span>
            </button>
            <button
              type="button"
              onClick={() => setUseTrim(false)}
              className={`min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                !useTrim ? 'bg-[#2563EB] text-white' : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
              }`}
            >
              전체 곡만 등록
            </button>
          </div>

          {useTrim && (
            <div className="rounded-xl bg-[#050914] border border-sky-200/[0.08] p-4 space-y-4">
              {/* Trim Input Mode Switcher: Slider mode vs Direct Typing mode */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sky-200/[0.08]">
                <span className="text-[11px] font-semibold text-[#8CA1C4]">구간 지정 방식</span>
                <div className="inline-flex p-0.5 rounded-lg bg-[#0B1324] border border-sky-200/10">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('slider')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      trimInputMode === 'slider'
                        ? 'bg-[#13203B] text-[#EEF4FF]'
                        : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>슬라이더 조절</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('typing')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                      trimInputMode === 'typing'
                        ? 'bg-[#13203B] text-[#EEF4FF]'
                        : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
                    }`}
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>직접 타이핑 입력</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#EEF4FF]">
                  선택 구간:{' '}
                  <span className="font-mono tabular-nums text-[#60A5FA]">
                    {formatTime(visualStart)} – {formatTime(visualEnd)}
                  </span>{' '}
                  <span className="text-[#8CA1C4] font-mono tabular-nums">
                    ({formatTime(Math.max(0, visualEnd - visualStart))})
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPreviewRange(track, visualStart)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-xs font-medium text-[#EEF4FF] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>시작점 듣기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewRange(track, Math.max(visualStart, visualEnd - 3))
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#0B1324] hover:bg-[#13203B] border border-sky-200/10 text-xs font-medium text-[#CBD5E1] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    끝 3초 전 확인
                  </button>
                </div>
              </div>

              {/* Visual range bar */}
              <div className="relative h-2 rounded-full bg-sky-200/10 overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-[#3B82F6] transition-all duration-150"
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(2, endPct - startPct)}%`,
                  }}
                />
              </div>

              {trimInputMode === 'slider' ? (
                /* Mode 1: Existing Slider + Current Position Mode */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 rounded-xl bg-[#0B1324] border border-sky-200/[0.08] p-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#8CA1C4]">
                        시작 (A) ·{' '}
                        <span className="font-mono tabular-nums text-[#EEF4FF]">
                          {formatTime(startSec)}
                        </span>
                      </label>
                      {isSamePlayingTrack && (
                        <button
                          type="button"
                          onClick={() => updateStart(activePlaybackTime)}
                          className="text-[11px] font-medium text-[#60A5FA] hover:underline cursor-pointer"
                        >
                          현재 위치 ({formatTime(activePlaybackTime)})
                        </button>
                      )}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, maxDuration - 1)}
                      value={startSec}
                      onChange={(e) => updateStart(Number(e.target.value))}
                      className="velo-range w-full h-4"
                      style={{
                        backgroundImage: `linear-gradient(to right, #3B82F6 ${
                          maxDuration > 1 ? (startSec / (maxDuration - 1)) * 100 : 0
                        }%, rgba(186,230,253,0.16) ${
                          maxDuration > 1 ? (startSec / (maxDuration - 1)) * 100 : 0
                        }%)`,
                        backgroundSize: '100% 4px',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div className="flex items-center justify-between gap-1.5">
                      {[-5, -1, 1, 5].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => updateStart(startSec + delta)}
                          className="flex-1 py-1 rounded-md bg-[#13203B]/70 hover:bg-[#1A2B4E] text-[11px] font-mono tabular-nums text-[#CBD5E1] cursor-pointer"
                        >
                          {delta > 0 ? `+${delta}s` : `${delta}s`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl bg-[#0B1324] border border-sky-200/[0.08] p-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-[#8CA1C4]">
                        끝 (B) ·{' '}
                        <span className="font-mono tabular-nums text-[#EEF4FF]">
                          {formatTime(endSec)}
                        </span>
                      </label>
                      {isSamePlayingTrack && (
                        <button
                          type="button"
                          onClick={() => updateEnd(activePlaybackTime)}
                          className="text-[11px] font-medium text-[#60A5FA] hover:underline cursor-pointer"
                        >
                          현재 위치 ({formatTime(activePlaybackTime)})
                        </button>
                      )}
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={maxDuration}
                      value={endSec}
                      onChange={(e) => updateEnd(Number(e.target.value))}
                      className="velo-range w-full h-4"
                      style={{
                        backgroundImage: `linear-gradient(to right, #3B82F6 ${
                          maxDuration > 0 ? (endSec / maxDuration) * 100 : 0
                        }%, rgba(186,230,253,0.16) ${
                          maxDuration > 0 ? (endSec / maxDuration) * 100 : 0
                        }%)`,
                        backgroundSize: '100% 4px',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div className="flex items-center justify-between gap-1.5">
                      {[-5, -1, 1, 5].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => updateEnd(endSec + delta)}
                          className="flex-1 py-1 rounded-md bg-[#13203B]/70 hover:bg-[#1A2B4E] text-[11px] font-mono tabular-nums text-[#CBD5E1] cursor-pointer"
                        >
                          {delta > 0 ? `+${delta}s` : `${delta}s`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Mode 2: Direct Keyboard Typing Input Mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 rounded-xl bg-[#0B1324] border border-sky-200/[0.08] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="trim-typing-start"
                          className="text-xs font-medium text-[#CBD5E1]"
                        >
                          시작 시간 직접 입력 (A)
                        </label>
                        {isSamePlayingTrack && (
                          <button
                            type="button"
                            onClick={() => {
                              const pos = Math.max(
                                0,
                                Math.min(maxDuration - 1, Math.floor(activePlaybackTime)),
                              );
                              setStartSec(pos);
                              setStartText(formatTime(pos));
                            }}
                            className="text-[11px] font-medium text-[#60A5FA] hover:underline cursor-pointer"
                          >
                            현재 ({formatTime(activePlaybackTime)})
                          </button>
                        )}
                      </div>
                      <input
                        id="trim-typing-start"
                        type="text"
                        inputMode="text"
                        value={startText}
                        onChange={(e) => handleTypingStartChange(e.target.value)}
                        placeholder="예: 0:45, 45, 1분20초"
                        className={`w-full rounded-lg bg-[#050914] border px-3 py-2 text-sm font-mono tabular-nums text-[#EEF4FF] placeholder-[#5B7196] focus:outline-none ${
                          parsedStartResult.error
                            ? 'border-red-400'
                            : 'border-sky-200/15 focus:border-[#3B82F6]'
                        }`}
                      />
                      {parsedStartResult.error ? (
                        <p className="text-[11px] text-[#FCA5A5]">{parsedStartResult.error}</p>
                      ) : (
                        <p className="text-[11px] text-[#8CA1C4] font-mono tabular-nums">
                          인식된 시작점: {formatTime(parsedStartResult.seconds ?? startSec)} (
                          {parsedStartResult.seconds ?? startSec}초)
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 rounded-xl bg-[#0B1324] border border-sky-200/[0.08] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="trim-typing-end"
                          className="text-xs font-medium text-[#CBD5E1]"
                        >
                          끝 시간 직접 입력 (B)
                        </label>
                        {isSamePlayingTrack && (
                          <button
                            type="button"
                            onClick={() => {
                              const pos = Math.max(
                                visualStart + 1,
                                Math.min(maxDuration, Math.floor(activePlaybackTime)),
                              );
                              setEndSec(pos);
                              setEndText(formatTime(pos));
                            }}
                            className="text-[11px] font-medium text-[#60A5FA] hover:underline cursor-pointer"
                          >
                            현재 ({formatTime(activePlaybackTime)})
                          </button>
                        )}
                      </div>
                      <input
                        id="trim-typing-end"
                        type="text"
                        inputMode="text"
                        value={endText}
                        onChange={(e) => handleTypingEndChange(e.target.value)}
                        placeholder="예: 1:30, 90, 2분10초"
                        className={`w-full rounded-lg bg-[#050914] border px-3 py-2 text-sm font-mono tabular-nums text-[#EEF4FF] placeholder-[#5B7196] focus:outline-none ${
                          parsedEndResult.error || typingOrderInvalid
                            ? 'border-red-400'
                            : 'border-sky-200/15 focus:border-[#3B82F6]'
                        }`}
                      />
                      {parsedEndResult.error ? (
                        <p className="text-[11px] text-[#FCA5A5]">{parsedEndResult.error}</p>
                      ) : typingOrderInvalid ? (
                        <p className="text-[11px] text-[#FCA5A5]">
                          끝 시간은 시작 시간({formatTime(effectiveStart)})보다 뒤여야 합니다.
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#8CA1C4] font-mono tabular-nums">
                          인식된 종료점: {formatTime(parsedEndResult.seconds ?? endSec)} (
                          {parsedEndResult.seconds ?? endSec}초)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8CA1C4]">
                    <span>지원 형식: 분:초(1:25) · 시:분:초 · 초(85) · 한글(1분 25초)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyClipDurationPreset(15)}
                        className="px-2 py-1 rounded-md bg-[#13203B] hover:bg-[#1A2B4E] text-[#CBD5E1] cursor-pointer"
                      >
                        +15초
                      </button>
                      <button
                        type="button"
                        onClick={() => applyClipDurationPreset(30)}
                        className="px-2 py-1 rounded-md bg-[#13203B] hover:bg-[#1A2B4E] text-[#CBD5E1] cursor-pointer"
                      >
                        +30초
                      </button>
                      <button
                        type="button"
                        onClick={() => applyClipDurationPreset(60)}
                        className="px-2 py-1 rounded-md bg-[#13203B] hover:bg-[#1A2B4E] text-[#CBD5E1] cursor-pointer"
                      >
                        +1분
                      </button>
                      <button
                        type="button"
                        onClick={() => applyClipDurationPreset('full')}
                        className="px-2 py-1 rounded-md bg-[#13203B] hover:bg-[#1A2B4E] text-[#CBD5E1] cursor-pointer"
                      >
                        끝까지
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-[#8CA1C4] mb-1.5">구간 이름 (선택)</label>
                <input
                  type="text"
                  maxLength={80}
                  value={clipLabel}
                  onChange={(e) => setClipLabel(e.target.value)}
                  placeholder="예: 후렴구, 기타 솔로, 1절 하이라이트"
                  className="w-full rounded-lg bg-[#0B1324] border border-sky-200/12 px-3 py-2 text-xs text-[#EEF4FF] placeholder-[#5B7196] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoSaveFull}
                  onChange={(e) => setAlsoSaveFull(e.target.checked)}
                  className="w-4 h-4 accent-[#2563EB] rounded"
                />
                <span className="text-xs font-medium text-[#EEF4FF]">
                  전체 곡도 동시에 함께 등록하기
                </span>
              </label>
            </div>
          )}

          {/* Destination selection */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[#8CA1C4]">
              저장 위치 선택 · 같은 곡도 여러 번 중복 등록 가능
            </p>

            <label className="flex items-center justify-between rounded-xl bg-[#050914] border border-sky-200/[0.08] px-3.5 py-2.5 cursor-pointer">
              <span className="text-sm text-[#EEF4FF]">좋아요 보관함에 저장</span>
              <input
                type="checkbox"
                checked={saveToLiked}
                onChange={(e) => setSaveToLiked(e.target.checked)}
                className="w-4 h-4 accent-[#2563EB]"
              />
            </label>

            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {playlists.map((pl) => {
                const selected = selectedPlaylistIds.includes(pl.id);
                const existingCount = pl.tracks.filter((t) => t.id === track.id).length;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleTogglePlaylist(pl.id)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#2563EB]/15 border-[#3B82F6]/55 text-[#EEF4FF]'
                        : 'bg-[#050914] border-sky-200/[0.08] text-[#CBD5E1] hover:border-sky-200/20'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-sm font-medium truncate">{pl.name}</p>
                      <p className="text-[11px] text-[#8CA1C4] font-mono tabular-nums">
                        {pl.tracks.length}곡
                        {existingCount > 0 ? ` · 현재 곡 ${existingCount}회 등록됨` : ''}
                      </p>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        selected ? 'bg-[#2563EB] text-white' : 'border border-sky-200/25'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Inline new playlist creator */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newPlName}
                onChange={(e) => setNewPlName(e.target.value)}
                placeholder="새 플레이리스트 이름으로 바로 추가..."
                className="flex-1 rounded-lg bg-[#050914] border border-sky-200/12 px-3 py-2 text-xs text-[#EEF4FF] placeholder-[#5B7196] focus:outline-none focus:border-[#3B82F6]"
              />
              <button
                type="button"
                disabled={!newPlName.trim() || isCreatingPl}
                onClick={handleCreateInlinePlaylist}
                className="px-3 py-2 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] disabled:opacity-40 text-xs font-medium text-[#EEF4FF] flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>만들기</span>
              </button>
            </div>
          </div>

          {errorMsg && <p className="text-xs text-[#FCA5A5]">{errorMsg}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 rounded-xl bg-[#13203B] hover:bg-[#1A2B4E] text-sm font-medium text-[#CBD5E1] cursor-pointer"
            >
              {isImportFlow ? '건너뛰기' : '취소'}
            </button>
            <button
              type="submit"
              disabled={isSaving || (useTrim && hasTypingError)}
              className="min-h-[42px] px-5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-sm font-medium text-white cursor-pointer"
            >
              {isSaving
                ? '저장 중...'
                : useTrim && alsoSaveFull
                  ? '구간 + 전체 곡 등록'
                  : useTrim
                    ? '선택 구간 등록'
                    : '전체 곡 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
