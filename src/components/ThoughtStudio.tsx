import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PenLine,
  Sparkles,
  Volume2,
  BookmarkPlus,
  Check,
  RefreshCw,
  Lightbulb,
  ArrowRight,
  Sliders,
  ChevronDown,
  VolumeX,
  Film,
  ExternalLink,
  Clapperboard,
  Info,
} from 'lucide-react';
import { CEFRLevel, InspirationPrompt, MediaClip, RecommendedExpression, ThoughtEntry, UserProficiency } from '../types';
import { sttController, ttsController, isSpeechRecognitionSupported } from '../lib/speech';
import { createInitialSRS } from '../lib/srs';

interface ThoughtStudioProps {
  proficiency: UserProficiency;
  onSaveEntry: (entry: ThoughtEntry) => void;
  onUpdateLevel: (level: CEFRLevel, isManual: boolean) => void;
  onNavigateToShadowing?: () => void;
}

const CEFR_LEVELS: { level: CEFRLevel; label: string; desc: string }[] = [
  { level: 'A1', label: 'A1 입문', desc: '기초 생존 영어 및 기본 단어' },
  { level: 'A2', label: 'A2 초급', desc: '간단한 일상 루틴과 사실 전달' },
  { level: 'B1', label: 'B1 중급', desc: '자신의 생각, 감정, 일상 의견 표현' },
  { level: 'B2', label: 'B2 중상급', desc: '자연스러운 원어민 구어체 및 복합 문장' },
  { level: 'C1', label: 'C1 고급', desc: '풍부한 이디엄과 세련된 비즈니스 뉘앙스' },
  { level: 'C2', label: 'C2 원어민', desc: '완벽한 뉘앙스 분별과 학술/문학적 표현' },
];

export const ThoughtStudio: React.FC<ThoughtStudioProps> = ({
  proficiency,
  onSaveEntry,
  onUpdateLevel,
  onNavigateToShadowing,
}) => {
  const [inputMode, setInputMode] = useState<'speech' | 'writing'>('speech');
  const [speechLang, setSpeechLang] = useState<'en-US' | 'ko-KR'>('en-US');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [promptData, setPromptData] = useState<InspirationPrompt | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [selectedExpressionTone, setSelectedExpressionTone] = useState<'natural' | 'professional' | 'advanced'>('natural');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedClips, setSavedClips] = useState<Record<string, boolean>>({});

  const [speakingExpression, setSpeakingExpression] = useState<string | null>(null);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);

  const timerRef = useRef<any>(null);

  // Load a quick starter prompt based on user's current level on mount
  useEffect(() => {
    fetchInspirationPrompt();
  }, [proficiency.currentLevel]);

  // Handle recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const fetchInspirationPrompt = async () => {
    setIsLoadingPrompt(true);
    try {
      const res = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLevel: proficiency.currentLevel }),
      });
      if (res.ok) {
        const data = await res.json();
        setPromptData(data);
      }
    } catch (e) {
      console.warn('Failed to load prompt', e);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleToggleRecord = () => {
    setRecordingError(null);
    setAnalysisError(null);
    if (isRecording) {
      sttController.stop();
      setIsRecording(false);
    } else {
      if (!isSpeechRecognitionSupported()) {
        setRecordingError('현재 브라우저에서 마이크 음성 인식이 지원되지 않습니다. Chrome 브라우저를 사용하시거나 직접 텍스트를 입력해 보세요.');
        return;
      }

      sttController.start({
        lang: speechLang,
        continuous: true,
        interimResults: true,
        onStart: () => {
          setIsRecording(true);
        },
        onResult: (transcript) => {
          setInputText(transcript);
        },
        onError: (err) => {
          setRecordingError(err);
          setIsRecording(false);
        },
        onEnd: () => {
          setIsRecording(false);
        },
      });
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() || isAnalyzing) return;

    if (isRecording) {
      sttController.stop();
      setIsRecording(false);
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/analyze-thought', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          inputMode,
          currentLevel: proficiency.currentLevel,
        }),
      });

      if (!res.ok) {
        throw new Error('분석 요청에 실패했습니다.');
      }

      const data = await res.json();
      setAnalysisResult(data);

      // Automatically update level if not manually locked
      if (data.assessedCefr && !proficiency.manualLevelOverride) {
        onUpdateLevel(data.assessedCefr, false);
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePlayTTS = (text: string) => {
    if (speakingExpression === text) {
      ttsController.stop();
      setSpeakingExpression(null);
      return;
    }

    setSpeakingExpression(text);
    ttsController.speak({
      text,
      lang: 'en-US',
      rate: speechSpeed,
      onEnd: () => setSpeakingExpression(null),
    });
  };

  const handleSaveToDeck = () => {
    if (!analysisResult) return;

    const expressions = analysisResult.recommendedExpressions || [];
    const activeExpr = expressions.find((e: RecommendedExpression) => e.tone === selectedExpressionTone) || expressions[0];
    const selectedIndex = expressions.indexOf(activeExpr);

    const newEntry: ThoughtEntry = {
      id: 'entry-' + Date.now(),
      originalText: inputText.trim(),
      inputMode,
      createdAt: Date.now(),
      detectedLanguage: analysisResult.detectedLanguage,
      thoughtSummary: analysisResult.thoughtSummary,
      assessedCefr: analysisResult.assessedCefr || proficiency.currentLevel,
      grammarCorrections: analysisResult.grammarCorrections || [],
      recommendedExpressions: expressions,
      vocabulary: analysisResult.vocabulary || [],
      mediaClips: analysisResult.mediaClips || [],
      coachingTip: analysisResult.coachingTip,
      selectedExpressionIndex: selectedIndex >= 0 ? selectedIndex : 0,
      srs: createInitialSRS(),
    };

    onSaveEntry(newEntry);
    setSavedSuccess(true);
  };

  const handleSaveClipToDeck = (clip: any) => {
    const newEntry: ThoughtEntry = {
      id: 'clip-' + Date.now(),
      originalText: `[${clip.title}] ${clip.character}: "${clip.quoteEn}"`,
      inputMode: 'speech',
      createdAt: Date.now(),
      detectedLanguage: 'english',
      thoughtSummary: `${clip.title} 속 ${clip.character}의 상황별 대사`,
      assessedCefr: proficiency.currentLevel,
      grammarCorrections: [],
      recommendedExpressions: [
        {
          tone: 'natural',
          english: clip.quoteEn,
          koreanMeaning: clip.quoteKr,
          nuance: `${clip.title} 속 ${clip.character}의 대사. 상황: ${clip.sceneContext}`,
        },
      ],
      vocabulary: [],
      mediaClips: [clip],
      selectedExpressionIndex: 0,
      srs: createInitialSRS(),
    };

    onSaveEntry(newEntry);
    setSavedClips((prev) => ({ ...prev, [clip.quoteEn]: true }));
  };

  return (
    <div className="space-y-6">
      {/* Level Banner & Adaptive Target Controller */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base border border-indigo-100 dark:border-indigo-900/50 shrink-0">
            {proficiency.currentLevel}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                학습자 적응형 레벨: {proficiency.currentLevel}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({proficiency.manualLevelOverride ? '수동 고정' : 'AI 자동 조절'})
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              사용자가 말하고 쓴 문장 복잡도를 분석하여 i+1 맞춤 표현을 제안합니다.
            </p>
          </div>
        </div>

        {/* Level manual override selector */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="text-xs text-slate-500 dark:text-slate-400">목표 난이도:</span>
          <div className="relative">
            <select
              value={proficiency.currentLevel}
              onChange={(e) => onUpdateLevel(e.target.value as CEFRLevel, true)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
            >
              {CEFR_LEVELS.map((c) => (
                <option key={c.level} value={c.level}>
                  {c.label} ({c.desc})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
          {proficiency.manualLevelOverride && (
            <button
              onClick={() => onUpdateLevel(proficiency.currentLevel, false)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-1.5 py-1"
              title="AI 자동 감지로 복귀"
            >
              자동 모드로
            </button>
          )}
        </div>
      </div>

      {/* Daily Thinking Inspiration Prompt */}
      {promptData && (
        <div className="bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 dark:from-slate-900/90 dark:via-slate-900 dark:to-indigo-950/40 rounded-2xl border border-indigo-100/80 dark:border-indigo-900/40 p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
              <Lightbulb className="w-4 h-4" />
              <span>오늘의 생각 영감 (CEFR {proficiency.currentLevel})</span>
              {promptData.isQuotaExceeded && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-normal">
                  레벨별 추천
                </span>
              )}
            </div>
            <button
              onClick={fetchInspirationPrompt}
              disabled={isLoadingPrompt}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingPrompt ? 'animate-spin' : ''}`} />
              <span>다른 질문</span>
            </button>
          </div>

          <div className="mt-2.5 space-y-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {promptData.questionKr}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 italic">
              "{promptData.questionEn}"
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">도움 키워드:</span>
            {promptData.hintVocabulary.map((kw, idx) => (
              <button
                key={idx}
                onClick={() => setInputText((prev) => (prev ? `${prev} ${kw}` : kw))}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:border-indigo-400 transition-colors text-[11px]"
              >
                + {kw}
              </button>
            ))}
            {promptData.starterSentence && (
              <button
                onClick={() => setInputText(promptData.starterSentence + ' ')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-medium ml-1"
              >
                문장 시작하기: "{promptData.starterSentence}..."
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input Stage: Speech & Writing Canvas */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        {/* Input Mode Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setInputMode('speech')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                inputMode === 'speech'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>영어로 말하기 (음성인식)</span>
            </button>
            <button
              onClick={() => setInputMode('writing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                inputMode === 'writing'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>글로 쓰기 (에세이/생각)</span>
            </button>
          </div>

          {inputMode === 'speech' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">발화 언어:</span>
              <button
                onClick={() => setSpeechLang('en-US')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  speechLang === 'en-US'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                영어 (English)
              </button>
              <button
                onClick={() => setSpeechLang('ko-KR')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  speechLang === 'ko-KR'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                한국어 생각
              </button>
            </div>
          )}
        </div>

        {/* Speech Mode Mic Area */}
        {inputMode === 'speech' && (
          <div className="py-4 flex flex-col items-center justify-center text-center space-y-3">
            <button
              onClick={handleToggleRecord}
              className={`relative group w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse ring-8 ring-rose-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 ring-4 ring-indigo-500/10'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isRecording ? (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    녹음 중... {recordingSeconds}초 (클릭 시 중지)
                  </span>
                ) : (
                  '마이크를 누르고 생각을 편하게 말해보세요'
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {speechLang === 'en-US'
                  ? '떠오르는 영단어나 불완전한 문장이어도 괜찮습니다. AI가 다듬어 드립니다.'
                  : '한국어로 떠오른 생각을 말하면, 원어민 표현 3단계로 변환해 드립니다.'}
              </p>
            </div>

            {recordingError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900">
                {recordingError}
              </p>
            )}
          </div>
        )}

        {/* Text Area for Live Transcript / Manual Writing */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {inputMode === 'speech' ? '음성 인식된 텍스트 (직접 수정 가능)' : '자유 생각 입력'}
            </span>
            <span className="tabular-nums">{inputText.length}자</span>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              inputMode === 'speech'
                ? '마이크로 말하면 이곳에 실시간으로 전사됩니다. 또는 키보드로 수정할 수 있습니다.'
                : '오늘 하루의 감정, 배운 점, 직장에서의 상황, 또는 깊은 고민을 한국어 또는 영어로 자유롭게 써보세요.'
            }
            rows={4}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors leading-relaxed"
          />
        </div>

        {/* Submit Action Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => {
              setInputText('');
              setAnalysisResult(null);
            }}
            disabled={!inputText}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
          >
            내용 지우기
          </button>

          <button
            onClick={handleAnalyze}
            disabled={!inputText.trim() || isAnalyzing}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm shadow-indigo-600/20"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AI 생각 분석 및 교정 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI 분석 & 교정 받기</span>
              </>
            )}
          </button>
        </div>

        {/* Inline Analysis Error if any */}
        {analysisError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <p className="font-semibold">{analysisError}</p>
              <p className="mt-0.5 text-rose-600/80 dark:text-rose-400">
                잠시 후 다시 시도해 주시거나, 화면 우측 상단 Settings &gt; Secrets에서 유료 결제가 연동된 API 키를 확인해 주세요.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis & Feedback Card */}
      {analysisResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6 animate-fadeIn">
          {/* Quota Exceeded Friendly Notice */}
          {analysisResult.isQuotaExceeded && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="flex-1 space-y-0.5">
                <p className="font-semibold">스마트 로컬 코칭 모드로 전환됨</p>
                <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
                  Gemini API 무료 티어 일일 한도(20회)에 도달하여 엄선된 오프라인 코칭 엔진으로 즉시 표현 및 미드 명장면을 분석했습니다. 무제한 실시간 분석을 원하시면 화면 우측 상단 <strong>Settings &gt; Secrets</strong>에서 결제 연동 API 키를 선택해 주세요.
                </p>
              </div>
            </div>
          )}

          {/* Header of analysis: Summary & Assessed CEFR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  AI Linguistic Analysis
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  진단 레벨: <strong className="text-slate-900 dark:text-white font-bold">{analysisResult.assessedCefr}</strong>
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {analysisResult.thoughtSummary}
              </h3>
            </div>

            {/* Audio speed controller */}
            <div className="flex items-center gap-1.5 self-start sm:self-center bg-slate-50 dark:bg-slate-800 p-1 rounded-lg text-xs">
              <span className="text-slate-400 px-1">TTS 속도:</span>
              {[0.8, 1.0, 1.2].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSpeechSpeed(speed)}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    speechSpeed === speed
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* 3 Tone Recommended Expressions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              상황별 추천 영어 표현 (3가지 톤)
            </h4>

            {/* Tone Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              {[
                { id: 'natural', label: '자연스러운 일상', desc: 'Native Casual' },
                { id: 'professional', label: '세련된 비즈니스', desc: 'Polished / Formal' },
                { id: 'advanced', label: '고급 표현 (i+1)', desc: 'Nuanced / Idiomatic' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedExpressionTone(tab.id as any)}
                  className={`py-2 px-3 rounded-lg text-left transition-all ${
                    selectedExpressionTone === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-700/50'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <p className="text-xs font-bold leading-tight">{tab.label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{tab.desc}</p>
                </button>
              ))}
            </div>

            {/* Active Expression Card */}
            {(() => {
              const expr =
                analysisResult.recommendedExpressions?.find(
                  (e: RecommendedExpression) => e.tone === selectedExpressionTone
                ) || analysisResult.recommendedExpressions?.[0];

              if (!expr) return null;

              const isSpeaking = speakingExpression === expr.english;

              return (
                <div className="p-4 sm:p-5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-relaxed font-sans">
                      {expr.english}
                    </p>
                    <button
                      onClick={() => handlePlayTTS(expr.english)}
                      title="원어민 발음 듣기"
                      className={`p-2 rounded-xl transition-all shrink-0 ${
                        isSpeaking
                          ? 'bg-indigo-600 text-white animate-pulse'
                          : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 border border-slate-200 dark:border-slate-700 shadow-xs'
                      }`}
                    >
                      {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>

                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {expr.koreanMeaning}
                  </p>

                  <div className="pt-2 border-t border-indigo-100/60 dark:border-indigo-900/30 text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-300 font-semibold">뉘앙스 해설: </strong>
                    {expr.nuance}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Grammar & Phrasing Corrections */}
          {analysisResult.grammarCorrections && analysisResult.grammarCorrections.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                문법 및 자연스러운 어휘 교정
              </h4>
              <div className="space-y-2">
                {analysisResult.grammarCorrections.map((corr: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5"
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <span className="line-through text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                        {corr.original}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        {corr.correction}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-normal">
                      {corr.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Key Idioms & Vocabulary */}
          {analysisResult.vocabulary && analysisResult.vocabulary.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                핵심 어휘 & 연어 (Collocations)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {analysisResult.vocabulary.map((vocab: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {vocab.term}
                      </span>
                      <button
                        onClick={() => handlePlayTTS(vocab.term)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1"
                        title="발음 듣기"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {vocab.ipa && <p className="font-mono text-[11px] text-slate-400">{vocab.ipa}</p>}
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium">{vocab.meaning}</p>
                    <p className="text-slate-500 dark:text-slate-400 italic text-[11px] border-t border-slate-200/50 dark:border-slate-700/50 pt-1 mt-1">
                      "{vocab.example}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Media Clips (미드 / 영드 / 영화 실제 대사 장면) */}
          {analysisResult.mediaClips && analysisResult.mediaClips.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    미드 · 영드 · 영화 속 실제 대사 장면 (비즈니스 & 전문직 추천)
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">Suits · The Intern · Sherlock 등 명작 매칭</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {analysisResult.mediaClips.map((clip: any, idx: number) => {
                  const isClipSpeaking = speakingExpression === clip.quoteEn;
                  const isClipSaved = savedClips[clip.quoteEn];

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-800/80 dark:to-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        {/* Title & Badge */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                            <Clapperboard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{clip.title}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            {clip.mediaType}
                          </span>
                        </div>

                        {/* Character & Scene Context */}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          <strong className="text-slate-700 dark:text-slate-300">{clip.character}</strong>
                          <span className="mx-1">·</span>
                          <span>{clip.sceneContext}</span>
                        </div>

                        {/* Quote Box */}
                        <div className="p-3 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white italic font-serif leading-relaxed">
                              "{clip.quoteEn}"
                            </p>
                            <button
                              onClick={() => handlePlayTTS(clip.quoteEn)}
                              title="대사 원어민 음성 듣기"
                              className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                                isClipSpeaking
                                  ? 'bg-indigo-600 text-white animate-pulse'
                                  : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            {clip.quoteKr}
                          </p>
                        </div>
                      </div>

                      {/* Actions: Watch on YouTube & Save to Deck */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                            clip.youtubeSearchQuery || `${clip.title} ${clip.character} scene`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>유튜브에서 장면 보기</span>
                        </a>

                        <button
                          onClick={() => handleSaveClipToDeck(clip)}
                          disabled={isClipSaved}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                            isClipSaved
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 shadow-2xs'
                          }`}
                        >
                          {isClipSaved ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>복습 덱 추가됨</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3 h-3 text-indigo-600" />
                              <span>대사 복습 덱에 추가</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Encouraging Coaching Tip */}
          {analysisResult.coachingTip && (
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>AI 코치 한마디: </strong> {analysisResult.coachingTip}
              </span>
            </div>
          )}

          {/* Action Row: Save to SRS Deck & Go to Shadowing */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleSaveToDeck}
              disabled={savedSuccess}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                savedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>망각곡선 복습 덱에 저장 완료!</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4" />
                  <span>망각곡선 복습 카드에 추가 (SRS)</span>
                </>
              )}
            </button>

            {onNavigateToShadowing && (
              <button
                onClick={onNavigateToShadowing}
                className="text-xs font-semibold text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
              >
                <span>섀도잉 플레이어에서 반복 연습하기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
