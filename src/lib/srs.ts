import { ReviewGrade, SRSData, ThoughtEntry } from '../types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function createInitialSRS(): SRSData {
  return {
    repetition: 0,
    interval: 0, // 0 means new/due immediately or today
    easeFactor: 2.5,
    nextReviewDate: Date.now(), // due today
    lastReviewedAt: 0,
    history: [],
  };
}

/**
 * SuperMemo-2 (SM-2) spaced repetition algorithm calculation
 * @param current Current SRS state
 * @param grade Score from 0 (forgot completely) to 5 (perfect recall)
 */
export function calculateNextSRS(current: SRSData, grade: ReviewGrade): SRSData {
  let { repetition, interval, easeFactor, history } = current;

  // Update ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEaseFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  );

  let newRepetition = repetition;
  let newInterval = interval;

  if (grade >= 3) {
    // Successful recall
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 3;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
    newRepetition += 1;
  } else {
    // Failed recall: reset repetition count and review again tomorrow (or today)
    newRepetition = 0;
    newInterval = 1;
  }

  const now = Date.now();
  const nextReviewDate = now + newInterval * ONE_DAY_MS;

  return {
    repetition: newRepetition,
    interval: newInterval,
    easeFactor: Number(newEaseFactor.toFixed(2)),
    nextReviewDate,
    lastReviewedAt: now,
    history: [...history, { date: now, score: grade }],
  };
}

/**
 * Check if an entry is due for review as of right now
 */
export function isDueForReview(entry: ThoughtEntry, targetTime = Date.now()): boolean {
  if (!entry.srs) return true;
  return entry.srs.nextReviewDate <= targetTime;
}

/**
 * Get comprehensive queue statistics
 */
export function getSRSReviewStats(entries: ThoughtEntry[]) {
  const now = Date.now();
  const tomorrow = now + ONE_DAY_MS;

  let dueToday = 0;
  let dueTomorrow = 0;
  let mastered = 0; // interval >= 21 days or repetition >= 5
  let learning = 0; // interval < 21 days

  for (const entry of entries) {
    const srs = entry.srs || createInitialSRS();
    if (srs.nextReviewDate <= now) {
      dueToday++;
    } else if (srs.nextReviewDate <= tomorrow) {
      dueTomorrow++;
    }

    if (srs.interval >= 21 || srs.repetition >= 5) {
      mastered++;
    } else {
      learning++;
    }
  }

  return {
    total: entries.length,
    dueToday,
    dueTomorrow,
    mastered,
    learning,
  };
}

/**
 * Helper to display human-friendly interval
 */
export function formatInterval(intervalDays: number): string {
  if (intervalDays <= 0) return '오늘 (즉시)';
  if (intervalDays === 1) return '1일 뒤';
  if (intervalDays < 7) return `${intervalDays}일 뒤`;
  if (intervalDays < 30) {
    const weeks = Math.round(intervalDays / 7);
    return `${weeks}주 뒤`;
  }
  const months = Math.round(intervalDays / 30);
  return `${months}달 뒤`;
}
