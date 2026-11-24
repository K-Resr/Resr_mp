import React, {useEffect, useRef, useState} from 'react';
import {Clock, Search, Sparkles, Trash2, Tv, X} from 'lucide-react';
import type {SearchHistoryEntry, SearchMode} from '../types/music';

interface SearchBarWithHistoryProps {
  query: string;
  searchMode: SearchMode;
  history: SearchHistoryEntry[];
  personalizedKeywords: string[];
  onQueryChange: (q: string) => void;
  onModeChange: (mode: SearchMode) => void;
  onExecuteSearch: (queryText: string, modeOverride?: SearchMode) => void;
  onClearSearch: () => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
}

export const SearchBarWithHistory: React.FC<SearchBarWithHistoryProps> = ({
  query,
  searchMode,
  history,
  personalizedKeywords,
  onQueryChange,
  onModeChange,
  onExecuteSearch,
  onClearSearch,
  onDeleteHistoryItem,
  onClearHistory,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.startsWith('http')) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      fetch(`/api/youtube/suggest?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((data: {suggestions?: string[]}) => {
          setSuggestions(data.suggestions || []);
        })
        .catch(() => setSuggestions([]));
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsOpen(false);
    onExecuteSearch(query.trim());
  };

  const filteredHistory = query.trim()
    ? history.filter((h) => h.query.toLowerCase().includes(query.trim().toLowerCase()))
    : history;

  const showDropdown =
    isOpen &&
    (suggestions.length > 0 || filteredHistory.length > 0 || personalizedKeywords.length > 0);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-2xl">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 text-[#8CA1C4] absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setIsOpen(true);
            }}
            placeholder={
              searchMode === 'channel'
                ? '유튜브 채널 이름 검색 (예: 딩고 뮤직, 1theK)'
                : '키워드·노래 검색 또는 유튜브 URL 붙여넣기'
            }
            aria-label="유튜브 음악 및 채널 검색"
            className="w-full min-h-[42px] rounded-xl bg-[#0B1324]/85 border border-sky-200/12 pl-10 pr-24 text-sm text-[#EEF4FF] placeholder-[#5B7196] focus:outline-none focus:border-[#3B82F6] transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onClearSearch();
                setSuggestions([]);
              }}
              aria-label="검색어 지우기"
              className="absolute right-14 min-h-[32px] min-w-[32px] flex items-center justify-center text-[#8CA1C4] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            검색
          </button>
        </div>

        {/* Search mode segmented control */}
        <div className="hidden md:flex items-center p-1 rounded-xl bg-[#0B1324]/85 border border-sky-200/12 shrink-0">
          <button
            type="button"
            onClick={() => onModeChange('music')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              searchMode === 'music' ? 'bg-[#2563EB] text-white' : 'text-[#8CA1C4] hover:text-white'
            }`}
          >
            음악
          </button>
          <button
            type="button"
            onClick={() => onModeChange('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              searchMode === 'all' ? 'bg-[#2563EB] text-white' : 'text-[#8CA1C4] hover:text-white'
            }`}
          >
            키워드
          </button>
          <button
            type="button"
            onClick={() => onModeChange('channel')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              searchMode === 'channel' ? 'bg-[#2563EB] text-white' : 'text-[#8CA1C4] hover:text-white'
            }`}
          >
            채널
          </button>
        </div>
      </form>

      {/* Dropdown: Autocomplete Suggestions + Search History + Algorithmic Keywords */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl bg-[#0B1324]/95 backdrop-blur-md border border-sky-200/12 shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
          {/* Mobile mode toggle inside dropdown */}
          <div className="md:hidden flex items-center gap-1 p-2 border-b border-sky-200/[0.08]">
            {(['music', 'all', 'channel'] as SearchMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${
                  searchMode === m ? 'bg-[#2563EB] text-white' : 'text-[#8CA1C4] bg-white/[0.04]'
                }`}
              >
                {m === 'music' ? '음악 검색' : m === 'all' ? '키워드 통합' : '유튜브 채널'}
              </button>
            ))}
          </div>

          {suggestions.length > 0 && (
            <div className="py-2 border-b border-sky-200/[0.08]">
              <p className="px-4 py-1 text-[11px] font-semibold text-[#8CA1C4]">추천 검색어</p>
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    onQueryChange(sug);
                    setIsOpen(false);
                    onExecuteSearch(sug);
                  }}
                  className="w-full px-4 py-2 flex items-center gap-3 text-left text-sm text-[#EEF4FF] hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-[#8CA1C4] shrink-0" />
                  <span className="truncate">{sug}</span>
                </button>
              ))}
            </div>
          )}

          {filteredHistory.length > 0 && (
            <div className="py-2 border-b border-sky-200/[0.08]">
              <div className="px-4 py-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#8CA1C4]">최근 검색 기록</span>
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-[11px] text-[#8CA1C4] hover:text-[#60A5FA] cursor-pointer"
                >
                  전체 삭제
                </button>
              </div>
              {filteredHistory.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-1.5 hover:bg-white/[0.06] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode: SearchMode =
                        item.searchType === 'channel' ? 'channel' : searchMode;
                      onQueryChange(item.query);
                      if (item.searchType === 'channel') onModeChange('channel');
                      setIsOpen(false);
                      onExecuteSearch(item.query, nextMode);
                    }}
                    className="flex-1 min-w-0 flex items-center gap-3 py-1 text-left text-sm text-[#CBD5E1] cursor-pointer"
                  >
                    {item.searchType === 'channel' ? (
                      <Tv className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-[#5B7196] shrink-0" />
                    )}
                    <span className="truncate">{item.query}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteHistoryItem(item.id)}
                    aria-label={`${item.query} 검색 기록 삭제`}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#5B7196] hover:text-[#60A5FA] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {personalizedKeywords.length > 0 && (
            <div className="py-2.5 px-4">
              <p className="text-[11px] font-semibold text-[#8CA1C4] mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#60A5FA]" />
                <span>취향 기반 추천 키워드</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {personalizedKeywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      onQueryChange(kw);
                      setIsOpen(false);
                      onExecuteSearch(kw, 'music');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#13203B] hover:bg-[#1E325B] text-xs font-medium text-[#EEF4FF] transition-colors cursor-pointer"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
