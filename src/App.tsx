import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ThoughtStudio } from './components/ThoughtStudio';
import { ReviewDeck } from './components/ReviewDeck';
import { ShadowingStudio } from './components/ShadowingStudio';
import { AnalyticsView } from './components/AnalyticsView';
import { NotificationModal } from './components/NotificationModal';
import { PWAInstallBanner, PWAInstallGuideModal } from './components/PWAInstallBanner';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  loadEntries,
  addEntry,
  recordSRSReview,
  loadProficiency,
  updateProficiencyLevel,
  loadNotificationSettings,
  triggerBrowserReviewNotification,
} from './lib/storage';
import { getSRSReviewStats, isDueForReview } from './lib/srs';
import { CEFRLevel, ReviewGrade, ThoughtEntry, UserProficiency } from './types';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('thoughtflow_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState<'thought' | 'review' | 'shadowing' | 'analytics'>('thought');
  const [entries, setEntries] = useState<ThoughtEntry[]>(() => loadEntries());
  const [proficiency, setProficiency] = useState<UserProficiency>(() => loadProficiency());
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);

  // Sync dark mode class on document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('thoughtflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('thoughtflow_theme', 'light');
    }
  }, [darkMode]);

  // Periodic review check for notifications
  useEffect(() => {
    const checkReviews = () => {
      const stats = getSRSReviewStats(entries);
      const settings = loadNotificationSettings();
      if (settings.enabled && stats.dueToday > 0) {
        triggerBrowserReviewNotification(stats.dueToday);
      }
    };

    // Check once on mount after 3 seconds
    const initialTimer = setTimeout(checkReviews, 3000);
    // Recurring check every 15 minutes
    const intervalTimer = setInterval(checkReviews, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [entries]);

  const handleSaveEntry = (newEntry: ThoughtEntry) => {
    const updated = addEntry(newEntry);
    setEntries(updated);
    setProficiency(loadProficiency());
  };

  const handleRecordReview = (id: string, grade: ReviewGrade) => {
    recordSRSReview(id, grade);
    setEntries(loadEntries());
    setProficiency(loadProficiency());
  };

  const handleUpdateLevel = (level: CEFRLevel, isManual: boolean) => {
    const updated = updateProficiencyLevel(level, isManual);
    setProficiency({ ...updated });
  };

  const stats = getSRSReviewStats(entries);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <PWAInstallBanner />
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dueCount={stats.dueToday}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'thought' && (
          <ThoughtStudio
            proficiency={proficiency}
            onSaveEntry={handleSaveEntry}
            onUpdateLevel={handleUpdateLevel}
            onNavigateToShadowing={() => setActiveTab('shadowing')}
          />
        )}

        {activeTab === 'review' && (
          <ReviewDeck
            entries={entries}
            onRecordReview={handleRecordReview}
            onNavigateToThought={() => setActiveTab('thought')}
          />
        )}

        {activeTab === 'shadowing' && (
          <ShadowingStudio
            entries={entries}
            onNavigateToThought={() => setActiveTab('thought')}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView entries={entries} proficiency={proficiency} />
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-4 bg-white dark:bg-slate-900/60 transition-colors text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>
            <strong>ThoughtFlow English</strong> · 생각을 영어로 말하고 쓰고 망각곡선으로 기억하다
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span>CEFR 적응형 엔진</span>
            <span>·</span>
            <span>Web Speech 음성인식 & TTS</span>
            <span>·</span>
            <span>SM-2 망각곡선</span>
          </div>
        </div>
      </footer>

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        dueCount={stats.dueToday}
        onGoToReview={() => setActiveTab('review')}
      />

      <PWAInstallGuideModal
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
}
