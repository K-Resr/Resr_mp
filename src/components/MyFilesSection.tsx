import React, {useRef, useState} from 'react';
import {
  Check,
  FileAudio,
  Heart,
  Link2,
  ListPlus,
  Lock,
  Pause,
  Pencil,
  Play,
  Plus,
  Scissors,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {formatFileSize} from '../services/localAudioStore';
import type {Playlist, Track} from '../types/music';
import {TrackThumbnail} from './TrackThumbnail';

interface MyFilesSectionProps {
  tracks: Track[];
  availableBlobIds: Set<string>;
  playlists: Playlist[];
  likedIds: Set<string>;
  activeEntryKey: string | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  isUploading: boolean;
  isSignedIn: boolean;
  autoTrimOnImport: boolean;
  onToggleAutoTrimOnImport: (enabled: boolean) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onRelinkFile: (trackId: string, file: File) => void;
  onPlayTrack: (track: Track, list: Track[]) => void;
  onTogglePlay: () => void;
  onToggleLike: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onOpenTrimModal: (track: Track) => void;
  onUpdateTrackMeta: (trackId: string, title: string, channel: string) => Promise<void>;
  onDeleteTrack: (trackId: string) => void;
}

export const MyFilesSection: React.FC<MyFilesSectionProps> = ({
  tracks,
  availableBlobIds,
  playlists,
  likedIds,
  activeEntryKey,
  currentTrackId,
  isPlaying,
  isUploading,
  isSignedIn,
  autoTrimOnImport,
  onToggleAutoTrimOnImport,
  onUploadFiles,
  onRelinkFile,
  onPlayTrack,
  onTogglePlay,
  onToggleLike,
  onAddToQueue,
  onAddToPlaylist,
  onOpenTrimModal,
  onUpdateTrackMeta,
  onDeleteTrack,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const relinkInputRef = useRef<HTMLInputElement | null>(null);
  const [relinkTargetId, setRelinkTargetId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editChannel, setEditChannel] = useState('');

  const playableTracks = tracks.filter((t) => availableBlobIds.has(t.id));

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleStartEdit = (track: Track) => {
    setEditingId(track.id);
    setEditTitle(track.title);
    setEditChannel(track.channel);
  };

  const handleSaveEdit = async (e: React.FormEvent, trackId: string) => {
    e.preventDefault();
    const cleanTitle = editTitle.trim();
    const cleanChannel = editChannel.trim() || '내 파일';
    if (!cleanTitle) return;
    await onUpdateTrackMeta(trackId, cleanTitle, cleanChannel);
    setEditingId(null);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#EEF4FF]">내 파일 사운드 트랙</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#13203B] border border-sky-200/12 text-[11px] font-medium text-[#CBD5E1]">
              <Lock className="w-3 h-3 text-[#60A5FA]" />
              <span>나만 사용</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-[#8CA1C4]">
            내 기기의 음악·음성 파일을 사운드 트랙에 추가해 혼자서 듣고 플레이리스트에도 담을 수 있습니다.
            {isSignedIn ? ' (메타데이터는 내 계정에만 비공개 동기화)' : ' (이 기기에만 비공개 저장)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {playableTracks.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayTrack(playableTracks[0], playableTracks)}
              className="min-h-[42px] px-4 rounded-xl bg-[#13203B] hover:bg-[#1A2B4E] border border-sky-200/10 text-sm font-medium text-[#EEF4FF] flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>내 파일 전체 재생</span>
            </button>
          )}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[42px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-sm font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{isUploading ? '파일 불러오는 중...' : '오디오 파일 추가'}</span>
          </button>
        </div>
      </div>

      {/* Hidden multi-file input & single relink input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.opus,.mp4"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />
      <input
        ref={relinkInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.opus,.mp4"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && relinkTargetId) {
            onRelinkFile(relinkTargetId, file);
          }
          setRelinkTargetId(null);
          e.target.value = '';
        }}
      />

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`rounded-2xl border-2 border-dashed px-6 py-7 text-center transition-colors cursor-pointer backdrop-blur-sm ${
          isDragging
            ? 'border-[#3B82F6] bg-[#2563EB]/15'
            : 'border-sky-200/15 bg-[#0B1324]/80 hover:border-sky-200/30 hover:bg-[#13203B]/80'
        }`}
      >
        <div className="mx-auto w-11 h-11 rounded-xl bg-[#2563EB]/20 border border-[#3B82F6]/35 flex items-center justify-center mb-3">
          <FileAudio className="w-5 h-5 text-[#60A5FA]" />
        </div>
        <p className="text-sm font-semibold text-[#EEF4FF]">
          여기에 오디오 파일을 끌어다 놓거나 클릭해서 선택하세요
        </p>
        <p className="mt-1 text-xs text-[#8CA1C4]">
          MP3, WAV, M4A, AAC, OGG, FLAC 등 지원 ·{' '}
          {autoTrimOnImport
            ? '가져온 파일은 바로 구간 자르기 화면이 열려 원하는 부분만 잘라 담을 수 있습니다'
            : '오디오 원본은 내 기기 브라우저에만 비공개 보관됩니다'}
        </p>
      </div>

      {/* Default Trim-on-Import Option Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0B1324]/80 backdrop-blur-sm border border-sky-200/[0.08] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Scissors className="w-4 h-4 text-[#60A5FA] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#EEF4FF]">
              가져온 음악 바로 구간 자르기 (기본 설정)
            </p>
            <p className="text-[11px] text-[#8CA1C4]">
              파일을 추가하면 자동으로 구간 자르기 창이 열려 원하는 하이라이트만 잘라 플레이리스트에 넣을 수 있습니다.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={autoTrimOnImport}
            onChange={(e) => onToggleAutoTrimOnImport(e.target.checked)}
            className="w-4 h-4 accent-[#2563EB] rounded"
          />
          <span className="text-xs font-medium text-[#EEF4FF]">
            {autoTrimOnImport ? '자동 자르기 켜짐' : '자르지 않고 바로 저장'}
          </span>
        </label>
      </div>

      {/* Private Local Track List */}
      {tracks.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 backdrop-blur-sm px-6 py-12 text-center">
          <p className="text-base font-medium text-[#EEF4FF]">아직 삽입한 내 파일 트랙이 없습니다</p>
          <p className="mt-1.5 text-sm text-[#8CA1C4]">
            개인 녹음, 반주(MR), 소장 음원을 추가하면 백그라운드 재생과 플레이리스트 구성을 바로 사용할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-sky-200/[0.08] border-t border-b border-sky-200/[0.08] rounded-xl bg-[#0B1324]/45 backdrop-blur-xs">
          {tracks.map((track, idx) => {
            const hasBlob = availableBlobIds.has(track.id);
            const isCurrent = track.entryId
              ? activeEntryKey === track.entryId
              : track.id === currentTrackId;
            const isLiked = likedIds.has(track.id);
            const isEditing = editingId === track.id;
            const menuOpen = openMenuId === track.id;

            return (
              <div
                key={track.id}
                className={`group relative flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-2 sm:px-3 py-3 transition-colors rounded-lg ${
                  isCurrent ? 'bg-[#13203B]/75' : 'hover:bg-[#13203B]/45'
                }`}
              >
                <span className="hidden sm:block w-7 text-right text-xs font-mono tabular-nums text-[#5B7196] shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (!hasBlob) {
                      setRelinkTargetId(track.id);
                      relinkInputRef.current?.click();
                      return;
                    }
                    if (isCurrent) {
                      onTogglePlay();
                    } else {
                      onPlayTrack(track, playableTracks.length > 0 ? playableTracks : [track]);
                    }
                  }}
                  className="relative shrink-0 cursor-pointer rounded-lg"
                  aria-label={isCurrent && isPlaying ? `${track.title} 일시 정지` : `${track.title} 재생`}
                >
                  <TrackThumbnail src="" isLocal alt={track.title} className="w-12 h-12" />
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

                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveEdit(e, track.id)}
                    className="flex-1 min-w-[200px] flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="트랙 제목"
                      maxLength={300}
                      autoFocus
                      className="flex-1 min-w-[140px] rounded-lg bg-[#050914] border border-sky-200/15 px-3 py-1.5 text-xs text-[#EEF4FF] focus:outline-none focus:border-[#3B82F6]"
                    />
                    <input
                      type="text"
                      value={editChannel}
                      onChange={(e) => setEditChannel(e.target.value)}
                      placeholder="아티스트 / 메모"
                      maxLength={150}
                      className="w-36 rounded-lg bg-[#050914] border border-sky-200/15 px-3 py-1.5 text-xs text-[#EEF4FF] focus:outline-none focus:border-[#3B82F6]"
                    />
                    <button
                      type="submit"
                      aria-label="저장"
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-[#2563EB] text-white cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="취소"
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-[#13203B] text-[#EEF4FF] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasBlob) {
                        setRelinkTargetId(track.id);
                        relinkInputRef.current?.click();
                        return;
                      }
                      if (isCurrent) {
                        onTogglePlay();
                      } else {
                        onPlayTrack(track, playableTracks.length > 0 ? playableTracks : [track]);
                      }
                    }}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrent ? 'text-[#60A5FA]' : 'text-[#EEF4FF]'
                      }`}
                    >
                      {track.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#8CA1C4]">
                      <span className="truncate">{track.channel}</span>
                      {typeof track.fileSize === 'number' && track.fileSize > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{formatFileSize(track.fileSize)}</span>
                        </>
                      )}
                      {!hasBlob && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400 font-medium">이 기기에 파일 연결 필요</span>
                        </>
                      )}
                    </div>
                  </button>
                )}

                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-auto">
                  {!hasBlob && (
                    <button
                      type="button"
                      onClick={() => {
                        setRelinkTargetId(track.id);
                        relinkInputRef.current?.click();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>파일 연결</span>
                    </button>
                  )}

                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(track)}
                      aria-label="제목 및 정보 수정"
                      title="제목 / 아티스트 수정"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenTrimModal(track)}
                    aria-label="구간 자르기 및 플레이리스트 저장"
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
                    disabled={!hasBlob}
                    onClick={() => onAddToQueue(track)}
                    aria-label="대기열에 추가"
                    title="대기열에 추가"
                    className="min-h-[40px] min-w-[40px] hidden sm:flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 disabled:opacity-35 transition-colors cursor-pointer"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(menuOpen ? null : track.id)}
                      aria-label="플레이리스트에 넣기"
                      title="플레이리스트에 넣기"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#EEF4FF] hover:bg-[#13203B]/70 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 top-11 z-30 w-56 max-h-60 overflow-y-auto overscroll-contain rounded-xl bg-[#0B1324] border border-sky-200/15 py-1.5 shadow-2xl">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onOpenTrimModal(track);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-medium text-[#60A5FA] hover:bg-[#13203B] flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>특정 구간 잘라서 넣기...</span>
                        </button>
                        <p className="px-3 py-1 mt-1 border-t border-sky-200/[0.08] text-[11px] font-medium text-[#8CA1C4]">
                          플레이리스트에 바로 넣기
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
                                setOpenMenuId(null);
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

                  <button
                    type="button"
                    onClick={() => onDeleteTrack(track.id)}
                    aria-label="내 파일 트랙 삭제"
                    title="내 파일 트랙 삭제"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-[#60A5FA] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <span className="w-12 text-right text-xs font-mono tabular-nums text-[#8CA1C4] shrink-0">
                    {track.duration || '0:00'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
