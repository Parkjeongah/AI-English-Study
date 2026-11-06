import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Volume2,
  Mic,
  Settings,
  Sparkles,
  CheckCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { ThoughtEntry } from '../types';
import { ttsController, sttController, isSpeechRecognitionSupported } from '../lib/speech';

interface ShadowingStudioProps {
  entries: ThoughtEntry[];
  onNavigateToThought: () => void;
}

export const ShadowingStudio: React.FC<ShadowingStudioProps> = ({
  entries,
  onNavigateToThought,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatCount, setRepeatCount] = useState<number>(3); // Repeat 3 times per sentence
  const [currentRepeat, setCurrentRepeat] = useState<number>(1);
  const [pauseDurationSec, setPauseDurationSec] = useState<number>(2.5); // 2.5s pause to shadow out loud
  const [speed, setSpeed] = useState<number>(1.0);
  const [accent, setAccent] = useState<'en-US' | 'en-GB'>('en-US');

  // Self-recording shadow check
  const [isSelfRecording, setIsSelfRecording] = useState(false);
  const [selfTranscript, setSelfTranscript] = useState('');

  const pauseTimerRef = useRef<any>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const validEntries = entries.filter((e) => e.recommendedExpressions && e.recommendedExpressions.length > 0);
  const activeEntry = validEntries[currentIndex];
  const activeExpression = activeEntry
    ? activeEntry.recommendedExpressions[activeEntry.selectedExpressionIndex || 0] ||
      activeEntry.recommendedExpressions[0]
    : null;

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const stopPlayback = () => {
    ttsController.stop();
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    setIsPlaying(false);
  };

  const playSentence = (index: number, repeatNum: number) => {
    if (!isPlayingRef.current || index >= validEntries.length) {
      setIsPlaying(false);
      return;
    }

    const entry = validEntries[index];
    const expr = entry.recommendedExpressions[entry.selectedExpressionIndex || 0] || entry.recommendedExpressions[0];
    if (!expr) return;

    setCurrentIndex(index);
    setCurrentRepeat(repeatNum);

    ttsController.speak({
      text: expr.english,
      lang: accent,
      rate: speed,
      onEnd: () => {
        if (!isPlayingRef.current) return;

        // Pause for user to shadow aloud
        pauseTimerRef.current = setTimeout(() => {
          if (!isPlayingRef.current) return;

          if (repeatNum < repeatCount) {
            playSentence(index, repeatNum + 1);
          } else {
            // Move to next entry
            const nextIndex = (index + 1) % validEntries.length;
            playSentence(nextIndex, 1);
          }
        }, pauseDurationSec * 1000);
      },
    });
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      if (validEntries.length === 0) return;
      setIsPlaying(true);
      isPlayingRef.current = true;
      playSentence(currentIndex, 1);
    }
  };

  const handleNext = () => {
    stopPlayback();
    const next = (currentIndex + 1) % validEntries.length;
    setCurrentIndex(next);
  };

  const handlePrev = () => {
    stopPlayback();
    const prev = (currentIndex - 1 + validEntries.length) % validEntries.length;
    setCurrentIndex(prev);
  };

  const handleToggleSelfRecord = () => {
    if (isSelfRecording) {
      sttController.stop();
      setIsSelfRecording(false);
    } else {
      if (!isSpeechRecognitionSupported()) {
        alert('마이크 음성 인식이 지원되지 않는 브라우저입니다.');
        return;
      }
      setSelfTranscript('');
      sttController.start({
        lang: 'en-US',
        continuous: false,
        onStart: () => setIsSelfRecording(true),
        onResult: (text) => setSelfTranscript(text),
        onError: () => setIsSelfRecording(false),
        onEnd: () => setIsSelfRecording(false),
      });
    }
  };

  if (validEntries.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center space-y-4">
        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
          <RotateCcw className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          섀도잉할 표현이 아직 없습니다
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          생각을 기록하고 AI 맞춤 표현을 생성하면, 이곳에서 원어민 음성으로 무한 섀도잉 루프 훈련을 진행할 수 있습니다.
        </p>
        <button
          onClick={onNavigateToThought}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
        >
          첫 생각 기록하기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shadowing Player Stage */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              섀도잉 세션 ({currentIndex + 1} / {validEntries.length})
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              반복: {currentRepeat}/{repeatCount}회
            </span>
          </div>

          {/* Player Configuration Toggles */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Speed */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              {[0.8, 1.0, 1.2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    speed === s
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Accent */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setAccent('en-US')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  accent === 'en-US'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                미국 (US)
              </button>
              <button
                onClick={() => setAccent('en-GB')}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  accent === 'en-GB'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                영국 (UK)
              </button>
            </div>

            {/* Pause duration */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-slate-400 ml-1" />
              {[1.5, 2.5, 3.5].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setPauseDurationSec(sec)}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    pauseDurationSec === sec
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                  title={`${sec}초 일시정지 (따라 말할 여유 시간)`}
                >
                  {sec}초
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Display Script Area */}
        <div className="py-6 sm:py-8 text-center space-y-4">
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-relaxed max-w-2xl mx-auto font-sans">
            "{activeExpression?.english}"
          </p>

          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {activeExpression?.koreanMeaning}
          </p>

          <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400">
            원래 생각: {activeEntry?.originalText}
          </div>
        </div>

        {/* Player Transport Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrev}
            className="p-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="이전 문장"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={handleTogglePlay}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md ${
              isPlaying
                ? 'bg-indigo-600 text-white ring-8 ring-indigo-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105'
            }`}
          >
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
          </button>

          <button
            onClick={handleNext}
            className="p-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="다음 문장"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Shadowing Practice Live Mic Check */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center space-y-2">
          <button
            onClick={handleToggleSelfRecord}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isSelfRecording
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>{isSelfRecording ? '내 목소리 녹음 중... (클릭 시 확인)' : '내 발음 직접 녹음해보기'}</span>
          </button>

          {selfTranscript && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-xs text-slate-800 dark:text-slate-200 max-w-md text-center">
              <strong>내가 발화한 내용: </strong> "{selfTranscript}"
            </div>
          )}
        </div>
      </div>

      {/* Playlist Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          섀도잉 연습 큐 목록 ({validEntries.length}개 문장)
        </h4>
        <div className="space-y-2">
          {validEntries.map((item, idx) => {
            const expr = item.recommendedExpressions[item.selectedExpressionIndex || 0] || item.recommendedExpressions[0];
            const isActive = idx === currentIndex;

            return (
              <div
                key={item.id}
                onClick={() => {
                  stopPlayback();
                  setCurrentIndex(idx);
                }}
                className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {expr?.english}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {expr?.koreanMeaning}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {item.assessedCefr}
                  </span>
                  {isActive && isPlaying && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
