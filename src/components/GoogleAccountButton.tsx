import React from 'react';
import type {User} from 'firebase/auth';
import {LogOut} from 'lucide-react';

interface GoogleAccountButtonProps {
  user: User | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  compact?: boolean;
}

const GoogleGIcon: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export const GoogleAccountButton: React.FC<GoogleAccountButtonProps> = ({
  user,
  authLoading,
  onSignIn,
  onSignOut,
  compact = false,
}) => {
  if (authLoading) {
    return (
      <div className="h-10 w-28 rounded-lg bg-white/[0.04] border border-white/[0.06]" />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className={`flex items-center justify-center gap-2.5 rounded-lg bg-white text-[#1F2937] hover:bg-[#F3F4F6] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm ${
          compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'w-full px-3.5 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <GoogleGIcon />
        <span>Google 계정 연동</span>
      </button>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Google 프로필'}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full object-cover border border-white/15"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center">
            {(user.displayName || user.email || 'G')[0].toUpperCase()}
          </div>
        )}
        <span className="hidden md:inline text-xs font-medium text-[#EEF4FF] max-w-[120px] truncate">
          {user.displayName || user.email}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Google 로그아웃"
          title="로그아웃"
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#050914]/80 border border-sky-200/10 p-3 flex items-center gap-3">
      {user.photoURL ? (
        <img
          src={user.photoURL}
          alt={user.displayName || 'Google 프로필'}
          referrerPolicy="no-referrer"
          className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[#2563EB] text-white text-xs font-semibold flex items-center justify-center shrink-0">
          {(user.displayName || user.email || 'G')[0].toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#EEF4FF] truncate">
          {user.displayName || 'Google 사용자'}
        </p>
        <p className="text-[11px] text-[#8CA1C4] truncate">클라우드 동기화됨</p>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="로그아웃"
        title="로그아웃"
        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-white hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};
