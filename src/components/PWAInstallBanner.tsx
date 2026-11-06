import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Share2, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallGuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const { isIOS } = usePWAInstall();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isIOS ? 'iPhone / iPad 앱 설치 안내' : '안드로이드 폰 앱 설치 안내'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">
              Safari 브라우저에서 간편하게 홈 화면에 추가할 수 있습니다:
            </p>
            <ol className="space-y-2 list-decimal list-inside bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <li>
                하단 툴바의 <strong>공유(Share)</strong> 아이콘 <Share2 className="w-3.5 h-3.5 inline mx-0.5" /> 터치
              </li>
              <li>메뉴 목록을 내려 <strong>'홈 화면에 추가'</strong> 선택</li>
              <li>우측 상단 <strong>'추가'</strong>를 누르면 설치 완료!</li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">
              Chrome 또는 삼성 인터넷 브라우저에서 설치하는 방법:
            </p>
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <p>
                  브라우저 우측 상단 <strong>더보기 메뉴 [⋮]</strong>를 터치합니다.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <p>
                  메뉴에서 <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong>를 누릅니다.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <p>
                  확인을 누르면 스마트폰 앱 서랍과 홈 화면에 ThoughtFlow 아이콘이 설치됩니다.
                </p>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-900 dark:text-indigo-200">
              ✨ <strong>PWA 장점: </strong> 브라우저 주소창 없이 전체화면으로 실행되며, 음성 인식과 오프라인 복습을 네이티브 앱처럼 이용할 수 있습니다.
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
        >
          확인
        </button>
      </div>
    </div>
  );
};

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // If already running in standalone mode or dismissed by user
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {/* Top Mobile/Desktop Install Promotion Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white px-4 py-2.5 text-xs shadow-sm relative z-30 transition-all">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <div>
              <span className="font-bold">안드로이드 폰 홈 화면에 앱으로 설치하기</span>
              <span className="hidden sm:inline text-indigo-200 ml-1.5">
                · 브라우저 주소창 없이 오프라인 지원 및 전체 화면 앱으로 실행됩니다.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-center">
            <button
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-900 font-bold rounded-lg transition-all shadow-xs hover:scale-102"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isInstallable ? '원클릭 앱 설치' : '설치 방법 보기'}</span>
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-indigo-300 hover:text-white rounded-md transition-colors"
              title="배너 닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <PWAInstallGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
};
