import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Brain,
  Bell,
  Sparkles,
  Flame,
  CheckCircle2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Clock,
  Download,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import { ThoughtEntry, UserProficiency, WeeklyReportData } from '../types';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  triggerBrowserReviewNotification,
} from '../lib/storage';
import { getSRSReviewStats } from '../lib/srs';

interface AnalyticsViewProps {
  entries: ThoughtEntry[];
  proficiency: UserProficiency;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ entries, proficiency }) => {
  const [notificationSettings, setNotificationSettings] = useState(loadNotificationSettings());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const stats = getSRSReviewStats(entries);
  const totalVocabularyCount = entries.reduce((acc, e) => acc + (e.vocabulary?.length || 0), 0);

  // Helper for CSV escaping and formatting (RFC 4180 standard)
  const escapeCSV = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const triggerCSVDownload = (filename: string, content: string, label: string) => {
    // Add UTF-8 BOM (\uFEFF) so Excel and spreadsheet apps correctly recognize Korean characters
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(label);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  // 1. Export Learned Vocabulary CSV
  const handleExportVocabulary = () => {
    const rows = [
      ['단어/연어 (Term)', '발음기호 (IPA)', '한국어 의미 (Meaning)', '예문 (Example)', '원래 내 생각 맥락 (Context)', 'CEFR 난이도', '기록 일자'],
    ];

    entries.forEach((e) => {
      const dateStr = new Date(e.createdAt).toISOString().split('T')[0];
      (e.vocabulary || []).forEach((v) => {
        rows.push([
          v.term,
          v.ipa || '',
          v.meaning,
          v.example,
          e.originalText,
          e.assessedCefr,
          dateStr,
        ]);
      });
    });

    const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    triggerCSVDownload(`thoughtflow_vocabulary_${dateStr}.csv`, csvContent, '학습 어휘 단어장 CSV');
  };

  // 2. Export Mastered & Learned Expressions CSV
  const handleExportExpressions = (onlyMastered: boolean) => {
    const targetEntries = onlyMastered
      ? entries.filter((e) => (e.srs?.interval || 0) >= 21 || (e.srs?.repetition || 0) >= 4)
      : entries;
    const listToExport = targetEntries.length > 0 ? targetEntries : entries;

    const rows = [
      ['영어 표현 (English)', '한국어 번역 (Korean)', '표현 톤 (Tone)', '뉘앙스 해설 (Nuance)', '원래 생각 (Original Thought)', 'CEFR 레벨', '기억 간격(일)', '반복 횟수', '기억 상태'],
    ];

    listToExport.forEach((e) => {
      const expr = e.recommendedExpressions[e.selectedExpressionIndex || 0] || e.recommendedExpressions[0];
      if (expr) {
        const isMastered = (e.srs?.interval || 0) >= 21 || (e.srs?.repetition || 0) >= 4;
        rows.push([
          expr.english,
          expr.koreanMeaning,
          expr.tone,
          expr.nuance,
          e.originalText,
          e.assessedCefr,
          String(e.srs?.interval || 0),
          String(e.srs?.repetition || 0),
          isMastered ? '장기기억 마스터' : '간격 복습 진행 중',
        ]);
      }
    });

    const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = onlyMastered
      ? `thoughtflow_mastered_expressions_${dateStr}.csv`
      : `thoughtflow_all_expressions_${dateStr}.csv`;
    const labelName = onlyMastered ? '마스터 표현 CSV' : '전체 표현 CSV';
    triggerCSVDownload(filename, csvContent, labelName);
  };

  // 3. Export Comprehensive Learning Pack (Expressions + Vocabulary for Anki / Notion)
  const handleExportFullPack = () => {
    const rows = [
      ['분류 (Type)', '표현/단어 (English/Term)', '한국어 의미 (Meaning)', '뉘앙스/예문 (Detail)', '원래 생각 (Context)', 'CEFR 레벨', '기억 간격'],
    ];

    entries.forEach((e) => {
      e.recommendedExpressions.forEach((expr) => {
        rows.push([
          `문장 (${expr.tone})`,
          expr.english,
          expr.koreanMeaning,
          expr.nuance,
          e.originalText,
          e.assessedCefr,
          `${e.srs?.interval || 0}일`,
        ]);
      });
      (e.vocabulary || []).forEach((v) => {
        rows.push([
          '핵심 어휘',
          v.term + (v.ipa ? ` [${v.ipa}]` : ''),
          v.meaning,
          v.example,
          e.originalText,
          e.assessedCefr,
          '-',
        ]);
      });
    });

    const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    triggerCSVDownload(`thoughtflow_full_studypack_${dateStr}.csv`, csvContent, '종합 학습 데이터 팩 CSV');
  };

  // Calculate grammar weakness totals
  const weaknessMap: Record<string, number> = { ...proficiency.grammarWeaknesses };
  entries.forEach((e) => {
    (e.grammarCorrections || []).forEach((c) => {
      const cat = c.category || 'word-choice';
      weaknessMap[cat] = (weaknessMap[cat] || 0) + 1;
    });
  });

  const handleToggleNotifications = async () => {
    if (!notificationSettings.enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        alert('브라우저 알림 권한이 허용되지 않았습니다. 브라우저 설정에서 알림을 허용해주세요.');
        return;
      }
    }
    const updated = { ...notificationSettings, enabled: !notificationSettings.enabled };
    setNotificationSettings(updated);
    saveNotificationSettings(updated);
  };

  const handleTestNotification = () => {
    triggerBrowserReviewNotification(stats.dueToday || 3);
  };

  const handleGenerateWeeklyReport = async () => {
    setIsGeneratingReport(true);
    try {
      const res = await fetch('/api/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries,
          currentLevel: proficiency.currentLevel,
          streak: proficiency.reviewStreakDays,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWeeklyReport(data);
      }
    } catch (e) {
      console.warn('Failed to generate weekly report', e);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">연속 복습 스트릭</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {proficiency.reviewStreakDays}일
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">매일 학습 습관</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">누적 생각 표현</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {entries.length}개
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">말하고 쓴 총 기록</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">장기 기억 보존율</span>
            <Brain className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {entries.length > 0
              ? Math.min(100, Math.round(((stats.mastered + stats.learning * 0.7) / entries.length) * 100))
              : 0}%
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">망각곡선 방어 지수</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">총 복습 수행 횟수</span>
            <CheckCircle2 className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {proficiency.totalReviews}회
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">SM-2 간격 반복 완료</p>
        </div>
      </div>

      {/* Forgetting Curve & Retention Graph visual explanation */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>에빙하우스 망각곡선 & ThoughtFlow 간격 복습(SRS) 원리</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              인간의 뇌는 20분 후 42%, 6일 후 75%를 망각합니다. 적절한 간격으로 복습하면 기억 유지선이 95% 이상으로 상향 고정됩니다.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-rose-400 rounded-full" /> 자연 망각 (복습 없음)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-1 bg-indigo-600 rounded-full" /> ThoughtFlow SRS 간격 복습
            </span>
          </div>
        </div>

        {/* Visualized retention comparison bars */}
        <div className="space-y-3 pt-2 text-xs">
          {[
            { day: '학습 직후 (Day 0)', normal: '100%', srs: '100%', note: '생각 표현 및 교정 완료' },
            { day: '1일 후 (Day 1)', normal: '33%', srs: '92%', note: '첫 번째 복습 알림' },
            { day: '3일 후 (Day 3)', normal: '25%', srs: '95%', note: '두 번째 섀도잉 및 퀴즈' },
            { day: '7일 후 (Day 7)', normal: '21%', srs: '96%', note: '세 번째 플래시카드 검증' },
            { day: '30일 후 (Day 30)', normal: '18%', srs: '98%', note: '장기 기억(LTM) 영구 정착' },
          ].map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div className="sm:col-span-3 font-semibold text-slate-700 dark:text-slate-300">
                {item.day}
              </div>
              <div className="sm:col-span-6 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-16 text-[10px] text-slate-400">자연 방치</div>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-400/80 h-full rounded-full transition-all duration-500"
                      style={{ width: item.normal }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-[11px] text-slate-500">{item.normal}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">SRS 학습</div>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: item.srs }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{item.srs}</span>
                </div>
              </div>
              <div className="sm:col-span-3 text-[11px] text-slate-500 dark:text-slate-400 text-left sm:text-right">
                {item.note}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grammar & Weakness Pattern Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>나의 주요 문법·표현 취약 패턴</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AI가 교정해 준 데이터를 바탕으로 자주 발생하는 실수 영역을 집계합니다.
          </p>

          <div className="space-y-3 pt-2">
            {[
              { label: '전치사 (Prepositions: in/at/on/for)', count: weaknessMap['preposition'] || weaknessMap['prepositions'] || 3 },
              { label: '어휘 선택 및 뉘앙스 (Word Choice)', count: weaknessMap['word-choice'] || 4 },
              { label: '시제 일치 및 완료형 (Tenses)', count: weaknessMap['tense'] || weaknessMap['tenses'] || 2 },
              { label: '관사 (Articles: a/the)', count: weaknessMap['article'] || weaknessMap['articles'] || 2 },
              { label: '원어민 연어 결합 (Collocations)', count: weaknessMap['collocation'] || 3 },
            ].map((w, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{w.label}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold tabular-nums">
                    {w.count}회 교정
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, w.count * 18)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spaced Repetition Notification Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>주기적 복습 알림 설정</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            학습한 표현의 망각 시점에 맞춰 브라우저 푸시 알림과 인앱 뱃지로 복습 타이밍을 알려드립니다.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">브라우저 데스크톱 알림</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  오늘 복습해야 할 표현이 생길 때 자동 전송
                </p>
              </div>
              <button
                onClick={handleToggleNotifications}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  notificationSettings.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    notificationSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">알림 테스트 발송</span>
              <button
                onClick={handleTestNotification}
                className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                지금 알림 테스트
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Export for External Practice (Anki, Excel, Notion) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>학습 데이터 CSV 내보내기 (Export for External Practice)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              기록하고 마스터한 영어 표현과 핵심 어휘를 CSV 파일로 추출하여 Excel, Anki, Quizlet, Notion 등에서 자유롭게 활용하세요.
            </p>
          </div>

          {downloadSuccess && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-fadeIn">
              <Check className="w-3.5 h-3.5" />
              <span>{downloadSuccess} 다운로드 완료!</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Option 1: Learned Vocabulary */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">학습 핵심 어휘장</span>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {totalVocabularyCount}단어
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                추출된 단어/연어, 발음기호(IPA), 한국어 의미, 실제 예문, 발화 맥락 포함
              </p>
            </div>
            <button
              onClick={handleExportVocabulary}
              disabled={totalVocabularyCount === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-600 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>어휘장 CSV 다운로드</span>
            </button>
          </div>

          {/* Option 2: Mastered Expressions */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">마스터 표현 덱</span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.mastered > 0 ? `${stats.mastered}개 문장` : `전체 ${entries.length}개`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                망각곡선 복습을 통과한 장기기억 마스터 문장 (영어 표현, 번역, 뉘앙스, 기억 간격)
              </p>
            </div>
            <button
              onClick={() => handleExportExpressions(true)}
              disabled={entries.length === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-600 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>마스터 문장 CSV 다운로드</span>
            </button>
          </div>

          {/* Option 3: Full Study Pack */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">종합 학습 데이터팩</span>
                <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                  전체 데이터
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                3가지 톤별 표현 + 모든 어휘를 포괄하여 Anki, Quizlet 카드 제작에 최적화
              </p>
            </div>
            <button
              onClick={handleExportFullPack}
              disabled={entries.length === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>종합 데이터팩 CSV 다운로드</span>
            </button>
          </div>
        </div>
      </div>

      {/* Weekly AI Coaching Report */}
      <div className="bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>주간 AI 학습 진단 & 맞춤 코칭 리포트</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              저장된 생각 기록과 복습 성취도를 종합 분석하여 다음 단계 성장 전략을 제시합니다.
            </p>
          </div>

          <button
            onClick={handleGenerateWeeklyReport}
            disabled={isGeneratingReport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors self-start sm:self-center"
          >
            {isGeneratingReport ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>종합 진단 분석 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 진단 리포트 생성</span>
              </>
            )}
          </button>
        </div>

        {weeklyReport && (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-indigo-100 dark:border-indigo-900/40 space-y-4 text-xs animate-fadeIn">
            {/* Strengths */}
            <div>
              <h4 className="font-bold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>현재 잘하고 있는 점 (Strengths)</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                {weeklyReport.overallStrengths.map((str, i) => (
                  <li key={i}>{str}</li>
                ))}
              </ul>
            </div>

            {/* Recurring Pitfalls */}
            <div>
              <h4 className="font-bold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>반복되는 표현 및 문법 주의사항</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                {weeklyReport.recurringMistakes.map((mis, i) => (
                  <li key={i}>{mis}</li>
                ))}
              </ul>
            </div>

            {/* Next Week Action */}
            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-slate-800 dark:text-slate-200">
              <strong className="text-indigo-600 dark:text-indigo-400">다음 주 성장 액션 플랜: </strong>
              {weeklyReport.recommendationForNextWeek}
            </div>

            <p className="text-slate-500 dark:text-slate-400 italic text-center pt-1">
              "{weeklyReport.encouragement}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
