import React, {useState} from 'react';
import {Download, Share} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({compact = false}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'w-full px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>앱으로 설치</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-2 rounded-lg border border-sky-200/15 bg-white/[0.04] hover:bg-white/[0.08] text-[#EEF4FF] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'w-full px-4 py-2.5 text-sm min-h-[44px]'
          }`}
        >
          <Share className="w-4 h-4 shrink-0" />
          <span>iOS 앱 설치</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0B1324] border border-sky-200/12 p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-[#EEF4FF]">iPhone / iPad 홈 화면에 추가</h3>
              <p className="mt-3 text-sm text-[#8CA1C4] leading-relaxed">
                Safari에서 앱처럼 설치하면 전체 화면과 잠금 화면 미디어 제어를 더 안정적으로 사용할 수 있습니다.
              </p>
              <ol className="mt-4 space-y-2 text-sm text-[#EEF4FF]">
                <li>1. 하단 또는 상단 Safari 툴바의 공유 버튼을 누르세요.</li>
                <li>2. 아래로 스크롤해 &ldquo;홈 화면에 추가&rdquo;를 선택하세요.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-colors cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
