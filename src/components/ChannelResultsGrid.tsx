import React from 'react';
import {ArrowLeft, ChevronRight, Play, Tv} from 'lucide-react';
import type {Track, YouTubeChannel} from '../types/music';
import {TrackThumbnail} from './TrackThumbnail';

interface ChannelResultsGridProps {
  channels: YouTubeChannel[];
  onSelectChannel: (channel: YouTubeChannel) => void;
}

export const ChannelResultsGrid: React.FC<ChannelResultsGridProps> = ({
  channels,
  onSelectChannel,
}) => {
  if (channels.length === 0) {
    return (
      <div className="rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 backdrop-blur-sm px-6 py-14 text-center">
        <p className="text-base font-medium text-[#EEF4FF]">검색된 유튜브 채널이 없습니다</p>
        <p className="mt-1.5 text-sm text-[#8CA1C4]">
          다른 채널 이름이나 아티스트명으로 검색해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {channels.map((ch) => (
        <button
          key={ch.channelId}
          type="button"
          onClick={() => onSelectChannel(ch)}
          className="group flex items-center gap-4 rounded-2xl border border-sky-200/[0.08] bg-[#0B1324]/80 backdrop-blur-sm hover:border-sky-300/25 p-4 text-left transition-colors cursor-pointer"
        >
          {ch.thumbnail ? (
            <img
              src={ch.thumbnail}
              alt={ch.title}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover bg-[#13203B] shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#13203B] flex items-center justify-center shrink-0">
              <Tv className="w-6 h-6 text-[#8CA1C4]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#EEF4FF] truncate group-hover:text-white">
              {ch.title}
            </p>
            <p className="mt-0.5 text-xs text-[#8CA1C4] truncate">{ch.subscriberText}</p>
            {ch.description && (
              <p className="mt-1 text-xs text-[#5B7196] line-clamp-1">{ch.description}</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-[#5B7196] group-hover:text-white shrink-0" />
        </button>
      ))}
    </div>
  );
};

interface ChannelHeaderProps {
  title: string;
  thumbnail: string;
  tracks: Track[];
  onBack: () => void;
  onPlayAll: () => void;
}

export const ChannelHeader: React.FC<ChannelHeaderProps> = ({
  title,
  thumbnail,
  tracks,
  onBack,
  onPlayAll,
}) => {
  return (
    <div className="rounded-2xl border border-sky-200/10 bg-[#0B1324]/85 backdrop-blur-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <TrackThumbnail src={thumbnail} alt={title} className="w-14 h-14 rounded-full" />
        <div className="min-w-0">
          <p className="text-xs text-[#8CA1C4]">YouTube 채널 업로드</p>
          <h2 className="text-xl font-bold text-[#EEF4FF] truncate">{title}</h2>
          <p className="text-xs font-mono tabular-nums text-[#8CA1C4] mt-0.5">
            불러온 영상 {tracks.length}곡
          </p>
        </div>
      </div>

      {tracks.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onPlayAll}
            className="min-h-[42px] px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-sm font-medium text-white flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>전체 재생</span>
          </button>
        </div>
      )}
    </div>
  );
};
