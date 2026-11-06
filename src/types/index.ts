export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type ToneType = 'natural' | 'professional' | 'advanced';

export interface GrammarCorrection {
  original: string;
  correction: string;
  explanation: string;
  category?: string;
}

export interface RecommendedExpression {
  tone: ToneType | string;
  english: string;
  koreanMeaning: string;
  nuance: string;
}

export interface VocabularyItem {
  term: string;
  ipa?: string;
  meaning: string;
  example: string;
}

export interface SRSHistoryEntry {
  date: number;
  score: number; // 0 to 5
}

export interface SRSData {
  repetition: number;
  interval: number; // in days
  easeFactor: number; // starts at 2.5
  nextReviewDate: number; // timestamp
  lastReviewedAt: number;
  history: SRSHistoryEntry[];
}

export interface MediaClip {
  title: string; // e.g. "Suits (슈츠)"
  mediaType: '미드' | '영드' | '영화' | string;
  character: string; // e.g. "Harvey Specter"
  sceneContext: string; // e.g. "협상 테이블에서 주도권을 잡기 위해 단호하게 말하는 장면"
  quoteEn: string;
  quoteKr: string;
  youtubeSearchQuery: string;
}

export interface ThoughtEntry {
  id: string;
  originalText: string;
  inputMode: 'speech' | 'writing';
  createdAt: number;
  detectedLanguage?: string;
  thoughtSummary?: string;
  assessedCefr: CEFRLevel;
  grammarCorrections: GrammarCorrection[];
  recommendedExpressions: RecommendedExpression[];
  vocabulary: VocabularyItem[];
  coachingTip?: string;
  mediaClips?: MediaClip[];
  selectedExpressionIndex: number;
  srs: SRSData;
  isQuotaExceeded?: boolean;
  quotaNotice?: string;
}

export interface InspirationPrompt {
  category: string;
  questionKr: string;
  questionEn: string;
  hintVocabulary: string[];
  starterSentence: string;
  isQuotaExceeded?: boolean;
  quotaNotice?: string;
}

export interface UserProficiency {
  currentLevel: CEFRLevel;
  manualLevelOverride: boolean;
  totalEntries: number;
  totalReviews: number;
  reviewStreakDays: number;
  lastActiveDate: string;
  grammarWeaknesses: Record<string, number>;
}

export interface WeeklyReportData {
  overallStrengths: string[];
  recurringMistakes: string[];
  recommendationForNextWeek: string;
  encouragement: string;
}

export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;
// 0: Complete blackout
// 1: Incorrect, but remembered after seeing answer
// 2: Incorrect, but seemed easy to recall
// 3: Correct response recalled with serious difficulty
// 4: Correct response after a hesitation
// 5: Perfect response without hesitation
