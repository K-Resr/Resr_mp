import React, {useState} from 'react';
import type {User} from 'firebase/auth';
import {BarChart3, Compass, Disc3, FileAudio, Headphones, Library, ListMusic, Plus, Trash2} from 'lucide-react';
import type {NavSection, Playlist} from '../types/music';
import {GoogleAccountButton} from './GoogleAccountButton';
import {PWAInstallButton} from './PWAInstallButton';

interface SidebarProps {
  activeSection: NavSection;
  activePlaylistId: string | null;
  playlists: Playlist[];
  likedCount: number;
  personalCount: number;
  user: User | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSelectSection: (section: NavSection, playlistId?: string) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onOpenBackgroundGuide: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  activePlaylistId,
  playlists,
  likedCount,
  personalCount,
  user,
  authLoading,
  onSignIn,
  onSignOut,
  onSelectSection,
  onCreatePlaylist,
  onDeletePlaylist,
  onOpenBackgroundGuide,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreatePlaylist(trimmed);
    setNewName('');
    setIsCreating(false);
  };

  return (
    <aside className="relative z-10 hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#0B1324]/80 backdrop-blur-md border-r border-sky-200/[0.08] h-full select-none">
      <div className="px-6 pt-6 pb-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
          <Disc3 className="w-4 h-4 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-[#EEF4FF] whitespace-nowrap">
          Resr mp
        </span>
      </div>

      <nav className="px-3 space-y-1" aria-label="주 메뉴">
        <button
          type="button"
          onClick={() => onSelectSection('explore')}
          className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeSection === 'explore'
              ? 'bg-[#2563EB]/20 text-white'
              : 'text-[#8CA1C4] hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <Compass className="w-4 h-4 shrink-0" />
          <span>탐색</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('charts')}
          className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeSection === 'charts'
              ? 'bg-[#2563EB]/20 text-white'
              : 'text-[#8CA1C4] hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span>인기 차트</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('playlists')}
          className={`w-full min-h-[44px] flex items-center justify-between px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeSection === 'playlists'
              ? 'bg-[#2563EB]/20 text-white'
              : 'text-[#8CA1C4] hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <span className="flex items-center gap-3">
            <ListMusic className="w-4 h-4 shrink-0" />
            <span>플레이리스트 목록</span>
          </span>
          <span className="text-xs font-mono tabular-nums text-[#8CA1C4]">{playlists.length}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('myfiles')}
          className={`w-full min-h-[44px] flex items-center justify-between px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeSection === 'myfiles'
              ? 'bg-[#2563EB]/20 text-white'
              : 'text-[#8CA1C4] hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <span className="flex items-center gap-3">
            <FileAudio className="w-4 h-4 shrink-0" />
            <span>내 파일 트랙</span>
          </span>
          <span className="text-xs font-mono tabular-nums text-[#8CA1C4]">{personalCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('library')}
          className={`w-full min-h-[44px] flex items-center justify-between px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeSection === 'library'
              ? 'bg-[#2563EB]/20 text-white'
              : 'text-[#8CA1C4] hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <span className="flex items-center gap-3">
            <Library className="w-4 h-4 shrink-0" />
            <span>좋아요 보관함</span>
          </span>
          <span className="text-xs font-mono tabular-nums text-[#8CA1C4]">{likedCount}</span>
        </button>
      </nav>

      <div className="mt-6 px-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onSelectSection('playlists')}
          className="text-xs font-semibold text-[#8CA1C4] hover:text-white transition-colors cursor-pointer"
        >
          내 플레이리스트
        </button>
        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          aria-label="새 플레이리스트 만들기"
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-[#8CA1C4] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="px-4 mt-2">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="플레이리스트 이름"
              autoFocus
              className="w-full min-w-0 rounded-lg bg-[#050914] border border-sky-200/12 px-3 py-1.5 text-xs text-white placeholder-[#5B7196] focus:outline-none focus:border-[#3B82F6]"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-medium text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              추가
            </button>
          </div>
        </form>
      )}

      <div className="mt-2 flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 space-y-0.5">
        {playlists.map((pl) => {
          const isActive = activeSection === 'playlist' && activePlaylistId === pl.id;
          return (
            <div
              key={pl.id}
              className={`group flex items-center justify-between rounded-lg transition-colors ${
                isActive ? 'bg-[#2563EB]/20 text-white' : 'text-[#8CA1C4] hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSection('playlist', pl.id)}
                className="flex-1 min-w-0 min-h-[40px] flex items-center gap-3 px-3.5 text-sm text-left cursor-pointer"
              >
                <ListMusic className="w-4 h-4 shrink-0" />
                <span className="truncate">{pl.name}</span>
                <span className="ml-auto text-[11px] font-mono tabular-nums text-[#5B7196]">
                  {pl.tracks.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDeletePlaylist(pl.id)}
                aria-label={`${pl.name} 삭제`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 min-h-[36px] min-w-[36px] flex items-center justify-center text-[#8CA1C4] hover:text-[#60A5FA] transition-opacity cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-sky-200/[0.08] space-y-2.5">
        <GoogleAccountButton
          user={user}
          authLoading={authLoading}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
        />
        <button
          type="button"
          onClick={onOpenBackgroundGuide}
          className="w-full min-h-[42px] flex items-center gap-2.5 px-3.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-xs font-medium text-[#CBD5E1] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Headphones className="w-4 h-4 text-[#60A5FA] shrink-0" />
          <span>백그라운드 재생 안내</span>
        </button>
        <PWAInstallButton />
      </div>
    </aside>
  );
};
