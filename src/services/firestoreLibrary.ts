import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type {User} from 'firebase/auth';
import {db, handleFirestoreError, OperationType} from '../lib/firebase';
import type {
  PlayHistoryEntry,
  Playlist,
  RepeatMode,
  SearchHistoryEntry,
  Track,
} from '../types/music';

export interface UserPreferences {
  repeatMode: RepeatMode;
  isShuffle: boolean;
  backgroundKeepAlive: boolean;
}

function clampString(val: string | undefined, maxLen: number, fallback = ''): string {
  const clean = (val || fallback).trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_');
  return (cleaned || `id_${Date.now()}`).slice(0, 128);
}

export function makeEntryId(videoId: string): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return sanitizeId(`ent_${videoId}_${Date.now()}_${rand}`);
}

function sanitizeTrackPayload(track: Track, explicitEntryId?: string) {
  const safeId = sanitizeId(track.id).slice(0, 64);
  const entryId = sanitizeId(explicitEntryId || track.entryId || makeEntryId(safeId));
  const safeDurationSeconds = Number.isFinite(track.durationSeconds)
    ? Math.max(0, Math.min(864000, Math.floor(track.durationSeconds)))
    : 0;

  const hasValidClip =
    typeof track.startSeconds === 'number' &&
    typeof track.endSeconds === 'number' &&
    track.startSeconds >= 0 &&
    track.endSeconds > track.startSeconds;

  return {
    entryId,
    id: safeId,
    title: clampString(track.title, 300, '제목 없음'),
    channel: clampString(track.channel, 150, 'YouTube'),
    duration: clampString(track.duration, 20, '0:00'),
    durationSeconds: safeDurationSeconds,
    thumbnail: clampString(track.thumbnail, 500, ''),
    ...(track.viewCountText ? {viewCountText: clampString(track.viewCountText, 60)} : {}),
    ...(track.source ? {source: track.source} : {}),
    ...(hasValidClip
      ? {
          startSeconds: Math.floor(track.startSeconds!),
          endSeconds: Math.floor(track.endSeconds!),
          ...(track.clipLabel ? {clipLabel: clampString(track.clipLabel, 80)} : {}),
        }
      : {}),
  };
}

export async function ensureAndLoadUserPreferences(
  user: User,
  defaults: UserPreferences,
): Promise<UserPreferences> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        ...(user.displayName ? {displayName: clampString(user.displayName, 120)} : {}),
        repeatMode: defaults.repeatMode,
        isShuffle: defaults.isShuffle,
        backgroundKeepAlive: defaults.backgroundKeepAlive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return defaults;
    }
    const data = snap.data();
    return {
      repeatMode:
        data.repeatMode === 'off' || data.repeatMode === 'all' || data.repeatMode === 'one'
          ? data.repeatMode
          : defaults.repeatMode,
      isShuffle: typeof data.isShuffle === 'boolean' ? data.isShuffle : defaults.isShuffle,
      backgroundKeepAlive:
        typeof data.backgroundKeepAlive === 'boolean'
          ? data.backgroundKeepAlive
          : defaults.backgroundKeepAlive,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserPreferences(
  uid: string,
  patch: Partial<UserPreferences>,
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    await updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function mapDocToTrack(docId: string, data: Record<string, unknown>): Track {
  return {
    entryId: String(data.entryId || docId),
    id: String(data.id || docId),
    title: String(data.title || ''),
    channel: String(data.channel || 'YouTube'),
    duration: String(data.duration || '0:00'),
    durationSeconds: Number(data.durationSeconds || 0),
    thumbnail: String(data.thumbnail || ''),
    viewCountText: data.viewCountText ? String(data.viewCountText) : undefined,
    startSeconds: typeof data.startSeconds === 'number' ? data.startSeconds : undefined,
    endSeconds: typeof data.endSeconds === 'number' ? data.endSeconds : undefined,
    clipLabel: data.clipLabel ? String(data.clipLabel) : undefined,
    source:
      data.source === 'local' || String(data.id || docId).startsWith('local_')
        ? 'local'
        : data.source === 'youtube'
          ? 'youtube'
          : undefined,
    fileName: typeof data.fileName === 'string' ? data.fileName : undefined,
    fileSize: typeof data.fileSize === 'number' ? data.fileSize : undefined,
  };
}

export function subscribeLikedTracks(
  uid: string,
  onTracks: (tracks: Track[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/likedTracks`;
  const q = query(collection(db, 'users', uid, 'likedTracks'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const withTime = snapshot.docs.map((d) => {
        const data = d.data();
        const addedAtMs = data.addedAt?.toMillis ? data.addedAt.toMillis() : 0;
        return {track: mapDocToTrack(d.id, data), addedAtMs};
      });
      withTime.sort((a, b) => b.addedAtMs - a.addedAtMs);
      onTracks(withTime.map((item) => item.track));
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function addLikedTrackCloud(uid: string, track: Track): Promise<string> {
  const payload = sanitizeTrackPayload(track);
  const path = `users/${uid}/likedTracks/${payload.entryId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'likedTracks', payload.entryId), {
      ...payload,
      ownerId: uid,
      addedAt: serverTimestamp(),
    });
    return payload.entryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeLikedTrackCloud(uid: string, entryId: string): Promise<void> {
  const safeId = sanitizeId(entryId);
  const path = `users/${uid}/likedTracks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'likedTracks', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribePlaylists(
  uid: string,
  onPlaylists: (playlists: Playlist[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/playlists`;
  const playlistsQuery = query(
    collection(db, 'users', uid, 'playlists'),
    where('ownerId', '==', uid),
  );

  const trackUnsubs = new Map<string, Unsubscribe>();
  const tracksByPlaylist = new Map<string, Track[]>();
  let latestMeta: Array<{id: string; name: string; createdAt: number}> = [];

  const emitCombined = () => {
    const merged: Playlist[] = latestMeta.map((meta) => ({
      id: meta.id,
      name: meta.name,
      createdAt: meta.createdAt,
      tracks: tracksByPlaylist.get(meta.id) || [],
    }));
    onPlaylists(merged);
  };

  const unsubRoot = onSnapshot(
    playlistsQuery,
    (snapshot) => {
      const activeIds = new Set<string>();
      latestMeta = snapshot.docs
        .map((d) => {
          const data = d.data();
          const id = String(data.id || d.id);
          activeIds.add(id);
          const ts = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
          return {
            id,
            name: String(data.name || '플레이리스트'),
            createdAt: ts,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      for (const [plId, unsub] of trackUnsubs.entries()) {
        if (!activeIds.has(plId)) {
          unsub();
          trackUnsubs.delete(plId);
          tracksByPlaylist.delete(plId);
        }
      }

      for (const meta of latestMeta) {
        if (!trackUnsubs.has(meta.id)) {
          const trackPath = `users/${uid}/playlists/${meta.id}/tracks`;
          const tracksQ = query(
            collection(db, 'users', uid, 'playlists', meta.id, 'tracks'),
            where('ownerId', '==', uid),
          );
          const unsubTracks = onSnapshot(
            tracksQ,
            (tSnap) => {
              const ordered = tSnap.docs.map((td) => {
                const data = td.data();
                return {
                  track: mapDocToTrack(td.id, data),
                  orderIndex: typeof data.orderIndex === 'number' ? data.orderIndex : 0,
                };
              });
              ordered.sort((a, b) => a.orderIndex - b.orderIndex);
              tracksByPlaylist.set(
                meta.id,
                ordered.map((item) => item.track),
              );
              emitCombined();
            },
            (error) => {
              if (onError) onError(error);
              handleFirestoreError(error, OperationType.LIST, trackPath);
            },
          );
          trackUnsubs.set(meta.id, unsubTracks);
        }
      }

      emitCombined();
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );

  return () => {
    unsubRoot();
    for (const unsub of trackUnsubs.values()) {
      unsub();
    }
    trackUnsubs.clear();
  };
}

export async function createPlaylistCloud(
  uid: string,
  name: string,
  initialTracks: Track[] = [],
): Promise<string> {
  const playlistId = sanitizeId(`pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${uid}/playlists/${playlistId}`;
  const safeName = clampString(name, 100, '새 플레이리스트');

  try {
    const batch = writeBatch(db);
    const playlistRef = doc(db, 'users', uid, 'playlists', playlistId);
    batch.set(playlistRef, {
      id: playlistId,
      ownerId: uid,
      name: safeName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    let orderIndex = 0;
    for (const track of initialTracks) {
      const payload = sanitizeTrackPayload(track);
      const trackRef = doc(db, 'users', uid, 'playlists', playlistId, 'tracks', payload.entryId);
      batch.set(trackRef, {
        ...payload,
        ownerId: uid,
        playlistId,
        orderIndex,
        addedAt: serverTimestamp(),
      });
      orderIndex++;
    }

    await batch.commit();
    return playlistId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function renamePlaylistCloud(
  uid: string,
  playlistId: string,
  newName: string,
): Promise<void> {
  const safePlId = sanitizeId(playlistId);
  const path = `users/${uid}/playlists/${safePlId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'playlists', safePlId), {
      name: clampString(newName, 100, '플레이리스트'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePlaylistCloud(uid: string, playlistId: string): Promise<void> {
  const safePlId = sanitizeId(playlistId);
  const path = `users/${uid}/playlists/${safePlId}`;
  try {
    const tracksSnap = await getDocs(
      query(
        collection(db, 'users', uid, 'playlists', safePlId, 'tracks'),
        where('ownerId', '==', uid),
      ),
    );
    const batch = writeBatch(db);
    for (const d of tracksSnap.docs) {
      batch.delete(d.ref);
    }
    batch.delete(doc(db, 'users', uid, 'playlists', safePlId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addTracksToPlaylistCloud(
  uid: string,
  playlistId: string,
  tracks: Track[],
  startOrderIndex: number,
): Promise<void> {
  const safePlId = sanitizeId(playlistId);
  const path = `users/${uid}/playlists/${safePlId}/tracks`;
  try {
    const batch = writeBatch(db);
    let idx = Math.max(0, Math.floor(startOrderIndex));
    for (const track of tracks) {
      const payload = sanitizeTrackPayload(track);
      const ref = doc(db, 'users', uid, 'playlists', safePlId, 'tracks', payload.entryId);
      batch.set(ref, {
        ...payload,
        ownerId: uid,
        playlistId: safePlId,
        orderIndex: idx,
        addedAt: serverTimestamp(),
      });
      idx++;
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeTrackFromPlaylistCloud(
  uid: string,
  playlistId: string,
  entryId: string,
): Promise<void> {
  const safePlId = sanitizeId(playlistId);
  const safeEntryId = sanitizeId(entryId);
  const path = `users/${uid}/playlists/${safePlId}/tracks/${safeEntryId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'playlists', safePlId, 'tracks', safeEntryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function reorderPlaylistTracksCloud(
  uid: string,
  playlistId: string,
  orderedEntryIds: string[],
): Promise<void> {
  const safePlId = sanitizeId(playlistId);
  const path = `users/${uid}/playlists/${safePlId}/tracks`;
  try {
    const CHUNK_SIZE = 450;
    for (let start = 0; start < orderedEntryIds.length; start += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const slice = orderedEntryIds.slice(start, start + CHUNK_SIZE);
      slice.forEach((entryId, offset) => {
        const safeEntryId = sanitizeId(entryId);
        const ref = doc(db, 'users', uid, 'playlists', safePlId, 'tracks', safeEntryId);
        batch.update(ref, {orderIndex: start + offset});
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeSearchHistory(
  uid: string,
  onHistory: (items: SearchHistoryEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/searchHistory`;
  const q = query(collection(db, 'users', uid, 'searchHistory'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SearchHistoryEntry[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            query: String(data.query || ''),
            searchType: (data.searchType === 'channel' || data.searchType === 'url'
              ? data.searchType
              : 'keyword') as 'keyword' | 'channel' | 'url',
            updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0,
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 20);
      onHistory(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function saveSearchHistoryCloud(
  uid: string,
  queryText: string,
  searchType: 'keyword' | 'channel' | 'url',
): Promise<void> {
  const historyId = sanitizeId(`sh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${uid}/searchHistory/${historyId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'searchHistory', historyId), {
      id: historyId,
      ownerId: uid,
      query: clampString(queryText, 200, ''),
      searchType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeSearchHistoryCloud(uid: string, historyId: string): Promise<void> {
  const safeId = sanitizeId(historyId);
  const path = `users/${uid}/searchHistory/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'searchHistory', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearSearchHistoryCloud(uid: string): Promise<void> {
  const path = `users/${uid}/searchHistory`;
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'searchHistory'), where('ownerId', '==', uid)),
    );
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribePlayHistory(
  uid: string,
  onItems: (items: PlayHistoryEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/playHistory`;
  const q = query(collection(db, 'users', uid, 'playHistory'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PlayHistoryEntry[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            title: String(data.title || ''),
            channel: String(data.channel || 'YouTube'),
            duration: String(data.duration || '0:00'),
            durationSeconds: Number(data.durationSeconds || 0),
            thumbnail: String(data.thumbnail || ''),
            playCount: typeof data.playCount === 'number' ? data.playCount : 1,
            lastPlayedAt: data.lastPlayedAt?.toMillis ? data.lastPlayedAt.toMillis() : 0,
          };
        })
        .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
        .slice(0, 60);
      onItems(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function recordPlayHistoryCloud(uid: string, track: Track): Promise<void> {
  const safeId = sanitizeId(track.id).slice(0, 64);
  if (!safeId) return;
  const path = `users/${uid}/playHistory/${safeId}`;
  const ref = doc(db, 'users', uid, 'playHistory', safeId);
  const safeDurationSeconds = Number.isFinite(track.durationSeconds)
    ? Math.max(0, Math.min(864000, Math.floor(track.durationSeconds)))
    : 0;
  const commonFields = {
    title: clampString(track.title, 300, '제목 없음'),
    channel: clampString(track.channel, 150, 'YouTube'),
    duration: clampString(track.duration, 20, '0:00'),
    durationSeconds: safeDurationSeconds,
    thumbnail: clampString(track.thumbnail, 500, ''),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: safeId,
        ownerId: uid,
        ...commonFields,
        playCount: 1,
        createdAt: serverTimestamp(),
        lastPlayedAt: serverTimestamp(),
      });
    } else {
      const existingCount = typeof snap.data().playCount === 'number' ? snap.data().playCount : 1;
      if (existingCount >= 100000) return;
      await updateDoc(ref, {
        ...commonFields,
        playCount: increment(1),
        lastPlayedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribePersonalTracks(
  uid: string,
  onTracks: (tracks: Track[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/personalTracks`;
  const q = query(collection(db, 'users', uid, 'personalTracks'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const withTime = snapshot.docs.map((d) => {
        const data = d.data();
        const createdAtMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : 0;
        return {track: mapDocToTrack(d.id, data), createdAtMs};
      });
      withTime.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onTracks(withTime.map((item) => item.track));
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function addPersonalTrackCloud(uid: string, track: Track): Promise<void> {
  const safeId = sanitizeId(track.id).slice(0, 64);
  const path = `users/${uid}/personalTracks/${safeId}`;
  const safeDurationSeconds = Number.isFinite(track.durationSeconds)
    ? Math.max(0, Math.min(864000, Math.floor(track.durationSeconds)))
    : 0;
  const safeFileSize = Number.isFinite(track.fileSize)
    ? Math.max(0, Math.min(1073741824, Math.floor(track.fileSize!)))
    : 0;
  try {
    await setDoc(doc(db, 'users', uid, 'personalTracks', safeId), {
      id: safeId,
      ownerId: uid,
      title: clampString(track.title, 300, '내 사운드 트랙'),
      channel: clampString(track.channel, 150, '내 파일'),
      duration: clampString(track.duration, 20, '0:00'),
      durationSeconds: safeDurationSeconds,
      thumbnail: clampString(track.thumbnail, 500, ''),
      source: 'local',
      fileName: clampString(track.fileName || track.title, 260, 'audio_file'),
      fileSize: safeFileSize,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePersonalTrackCloud(
  uid: string,
  trackId: string,
  patch: {title: string; channel: string},
): Promise<void> {
  const safeId = sanitizeId(trackId).slice(0, 64);
  const path = `users/${uid}/personalTracks/${safeId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'personalTracks', safeId), {
      title: clampString(patch.title, 300, '내 사운드 트랙'),
      channel: clampString(patch.channel, 150, '내 파일'),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePersonalTrackCloud(uid: string, trackId: string): Promise<void> {
  const safeId = sanitizeId(trackId).slice(0, 64);
  const path = `users/${uid}/personalTracks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'personalTracks', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function mergeLocalLibraryToCloud(
  uid: string,
  localPlaylists: Playlist[],
  localLiked: Track[],
  localPersonalTracks: Track[] = [],
): Promise<void> {
  if (localPlaylists.length === 0 && localLiked.length === 0 && localPersonalTracks.length === 0) {
    return;
  }

  try {
    const existingLikedSnap = await getDocs(
      query(collection(db, 'users', uid, 'likedTracks'), where('ownerId', '==', uid)),
    );
    const existingLikedIds = new Set(existingLikedSnap.docs.map((d) => String(d.data().id || d.id)));
    for (const track of localLiked) {
      if (!existingLikedIds.has(track.id)) {
        await addLikedTrackCloud(uid, track);
      }
    }

    const existingPlaylistsSnap = await getDocs(
      query(collection(db, 'users', uid, 'playlists'), where('ownerId', '==', uid)),
    );
    const existingNames = new Set(
      existingPlaylistsSnap.docs.map((d) => String(d.data().name || '')),
    );
    for (const pl of localPlaylists) {
      if (!existingNames.has(pl.name)) {
        await createPlaylistCloud(uid, pl.name, pl.tracks);
      }
    }

    if (localPersonalTracks.length > 0) {
      const existingPersonalSnap = await getDocs(
        query(collection(db, 'users', uid, 'personalTracks'), where('ownerId', '==', uid)),
      );
      const existingPersonalIds = new Set(
        existingPersonalSnap.docs.map((d) => String(d.data().id || d.id)),
      );
      for (const track of localPersonalTracks) {
        if (!existingPersonalIds.has(track.id)) {
          await addPersonalTrackCloud(uid, track);
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}
