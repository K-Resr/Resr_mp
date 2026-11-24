import {formatTime} from '../utils/formatTime';

const DB_NAME = 'resr_mp_private_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audioFiles';

interface StoredAudioRecord {
  storageKey: string;
  ownerScope: string;
  trackId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  blob: Blob;
  savedAt: number;
}

function makeStorageKey(ownerScope: string, trackId: string): string {
  return `${ownerScope}:${trackId}`;
}

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저에서는 로컬 파일 저장소(IndexedDB)를 사용할 수 없습니다.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {keyPath: 'storageKey'});
        store.createIndex('ownerScope', 'ownerScope', {unique: false});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('로컬 오디오 저장소를 열지 못했습니다.'));
  });
}

export async function saveLocalAudioBlob(
  ownerScope: string,
  trackId: string,
  blob: Blob,
  fileName: string,
): Promise<void> {
  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredAudioRecord = {
      storageKey: makeStorageKey(ownerScope, trackId),
      ownerScope,
      trackId,
      fileName,
      mimeType: blob.type || 'audio/mpeg',
      fileSize: blob.size,
      blob,
      savedAt: Date.now(),
    };
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('오디오 파일 저장에 실패했습니다.'));
  });
}

export async function getLocalAudioBlob(
  ownerScope: string,
  trackId: string,
): Promise<Blob | null> {
  try {
    const db = await openAudioDB();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(makeStorageKey(ownerScope, trackId));
      req.onsuccess = () => {
        const rec = req.result as StoredAudioRecord | undefined;
        resolve(rec?.blob || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteLocalAudioBlob(ownerScope: string, trackId: string): Promise<void> {
  try {
    const db = await openAudioDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(makeStorageKey(ownerScope, trackId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function listAvailableLocalTrackIds(ownerScope: string): Promise<Set<string>> {
  try {
    const db = await openAudioDB();
    return await new Promise<Set<string>>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('ownerScope');
      const req = index.getAllKeys(IDBKeyRange.only(ownerScope));
      req.onsuccess = () => {
        const keys = (req.result || []) as string[];
        const ids = new Set<string>();
        const prefix = `${ownerScope}:`;
        for (const k of keys) {
          if (typeof k === 'string' && k.startsWith(prefix)) {
            ids.add(k.slice(prefix.length));
          }
        }
        resolve(ids);
      };
      req.onerror = () => resolve(new Set());
    });
  } catch {
    return new Set();
  }
}

export async function migrateGuestAudioBlobsToUser(uid: string): Promise<void> {
  try {
    const db = await openAudioDB();
    const guestRecords = await new Promise<StoredAudioRecord[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('ownerScope');
      const req = index.getAll(IDBKeyRange.only('guest'));
      req.onsuccess = () => resolve((req.result || []) as StoredAudioRecord[]);
      req.onerror = () => resolve([]);
    });

    if (guestRecords.length === 0) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const rec of guestRecords) {
        store.put({
          ...rec,
          storageKey: makeStorageKey(uid, rec.trackId),
          ownerScope: uid,
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore migration errors
  }
}

export function isSupportedAudioFile(file: File): boolean {
  if (file.type && (file.type.startsWith('audio/') || file.type === 'video/mp4' || file.type === 'video/webm')) {
    return true;
  }
  return /\.(mp3|wav|m4a|aac|ogg|flac|opus|weba|webm|mp4|wma|aiff)$/i.test(file.name);
}

export function stripAudioExtension(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{2,5}$/i, '').trim() || '내 사운드 트랙';
}

export function makeLocalTrackId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `local_${Date.now()}_${rand}`.slice(0, 64);
}

export function readAudioFileDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const finish = (sec: number) => {
      if (settled) return;
      settled = true;
      audio.src = '';
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0);
    };

    const timer = window.setTimeout(() => finish(0), 6000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish(audio.duration);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(0);
    };
    audio.src = url;
  });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTrackDurationLabel(seconds: number): string {
  return formatTime(Math.max(0, Math.floor(seconds)));
}
