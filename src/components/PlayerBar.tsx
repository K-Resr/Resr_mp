import React, {useRef, useState} from 'react';
import {
  ChevronUp,
  Headphones,
  Heart,
  ListMusic,
  Maximize2,
  Monitor,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Scissors,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {RepeatMode, Track, VideoSurfaceMode} from '../types/music';
import {formatTime} from '../utils/formatTime';
import {TrackThumbnail} from './TrackThumbnail';

interface PlayerBarProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  canShuffle: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  abLoopEnabled: boolean;
  abStart: number;
  abEnd: number;
  videoMode: VideoSurfaceMode;
  backgroundKeepAlive: boolean;
  isLiked: boolean;
  queueCount: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onSetAbStart: () => void;
  onSetAbEnd: () => void;
  onToggleAbLoop: () => void;
  onResetAbLoop: () => void;
  onSaveCurrentClip: () => void;
  onCycleVideoMode: () => void;
  onToggleBackgroundKeepAlive: () => void;
  onToggleLike: () => void;
  onToggleQueue: () => void;
  onOpenMobilePlayer: () => void;
  onDismiss: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  canShuffle,
  isShuffle,
  repeatMode,
  abLoopEnabled,
  abStart,
  abEnd,
  videoMode,
  backgroundKeepAlive,
  isLiked,
  queueCount,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onSetAbStart,
  onSetAbEnd,
  onToggleAbLoop,
  onResetAbLoop,
  onSaveCurrentClip,
  onCycleVideoMode,
  onToggleBackgroundKeepAlive,
  onToggleLike,
  onToggleQueue,
  onOpenMobilePlayer,
  onDismiss,
}) => {
  const [abPanelOpen, setAbPanelOpen] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  // Hide the player bar completely when no song is active so the screen has more room
  if (!track) {
    return null;
  }

  const safeDuration = duration > 0 ? duration : track.durationSeconds || 0;
  const progressPct = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  const hasValidAb = abEnd > abStart;
  const abStartPct =
    safeDuration > 0 && hasValidAb ? Math.min(100, (abStart / safeDuration) * 100) : 0;
  const abWidthPct =
    safeDuration > 0 && hasValidAb
      ? Math.max(1, Math.min(100 - abStartPct, ((abEnd - abStart) / safeDuration) * 100))
      : 0;

  const repeatLabel =
    repeatMode === 'one'
      ? '한 곡 반복'
      : repeatMode === 'all'
        ? '전체 반복'
        : '반복 끔';

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT') return;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (touchStartYRef.current === null) return;
    const delta = e.touches[0].clientY - touchStartYRef.current;
    if (delta < 0) {
      // Dragging UP -> preview opening full-screen Now Playing screen
      setDragOffsetY(Math.max(-56, delta * 0.65));
    } else if (delta > 0) {
      // Dragging DOWN -> preview dismissing bar
      setDragOffsetY(Math.min(80, delta));
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY < -24) {
      setDragOffsetY(0);
      touchStartYRef.current = null;
      onOpenMobilePlayer();
      return;
    }
    if (dragOffsetY > 48) {
      setDragOffsetY(0);
      touchStartYRef.current = null;
      onDismiss();
      return;
    }
    setDragOffsetY(0);
    touchStartYRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (e.deltaY < -40) {
      onOpenMobilePlayer();
    } else if (e.deltaY > 55) {
      onDismiss();
    }
  };

  return (
    <footer
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      style={{
        transform: dragOffsetY !== 0 ? `translateY(${dragOffsetY}px)` : undefined,
        opacity: dragOffsetY > 0 ? Math.max(0.35, 1 - dragOffsetY / 100) : 1,
      }}
      title="위로 올리거나 곡 정보를 누르면 전체 플레이어 화면이 열립니다"
      className="fixed bottom-14 lg:bottom-0 left-0 right-0 z-30 bg-[#0B1324]/88 backdrop-blur-md border-t border-sky-200/10 transition-[transform,opacity] duration-150"
    >
      {/* Subtle pull-up handle indicator on mobile */}
      <button
        type="button"
        onClick={onOpenMobilePlayer}
        aria-label="전체 화면 플레이어 위로 열기"
        className="lg:hidden w-full flex justify-center pt-1.5 pb-0.5 cursor-pointer"
      >
        <div className="w-9 h-1 rounded-full bg-sky-200/30" />
      </button>

      {/* Expandable A-B Segment Loop Control Strip */}
      {(abPanelOpen || abLoopEnabled) && (
        <div className="border-b border-sky-200/[0.08] bg-[#070D1C]/95 px-4 sm:px-6 py-2 max-h-40 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[#8CA1C4]">한 곡 구간 반복</span>
              <button
                type="button"
                onClick={onSetAbStart}
                className="px-2.5 py-1 rounded-md bg-[#13203B] hover:bg-[#1A2B4E] text-[#EEF4FF] font-mono tabular-nums cursor-pointer"
              >
                A 시작 지정 ({formatTime(abStart)})
              </button>
              <button
                type="button"
                onClick={onSetAbEnd}
                className="px-2.5 py-1 rounded-md bg-[#13203B] hover:bg-[#1A2B4E] text-[#EEF4FF] font-mono tabular-nums cursor-pointer"
              >
                B 끝 지정 ({formatTime(abEnd)})
              </button>
              <button
                type="button"
                onClick={onToggleAbLoop}
                disabled={!hasValidAb}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                  abLoopEnabled
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#13203B] text-[#CBD5E1] hover:bg-[#1A2B4E]'
                }`}
              >
                {abLoopEnabled ? '구간 반복 켜짐' : '구간 반복 시작'}
              </button>
              {hasValidAb && (
                <button
                  type="button"
                  onClick={onResetAbLoop}
                  className="px-2.5 py-1 rounded-md text-[#8CA1C4] hover:text-[#EEF4FF] cursor-pointer"
                >
                  초기화
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSaveCurrentClip}
                className="px-3 py-1 rounded-md bg-[#13203B] hover:bg-[#1A2B4E] text-[#60A5FA] font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>이 구간 잘라서 저장</span>
              </button>
              {!abLoopEnabled && (
                <button
                  type="button"
                  onClick={() => setAbPanelOpen(false)}
                  className="px-2 py-1 text-[#8CA1C4] hover:text-[#EEF4FF] cursor-pointer"
                >
                  접기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile compact progress edge */}
      <div className="lg:hidden h-0.5 w-full bg-sky-200/10">
        <div
          className="h-full bg-[#3B82F6] transition-[width] duration-200"
          style={{width: `${progressPct}%`}}
        />
      </div>

      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-16 lg:h-20 flex items-center justify-between gap-2 sm:gap-6">
        {/* Left: Current track */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 lg:flex-none lg:w-72">
          <button
            type="button"
            onClick={onOpenMobilePlayer}
            aria-label="전체 플레이어 화면 열기"
            className="group flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 text-left cursor-pointer rounded-xl py-1 pr-1 hover:bg-white/[0.04] transition-colors"
          >
            <TrackThumbnail
              src={track.thumbnail}
              alt={track.title}
              isLocal={track.source === 'local' || track.id.startsWith('local_')}
              className="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#EEF4FF] truncate group-hover:text-white">
                {track.title}
              </p>
              <p className="text-xs text-[#8CA1C4] truncate">
                {track.channel}
                {typeof track.startSeconds === 'number' && typeof track.endSeconds === 'number'
                  ? ` · 구간 ${formatTime(track.startSeconds)}–${formatTime(track.endSeconds)}`
                  : ''}
              </p>
            </div>
            <ChevronUp className="w-4 h-4 text-[#8CA1C4] group-hover:text-[#60A5FA] shrink-0 transition-transform group-hover:-translate-y-0.5" />
          </button>
          <button
            type="button"
            onClick={onToggleLike}
            aria-label={isLiked ? '좋아요 취소' : '좋아요'}
            className={`hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isLiked ? 'text-[#60A5FA]' : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#60A5FA]' : ''}`} />
          </button>
        </div>

        {/* Center: Transport & Scrubber */}
        <div className="flex items-center lg:flex-col lg:flex-1 lg:max-w-xl gap-1">
          <div className="flex items-center gap-0.5 sm:gap-2">
            {canShuffle && (
              <button
                type="button"
                onClick={onToggleShuffle}
                aria-label={isShuffle ? '플레이리스트 랜덤 셔플 켜짐' : '플레이리스트 랜덤 셔플 꺼짐'}
                title={isShuffle ? '플레이리스트 랜덤 셔플 켜짐' : '플레이리스트 랜덤 셔플 꺼짐'}
                className={`hidden sm:flex min-h-[38px] px-2.5 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isShuffle
                    ? 'bg-[#2563EB]/20 text-[#60A5FA]'
                    : 'text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70'
                }`}
              >
                <Shuffle className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline">셔플</span>
              </button>
            )}

            <button
              type="button"
              onClick={onPrev}
              aria-label="이전 곡"
              className="min-h-[40px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-lg text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? '일시 정지' : '재생'}
              className="w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center transition-transform active:scale-95 shrink-0 cursor-pointer shadow-lg shadow-[#2563EB]/25"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              aria-label="다음 곡"
              className="min-h-[40px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-lg text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onCycleRepeat}
              aria-label={repeatLabel}
              title={`반복 모드: ${repeatLabel}`}
              className={`hidden sm:flex min-h-[38px] px-2.5 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                repeatMode !== 'off'
                  ? 'bg-[#2563EB]/20 text-[#60A5FA]'
                  : 'text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4 shrink-0" />
              ) : (
                <Repeat className="w-4 h-4 shrink-0" />
              )}
              <span className="hidden xl:inline">{repeatLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => setAbPanelOpen((v) => !v)}
              title="구간 반복(A-B) 및 자르기 저장"
              className={`hidden sm:flex min-h-[38px] px-2.5 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                abLoopEnabled || abPanelOpen
                  ? 'bg-[#2563EB]/20 text-[#60A5FA]'
                  : 'text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">구간</span>
            </button>

            {/* Mobile Dismiss X button */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="노래 끄고 바 닫기"
              title="노래 끄기"
              className="md:hidden min-h-[40px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 w-full">
            <span className="w-11 text-right text-[11px] font-mono tabular-nums text-[#8CA1C4]">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 flex items-center">
              {hasValidAb && (
                <div
                  className="pointer-events-none absolute h-1.5 rounded-full bg-cyan-400/45"
                  style={{left: `${abStartPct}%`, width: `${abWidthPct}%`}}
                />
              )}
              <input
                type="range"
                min={0}
                max={safeDuration || 100}
                step={1}
                value={Math.min(currentTime, safeDuration || 100)}
                disabled={safeDuration <= 0}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="재생 위치"
                className="velo-range relative z-10 w-full h-4"
                style={{
                  backgroundImage: `linear-gradient(to right, #3B82F6 ${progressPct}%, rgba(186,230,253,0.14) ${progressPct}%)`,
                  backgroundSize: '100% 4px',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
              />
            </div>
            <span className="w-11 text-[11px] font-mono tabular-nums text-[#8CA1C4]">
              {formatTime(safeDuration)}
            </span>
          </div>
        </div>

        {/* Right: Background Keep-Alive, Video Surface, Queue, Volume, Dismiss */}
        <div className="hidden md:flex items-center justify-end gap-1 lg:w-80 shrink-0">
          <button
            type="button"
            onClick={onToggleBackgroundKeepAlive}
            title={backgroundKeepAlive ? '백그라운드 오디오 유지 켜짐' : '백그라운드 오디오 유지 꺼짐'}
            aria-label="백그라운드 오디오 유지 전환"
            className={`min-h-[40px] px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              backgroundKeepAlive
                ? 'bg-[#2563EB]/20 text-[#60A5FA]'
                : 'text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70'
            }`}
          >
            <Headphones className="w-4 h-4 shrink-0" />
            <span className="hidden xl:inline">백그라운드</span>
          </button>

          <button
            type="button"
            onClick={onCycleVideoMode}
            title="영상 화면 크기 전환 (작은 창 / 중간 창 / 크게 보기)"
            aria-label="영상 화면 전환"
            className={`min-h-[40px] min-w-[38px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              videoMode !== 'audio'
                ? 'bg-[#13203B] text-[#EEF4FF]'
                : 'text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70'
            }`}
          >
            {videoMode === 'theater' ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Monitor className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleQueue}
            aria-label="재생 대기열 열기"
            title="재생 대기열"
            className="min-h-[40px] px-2 flex items-center gap-1.5 rounded-lg text-xs font-mono tabular-nums text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
          >
            <ListMusic className="w-4 h-4" />
            <span>{queueCount}</span>
          </button>

          <div className="flex items-center gap-1.5 pl-0.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? '음소거 해제' : '음소거'}
              title={isMuted ? '음소거 해제' : `음소거 (현재 ${volume}%)`}
              className="min-h-[40px] min-w-[34px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] transition-colors cursor-pointer"
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
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="앱 음량"
              className="velo-range w-16 lg:w-20 h-4"
              style={{
                backgroundImage: `linear-gradient(to right, #3B82F6 ${isMuted ? 0 : volume}%, rgba(186,230,253,0.16) ${isMuted ? 0 : volume}%)`,
                backgroundSize: '100% 4px',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
            />
            <span className="hidden xl:inline-block w-8 text-right text-[11px] font-mono tabular-nums text-[#8CA1C4]">
              {isMuted ? 0 : volume}%
            </span>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="노래 끄고 바 닫기"
            title="노래 끄기 (아래로 스크롤해도 닫힙니다)"
            className="min-h-[40px] min-w-[38px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};
