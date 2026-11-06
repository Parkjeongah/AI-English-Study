import { CEFRLevel, ReviewGrade, ThoughtEntry, UserProficiency } from '../types';
import { calculateNextSRS, createInitialSRS } from './srs';

const ENTRIES_KEY = 'thoughtflow_entries_v1';
const PROFICIENCY_KEY = 'thoughtflow_proficiency_v1';
const NOTIFICATIONS_KEY = 'thoughtflow_notifications_v1';

const INITIAL_SEED_ENTRIES: ThoughtEntry[] = [
  {
    id: 'seed-1',
    originalText: '오늘 회사에서 너무 바빴는데 그래도 운동 갔다 와서 뿌듯하다.',
    inputMode: 'speech',
    createdAt: Date.now() - 36 * 60 * 60 * 1000, // 1.5 days ago
    detectedLanguage: 'korean',
    thoughtSummary: '바쁜 일과 후 운동을 마치고 느낀 성취감',
    assessedCefr: 'B1',
    grammarCorrections: [
      {
        original: 'I was busy at company today',
        correction: 'I had a hectic day at work today',
        explanation: "'company'는 법인 조직 자체를 뜻하므로, 근무 중인 상황은 'at work'를 사용하는 것이 자연스럽습니다.",
        category: 'word-choice',
      },
    ],
    recommendedExpressions: [
      {
        tone: 'natural',
        english: 'Work was pretty crazy today, but I still made it to the gym and feel so accomplished.',
        koreanMeaning: '오늘 일은 정신없었지만, 그래도 헬스장 다녀와서 정말 뿌듯해.',
        nuance: '원어민들이 퇴근 후 일상 대화나 SNS에서 가장 즐겨 쓰는 캐주얼하고 생생한 표현입니다.',
      },
      {
        tone: 'professional',
        english: 'Despite having a demanding workday, I managed to complete my workout and find it very rewarding.',
        koreanMeaning: '매우 바쁜 업무 일정이었음에도 불구하고, 운동을 마칠 수 있어 매우 보람찹니다.',
        nuance: '격식 있는 회화나 링크드인/커리어 일기에서 쓰기 적합한 정중하고 균형 잡힌 문장입니다.',
      },
      {
        tone: 'advanced',
        english: 'It was a grueling day at the office, yet squeezing in a workout gave me a tremendous sense of fulfillment.',
        koreanMeaning: '사무실에서 몹시 고된 하루였으나, 짬을 내어 한 운동이 엄청난 성취감을 안겨주었습니다.',
        nuance: 'grueling, squeezing in, fulfillment 등 고급 어휘와 구문이 돋보이는 CEFR C1 수준의 문장입니다.',
      },
    ],
    vocabulary: [
      {
        term: 'make it to',
        ipa: '/meɪk ɪt tuː/',
        meaning: '(시간에 맞추어/간신히) ~에 도착하다, 가다',
        example: 'I was running late, but I still made it to the meeting on time.',
      },
      {
        term: 'squeeze in',
        ipa: '/skwiːz ɪn/',
        meaning: '바쁜 일정 속에서 짬을 내어 ~하다',
        example: 'Can you squeeze in a 10-minute coffee chat before lunch?',
      },
      {
        term: 'sense of fulfillment',
        ipa: '/sɛns əv fʊlˈfɪlmənt/',
        meaning: '깊은 성취감, 충족감',
        example: 'Helping others provides a deep sense of fulfillment.',
      },
    ],
    coachingTip: '바쁜 상황을 단순히 "busy" 대신 "crazy", "hectic", "demanding" 등으로 다양하게 변주해 보세요!',
    mediaClips: [
      {
        title: 'Suits (미드 슈츠)',
        mediaType: '미드',
        character: 'Harvey Specter',
        sceneContext: '격무에 시달리면서도 타협 없이 결과를 만들어내며 상대 변호사를 압도하는 장면',
        quoteEn: "Work isn't about the hours you put in; it's about the results you deliver.",
        quoteKr: '일이란 얼마나 오래 앉아있었느냐가 아니라, 어떤 결과를 가져왔느냐의 문제야.',
        youtubeSearchQuery: 'Suits Harvey Specter results you deliver scene',
      },
      {
        title: 'The Intern (영화 인턴)',
        mediaType: '영화',
        character: 'Ben Whittaker (Robert De Niro)',
        sceneContext: '야근 후 번아웃에 빠진 젊은 CEO 줄스에게 삶의 균형과 성취에 대해 따뜻하게 조언하는 장면',
        quoteEn: "You're never wrong to do the right thing, no matter how exhausting the day was.",
        quoteKr: '아무리 피곤하고 고단한 하루였어도, 옳은 일을 한 선택은 결코 틀리지 않아요.',
        youtubeSearchQuery: 'The Intern Robert De Niro advice Jules scene',
      },
    ],
    selectedExpressionIndex: 0,
    srs: {
      repetition: 1,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: Date.now() - 2 * 60 * 60 * 1000, // Due today!
      lastReviewedAt: Date.now() - 24 * 60 * 60 * 1000,
      history: [{ date: Date.now() - 24 * 60 * 60 * 1000, score: 4 }],
    },
  },
  {
    id: 'seed-2',
    originalText: 'I think AI will change our daily life very much in the future.',
    inputMode: 'writing',
    createdAt: Date.now() - 72 * 60 * 60 * 1000, // 3 days ago
    detectedLanguage: 'english',
    thoughtSummary: '인공지능이 일상에 미칠 영향에 대한 예측',
    assessedCefr: 'A2',
    grammarCorrections: [
      {
        original: 'change our daily life very much',
        correction: 'dramatically reshape our daily lives',
        explanation: "'very much' 대신 'dramatically', 'profoundly' 같은 부사를 동사와 결합하면 표현력이 훨씬 풍부해집니다. 또한 'daily life'는 복수형 'daily lives'로 쓰는 경우가 많습니다.",
        category: 'collocation',
      },
    ],
    recommendedExpressions: [
      {
        tone: 'natural',
        english: 'I really believe AI is going to totally transform the way we live our day-to-day lives.',
        koreanMeaning: '난 AI가 우리의 일상생활 방식을 완전히 탈바꿈할 거라고 진심으로 믿어.',
        nuance: 'totally transform과 day-to-day lives를 활용하여 원어민의 자연스러운 호흡을 살린 표현입니다.',
      },
      {
        tone: 'professional',
        english: 'Artificial intelligence is poised to fundamentally redefine our daily routines and workflows.',
        koreanMeaning: '인공지능은 우리의 일상적 루틴과 업무 방식을 근본적으로 재정의할 준비가 되어 있습니다.',
        nuance: 'is poised to (~할 준비/태세가 되다), fundamentally redefine 등 프레젠테이션에 최적화된 표현입니다.',
      },
      {
        tone: 'advanced',
        english: 'The proliferation of AI is inevitably ushering in a paradigm shift across every facet of daily existence.',
        koreanMeaning: 'AI의 확산은 불가피하게 우리 일상의 모든 영역에 걸쳐 패러다임 전환을 도래시키고 있습니다.',
        nuance: 'ushering in, paradigm shift 등 학술적 토론 및 고급 논평에 적합한 CEFR C1/C2 문장입니다.',
      },
    ],
    vocabulary: [
      {
        term: 'be poised to',
        ipa: '/biː pɔɪzd tuː/',
        meaning: '~할 만반의 태세를 갖추다, 곧 ~할 것 같다',
        example: 'The tech market is poised to rebound this quarter.',
      },
      {
        term: 'day-to-day',
        ipa: '/ˌdeɪ.təˈdeɪ/',
        meaning: '일상적인, 매일매일의',
        example: 'He manages the day-to-day operations of the store.',
      },
    ],
    coachingTip: '생각을 말할 때 "I think" 대신 "I believe", "In my view", "I strongly suspect"를 교차 사용해 보세요.',
    mediaClips: [
      {
        title: 'Silicon Valley (미드 실리콘 밸리)',
        mediaType: '미드',
        character: 'Gavin Belson',
        sceneContext: '테크 컨퍼런스 기조연설에서 차세대 지능형 컴퓨팅이 인류 문명을 어떻게 재편할 것인지 역설하는 장면',
        quoteEn: 'This is not merely an incremental upgrade; it is fundamentally rewriting the human experience.',
        quoteKr: '이것은 단순한 점진적 업그레이드가 아닙니다. 인류의 경험 자체를 근본적으로 다시 쓰는 일입니다.',
        youtubeSearchQuery: 'Silicon Valley Gavin Belson keynote rewrite human experience',
      },
      {
        title: 'Sherlock (영드 셜록)',
        mediaType: '영드',
        character: 'Sherlock Holmes',
        sceneContext: '현대 사회의 빅데이터와 인과관계가 인간의 사소한 습관까지 예측하는 시대가 도래했음을 지적하는 장면',
        quoteEn: 'The world is governed by subtle algorithmic patterns most people are too blind to notice.',
        quoteKr: '세상은 대부분의 사람들이 너무 둔감해서 눈치채지 못하는 미묘한 알고리즘 패턴에 의해 움직이고 있어.',
        youtubeSearchQuery: 'Sherlock Benedict Cumberbatch patterns observation scene',
      },
    ],
    selectedExpressionIndex: 0,
    srs: {
      repetition: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: Date.now() - 1000, // Due right now
      lastReviewedAt: 0,
      history: [],
    },
  },
];

export const INITIAL_PROFICIENCY: UserProficiency = {
  currentLevel: 'B1',
  manualLevelOverride: false,
  totalEntries: 2,
  totalReviews: 1,
  reviewStreakDays: 3,
  lastActiveDate: new Date().toISOString().split('T')[0],
  grammarWeaknesses: {
    'prepositions': 2,
    'word-choice': 3,
    'tenses': 1,
    'articles': 2,
  },
};

export function loadEntries(): ThoughtEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(ENTRIES_KEY);
    if (!data) {
      saveEntries(INITIAL_SEED_ENTRIES);
      return INITIAL_SEED_ENTRIES;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load entries from localStorage', e);
    return INITIAL_SEED_ENTRIES;
  }
}

export function saveEntries(entries: ThoughtEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to save entries to localStorage', e);
  }
}

export function addEntry(entry: ThoughtEntry): ThoughtEntry[] {
  const current = loadEntries();
  const updated = [entry, ...current];
  saveEntries(updated);

  // Update proficiency stats
  const prof = loadProficiency();
  prof.totalEntries = updated.length;
  updateStreak(prof);
  saveProficiency(prof);

  return updated;
}

export function updateEntry(updatedEntry: ThoughtEntry): ThoughtEntry[] {
  const current = loadEntries();
  const updated = current.map(item => (item.id === updatedEntry.id ? updatedEntry : item));
  saveEntries(updated);
  return updated;
}

export function deleteEntry(id: string): ThoughtEntry[] {
  const current = loadEntries();
  const updated = current.filter(item => item.id !== id);
  saveEntries(updated);
  return updated;
}

export function recordSRSReview(entryId: string, grade: ReviewGrade): ThoughtEntry | null {
  const current = loadEntries();
  const entryIndex = current.findIndex(e => e.id === entryId);
  if (entryIndex === -1) return null;

  const target = current[entryIndex];
  const newSrs = calculateNextSRS(target.srs || createInitialSRS(), grade);
  const updatedEntry: ThoughtEntry = {
    ...target,
    srs: newSrs,
  };

  current[entryIndex] = updatedEntry;
  saveEntries(current);

  // Update proficiency review stats
  const prof = loadProficiency();
  prof.totalReviews += 1;
  updateStreak(prof);
  saveProficiency(prof);

  return updatedEntry;
}

export function loadProficiency(): UserProficiency {
  if (typeof window === 'undefined') return INITIAL_PROFICIENCY;
  try {
    const data = localStorage.getItem(PROFICIENCY_KEY);
    if (!data) {
      saveProficiency(INITIAL_PROFICIENCY);
      return INITIAL_PROFICIENCY;
    }
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_PROFICIENCY;
  }
}

export function saveProficiency(prof: UserProficiency): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFICIENCY_KEY, JSON.stringify(prof));
  } catch (e) {
    console.error('Failed to save proficiency', e);
  }
}

export function updateProficiencyLevel(newLevel: CEFRLevel, isManual = false) {
  const prof = loadProficiency();
  if (prof.manualLevelOverride && !isManual) {
    return prof; // Respect user manual choice
  }
  prof.currentLevel = newLevel;
  prof.manualLevelOverride = isManual;
  saveProficiency(prof);
  return prof;
}

function updateStreak(prof: UserProficiency) {
  const today = new Date().toISOString().split('T')[0];
  if (prof.lastActiveDate === today) return;

  const lastDate = new Date(prof.lastActiveDate);
  const currentDate = new Date(today);
  const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 1) {
    prof.reviewStreakDays += 1;
  } else if (diffDays > 1) {
    prof.reviewStreakDays = 1; // streak reset
  }
  prof.lastActiveDate = today;
}

// Web Notifications
export interface NotificationSettings {
  enabled: boolean;
  dailyTime: string; // "09:00"
}

export function loadNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return { enabled: false, dailyTime: '09:00' };
  try {
    const data = localStorage.getItem(NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : { enabled: false, dailyTime: '09:00' };
  } catch {
    return { enabled: false, dailyTime: '09:00' };
  }
}

export function saveNotificationSettings(settings: NotificationSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(settings));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function triggerBrowserReviewNotification(dueCount: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted' && dueCount > 0) {
    new Notification('ThoughtFlow 영어 복습 알림 🧠', {
      body: `오늘 망각곡선 주기에 도달한 표현이 ${dueCount}개 있습니다. 지금 3분 퀴즈로 장기 기억으로 전환하세요!`,
      icon: '/favicon.ico',
    });
  }
}
