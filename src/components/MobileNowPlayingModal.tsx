import React, {useCallback, useRef, useState} from 'react';
import {
  Check,
  ChevronDown,
  Headphones,
  Heart,
  ListMusic,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Scissors,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {RepeatMode, Track} from '../types/music';
import {formatTime} from '../utils/formatTime';
import {TrackThumbnail} from './TrackThumbnail';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  canShuffle: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  abLoopEnabled: boolean;
  abStart: number;
  abEnd: number;
  backgroundKeepAlive: boolean;
  isLiked: boolean;
  volume: number;
  isMuted: boolean;
  onClose: () => void;
  onDismiss: () => void;
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
  onSaveCurrentClip: () => void;
  onToggleBackgroundKeepAlive: () => void;
  onToggleLike: () => void;
  onOpenQueue: () => void;
}

const RING_SIZE = 280;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = 128;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const MobileNowPlayingModal: React.FC<MobileNowPlayingModalProps> = ({
  isOpen,
  track,
  isPlaying,
  currentTime,
  duration,
  canShuffle,
  isShuffle,
  repeatMode,
  abLoopEnabled,
  abStart,
  abEnd,
  backgroundKeepAlive,
  isLiked,
  volume,
  isMuted,
  onClose,
  onDismiss,
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
  onSaveCurrentClip,
  onToggleBackgroundKeepAlive,
  onToggleLike,
  onOpenQueue,
}) => {
  const [controlsSheetOpen, setControlsSheetOpen] = useState(false);
  const [swipeDownOffset, setSwipeDownOffset] = useState(0);
  const [isScrubbingRing, setIsScrubbingRing] = useState(false);
  const swipeStartYRef = useRef<number | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  const safeDuration = duration > 0 ? duration : track?.durationSeconds || 0;
  const progressFraction =
    safeDuration > 0 ? Math.max(0, Math.min(1, currentTime / safeDuration)) : 0;

  const seekFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!ringRef.current || safeDuration <= 0) return;
      const rect = ringRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      // Angle starting at 12 o'clock (0..2π clockwise)
      let angle = Math.atan2(dx, -dy);
      if (angle < 0) angle += 2 * Math.PI;
      const frac = Math.max(0, Math.min(1, angle / (2 * Math.PI)));
      onSeek(Math.round(frac * safeDuration));
    },
    [onSeek, safeDuration],
  );

  if (!isOpen || !track) return null;

  const isLocal = track.source === 'local' || track.id.startsWith('local_');
  const artworkUrl = isLocal ? '' : `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;

  const repeatLabel =
    repeatMode === 'one'
      ? '한 곡 반복'
      : repeatMode === 'all'
        ? '전체 반복'
        : '반복 끔';

  // Compute thumb coordinates on SVG circle (12 o'clock = -90 deg)
  const thumbAngleRad = progressFraction * 2 * Math.PI - Math.PI / 2;
  const thumbX = RING_CENTER + RING_RADIUS * Math.cos(thumbAngleRad);
  const thumbY = RING_CENTER + RING_RADIUS * Math.sin(thumbAngleRad);
  const dashOffset = RING_CIRCUMFERENCE * (1 - progressFraction);

  const handleHeaderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    swipeStartYRef.current = e.touches[0].clientY;
  };

  const handleHeaderTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (swipeStartYRef.current === null) return;
    const delta = e.touches[0].clientY - swipeStartYRef.current;
    if (delta > 0) {
      setSwipeDownOffset(Math.min(140, delta * 0.75));
    }
  };

  const handleHeaderTouchEnd = () => {
    if (swipeDownOffset > 52) {
      setSwipeDownOffset(0);
      swipeStartYRef.current = null;
      onClose();
      return;
    }
    setSwipeDownOffset(0);
    swipeStartYRef.current = null;
  };

  return (
    <div
      style={{
        transform: swipeDownOffset > 0 ? `translateY(${swipeDownOffset}px)` : undefined,
        opacity: swipeDownOffset > 0 ? Math.max(0.45, 1 - swipeDownOffset / 220) : 1,
      }}
      className="fixed inset-0 z-50 bg-[#050914] flex flex-col overflow-hidden transition-[transform,opacity] duration-150"
    >
      {/* Atmospheric blurred album art + starry night backdrop */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover scale-125 blur-3xl opacity-[0.28]"
          />
        ) : (
          <img
            src="/src/assets/images/app_starry_backdrop_1795390659040.jpg"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-[0.3]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050914]/82 via-[#070E20]/78 to-[#040812]/96" />
      </div>

      {/* Top Header (Swipe down to collapse) */}
      <header
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        className="relative z-10 shrink-0 px-4 pt-4 pb-2 flex items-center justify-between gap-3"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="플레이어 아래로 접기"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#CBD5E1] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5 min-w-0">
            <Music2 className="w-3.5 h-3.5 text-[#8CA1C4] shrink-0" />
            <h2 className="text-sm sm:text-base font-semibold text-[#EEF4FF] truncate">
              {track.title}
            </h2>
          </div>
          <p className="text-xs text-[#60A5FA] font-medium truncate mt-0.5">
            {track.channel}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSaveCurrentClip();
            }}
            aria-label="구간 잘라서 저장"
            title="구간 잘라서 저장"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#CBD5E1] hover:text-[#60A5FA] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <Scissors className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="노래 끄고 닫기"
            title="노래 끄기"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#CBD5E1] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Stage */}
      <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain flex flex-col items-center justify-between px-5 pt-2 pb-4 max-w-2xl w-full mx-auto">
        {/* Center Circular Artwork + Scrubbable Progress Ring */}
        <div className="flex-1 flex flex-col items-center justify-center w-full py-2">
          <div className="mb-3 flex items-center gap-2 text-xs font-mono tabular-nums text-[#CBD5E1]">
            <span className="text-[#60A5FA] font-semibold">{formatTime(currentTime)}</span>
            <span aria-hidden="true" className="text-[#5B7196]">
              ·
            </span>
            <span>{formatTime(safeDuration)}</span>
          </div>

          <div
            ref={ringRef}
            onPointerDown={(e) => {
              if (safeDuration <= 0) return;
              // Only start ring drag if pointer is near outer ring or intentionally dragging
              setIsScrubbingRing(true);
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              seekFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!isScrubbingRing) return;
              seekFromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={() => setIsScrubbingRing(false)}
            onPointerCancel={() => setIsScrubbingRing(false)}
            className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center touch-none select-none cursor-pointer"
            role="slider"
            aria-label="원형 재생 위치 조절"
            aria-valuemin={0}
            aria-valuemax={Math.max(1, Math.round(safeDuration))}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') onSeek(Math.min(safeDuration, currentTime + 5));
              if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
            }}
          >
            {/* Circular SVG Track & Glowing Thumb */}
            <svg
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="rgba(186, 230, 253, 0.16)"
                strokeWidth="3"
              />
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
              />
              {safeDuration > 0 && (
                <circle
                  cx={thumbX}
                  cy={thumbY}
                  r="6"
                  fill="#60A5FA"
                  stroke="#EEF4FF"
                  strokeWidth="2"
                />
              )}
            </svg>

            {/* Circular Rotating Artwork */}
            <div
              className={`w-[78%] h-[78%] rounded-full overflow-hidden border border-sky-200/20 shadow-2xl shadow-black/60 pointer-events-none ${
                isPlaying ? 'motion-safe:animate-[spin_30s_linear_infinite]' : ''
              }`}
              style={{
                animationPlayState: isPlaying ? 'running' : 'paused',
              }}
            >
              <TrackThumbnail
                src={artworkUrl}
                isLocal={isLocal}
                alt={track.title}
                className="w-full h-full rounded-full"
              />
            </div>
          </div>

          {/* Repeat · Like · Shuffle strip */}
          <div className="mt-6 flex items-center justify-center gap-8 sm:gap-12">
            <button
              type="button"
              onClick={onCycleRepeat}
              aria-label={repeatLabel}
              title={repeatLabel}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                repeatMode !== 'off'
                  ? 'text-[#60A5FA]'
                  : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleLike}
              aria-label={isLiked ? '좋아요 취소' : '좋아요'}
              className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
                isLiked ? 'text-[#60A5FA]' : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
              }`}
            >
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-[#60A5FA]' : ''}`} />
              <span className="text-[11px] font-medium">
                {isLiked ? '좋아요됨' : '좋아요'}
              </span>
            </button>

            {canShuffle ? (
              <button
                type="button"
                onClick={onToggleShuffle}
                aria-label="랜덤 셔플"
                title={isShuffle ? '셔플 켜짐' : '셔플 꺼짐'}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                  isShuffle
                    ? 'text-[#60A5FA]'
                    : 'text-[#8CA1C4] hover:text-[#EEF4FF]'
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSaveCurrentClip();
                }}
                aria-label="구간 잘라서 저장"
                title="구간 잘라서 저장"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#8CA1C4] hover:text-[#EEF4FF] transition-colors cursor-pointer"
              >
                <Scissors className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Centered Track Info */}
          <div className="mt-4 text-center max-w-md px-2">
            <p className="text-sm sm:text-base font-semibold text-[#60A5FA] truncate">
              {track.title} - {track.channel}
            </p>
            <p className="mt-1 text-xs text-[#8CA1C4] truncate">
              {abLoopEnabled && abEnd > abStart
                ? `한 곡 구간 반복 중 · ${formatTime(abStart)}–${formatTime(abEnd)}`
                : typeof track.startSeconds === 'number' && typeof track.endSeconds === 'number'
                  ? `저장된 클립 구간 · ${formatTime(track.startSeconds)}–${formatTime(track.endSeconds)}`
                  : backgroundKeepAlive
                    ? '화면 꺼짐 · 백그라운드 오디오 유지 활성화됨'
                    : '원형 테두리를 드래그해 재생 위치를 조절할 수 있습니다'}
            </p>
          </div>
        </div>

        {/* Expandable Bottom Controls Drawer (Volume, A-B Loop, Background Keep-Alive) */}
        {controlsSheetOpen && (
          <div className="w-full mb-3 rounded-2xl border border-sky-200/12 bg-[#0B1324]/92 backdrop-blur-md p-3.5 space-y-2.5 shadow-2xl">
            {/* Background Audio Mode Row */}
            <button
              type="button"
              onClick={onToggleBackgroundKeepAlive}
              className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                backgroundKeepAlive
                  ? 'border-[#3B82F6]/45 bg-[#13203B] text-[#EEF4FF]'
                  : 'border-sky-200/10 bg-[#070D1C]/80 text-[#8CA1C4]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[#60A5FA]" />
                <span>백그라운드 · 화면 꺼짐 재생 유지</span>
              </span>
              {backgroundKeepAlive ? (
                <Check className="w-4 h-4 text-[#60A5FA]" />
              ) : (
                <span className="text-xs text-[#5B7196]">꺼짐</span>
              )}
            </button>

            {/* A-B Segment Loop Quick Strip */}
            <div className="rounded-xl border border-sky-200/10 bg-[#070D1C]/80 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#8CA1C4]">한 곡 구간 반복 (A-B)</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSaveCurrentClip();
                  }}
                  className="text-[#60A5FA] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>구간 잘라서 저장</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={onSetAbStart}
                  className="min-h-[38px] rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-xs font-mono tabular-nums text-[#EEF4FF] cursor-pointer"
                >
                  A {formatTime(abStart)}
                </button>
                <button
                  type="button"
                  onClick={onSetAbEnd}
                  className="min-h-[38px] rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-xs font-mono tabular-nums text-[#EEF4FF] cursor-pointer"
                >
                  B {formatTime(abEnd)}
                </button>
                <button
                  type="button"
                  disabled={abEnd <= abStart}
                  onClick={onToggleAbLoop}
                  className={`min-h-[38px] rounded-lg text-xs font-medium disabled:opacity-40 cursor-pointer ${
                    abLoopEnabled
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#13203B] text-[#CBD5E1] hover:bg-[#1A2B4E]'
                  }`}
                >
                  {abLoopEnabled ? '반복 켜짐' : '반복 시작'}
                </button>
              </div>
            </div>

            {/* App Volume Slider (- ... +) */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? '음소거 해제' : '음소거'}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#CBD5E1] hover:text-white cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#60A5FA]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onVolumeChange(Math.max(0, (isMuted ? 0 : volume) - 10))}
                aria-label="음량 줄이기"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-white cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                aria-label="앱 음량 조절"
                className="velo-range flex-1 h-5"
                style={{
                  backgroundImage: `linear-gradient(to right, #3B82F6 ${isMuted ? 0 : volume}%, rgba(186,230,253,0.18) ${isMuted ? 0 : volume}%)`,
                  backgroundSize: '100% 4px',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
              />
              <button
                type="button"
                onClick={() => onVolumeChange(Math.min(100, (isMuted ? 0 : volume) + 10))}
                aria-label="음량 높이기"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <span className="w-9 text-right text-xs font-mono tabular-nums text-[#8CA1C4]">
                {isMuted ? 0 : volume}%
              </span>
            </div>
          </div>
        )}

        {/* Bottom Transport Row (Queue · Prev · Play/Pause · Next · Controls Sheet) */}
        <div className="w-full pt-2 pb-2 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQueue();
            }}
            aria-label="재생 대기열 열기"
            title="재생 대기열"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-[#CBD5E1] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <ListMusic className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onPrev}
            aria-label="이전 곡"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full text-[#EEF4FF] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? '일시 정지' : '재생'}
            className="w-16 h-16 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-lg shadow-[#2563EB]/35 active:scale-95 transition-transform cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-white" />
            ) : (
              <Play className="w-7 h-7 fill-white ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            aria-label="다음 곡"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full text-[#EEF4FF] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => setControlsSheetOpen((v) => !v)}
            aria-label="음량 · 구간 반복 · 백그라운드 설정 열기"
            title="음량 및 재생 설정"
            className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              controlsSheetOpen
                ? 'text-[#60A5FA] bg-[#2563EB]/15'
                : 'text-[#CBD5E1] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
