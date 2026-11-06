import React, { useState } from 'react';
import {
  BookOpen,
  Volume2,
  Mic,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  VolumeX,
  Trophy,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
  Film,
} from 'lucide-react';
import { ReviewGrade, ThoughtEntry } from '../types';
import { isDueForReview, formatInterval, getSRSReviewStats } from '../lib/srs';
import { ttsController, sttController, isSpeechRecognitionSupported } from '../lib/speech';

interface ReviewDeckProps {
  entries: ThoughtEntry[];
  onRecordReview: (id: string, grade: ReviewGrade) => void;
  onNavigateToThought: () => void;
}

type QuizMode = 'flashcard' | 'cloze' | 'speaking';

export const ReviewDeck: React.FC<ReviewDeckProps> = ({
  entries,
  onRecordReview,
  onNavigateToThought,
}) => {
  const [filterMode, setFilterMode] = useState<'due' | 'all' | 'mastered'>('due');
  const [quizMode, setQuizMode] = useState<QuizMode>('flashcard');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Cloze Quiz State
  const [clozeInput, setClozeInput] = useState('');
  const [clozeChecked, setClozeChecked] = useState(false);
  const [isClozeCorrect, setIsClozeCorrect] = useState(false);

  // Speaking Check State
  const [isSpeakingListening, setIsSpeakingListening] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [isEvaluatingSpeech, setIsEvaluatingSpeech] = useState(false);
  const [speechEvaluation, setSpeechEvaluation] = useState<any | null>(null);

  const [playingTTS, setPlayingTTS] = useState(false);

  // Filter queue
  const dueEntries = entries.filter((e) => isDueForReview(e));
  const masteredEntries = entries.filter((e) => (e.srs?.interval || 0) >= 21);

  const activeQueue =
    filterMode === 'due'
      ? dueEntries
      : filterMode === 'mastered'
      ? masteredEntries
      : entries;

  const currentEntry = activeQueue[currentIndex];
  const stats = getSRSReviewStats(entries);

  const activeExpression = currentEntry
    ? currentEntry.recommendedExpressions[currentEntry.selectedExpressionIndex || 0] ||
      currentEntry.recommendedExpressions[0]
    : null;

  // Prepare Cloze word (pick a key vocabulary word or a distinctive word from the expression)
  const getClozeData = () => {
    if (!activeExpression) return { sentenceWithBlank: '', targetWord: '' };
    const vocabTerm = currentEntry.vocabulary?.[0]?.term;
    const sentence = activeExpression.english;

    if (vocabTerm && sentence.toLowerCase().includes(vocabTerm.toLowerCase())) {
      const regex = new RegExp(vocabTerm, 'gi');
      return {
        sentenceWithBlank: sentence.replace(regex, '______'),
        targetWord: vocabTerm,
      };
    }

    // Fallback: pick a word > 4 chars
    const words = sentence.split(' ');
    const candidates = words.filter((w) => w.replace(/[^a-zA-Z]/g, '').length >= 5);
    const target = candidates.length > 0 ? candidates[Math.floor(candidates.length / 2)] : words[0];
    const cleanTarget = target.replace(/[^a-zA-Z]/g, '');

    return {
      sentenceWithBlank: sentence.replace(target, '______'),
      targetWord: cleanTarget,
    };
  };

  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const handlePlayTTS = (text: string) => {
    if (playingTTS) {
      ttsController.stop();
      setPlayingTTS(false);
      return;
    }

    setPlayingTTS(true);
    ttsController.speak({
      text,
      lang: 'en-US',
      rate: 0.95,
      onEnd: () => setPlayingTTS(false),
    });
  };

  const handleNext = () => {
    setIsFlipped(false);
    setClozeInput('');
    setClozeChecked(false);
    setIsClozeCorrect(false);
    setSpokenTranscript('');
    setSpeechEvaluation(null);
    ttsController.stop();
    setPlayingTTS(false);

    if (currentIndex < activeQueue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleGrade = (grade: ReviewGrade) => {
    if (!currentEntry) return;
    onRecordReview(currentEntry.id, grade);
    handleNext();
  };

  const checkCloze = (targetWord: string) => {
    setClozeChecked(true);
    const isCorrect = clozeInput.trim().toLowerCase() === targetWord.toLowerCase();
    setIsClozeCorrect(isCorrect);
  };

  const handleStartSpeakingCheck = () => {
    if (!activeExpression) return;
    if (isSpeakingListening) {
      sttController.stop();
      setIsSpeakingListening(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      alert('브라우저에서 마이크 음성 인식이 지원되지 않습니다.');
      return;
    }

    setSpokenTranscript('');
    setSpeechEvaluation(null);

    sttController.start({
      lang: 'en-US',
      continuous: false,
      interimResults: true,
      onStart: () => setIsSpeakingListening(true),
      onResult: (transcript, isFinal) => {
        setSpokenTranscript(transcript);
        if (isFinal) {
          evaluateSpeechResult(transcript, activeExpression.english);
        }
      },
      onError: (err) => {
        alert(err);
        setIsSpeakingListening(false);
      },
      onEnd: () => setIsSpeakingListening(false),
    });
  };

  const evaluateSpeechResult = async (spoken: string, target: string) => {
    setIsEvaluatingSpeech(true);
    try {
      const res = await fetch('/api/evaluate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetText: target, spokenText: spoken }),
      });
      if (res.ok) {
        const data = await res.json();
        setSpeechEvaluation(data);
      }
    } catch (e) {
      console.warn('Speech evaluation error', e);
    } finally {
      setIsEvaluatingSpeech(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top SRS Queue Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => {
            setFilterMode('due');
            setCurrentIndex(0);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterMode === 'due'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">오늘 복습할 표현</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {stats.dueToday}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">망각 주기 도달</p>
        </button>

        <button
          onClick={() => {
            setFilterMode('all');
            setCurrentIndex(0);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterMode === 'all'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">전체 저장 카드</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {stats.total}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">내 생각 어휘 풀</p>
        </button>

        <button
          onClick={() => {
            setFilterMode('mastered');
            setCurrentIndex(0);
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            filterMode === 'mastered'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">장기 기억 마스터</span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {stats.mastered}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">주기 21일 이상</p>
        </button>

        <div className="p-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-left">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">내일 예정 복습</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {stats.dueTomorrow}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">망각곡선 예측</p>
        </div>
      </div>

      {/* Quiz Mode Segmented Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            onClick={() => setQuizMode('flashcard')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              quizMode === 'flashcard'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            플래시카드 (카드 뒤집기)
          </button>
          <button
            onClick={() => setQuizMode('cloze')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              quizMode === 'cloze'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            빈칸 채우기 퀴즈
          </button>
          <button
            onClick={() => setQuizMode('speaking')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              quizMode === 'speaking'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            스피킹 발화 채점
          </button>
        </div>

        {activeQueue.length > 0 && (
          <div className="text-xs text-slate-500 dark:text-slate-400 px-2 font-medium tabular-nums">
            {currentIndex + 1} / {activeQueue.length}
          </div>
        )}
      </div>

      {/* When queue is empty */}
      {activeQueue.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {filterMode === 'due' ? '오늘의 복습을 모두 완료했습니다!' : '해당하는 카드가 없습니다'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
              {filterMode === 'due'
                ? '에빙하우스 망각곡선 주기에 맞춰 다음 복습 시간이 되면 자동으로 알림을 전송해 드립니다.'
                : '새로운 생각을 기록하고 분석하여 복습 덱에 추가해 보세요.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => {
                setFilterMode('all');
                setCurrentIndex(0);
              }}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition-colors"
            >
              전체 카드 미리 복습하기
            </button>
            <button
              onClick={onNavigateToThought}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm"
            >
              새 생각 표현하기
            </button>
          </div>
        </div>
      ) : (
        /* Active Card Stage */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
          {/* Card Meta & Current SRS Interval info */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                CEFR {currentEntry.assessedCefr}
              </span>
              <span>·</span>
              <span>입력 모드: {currentEntry.inputMode === 'speech' ? '음성 발화' : '글쓰기'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>기억 간격: {formatInterval(currentEntry.srs?.interval || 0)}</span>
              <span>·</span>
              <span>반복 횟수: {currentEntry.srs?.repetition || 0}회</span>
            </div>
          </div>

          {/* Mode 1: Flashcard (Front & Back) */}
          {quizMode === 'flashcard' && (
            <div className="space-y-6">
              {/* Question / Front: Original Thought */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  내가 떠올렸던 생각 (Thought Intent)
                </span>
                <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-white leading-relaxed">
                  "{currentEntry.originalText}"
                </p>
                {currentEntry.thoughtSummary && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    요약: {currentEntry.thoughtSummary}
                  </p>
                )}
              </div>

              {/* Reveal Button or Back Card */}
              {!isFlipped ? (
                <div className="py-6 flex flex-col items-center justify-center space-y-2">
                  <button
                    onClick={handleFlipCard}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-semibold text-sm transition-all shadow-sm shadow-indigo-600/20 hover:scale-102"
                  >
                    영어로 어떻게 표현할까요? (정답 확인)
                  </button>
                  <p className="text-xs text-slate-400">스페이스바 또는 클릭하여 카드 뒤집기</p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/40 space-y-4 animate-fadeIn">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        원어민 맞춤 표현 ({activeExpression?.tone})
                      </span>
                      <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1 leading-relaxed">
                        {activeExpression?.english}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePlayTTS(activeExpression?.english || '')}
                      className={`p-2.5 rounded-xl transition-all ${
                        playingTTS
                          ? 'bg-indigo-600 text-white animate-pulse'
                          : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 shadow-xs'
                      }`}
                    >
                      {playingTTS ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>

                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {activeExpression?.koreanMeaning}
                  </p>

                  {activeExpression?.nuance && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 border-t border-indigo-100/60 dark:border-indigo-900/30 pt-2">
                      <strong className="text-slate-700 dark:text-slate-300">뉘앙스: </strong>
                      {activeExpression.nuance}
                    </p>
                  )}

                  {currentEntry.mediaClips && currentEntry.mediaClips.length > 0 && (
                    <div className="pt-2 border-t border-indigo-100/60 dark:border-indigo-900/30 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                      <Film className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {currentEntry.mediaClips[0].title} ({currentEntry.mediaClips[0].character}):
                        </strong>{' '}
                        <span className="italic">"{currentEntry.mediaClips[0].quoteEn}"</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Cloze Fill-in-the-blank Quiz */}
          {quizMode === 'cloze' && (
            <div className="space-y-6">
              {(() => {
                const { sentenceWithBlank, targetWord } = getClozeData();

                return (
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        한국어 의미: {activeExpression?.koreanMeaning}
                      </span>
                      <p className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-relaxed">
                        {sentenceWithBlank}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={clozeInput}
                        onChange={(e) => setClozeInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && checkCloze(targetWord)}
                        placeholder="빈칸에 들어갈 영어 단어를 입력하세요"
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => checkCloze(targetWord)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs"
                      >
                        정답 확인
                      </button>
                    </div>

                    {clozeChecked && (
                      <div
                        className={`p-4 rounded-xl text-xs space-y-1.5 ${
                          isClozeCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        <p className="font-bold text-sm">
                          {isClozeCorrect ? '정답입니다! 🎉' : '아쉬워요! 다시 확인해 보세요.'}
                        </p>
                        <p>
                          정답 단어: <strong className="underline">{targetWord}</strong>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 pt-1">
                          전체 문장: "{activeExpression?.english}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Mode 3: Speaking Practice Check */}
          {quizMode === 'speaking' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  따라 말할 목표 문장
                </span>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {activeExpression?.english}
                  </p>
                  <button
                    onClick={() => handlePlayTTS(activeExpression?.english || '')}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeExpression?.koreanMeaning}
                </p>
              </div>

              {/* Mic action */}
              <div className="py-4 flex flex-col items-center justify-center space-y-3">
                <button
                  onClick={handleStartSpeakingCheck}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    isSpeakingListening
                      ? 'bg-rose-500 text-white animate-pulse ring-8 ring-rose-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-500/10'
                  }`}
                >
                  <Mic className="w-7 h-7" />
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isSpeakingListening
                    ? '듣고 있습니다... 문장을 소리 내어 말해보세요'
                    : '마이크를 켜고 위 문장을 영어로 말해보세요'}
                </p>

                {spokenTranscript && (
                  <div className="w-full max-w-lg p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200">
                    <strong>인식된 발화: </strong> "{spokenTranscript}"
                  </div>
                )}

                {isEvaluatingSpeech && (
                  <p className="text-xs text-indigo-600 animate-pulse">발음 및 유창성 채점 중...</p>
                )}

                {speechEvaluation && (
                  <div className="w-full max-w-lg p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        발화 일치도 점수
                      </span>
                      <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {speechEvaluation.score}점
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      {speechEvaluation.feedbackKr}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SM-2 Spaced Repetition Grading Bar (Always available or shown when flipped/tested) */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">망각곡선 기억도 평가 (다음 복습 주기 조절)</span>
              <span>SM-2 알고리즘</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleGrade(1)}
                className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-left transition-colors"
              >
                <div className="text-xs font-bold text-rose-700 dark:text-rose-400">다시 학습</div>
                <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">내일 다시 복습 (1일)</div>
              </button>

              <button
                onClick={() => handleGrade(2)}
                className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 text-left transition-colors"
              >
                <div className="text-xs font-bold text-amber-700 dark:text-amber-400">어려움</div>
                <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">1~2일 후 복습</div>
              </button>

              <button
                onClick={() => handleGrade(4)}
                className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/50 text-left transition-colors"
              >
                <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400">알맞음</div>
                <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">3~5일 후 복습</div>
              </button>

              <button
                onClick={() => handleGrade(5)}
                className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-left transition-colors"
              >
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">쉬움</div>
                <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">7일 이상 후 복습</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
