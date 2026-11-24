import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600/95 px-3.5 py-2 text-xs font-medium text-white shadow-lg border border-amber-400/30"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>오프라인 상태 — 저장된 라이브러리만 표시됩니다</span>
    </div>
  );
};
