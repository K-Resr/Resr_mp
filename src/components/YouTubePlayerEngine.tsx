import {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {getLocalAudioBlob} from '../services/localAudioStore';
import type {VideoSurfaceMode} from '../types/music';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId?: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: {target: YTPlayerInstance}) => void;
            onStateChange?: (e: {data: number; target: YTPlayerInstance}) => void;
            onError?: (e: {data: number}) => void;
          };
        },
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  loadVideoById: (
    arg: string | {videoId: string; startSeconds?: number; endSeconds?: number},
  ) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo?: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted?: () => boolean;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe?: () => HTMLIFrameElement;
  destroy: () => void;
}

export interface YouTubeEngineHandle {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  getPlayerState: () => number;
  tickWatchdog: () => void;
}

interface YouTubePlayerEngineProps {
  videoId: string | null;
  trackSource?: 'youtube' | 'local';
  ownerScope: string;
  activeEntryKey: string | null;
  prefetchVideoIds?: string[];
  clipStart?: number;
  clipEnd?: number;
  abLoopEnabled: boolean;
  abStart: number;
  abEnd: number;
  videoMode: VideoSurfaceMode;
  volume: number;
  isMuted: boolean;
  backgroundKeepAlive: boolean;
  userPausedRef: React.MutableRefObject<boolean>;
  onAudioModeChange?: (mode: 'native-audio' | 'iframe') => void;
  onPlayingChange: (playing: boolean) => void;
  onProgress: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onError: (code: number) => void;
  onCloseTheater: () => void;
}

let ytApiPromise: Promise<void> | null = null;
const streamCapabilityCache = new Map<string, boolean>();

function loadYouTubeIframeAPI(): Promise<void> {
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      resolve();
    };
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    } else {
      const checkTimer = window.setInterval(() => {
        if (window.YT && window.YT.Player) {
          window.clearInterval(checkTimer);
          resolve();
        }
      }, 80);
    }
  });
  return ytApiPromise;
}

async function checkYouTubeDirectStream(videoId: string, timeoutMs = 1400): Promise<boolean> {
  if (streamCapabilityCache.has(videoId)) {
    return Boolean(streamCapabilityCache.get(videoId));
  }
  try {
    const res = await fetch(`/api/youtube/audio-info?v=${encodeURIComponent(videoId)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      streamCapabilityCache.set(videoId, false);
      return false;
    }
    const data = (await res.json()) as {available?: boolean};
    const ok = Boolean(data.available);
    streamCapabilityCache.set(videoId, ok);
    return ok;
  } catch {
    return false;
  }
}

export const YouTubePlayerEngine = forwardRef<YouTubeEngineHandle, YouTubePlayerEngineProps>(
  function YouTubePlayerEngine(
    {
      videoId,
      trackSource,
      ownerScope,
      activeEntryKey,
      prefetchVideoIds,
      clipStart,
      clipEnd,
      abLoopEnabled,
      abStart,
      abEnd,
      videoMode,
      volume,
      isMuted,
      backgroundKeepAlive,
      userPausedRef,
      onAudioModeChange,
      onPlayingChange,
      onProgress,
      onEnded,
      onError,
      onCloseTheater,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<YTPlayerInstance | null>(null);
    const readyRef = useRef(false);
    const createdWithEntryRef = useRef<string | null>(null);
    const pendingLoadRef = useRef<{
      entryKey: string;
      videoId: string;
      startSeconds: number;
    } | null>(null);

    const nativeAudioRef = useRef<HTMLAudioElement | null>(null);
    const localObjectUrlRef = useRef<string | null>(null);
    const loadSeqRef = useRef<number>(0);

    // Track whether audio currently comes from native <audio> (local file OR streamed YouTube) or YT iframe
    const activePipelineRef = useRef<'native-audio' | 'iframe'>('iframe');
    const activeVideoIdRef = useRef<string | null>(videoId);
    activeVideoIdRef.current = videoId;

    const iframeRecoveryAtRef = useRef<number>(0);
    const nativeRecoveryAtRef = useRef<number>(0);
    const trackLoadedAtRef = useRef<number>(0);
    const bgResumeStreakRef = useRef<number>(0);
    const lastBlurAtRef = useRef<number>(0);
    const clipEndedLockRef = useRef<number>(0);
    const cuedRetryLockRef = useRef<number>(0);
    const ytStartAfterReadyRef = useRef<number>(0);

    const isBackgroundContext = () => {
      if (document.visibilityState === 'hidden') return true;
      const recentlyBlurred = Date.now() - lastBlurAtRef.current < 1600;
      const iframeFocused =
        typeof document.activeElement?.tagName === 'string' &&
        document.activeElement.tagName.toUpperCase() === 'IFRAME';
      return recentlyBlurred && !iframeFocused;
    };

    const isLocalTrack = Boolean(
      videoId && (trackSource === 'local' || videoId.startsWith('local_')),
    );
    const isLocalRef = useRef(isLocalTrack);
    isLocalRef.current = isLocalTrack;

    const audioRef = useRef({volume, isMuted, backgroundKeepAlive, videoMode});
    audioRef.current = {volume, isMuted, backgroundKeepAlive, videoMode};

    const stateRef = useRef({
      clipStart,
      clipEnd,
      abLoopEnabled,
      abStart,
      abEnd,
    });
    stateRef.current = {clipStart, clipEnd, abLoopEnabled, abStart, abEnd};

    const callbacksRef = useRef({
      onAudioModeChange,
      onPlayingChange,
      onProgress,
      onEnded,
      onError,
    });
    callbacksRef.current = {
      onAudioModeChange,
      onPlayingChange,
      onProgress,
      onEnded,
      onError,
    };

    const hasActiveVideoRef = useRef(Boolean(videoId));
    hasActiveVideoRef.current = Boolean(videoId);

    const setPipelineMode = (mode: 'native-audio' | 'iframe') => {
      if (activePipelineRef.current !== mode) {
        activePipelineRef.current = mode;
        callbacksRef.current.onAudioModeChange?.(mode);
      }
    };

    const applyNativeVolume = (audioEl: HTMLAudioElement, vol: number, muted: boolean) => {
      const clamped = Math.max(0, Math.min(100, Math.round(vol)));
      audioEl.volume = clamped / 100;
      audioEl.muted = muted || clamped === 0;
    };

    const applyIframeVolume = (player: YTPlayerInstance, vol: number, muted: boolean) => {
      try {
        if (muted || vol <= 0) {
          player.mute();
          player.setVolume(0);
        } else {
          player.unMute();
          player.setVolume(Math.max(0, Math.min(100, Math.round(vol))));
        }
      } catch {
        // Ignore transient player exception
      }
    };

    const ensureIframeAudible = (player: YTPlayerInstance) => {
      try {
        if (audioRef.current.isMuted || audioRef.current.volume <= 0) return;
        if (player.isMuted?.()) {
          player.unMute();
          player.setVolume(Math.max(0, Math.min(100, Math.round(audioRef.current.volume))));
        }
      } catch {
        // Ignore
      }
    };

    const startOrReuseIframe = (targetVideoId: string, entryKey: string, startSec: number, muteAudio: boolean) => {
      pendingLoadRef.current = {entryKey, videoId: targetVideoId, startSeconds: startSec};
      ytStartAfterReadyRef.current = startSec;

      if (readyRef.current && playerRef.current) {
        try {
          trackLoadedAtRef.current = Date.now();
          bgResumeStreakRef.current = 0;
          if (muteAudio) {
            playerRef.current.mute();
            playerRef.current.setVolume(0);
          } else {
            applyIframeVolume(playerRef.current, audioRef.current.volume, audioRef.current.isMuted);
          }
          playerRef.current.loadVideoById({
            videoId: targetVideoId,
            startSeconds: startSec,
          });
        } catch {
          // Ignore transient iframe load error
        }
        return;
      }

      if (playerRef.current) {
        return;
      }

      const initEntryKey = entryKey;
      loadYouTubeIframeAPI().then(() => {
        if (!mountRef.current || !window.YT?.Player || playerRef.current) {
          return;
        }
        if (!hasActiveVideoRef.current || isLocalRef.current) return;

        const targetEl = document.createElement('div');
        mountRef.current.innerHTML = '';
        mountRef.current.appendChild(targetEl);
        createdWithEntryRef.current = initEntryKey;

        const player = new window.YT.Player(targetEl, {
          width: '100%',
          height: '100%',
          videoId: targetVideoId,
          playerVars: {
            autoplay: 1,
            mute: muteAudio ? 1 : 0,
            start: startSec,
            controls: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            disablekb: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (!hasActiveVideoRef.current || isLocalRef.current) return;
              readyRef.current = true;
              try {
                const iframe = e.target.getIframe?.();
                if (iframe) {
                  iframe.setAttribute(
                    'allow',
                    'autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                  );
                  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                }
              } catch {
                // Ignore attribute sync failures
              }

              const shouldMuteIframe = activePipelineRef.current === 'native-audio';
              if (shouldMuteIframe) {
                e.target.mute();
                e.target.setVolume(0);
              } else {
                applyIframeVolume(e.target, audioRef.current.volume, audioRef.current.isMuted);
              }

              const latest = pendingLoadRef.current;
              if (latest && latest.entryKey !== createdWithEntryRef.current) {
                e.target.loadVideoById({
                  videoId: latest.videoId,
                  startSeconds: latest.startSeconds,
                });
              }
              if (!userPausedRef.current && (!shouldMuteIframe || audioRef.current.videoMode !== 'audio')) {
                e.target.playVideo();
              }
            },
            onStateChange: (e) => {
              if (isLocalRef.current || activePipelineRef.current === 'native-audio') {
                return;
              }
              const state = e.data;
              if (state === 1) {
                ensureIframeAudible(e.target);
                if (Date.now() - trackLoadedAtRef.current > 1000) {
                  bgResumeStreakRef.current = 0;
                }
                callbacksRef.current.onPlayingChange(true);
              } else if (state === 2) {
                if (
                  audioRef.current.backgroundKeepAlive &&
                  !userPausedRef.current &&
                  isBackgroundContext()
                ) {
                  const now = Date.now();
                  const minGap = bgResumeStreakRef.current >= 6 ? 1200 : 180;
                  if (now - iframeRecoveryAtRef.current > minGap) {
                    iframeRecoveryAtRef.current = now;
                    bgResumeStreakRef.current += 1;
                    try {
                      ensureIframeAudible(e.target);
                      e.target.playVideo();
                    } catch {
                      // Worker tick will retry
                    }
                  }
                  return;
                }
                callbacksRef.current.onPlayingChange(false);
              } else if (state === 5) {
                if (!userPausedRef.current) {
                  if (Date.now() - cuedRetryLockRef.current > 240) {
                    cuedRetryLockRef.current = Date.now();
                    ensureIframeAudible(e.target);
                    e.target.playVideo();
                  }
                } else {
                  callbacksRef.current.onPlayingChange(false);
                }
              } else if (state === 0) {
                callbacksRef.current.onEnded();
              }
            },
            onError: (e) => {
              if (isLocalRef.current || activePipelineRef.current === 'native-audio') return;
              callbacksRef.current.onPlayingChange(false);
              callbacksRef.current.onError(e.data);
            },
          },
        });

        playerRef.current = player;
      });
    };

    const attemptBackgroundResume = useRef((immediate = true) => {
      const now = Date.now();
      if (activePipelineRef.current === 'native-audio') {
        const nativeEl = nativeAudioRef.current;
        if (
          !nativeEl ||
          !hasActiveVideoRef.current ||
          userPausedRef.current ||
          !audioRef.current.backgroundKeepAlive ||
          nativeEl.ended
        ) {
          return;
        }
        nativeRecoveryAtRef.current = now;
        const resumeNative = () => {
          if (
            !nativeAudioRef.current ||
            activePipelineRef.current !== 'native-audio' ||
            userPausedRef.current ||
            !audioRef.current.backgroundKeepAlive ||
            nativeAudioRef.current.ended
          ) {
            return;
          }
          applyNativeVolume(
            nativeAudioRef.current,
            audioRef.current.volume,
            audioRef.current.isMuted,
          );
          nativeAudioRef.current.play().catch(() => {});
        };
        if (immediate) {
          resumeNative();
        } else {
          window.setTimeout(resumeNative, 80);
        }
        return;
      }

      const player = playerRef.current;
      if (
        !player ||
        !readyRef.current ||
        !hasActiveVideoRef.current ||
        userPausedRef.current ||
        !audioRef.current.backgroundKeepAlive
      ) {
        return;
      }
      iframeRecoveryAtRef.current = now;
      const resumeIframe = () => {
        if (
          activePipelineRef.current !== 'iframe' ||
          !playerRef.current ||
          !readyRef.current ||
          !hasActiveVideoRef.current ||
          userPausedRef.current ||
          !audioRef.current.backgroundKeepAlive
        ) {
          return;
        }
        try {
          ensureIframeAudible(playerRef.current);
          playerRef.current.playVideo();
        } catch {
          // Worker tick will retry
        }
      };
      if (immediate) {
        resumeIframe();
      } else {
        window.setTimeout(resumeIframe, 80);
      }
    });

    const enforceBoundaries = (current: number, seekFn: (sec: number) => void) => {
      const {abLoopEnabled: loopOn, abStart: a, abEnd: b, clipEnd: cEnd} = stateRef.current;

      if (loopOn && b > a + 0.5) {
        if (current >= b || current < a - 0.8) {
          seekFn(a);
          return true;
        }
      }

      if (
        !loopOn &&
        typeof cEnd === 'number' &&
        cEnd > 0 &&
        current >= cEnd &&
        Date.now() - clipEndedLockRef.current > 1200
      ) {
        clipEndedLockRef.current = Date.now();
        callbacksRef.current.onEnded();
        return true;
      }
      return false;
    };

    const tickPlayerSync = useRef(() => {
      if (!hasActiveVideoRef.current) return;

      if (activePipelineRef.current === 'native-audio') {
        const nativeEl = nativeAudioRef.current;
        if (!nativeEl || !nativeEl.src) return;
        const current = Number.isFinite(nativeEl.currentTime) ? nativeEl.currentTime : 0;
        const total = Number.isFinite(nativeEl.duration) ? nativeEl.duration : 0;
        callbacksRef.current.onProgress(current, total);

        if (
          audioRef.current.backgroundKeepAlive &&
          !userPausedRef.current &&
          isBackgroundContext() &&
          nativeEl.paused &&
          !nativeEl.ended &&
          Date.now() - nativeRecoveryAtRef.current > 280
        ) {
          attemptBackgroundResume.current(true);
        }

        if (!nativeEl.paused && !nativeEl.ended) {
          enforceBoundaries(current, (sec) => {
            nativeEl.currentTime = sec;
          });
        }

        // Keep optional visual YT video synced silently while native <audio> handles sound
        if (
          !isLocalRef.current &&
          audioRef.current.videoMode !== 'audio' &&
          readyRef.current &&
          playerRef.current
        ) {
          try {
            playerRef.current.mute();
            const ytState = playerRef.current.getPlayerState();
            const ytTime = playerRef.current.getCurrentTime() || 0;
            if (!nativeEl.paused && ytState !== 1 && ytState !== 3) {
              playerRef.current.playVideo();
            } else if (nativeEl.paused && ytState === 1) {
              playerRef.current.pauseVideo();
            }
            if (Math.abs(ytTime - current) > 2.2) {
              playerRef.current.seekTo(current, true);
            }
          } catch {
            // Ignore visual sync errors
          }
        }
        return;
      }

      if (!readyRef.current || !playerRef.current) return;
      try {
        const state = playerRef.current.getPlayerState();
        const sinceLoad = Date.now() - trackLoadedAtRef.current;
        const needsRecovery =
          state === 2 || state === 5 || (state === -1 && sinceLoad > 1300);
        const recoveryCooldown = bgResumeStreakRef.current >= 6 ? 1400 : 450;

        if (
          audioRef.current.backgroundKeepAlive &&
          !userPausedRef.current &&
          isBackgroundContext() &&
          needsRecovery &&
          Date.now() - iframeRecoveryAtRef.current > recoveryCooldown
        ) {
          bgResumeStreakRef.current += 1;
          attemptBackgroundResume.current(true);
        }

        if (state === 1 || state === 2 || state === 3) {
          const current = playerRef.current.getCurrentTime() || 0;
          const total = playerRef.current.getDuration() || 0;
          callbacksRef.current.onProgress(current, total);

          if (state === 1) {
            enforceBoundaries(current, (sec) => {
              playerRef.current?.seekTo(sec, true);
            });
          }
        }
      } catch {
        // Ignore transient iframe sync exceptions
      }
    });

    useEffect(() => {
      loadYouTubeIframeAPI();
    }, []);

    // Bind native <audio> events (for both private local files and streamed YouTube audio)
    useEffect(() => {
      const nativeEl = nativeAudioRef.current;
      if (!nativeEl) return;

      const onPlay = () => {
        if (activePipelineRef.current !== 'native-audio') return;
        callbacksRef.current.onPlayingChange(true);
      };
      const onPause = () => {
        if (activePipelineRef.current !== 'native-audio') return;
        if (
          audioRef.current.backgroundKeepAlive &&
          !userPausedRef.current &&
          isBackgroundContext() &&
          !nativeEl.ended
        ) {
          attemptBackgroundResume.current(true);
          return;
        }
        callbacksRef.current.onPlayingChange(false);
      };
      const onAudioEnded = () => {
        if (activePipelineRef.current !== 'native-audio') return;
        callbacksRef.current.onEnded();
      };
      const onTimeUpdate = () => {
        if (activePipelineRef.current !== 'native-audio') return;
        const current = Number.isFinite(nativeEl.currentTime) ? nativeEl.currentTime : 0;
        const total = Number.isFinite(nativeEl.duration) ? nativeEl.duration : 0;
        callbacksRef.current.onProgress(current, total);
        if (!nativeEl.paused && !nativeEl.ended) {
          enforceBoundaries(current, (sec) => {
            nativeEl.currentTime = sec;
          });
        }
      };
      const onAudioError = () => {
        if (activePipelineRef.current !== 'native-audio' || !nativeEl.src) return;
        const currentVid = activeVideoIdRef.current;
        // If a YouTube stream URL failed, transparently fall back to YouTube IFrame player
        if (!isLocalRef.current && currentVid) {
          streamCapabilityCache.set(currentVid, false);
          setPipelineMode('iframe');
          const startSec =
            typeof stateRef.current.clipStart === 'number' && stateRef.current.clipStart > 0
              ? Math.floor(stateRef.current.clipStart)
              : 0;
          const entryKey = `${currentVid}__fallback`;
          startOrReuseIframe(currentVid, entryKey, startSec, false);
          return;
        }
        callbacksRef.current.onPlayingChange(false);
        callbacksRef.current.onError(404);
      };

      nativeEl.addEventListener('play', onPlay);
      nativeEl.addEventListener('pause', onPause);
      nativeEl.addEventListener('ended', onAudioEnded);
      nativeEl.addEventListener('timeupdate', onTimeUpdate);
      nativeEl.addEventListener('error', onAudioError);

      return () => {
        nativeEl.removeEventListener('play', onPlay);
        nativeEl.removeEventListener('pause', onPause);
        nativeEl.removeEventListener('ended', onAudioEnded);
        nativeEl.removeEventListener('timeupdate', onTimeUpdate);
        nativeEl.removeEventListener('error', onAudioError);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userPausedRef]);

    useImperativeHandle(ref, () => ({
      play: () => {
        userPausedRef.current = false;

        if (activePipelineRef.current === 'native-audio') {
          const nativeEl = nativeAudioRef.current;
          if (nativeEl && nativeEl.src) {
            applyNativeVolume(nativeEl, audioRef.current.volume, audioRef.current.isMuted);
            nativeEl.play().catch(() => {
              // Autoplay retry on gesture
            });
          }
          return;
        }

        const player = playerRef.current;
        if (readyRef.current && player) {
          try {
            applyIframeVolume(player, audioRef.current.volume, audioRef.current.isMuted);
            player.playVideo();
          } catch {
            // Ignore transient player state error
          }
        }
      },
      pause: () => {
        userPausedRef.current = true;

        if (activePipelineRef.current === 'native-audio') {
          nativeAudioRef.current?.pause();
          if (readyRef.current && playerRef.current) {
            try {
              playerRef.current.pauseVideo();
            } catch {
              // Ignore
            }
          }
          callbacksRef.current.onPlayingChange(false);
          return;
        }

        const player = playerRef.current;
        if (readyRef.current && player) {
          try {
            player.pauseVideo();
          } catch {
            // Ignore transient player state error
          }
        }
        callbacksRef.current.onPlayingChange(false);
      },
      stop: () => {
        userPausedRef.current = true;

        if (nativeAudioRef.current) {
          nativeAudioRef.current.pause();
          nativeAudioRef.current.removeAttribute('src');
          nativeAudioRef.current.load();
        }
        if (localObjectUrlRef.current) {
          URL.revokeObjectURL(localObjectUrlRef.current);
          localObjectUrlRef.current = null;
        }

        if (playerRef.current) {
          try {
            playerRef.current.stopVideo?.();
          } catch {
            // Ignore
          }
        }
        callbacksRef.current.onPlayingChange(false);
      },
      seekTo: (seconds: number) => {
        if (activePipelineRef.current === 'native-audio') {
          if (nativeAudioRef.current && nativeAudioRef.current.src) {
            nativeAudioRef.current.currentTime = Math.max(0, seconds);
          }
          if (!isLocalRef.current && audioRef.current.videoMode !== 'audio' && readyRef.current && playerRef.current) {
            try {
              playerRef.current.seekTo(seconds, true);
            } catch {
              // Ignore
            }
          }
          return;
        }
        if (readyRef.current && playerRef.current) {
          try {
            playerRef.current.seekTo(seconds, true);
          } catch {
            // Ignore
          }
        }
      },
      setVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(100, Math.round(vol)));
        if (nativeAudioRef.current) {
          nativeAudioRef.current.volume = clamped / 100;
          nativeAudioRef.current.muted = clamped === 0;
        }
        if (readyRef.current && playerRef.current && activePipelineRef.current === 'iframe') {
          applyIframeVolume(playerRef.current, clamped, clamped === 0);
        }
      },
      getPlayerState: () => {
        if (activePipelineRef.current === 'native-audio') {
          const nativeEl = nativeAudioRef.current;
          if (!nativeEl || !nativeEl.src) return -1;
          if (nativeEl.ended) return 0;
          return nativeEl.paused ? 2 : 1;
        }
        if (!readyRef.current || !playerRef.current) return -1;
        try {
          return playerRef.current.getPlayerState();
        } catch {
          return -1;
        }
      },
      tickWatchdog: () => {
        tickPlayerSync.current();
      },
    }));

    // Handle visibility / screen-off / blur transitions cleanly
    useEffect(() => {
      const nudgeIfBackgrounded = () => {
        if (
          !audioRef.current.backgroundKeepAlive ||
          !hasActiveVideoRef.current ||
          userPausedRef.current
        ) {
          return;
        }
        for (const delay of [80, 320, 900]) {
          window.setTimeout(() => {
            if (
              userPausedRef.current ||
              !audioRef.current.backgroundKeepAlive ||
              !isBackgroundContext()
            ) {
              return;
            }
            if (activePipelineRef.current === 'native-audio') {
              const nativeEl = nativeAudioRef.current;
              if (nativeEl && nativeEl.paused && !nativeEl.ended && nativeEl.src) {
                applyNativeVolume(nativeEl, audioRef.current.volume, audioRef.current.isMuted);
                nativeEl.play().catch(() => {});
              }
              return;
            }
            if (!playerRef.current || !readyRef.current) return;
            try {
              const st = playerRef.current.getPlayerState();
              if (st === 2 || st === 5) {
                ensureIframeAudible(playerRef.current);
                playerRef.current.playVideo();
              }
            } catch {
              // Ignore
            }
          }, delay);
        }
      };

      const handleBlur = () => {
        const iframeFocused =
          typeof document.activeElement?.tagName === 'string' &&
          document.activeElement.tagName.toUpperCase() === 'IFRAME';
        if (!iframeFocused) {
          lastBlurAtRef.current = Date.now();
          nudgeIfBackgrounded();
        }
      };

      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          lastBlurAtRef.current = Date.now();
          nudgeIfBackgrounded();
        }
      };

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('pagehide', handleVisibility);
      window.addEventListener('blur', handleBlur);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('pagehide', handleVisibility);
        window.removeEventListener('blur', handleBlur);
      };
    }, [userPausedRef]);

    // Sync video surface when videoMode toggles while native YouTube stream is playing
    useEffect(() => {
      if (!videoId || isLocalTrack || !activeEntryKey) return;
      if (activePipelineRef.current === 'native-audio') {
        if (videoMode !== 'audio') {
          const cur = nativeAudioRef.current?.currentTime || 0;
          startOrReuseIframe(videoId, activeEntryKey, Math.floor(cur), true);
        } else if (readyRef.current && playerRef.current) {
          try {
            playerRef.current.pauseVideo();
          } catch {
            // Ignore
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoMode]);

    // Coordinate Native Audio & YouTube IFrame track loading without dropping audio focus
    useEffect(() => {
      if (!videoId || !activeEntryKey) {
        loadSeqRef.current += 1;
        if (nativeAudioRef.current) {
          nativeAudioRef.current.pause();
          nativeAudioRef.current.removeAttribute('src');
          nativeAudioRef.current.load();
        }
        if (localObjectUrlRef.current) {
          URL.revokeObjectURL(localObjectUrlRef.current);
          localObjectUrlRef.current = null;
        }

        readyRef.current = false;
        createdWithEntryRef.current = null;
        pendingLoadRef.current = null;
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // Ignore cleanup errors
          }
          playerRef.current = null;
        }
        if (mountRef.current) {
          mountRef.current.innerHTML = '';
        }
        return;
      }

      const startSec = typeof clipStart === 'number' && clipStart > 0 ? Math.floor(clipStart) : 0;
      userPausedRef.current = false;
      clipEndedLockRef.current = 0;
      cuedRetryLockRef.current = 0;

      const seq = ++loadSeqRef.current;
      let cancelled = false;

      // Branch 1: Private local audio file track (always native <audio>)
      if (isLocalTrack) {
        setPipelineMode('native-audio');
        if (readyRef.current && playerRef.current) {
          try {
            playerRef.current.pauseVideo();
          } catch {
            // Ignore
          }
        }

        getLocalAudioBlob(ownerScope, videoId).then((blob) => {
          if (cancelled || seq !== loadSeqRef.current) return;
          const nativeEl = nativeAudioRef.current;
          if (!nativeEl) return;

          if (!blob) {
            nativeEl.pause();
            callbacksRef.current.onPlayingChange(false);
            callbacksRef.current.onError(404);
            return;
          }

          const prevObjUrl = localObjectUrlRef.current;
          const objUrl = URL.createObjectURL(blob);
          localObjectUrlRef.current = objUrl;

          // Swap src directly without removeAttribute/load() so mobile background audio focus never lapses
          nativeEl.src = objUrl;
          applyNativeVolume(nativeEl, audioRef.current.volume, audioRef.current.isMuted);

          if (prevObjUrl) {
            window.setTimeout(() => URL.revokeObjectURL(prevObjUrl), 2000);
          }

          let startedAtOffset = false;
          const startPlayback = () => {
            if (cancelled || seq !== loadSeqRef.current) return;
            if (!startedAtOffset && startSec > 0 && Number.isFinite(nativeEl.duration) && startSec < nativeEl.duration) {
              startedAtOffset = true;
              nativeEl.currentTime = startSec;
            }
            if (!userPausedRef.current && nativeEl.paused) {
              nativeEl.play().catch(() => {
                // Retry on user gesture
              });
            }
          };

          if (nativeEl.readyState >= 1) {
            startPlayback();
          } else {
            nativeEl.addEventListener('loadedmetadata', startPlayback, {once: true});
            nativeEl.addEventListener('canplay', startPlayback, {once: true});
            if (!userPausedRef.current) {
              nativeEl.play().catch(() => {});
            }
          }
        });

        return () => {
          cancelled = true;
        };
      }

      // Branch 2: YouTube track — ALWAYS start playback synchronously in 0ms inside user gesture!
      const startNativeYouTubeStream = (targetVid: string, entryKey: string, resumeAtSec = startSec) => {
        const nativeEl = nativeAudioRef.current;
        if (!nativeEl) return false;
        setPipelineMode('native-audio');
        nativeEl.src = `/api/youtube/stream?v=${encodeURIComponent(targetVid)}`;
        applyNativeVolume(nativeEl, audioRef.current.volume, audioRef.current.isMuted);

        let seekApplied = false;
        const startStreamPlayback = () => {
          if (cancelled || seq !== loadSeqRef.current) return;
          if (!seekApplied && resumeAtSec > 0 && Number.isFinite(nativeEl.duration) && resumeAtSec < nativeEl.duration) {
            seekApplied = true;
            nativeEl.currentTime = resumeAtSec;
          }
          if (!userPausedRef.current && nativeEl.paused) {
            nativeEl.play().catch(() => {});
          }
        };

        nativeEl.addEventListener('loadedmetadata', startStreamPlayback, {once: true});
        nativeEl.addEventListener('canplay', startStreamPlayback, {once: true});
        if (!userPausedRef.current) {
          nativeEl.play().catch(() => {});
        }

        if (audioRef.current.videoMode !== 'audio') {
          startOrReuseIframe(targetVid, entryKey, Math.floor(resumeAtSec), true);
        } else if (readyRef.current && playerRef.current) {
          try {
            playerRef.current.pauseVideo();
          } catch {
            // Ignore
          }
        }
        return true;
      };

      const startIframeFallback = (targetVid: string, entryKey: string) => {
        setPipelineMode('iframe');
        const nativeEl = nativeAudioRef.current;
        if (nativeEl && !nativeEl.paused) {
          nativeEl.pause();
        }
        startOrReuseIframe(targetVid, entryKey, startSec, false);
      };

      const cachedStreamCap = streamCapabilityCache.get(videoId);
      if (cachedStreamCap === true) {
        startNativeYouTubeStream(videoId, activeEntryKey, startSec);
      } else {
        // Immediate synchronous iframe start so OS autoplay gesture & wake state never expire waiting on fetch
        startIframeFallback(videoId, activeEntryKey);
        if (cachedStreamCap === undefined) {
          checkYouTubeDirectStream(videoId, 1600)
            .then((canStreamNative) => {
              if (cancelled || seq !== loadSeqRef.current || !canStreamNative || userPausedRef.current) {
                return;
              }
              // Seamlessly upgrade to pure native <audio> while user is still in foreground
              if (document.visibilityState === 'visible' && activePipelineRef.current === 'iframe') {
                let currentSec = startSec;
                try {
                  const t = playerRef.current?.getCurrentTime();
                  if (typeof t === 'number' && Number.isFinite(t) && t > startSec) {
                    currentSec = t;
                  }
                } catch {
                  // Use startSec
                }
                startNativeYouTubeStream(videoId, activeEntryKey, currentSec);
              }
            })
            .catch(() => {});
        }
      }

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeEntryKey, videoId, isLocalTrack, ownerScope]);

    // Pre-warm direct stream capability for upcoming tracks in the queue
    useEffect(() => {
      if (!prefetchVideoIds || prefetchVideoIds.length === 0) return;
      const targets = prefetchVideoIds
        .filter((id) => id && !id.startsWith('local_') && !streamCapabilityCache.has(id))
        .slice(0, 2);
      if (targets.length === 0) return;
      const timer = window.setTimeout(() => {
        targets.forEach((id) => {
          checkYouTubeDirectStream(id, 2000).catch(() => {});
        });
      }, 600);
      return () => window.clearTimeout(timer);
    }, [prefetchVideoIds]);

    useEffect(() => {
      return () => {
        readyRef.current = false;
        if (nativeAudioRef.current) {
          nativeAudioRef.current.pause();
          nativeAudioRef.current.src = '';
        }
        if (localObjectUrlRef.current) {
          URL.revokeObjectURL(localObjectUrlRef.current);
          localObjectUrlRef.current = null;
        }
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // Ignore cleanup errors
          }
          playerRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (nativeAudioRef.current) {
        applyNativeVolume(nativeAudioRef.current, volume, isMuted);
      }
      if (!readyRef.current || !playerRef.current) return;
      if (activePipelineRef.current === 'iframe') {
        applyIframeVolume(playerRef.current, volume, isMuted);
      }
    }, [volume, isMuted]);

    useEffect(() => {
      const interval = window.setInterval(() => {
        tickPlayerSync.current();
      }, 250);

      return () => window.clearInterval(interval);
    }, []);

    const containerClasses =
      videoMode === 'theater'
        ? 'fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#050914]/92 backdrop-blur-md p-4 pb-28'
        : videoMode === 'mini'
          ? 'fixed bottom-[136px] lg:bottom-24 right-3 sm:right-4 z-20 w-64 sm:w-80 aspect-video rounded-xl overflow-hidden border border-sky-200/15 bg-[#050914] shadow-2xl'
          : 'fixed bottom-[136px] lg:bottom-24 right-3 sm:right-4 z-20 w-[160px] sm:w-[200px] aspect-video rounded-xl overflow-hidden border border-sky-200/15 bg-[#050914] shadow-2xl';

    const showYouTubeSurface = Boolean(videoId) && !isLocalTrack;

    return (
      <>
        <audio ref={nativeAudioRef} preload="auto" playsInline className="hidden" />
        <div className={showYouTubeSurface ? containerClasses : 'hidden'}>
          {videoMode === 'theater' && showYouTubeSurface && (
            <div className="w-full max-w-4xl flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#8CA1C4]">YouTube 비디오 재생</span>
              <button
                type="button"
                onClick={onCloseTheater}
                className="px-3.5 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1A2B4E] text-xs font-medium text-[#EEF4FF] transition-colors cursor-pointer"
              >
                작은 화면으로 돌아가기
              </button>
            </div>
          )}
          <div
            className={
              videoMode === 'theater'
                ? 'w-full max-w-4xl aspect-video rounded-2xl overflow-hidden border border-sky-200/15 bg-[#050914] shadow-2xl'
                : 'w-full h-full'
            }
          >
            <div ref={mountRef} className="w-full h-full" />
          </div>
        </div>
      </>
    );
  },
);
