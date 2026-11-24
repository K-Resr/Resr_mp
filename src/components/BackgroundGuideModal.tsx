import React from 'react';
import {Headphones, MonitorPlay, Smartphone, Volume2, VolumeX, X} from 'lucide-react';

interface BackgroundGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  keepAliveEnabled: boolean;
  onToggleKeepAlive: () => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
}

export const BackgroundGuideModal: React.FC<BackgroundGuideModalProps> = ({
  isOpen,
  onClose,
  keepAliveEnabled,
  onToggleKeepAlive,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}) => {
  if (!isOpen) return null;

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[88dvh] flex flex-col rounded-2xl bg-[#0B1324] border border-sky-200/12 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-sky-200/[0.08]">
          <div>
            <h2 className="text-lg font-semibold text-[#EEF4FF]">앱 음량 및 백그라운드 재생 설정</h2>
            <p className="mt-1 text-sm text-[#8CA1C4]">
              기기 볼륨과 별도로 앱 내 음량과 백그라운드 재생 옵션을 조절합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="안내 닫기"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#8CA1C4] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4 text-sm">
          {/* App-level Volume Control */}
          <div className="rounded-xl bg-[#13203B] p-4 border border-sky-200/[0.08] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[#EEF4FF]">앱 자체 음량 조절</p>
                <p className="mt-0.5 text-xs text-[#8CA1C4]">
                  현재 재생 중이거나 다음에 재생할 트랙의 앱 출력 음량을 설정합니다.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-[#60A5FA] shrink-0">
                {isMuted ? '음소거' : `${volume}%`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? '음소거 해제' : '음소거'}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#050914] border border-sky-200/12 text-[#EEF4FF] hover:border-sky-300/30 transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#60A5FA]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={effectiveVolume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                aria-label="앱 자체 음량"
                className="velo-range flex-1 h-5"
                style={{
                  backgroundImage: `linear-gradient(to right, #3B82F6 ${effectiveVolume}%, rgba(147,197,253,0.18) ${effectiveVolume}%)`,
                  backgroundSize: '100% 4px',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((preset) => {
                const isSelected = !isMuted && volume === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onVolumeChange(preset)}
                    className={`py-1.5 rounded-lg text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563EB] text-white font-semibold'
                        : 'bg-[#050914] border border-sky-200/10 text-[#CBD5E1] hover:border-sky-300/25'
                    }`}
                  >
                    {preset}%
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-[#13203B] p-4 border border-sky-200/[0.08]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-[#EEF4FF]">백그라운드 오디오 세션 유지</p>
                <p className="mt-1 text-xs text-[#8CA1C4]">
                  네이티브 오디오 스트림, 워커 타이머 및 Media Session API를 연동해 화면이 꺼져도 재생과 다음 곡 전환이 이어집니다.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleKeepAlive}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  keepAliveEnabled
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white/10 text-[#8CA1C4] hover:text-white'
                }`}
              >
                {keepAliveEnabled ? '사용 중' : '꺼짐'}
              </button>
            </div>
          </div>

          <div className="space-y-3 text-[#8CA1C4]">
            <div className="flex items-start gap-3">
              <MonitorPlay className="w-5 h-5 text-[#EEF4FF] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#EEF4FF]">PC 데스크톱 (Chrome / Edge / Safari)</p>
                <p className="mt-0.5 leading-relaxed">
                  다른 탭으로 이동하거나 창을 최소화해도 재생이 계속되며, 키보드 미디어 키로 곡을 넘길 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-[#EEF4FF] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#EEF4FF]">Android 모바일 백그라운드 안내</p>
                <p className="mt-0.5 leading-relaxed">
                  내 파일 트랙과 서버 직접 오디오 스트림은 화면을 꺼도 끊김 없이 재생됩니다. 단, YouTube 봇 차단으로 임베드 플레이어로 전환된 경우 Android Chrome 자체 정책상 화면이 꺼지면 영상이 정지될 수 있으며, 삼성 인터넷(백그라운드 재생 켜기) 또는 Brave 브라우저나 자체 서버의 쿠키 설정 시 안정적으로 유지됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Headphones className="w-5 h-5 text-[#EEF4FF] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#EEF4FF]">iPhone / iPad (iOS Safari)</p>
                <p className="mt-0.5 leading-relaxed">
                  오디오 트랙은 화면을 꺼도 이어서 재생되며, 기기 절전 정책으로 일시 정지된 경우 잠금 화면의 재생(▶) 버튼으로 즉시 이어 들을 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-6 pb-5 pt-3 border-t border-sky-200/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
