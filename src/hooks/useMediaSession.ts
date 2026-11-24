import {useEffect, useRef} from 'react';
import type {Track} from '../types/music';

interface UseMediaSessionProps {
  track: Track | null;
  isPlaying: boolean;
  isUserPaused?: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekTo: (seconds: number) => void;
}

export function useMediaSession({
  track,
  isPlaying,
  isUserPaused = false,
  currentTime,
  duration,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onSeekTo,
}: UseMediaSessionProps) {
  const lastPosSyncRef = useRef<{
    trackId: string | null;
    isPlaying: boolean;
    position: number;
    duration: number;
    syncedAt: number;
  }>({
    trackId: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    syncedAt: 0,
  });

  const latestRef = useRef({
    track,
    isPlaying,
    isUserPaused,
    currentTime,
    duration,
    onPlay,
    onPause,
    onPrev,
    onNext,
    onSeekTo,
  });
  latestRef.current = {
    track,
    isPlaying,
    isUserPaused,
    currentTime,
    duration,
    onPlay,
    onPause,
    onPrev,
    onNext,
    onSeekTo,
  };

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    if (!track) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    const isLocalTrack = track.source === 'local' || track.id.startsWith('local_');
    const artwork = isLocalTrack
      ? [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ]
      : [
          ...(track.thumbnail
            ? [
                {
                  src: track.thumbnail,
                  sizes: '480x360',
                  type: 'image/jpeg',
                },
              ]
            : []),
          {
            src: `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`,
            sizes: '320x180',
            type: 'image/jpeg',
          },
          {
            src: `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`,
            sizes: '480x360',
            type: 'image/jpeg',
          },
          {
            src: `https://i.ytimg.com/vi/${track.id}/maxresdefault.jpg`,
            sizes: '1280x720',
            type: 'image/jpeg',
          },
        ];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.channel,
      album: isLocalTrack ? '내 사운드 트랙 · Resr mp' : 'Resr mp',
      artwork,
    });
  }, [track]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    if (!track) {
      navigator.mediaSession.playbackState = 'none';
      return;
    }
    // Keep OS playbackState 'playing' smoothly across rapid track transitions unless user paused
    navigator.mediaSession.playbackState = isPlaying || !isUserPaused ? 'playing' : 'paused';
  }, [track, isPlaying, isUserPaused]);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }

    if (!track || duration <= 0 || !Number.isFinite(currentTime) || currentTime > duration) {
      return;
    }

    const now = Date.now();
    const prev = lastPosSyncRef.current;
    const trackChanged = prev.trackId !== track.id;
    const playChanged = prev.isPlaying !== isPlaying;
    const durChanged = Math.abs(prev.duration - duration) > 1.5;
    const expectedPos = prev.isPlaying
      ? prev.position + (now - prev.syncedAt) / 1000
      : prev.position;
    const jumped = Math.abs(currentTime - expectedPos) > 2.2;
    const periodicRefresh = now - prev.syncedAt >= 5000;

    if (!trackChanged && !playChanged && !durChanged && !jumped && !periodicRefresh) {
      return;
    }

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: isPlaying ? 1 : 0,
        position: Math.max(0, currentTime),
      });
      lastPosSyncRef.current = {
        trackId: track.id,
        isPlaying,
        position: currentTime,
        duration,
        syncedAt: now,
      };
    } catch {
      // Ignore transient duration/position mismatches during track switching
    }
  }, [track, isPlaying, currentTime, duration]);

  // Register Media Session action handlers once without tearing down on every progress tick
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    const session = navigator.mediaSession;
    const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Ignore unsupported actions in older browsers
      }
    };

    safeSet('play', () => latestRef.current.onPlay());
    safeSet('pause', () => latestRef.current.onPause());
    safeSet('stop', () => latestRef.current.onPause());
    safeSet('previoustrack', () => latestRef.current.onPrev());
    safeSet('nexttrack', () => latestRef.current.onNext());
    safeSet('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        latestRef.current.onSeekTo(details.seekTime);
      }
    });
    safeSet('seekbackward', (details) => {
      const {currentTime: cur, onSeekTo: seek} = latestRef.current;
      seek(Math.max(0, cur - (details.seekOffset || 10)));
    });
    safeSet('seekforward', (details) => {
      const {currentTime: cur, duration: dur, onSeekTo: seek} = latestRef.current;
      seek(Math.min(dur || cur + 10, cur + (details.seekOffset || 10)));
    });

    const syncSessionPlaybackState = () => {
      const {track: tr, isPlaying: playing, isUserPaused: userPaused} = latestRef.current;
      if (tr) {
        session.playbackState = playing || !userPaused ? 'playing' : 'paused';
      }
    };
    document.addEventListener('visibilitychange', syncSessionPlaybackState);
    window.addEventListener('pagehide', syncSessionPlaybackState);
    window.addEventListener('pageshow', syncSessionPlaybackState);
    window.addEventListener('focus', syncSessionPlaybackState);

    return () => {
      document.removeEventListener('visibilitychange', syncSessionPlaybackState);
      window.removeEventListener('pagehide', syncSessionPlaybackState);
      window.removeEventListener('pageshow', syncSessionPlaybackState);
      window.removeEventListener('focus', syncSessionPlaybackState);
      safeSet('play', null);
      safeSet('pause', null);
      safeSet('stop', null);
      safeSet('previoustrack', null);
      safeSet('nexttrack', null);
      safeSet('seekto', null);
      safeSet('seekbackward', null);
      safeSet('seekforward', null);
    };
  }, []);
}
