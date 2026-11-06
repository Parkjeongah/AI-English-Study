import React, { useState } from 'react';
import { X, Bell, CheckCircle2, Clock } from 'lucide-react';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  triggerBrowserReviewNotification,
} from '../lib/storage';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dueCount: number;
  onGoToReview: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  dueCount,
  onGoToReview,
}) => {
  const [settings, setSettings] = useState(loadNotificationSettings());

  if (!isOpen) return null;

  const handleToggle = async () => {
    if (!settings.enabled) {
      const ok = await requestNotificationPermission();
      if (!ok) {
        alert('브라우저 알림 권한을 승인해주세요.');
        return;
      }
    }
    const updated = { ...settings, enabled: !settings.enabled };
    setSettings(updated);
    saveNotificationSettings(updated);
  };

  const handleTest = () => {
    triggerBrowserReviewNotification(dueCount || 3);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              주기적 복습 알림 설정
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {dueCount > 0 && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-rose-800 dark:text-rose-300">
                오늘 복습할 표현이 {dueCount}개 대기 중입니다!
              </p>
              <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-0.5">
                지금 복습하면 망각곡선 90% 이상 기억선이 유지됩니다.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onGoToReview();
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs shrink-0 ml-2"
            >
              지금 복습
            </button>
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">데스크톱 푸시 알림 허용</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                앱을 켜두지 않아도 복습 주기에 맞춰 알림 수신
              </p>
            </div>
            <button
              onClick={handleToggle}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                settings.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  settings.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              알림 동작 확인 (테스트)
            </span>
            <button
              onClick={handleTest}
              className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              알림 띄우기
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
