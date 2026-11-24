import {useCallback, useEffect, useRef} from 'react';

function createCarrierWavUrl(): string {
  // 20 seconds of 8kHz mono 16-bit PCM with a 36Hz low-frequency carrier (~-38.9dB @ volume 1.0).
  // 36Hz clears mobile audio high-pass filters and Chromium's silence detector,
  // while remaining virtually inaudible beneath music playback on phone speakers/earbuds.
  // 20s at 36Hz completes an exact integer number of cycles (720 cycles) for clickless looping.
  const sampleRate = 8000;
  const durationSeconds = 20;
  const numSamples = sampleRate * durationSeconds;
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 36 * i) / sampleRate) * 520);
    view.setInt16(44 + i * 2, sample, true);
  }

  const blob = new Blob([buffer], {type: 'audio/wav'});
  return URL.createObjectURL(blob);
}

function createTickerWorker(): {worker: Worker; url: string} | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  try {
    const code = `
      let timerId = null;
      self.onmessage = (e) => {
        if (e.data === 'start') {
          if (timerId !== null) clearInterval(timerId);
          timerId = setInterval(() => self.postMessage('tick'), 250);
        } else if (e.data === 'stop') {
          if (timerId !== null) {
            clearInterval(timerId);
            timerId = null;
          }
        }
      };
    `;
    const blob = new Blob([code], {type: 'application/javascript'});
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    return {worker, url};
  } catch {
    return null;
  }
}

interface UseBackgroundKeepAliveProps {
  enabled: boolean;
  /** True while a track is active and not explicitly paused by the user */
  active: boolean;
  /** Playback mode hint (carrier stays softly continuous across swaps while enabled && active) */
  mode?: 'native-audio' | 'iframe';
  onHeartbeat?: () => void;
}

export function useBackgroundKeepAlive({
  enabled,
  active,
  mode = 'iframe',
  onHeartbeat,
}: UseBackgroundKeepAliveProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscStartedRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const workerUrlRef = useRef<string | null>(null);
  const lockReleaseRef = useRef<(() => void) | null>(null);
  const lockActiveRef = useRef(false);

  const shouldHoldSessionRef = useRef(enabled && active);
  shouldHoldSessionRef.current = enabled && active;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const shouldTickWorkerRef = useRef(active);
  shouldTickWorkerRef.current = active;

  const onHeartbeatRef = useRef(onHeartbeat);
  onHeartbeatRef.current = onHeartbeat;

  const acquireAntiFreezeLock = useCallback(() => {
    if (
      typeof navigator === 'undefined' ||
      !('locks' in navigator) ||
      lockActiveRef.current ||
      !shouldHoldSessionRef.current
    ) {
      return;
    }
    lockActiveRef.current = true;
    try {
      navigator.locks
        .request('velo-playback-keepalive', () => {
          return new Promise<void>((resolve) => {
            if (!shouldHoldSessionRef.current) {
              resolve();
              return;
            }
            lockReleaseRef.current = resolve;
          });
        })
        .catch(() => {
          // Ignore Web Locks errors on unsupported origins/contexts
        })
        .finally(() => {
          lockActiveRef.current = false;
          lockReleaseRef.current = null;
        });
    } catch {
      lockActiveRef.current = false;
    }
  }, []);

  const releaseAntiFreezeLock = useCallback(() => {
    if (lockReleaseRef.current) {
      const release = lockReleaseRef.current;
      lockReleaseRef.current = null;
      release();
    }
  }, []);

  const ensureWebAudioAnchor = useCallback(() => {
    if (typeof window === 'undefined' || !shouldHoldSessionRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!oscStartedRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 36;
        gain.gain.value = 0.0025;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        oscStartedRef.current = true;
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          // Ignore autoplay restriction before user gesture
        });
      }
    } catch {
      // Ignore Web Audio unsupported environments
    }
  }, []);

  // Persistent Web Worker heartbeat (resists hidden-tab timer throttling)
  useEffect(() => {
    const created = createTickerWorker();
    if (!created) return;
    workerRef.current = created.worker;
    workerUrlRef.current = created.url;

    created.worker.onmessage = () => {
      if (shouldTickWorkerRef.current) {
        onHeartbeatRef.current?.();
      }
    };

    return () => {
      created.worker.postMessage('stop');
      created.worker.terminate();
      workerRef.current = null;
      if (workerUrlRef.current) {
        URL.revokeObjectURL(workerUrlRef.current);
        workerUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;
    if (active) {
      workerRef.current.postMessage('start');
    } else {
      workerRef.current.postMessage('stop');
    }
  }, [active]);

  // Mount carrier <audio> inside DOM so iOS Safari / Android Chrome treat it as a persistent page player
  useEffect(() => {
    const audio = document.createElement('audio');
    const url = createCarrierWavUrl();
    blobUrlRef.current = url;
    audio.src = url;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 1.0;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('aria-hidden', 'true');
    audio.className = 'hidden';
    document.body.appendChild(audio);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (shouldHoldSessionRef.current) {
        onHeartbeatRef.current?.();
      }
    };

    const handleUnexpectedPause = () => {
      if (shouldHoldSessionRef.current) {
        audio.play().catch(() => {
          window.setTimeout(() => {
            if (shouldHoldSessionRef.current && audioRef.current?.paused) {
              audioRef.current.play().catch(() => {
                // Ignore transient OS audio lock
              });
            }
          }, 120);
        });
      }
    };

    const handleVisibilityOrResume = () => {
      if (shouldHoldSessionRef.current) {
        acquireAntiFreezeLock();
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        if (audioRef.current?.paused) {
          audioRef.current.play().catch(() => {});
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('pause', handleUnexpectedPause);
    document.addEventListener('visibilitychange', handleVisibilityOrResume);
    document.addEventListener('resume', handleVisibilityOrResume);
    window.addEventListener('focus', handleVisibilityOrResume);
    window.addEventListener('pageshow', handleVisibilityOrResume);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('pause', handleUnexpectedPause);
      document.removeEventListener('visibilitychange', handleVisibilityOrResume);
      document.removeEventListener('resume', handleVisibilityOrResume);
      window.removeEventListener('focus', handleVisibilityOrResume);
      window.removeEventListener('pageshow', handleVisibilityOrResume);
      releaseAntiFreezeLock();
      audio.pause();
      audio.src = '';
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      audioRef.current = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        oscStartedRef.current = false;
      }
    };
  }, [acquireAntiFreezeLock, releaseAntiFreezeLock]);

  const unlockAndPlay = useCallback(() => {
    if (!enabled) return;
    shouldHoldSessionRef.current = true;
    acquireAntiFreezeLock();
    ensureWebAudioAnchor();

    const audio = audioRef.current;
    if (!audio) return;
    // Keep carrier softly alive in native-audio too so mode swaps never lose audio focus in background
    audio.volume = modeRef.current === 'native-audio' ? 0.35 : 1.0;
    if (audio.paused) {
      audio.play().catch(() => {
        // Autoplay policy will retry on next gesture
      });
    }
  }, [enabled, acquireAntiFreezeLock, ensureWebAudioAnchor]);

  const stopKeepAlive = useCallback(() => {
    shouldHoldSessionRef.current = false;
    releaseAntiFreezeLock();
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend().catch(() => {});
    }
  }, [releaseAntiFreezeLock]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (enabled && active) {
      acquireAntiFreezeLock();
      ensureWebAudioAnchor();
      audio.volume = mode === 'native-audio' ? 0.35 : 1.0;
      if (audio.paused) {
        audio.play().catch(() => {
          // Browser autoplay policy may defer until next user gesture
        });
      }
    } else {
      releaseAntiFreezeLock();
      if (!audio.paused) {
        audio.pause();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
    }
  }, [enabled, active, mode, acquireAntiFreezeLock, releaseAntiFreezeLock, ensureWebAudioAnchor]);

  return {unlockAndPlay, stopKeepAlive};
}
