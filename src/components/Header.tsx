import React from 'react';
import { Sun, Moon, Sparkles, BookOpen, Mic, Repeat, BarChart3, Bell, Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HeaderProps {
  activeTab: 'thought' | 'review' | 'shadowing' | 'analytics';
  setActiveTab: (tab: 'thought' | 'review' | 'shadowing' | 'analytics') => void;
  dueCount: number;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenNotifications: () => void;
  onOpenInstallGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  dueCount,
  darkMode,
  setDarkMode,
  onOpenNotifications,
  onOpenInstallGuide,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const handleHeaderInstall = async () => {
    if (isInstallable) {
      await install();
    } else {
      onOpenInstallGuide();
    }
  };
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            ThoughtFlow
          </span>
        </div>

        {/* Zone 2: Navigation Links (Single-line, unboxed text links) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('thought')}
            className={`flex items-center gap-1.5 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'thought'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>생각 표현 & 교정</span>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`flex items-center gap-1.5 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 relative ${
              activeTab === 'review'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>망각곡선 복습</span>
            {dueCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[11px] font-bold rounded-full tabular-nums">
                {dueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('shadowing')}
            className={`flex items-center gap-1.5 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'shadowing'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>원어민 섀도잉</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'analytics'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>학습 분석</span>
          </button>
        </nav>

        {/* Zone 3: Actions (Review notification trigger & Dark Mode) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onOpenNotifications}
            title="복습 알림 설정"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {dueCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {!isInstalled && (
            <button
              onClick={handleHeaderInstall}
              title="홈 화면에 앱 설치하기"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800 rounded-lg transition-colors shadow-2xs whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">앱 설치</span>
            </button>
          )}

          {dueCount > 0 && (
            <button
              onClick={() => setActiveTab('review')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              <span>복습하기</span>
              <span className="px-1.5 py-0.5 bg-indigo-700 rounded text-[10px] tabular-nums">
                {dueCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 dark:border-slate-800 py-1.5 px-2 bg-slate-50 dark:bg-slate-900/50">
        <button
          onClick={() => setActiveTab('thought')}
          className={`flex flex-col items-center py-1 px-2 text-xs ${
            activeTab === 'thought'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Mic className="w-4 h-4 mb-0.5" />
          <span>표현·교정</span>
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`flex flex-col items-center py-1 px-2 text-xs relative ${
            activeTab === 'review'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5" />
          <span>망각 복습</span>
          {dueCount > 0 && (
            <span className="absolute top-0 right-1 px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full tabular-nums">
              {dueCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('shadowing')}
          className={`flex flex-col items-center py-1 px-2 text-xs ${
            activeTab === 'shadowing'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Repeat className="w-4 h-4 mb-0.5" />
          <span>섀도잉</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center py-1 px-2 text-xs ${
            activeTab === 'analytics'
              ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5" />
          <span>학습 분석</span>
        </button>
      </div>
    </header>
  );
};
