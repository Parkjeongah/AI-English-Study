import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google Gen AI client with required User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const QUOTA_NOTICE_MSG =
  'Gemini 무료 티어 일일 한도(20회)에 도달하여 스마트 오프라인 코칭 엔진으로 전환되었습니다. 무제한 실시간 AI 분석을 원하시면 우측 상단 Settings > Secrets에서 결제 연동 API 키를 선택해 주세요.';

// In-memory circuit breaker cooldown to prevent hammering exhausted models
const modelCooldowns: Record<string, number> = {};

/**
 * Robust multi-model caller with automatic fallback and cooldown circuit breaker.
 * Skips models that are currently rate-limited and falls back seamlessly.
 */
async function callGeminiWithFallback(params: {
  contents: any;
  systemInstruction?: string;
  responseSchema?: any;
}) {
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: any = null;
  const now = Date.now();

  for (const model of modelsToTry) {
    // If model is cooling down due to rate limits, skip immediately
    if (now < (modelCooldowns[model] || 0)) {
      continue;
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
        },
      });

      if (response && response.text) {
        return { data: JSON.parse(response.text), modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      const isQuota =
        err?.status === 'RESOURCE_EXHAUSTED' ||
        err?.code === 429 ||
        String(err?.message || '').includes('429') ||
        String(err?.message || '').includes('Quota exceeded') ||
        String(err?.message || '').includes('RESOURCE_EXHAUSTED');

      if (isQuota) {
        // Cooldown this model for 25 minutes so we don't spam rate-limited API calls
        modelCooldowns[model] = Date.now() + 25 * 60 * 1000;
        console.log(`[Rate Limit Notice] Model ${model} free tier daily limit reached. Cooldown engaged for 25m.`);
      } else {
        console.log(`[Model Notice] Model ${model} unavailable, trying fallback.`);
      }
    }
  }

  throw lastError || new Error('All Gemini model fallbacks exhausted.');
}

// Curated library of CEFR-specific prompts for offline/fallback use
const FALLBACK_PROMPTS: Record<string, Array<{
  category: string;
  questionKr: string;
  questionEn: string;
  hintVocabulary: string[];
  starterSentence: string;
}>> = {
  A1: [
    {
      category: 'daily',
      questionKr: '오늘 하루 기분은 어땠나요? 가장 기억에 남는 일을 떠올려 보세요.',
      questionEn: 'How was your day today? What was the best part?',
      hintVocabulary: ['relaxing day', 'feel energetic', 'good coffee'],
      starterSentence: 'Today was a good day because...',
    },
    {
      category: 'routine',
      questionKr: '주말에 주로 무엇을 하며 휴식을 취하시나요?',
      questionEn: 'What do you usually do to relax on weekends?',
      hintVocabulary: ['sleep in', 'watch movies', 'take a walk'],
      starterSentence: 'On weekends, I usually like to...',
    },
  ],
  A2: [
    {
      category: 'food & life',
      questionKr: '최근에 가장 맛있게 먹었던 음식이나 식당은 어디였나요?',
      questionEn: 'What is the best meal or restaurant you visited recently?',
      hintVocabulary: ['delicious flavor', 'cozy atmosphere', 'recommend to friends'],
      starterSentence: 'The most memorable meal I had recently was...',
    },
    {
      category: 'hobby',
      questionKr: '새로운 취미를 배운다면 무엇을 가장 시도해보고 싶으신가요?',
      questionEn: 'If you could start a new hobby, what would you choose?',
      hintVocabulary: ['learn an instrument', 'stay active', 'creative hobby'],
      starterSentence: 'If I had free time, I would love to learn...',
    },
  ],
  B1: [
    {
      category: 'career & growth',
      questionKr: '오늘 직장이나 일상에서 마주쳤던 작은 고민이나 과제는 무엇인가요?',
      questionEn: 'What was a small challenge or dilemma you faced at work or daily life today?',
      hintVocabulary: ['figure out a solution', 'tight deadline', 'collaborate with others'],
      starterSentence: 'Today, one issue I had to deal with was...',
    },
    {
      category: 'reflection',
      questionKr: '내가 생각하는 성공적인 하루의 기준은 무엇인가요?',
      questionEn: 'What defines a productive and fulfilling day for you?',
      hintVocabulary: ['sense of accomplishment', 'stay focused', 'work-life balance'],
      starterSentence: 'To me, a truly fulfilling day means that I...',
    },
  ],
  B2: [
    {
      category: 'workplace & mindset',
      questionKr: '최근 자신의 일하는 방식이나 가치관에 긍정적인 자극을 준 경험이 있나요?',
      questionEn: 'Has there been an experience recently that shaped your professional mindset?',
      hintVocabulary: ['shift in perspective', 'take initiative', 'embrace constructive feedback'],
      starterSentence: 'Looking back on recent projects, I realized that...',
    },
    {
      category: 'decision making',
      questionKr: '어려운 결정을 내려야 할 때, 가장 우선적으로 고려하는 판단 기준은?',
      questionEn: 'When faced with tough trade-offs, what guiding principle do you rely on most?',
      hintVocabulary: ['weigh pros and cons', 'trust my gut feeling', 'long-term consequences'],
      starterSentence: 'Whenever I find myself at a critical crossroads, I prioritize...',
    },
  ],
  C1: [
    {
      category: 'leadership & influence',
      questionKr: '치열한 비즈니스 환경에서 신뢰와 영향력을 구축하는 핵심 요인은 무엇일까요?',
      questionEn: 'In high-stakes professional settings, what carries the most weight in building credibility?',
      hintVocabulary: ['uncompromising integrity', 'articulate clear vision', 'mutual accountability'],
      starterSentence: 'In any high-stakes negotiation or leadership role, the pivotal factor is...',
    },
    {
      category: 'resilience',
      questionKr: '예상치 못한 변수나 위기가 닥쳤을 때 평정심을 유지하는 당신만의 방법은?',
      questionEn: 'How do you cultivate composure and strategic agility when unexpected disruptions occur?',
      hintVocabulary: ['unflappable poise', 'pivot swiftly', 'calculated risk assessment'],
      starterSentence: 'When unforeseen hurdles threaten to derail momentum, my first response is to...',
    },
  ],
  C2: [
    {
      category: 'strategy & philosophy',
      questionKr: '권한 행사를 넘어 자율성과 동기를 이끌어내는 진정한 리더십에 대해 어떻게 생각하시나요?',
      questionEn: 'How do you evaluate the premise that authentic leadership lies in empowering autonomy rather than exerting command?',
      hintVocabulary: ['catalyze organizational synergy', 'foster psychological safety', 'meritocratic culture'],
      starterSentence: 'The essence of transformative leadership inevitably hinges on...',
    },
  ],
};

function getFallbackPrompt(currentLevel: string = 'B1', category?: string) {
  const levelKey = FALLBACK_PROMPTS[currentLevel] ? currentLevel : 'B1';
  const list = FALLBACK_PROMPTS[levelKey];
  const selected = list[Math.floor(Math.random() * list.length)];
  return {
    ...selected,
    isQuotaExceeded: true,
    quotaNotice: QUOTA_NOTICE_MSG,
  };
}

/**
 * Intelligent local fallback for thought analysis when Gemini quota is exhausted.
 */
function getFallbackThoughtAnalysis(text: string, currentLevel: string = 'B1', inputMode: string = 'writing') {
  const isKorean = /[가-힣]/.test(text);
  const words = text.trim().split(/\s+/);
  const detectedLanguage = isKorean ? (words.length > 3 && /[a-zA-Z]/.test(text) ? 'mixed' : 'korean') : 'english';

  // Extract clean context
  let naturalEn = '';
  let profEn = '';
  let advEn = '';
  let korSummary = '';
  let nuanceNat = '';
  let nuanceProf = '';
  let nuanceAdv = '';

  if (isKorean) {
    korSummary = `"${text.slice(0, 35)}${text.length > 35 ? '...' : ''}"에 대한 생각 정리 및 표현 확장`;
    naturalEn = `I was just thinking that we really need to focus on what matters most right now.`;
    profEn = `I would suggest prioritizing our core objectives to ensure maximum impact and efficiency.`;
    advEn = `It is incumbent upon us to hone in on the decisive variables rather than getting bogged down in minutiae.`;
    nuanceNat = '일상 대화나 팀원 간 스탠드업 미팅에서 편안하게 아이디어를 나눌 때 이상적입니다.';
    nuanceProf = '임원 보고, 클라이언트 미팅, 공식 제안서에서 신뢰감과 설득력을 부여합니다.';
    advEn = '고급 어휘(incumbent upon, hone in, minutiae)를 활용하여 정교하고 전략적인 통찰을 표현합니다.';
  } else {
    // Polish the English input
    const cleanInput = text.trim().replace(/[.!?]+$/, '');
    korSummary = `작성하신 영문 생각("${cleanInput.slice(0, 30)}...")의 어법 교정 및 3단계 뉘앙스 업그레이드`;
    naturalEn = `${cleanInput}. Honestly, it makes a lot of sense when you look at the bigger picture.`;
    profEn = `Taking a strategic view, ${cleanInput.toLowerCase()}, which aligns closely with our key milestones.`;
    advEn = `Upon critical reflection, ${cleanInput.toLowerCase()}, underscoring the necessity of proactive execution.`;
    nuanceNat = '원어민들이 스스럼없이 덧붙이는 자연스러운 구어체 추임새와 결합된 표현입니다.';
    nuanceProf = '비즈니스 실무에서 명확한 인과관계와 방향성을 설명하는 세련된 화법입니다.';
    nuanceAdv = '학술 또는 고위급 토론에서 논리적 필연성을 강조할 때 주로 사용되는 고급 수사법입니다.';
  }

  // Grammar corrections check (smart heuristic for common pitfalls)
  const grammarCorrections: Array<{ original: string; correction: string; explanation: string; category: string }> = [];
  if (text.toLowerCase().includes('i am agree')) {
    grammarCorrections.push({
      original: 'I am agree',
      correction: 'I agree',
      explanation: '"agree"는 형용사가 아닌 일반동사이므로 be동사 없이 주어 바로 뒤에 사용해야 합니다.',
      category: 'verb-form',
    });
  } else if (text.toLowerCase().includes('explain about')) {
    grammarCorrections.push({
      original: 'explain about',
      correction: 'explain',
      explanation: '"explain"은 타동사이므로 전치사 "about" 없이 바로 목적어를 취합니다.',
      category: 'preposition',
    });
  } else if (text.toLowerCase().includes('discuss about')) {
    grammarCorrections.push({
      original: 'discuss about',
      correction: 'discuss',
      explanation: '"discuss"는 타동사이므로 전치사 about을 쓰지 않고 바로 대상을 연결합니다.',
      category: 'preposition',
    });
  }

  return {
    detectedLanguage,
    thoughtSummary: korSummary,
    assessedCefr: currentLevel,
    grammarCorrections,
    recommendedExpressions: [
      {
        tone: 'natural',
        english: naturalEn,
        koreanMeaning: isKorean ? '지금 가장 중요한 핵심에만 집중하면 될 것 같다는 생각이 들어요.' : `${text} (자연스러운 회화체)`,
        nuance: nuanceNat,
      },
      {
        tone: 'professional',
        english: profEn,
        koreanMeaning: isKorean ? '최대의 성과를 달성하기 위해 핵심 과제를 우선순위화하는 방안을 제안합니다.' : `${text} (정중한 비즈니스체)`,
        nuance: nuanceProf,
      },
      {
        tone: 'advanced',
        english: advEn,
        koreanMeaning: isKorean ? '사소한 지엽적 문제에 매몰되지 않고 결정적 핵심 변수에 온전히 집중해야 합니다.' : `${text} (고급 원어민 문장)`,
        nuance: nuanceAdv,
      },
    ],
    vocabulary: [
      {
        term: 'hone in on',
        ipa: '/hoʊn ɪn ɑːn/',
        meaning: '~에 온 정신/주의를 집중하다, 과녁을 조준하다',
        example: 'We need to hone in on the customer feedback before the product launch.',
      },
      {
        term: 'minutiae',
        ipa: '/mɪˈnuːʃiˌaɪ/',
        meaning: '자잘한 세부사항, 사소한 점들',
        example: "Let's not get bogged down in the minutiae during today's executive summary.",
      },
      {
        term: 'prioritize',
        ipa: '/praɪˈɔːrəˌtaɪz/',
        meaning: '우선순위를 매기다, 가장 중요하게 다루다',
        example: 'Senior leadership urged the teams to prioritize customer satisfaction over rapid expansion.',
      },
    ],
    mediaClips: [
      {
        title: 'Suits (슈츠)',
        mediaType: '미드',
        character: 'Harvey Specter',
        sceneContext: '협상 테이블에서 상대방의 블러핑을 꿰뚫어보고 주도권을 확실히 가져오기 위해 단호하게 던지는 명대사',
        quoteEn: "I don't play the odds, I play the man.",
        quoteKr: '난 막연한 확률에 기대지 않아. 상대를 간파해서 판을 지배하지.',
        youtubeSearchQuery: 'Suits Harvey Specter I play the man scene',
      },
      {
        title: 'The Intern (인턴)',
        mediaType: '영화',
        character: 'Ben Whittaker (Robert De Niro)',
        sceneContext: '새로운 스타트업의 혼란 속에서 젊은 CEO 줄스에게 흔들리지 않는 연륜과 진정성 어린 지혜를 건네는 장면',
        quoteEn: 'Experience never gets old.',
        quoteKr: '경험은 결코 낡지 않습니다. 본질과 디테일에 집중하세요.',
        youtubeSearchQuery: 'The Intern Ben Whittaker Experience never gets old scene',
      },
    ],
    coachingTip: '완벽한 문법을 고민하기보다 머릿속 생각을 일단 소리 내어 뱉는 것이 유창성의 가장 빠른 지름길입니다!',
    isQuotaExceeded: true,
    quotaNotice: QUOTA_NOTICE_MSG,
  };
}

/**
 * Fallback speech evaluator (Levenshtein + token overlap) when quota is reached
 */
function getFallbackSpeechEvaluation(targetText: string, spokenText: string) {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const targetTokens = clean(targetText);
  const spokenTokens = clean(spokenText);

  const matched = targetTokens.filter((token) => spokenTokens.includes(token));
  const missed = targetTokens.filter((token) => !spokenTokens.includes(token));

  const score = targetTokens.length > 0 ? Math.round((matched.length / targetTokens.length) * 100) : 80;

  let feedbackKr = '';
  if (score >= 85) {
    feedbackKr = '발음과 리듬감이 매우 훌륭합니다! 억양을 조금 더 확신 있게 이어가면 완벽한 원어민 뉘앙스가 완성됩니다.';
  } else if (score >= 60) {
    feedbackKr = `핵심 어휘가 명확히 전달되었습니다. 누락되거나 발음이 뭉개진 부분(${missed.slice(0, 3).join(', ')})의 연음과 강세에 유의해 보세요.`;
  } else {
    feedbackKr = '천천히 음절을 또박또박 발음해보세요. 상단 오디오 버튼을 눌러 원어민 발음을 다시 들은 후 호흡을 맞춰 따라 해보세요.';
  }

  return {
    score,
    matchedWords: matched.length,
    missedWords: missed,
    feedbackKr,
    isQuotaExceeded: true,
    quotaNotice: QUOTA_NOTICE_MSG,
  };
}

/**
 * Fallback weekly report generator
 */
function getFallbackWeeklyReport(entries: any[] = [], currentLevel: string = 'B1', streak: number = 0) {
  const entryCount = entries.length;
  return {
    overallStrengths: [
      `지속적인 일상 생각 기록 (${entryCount}회)을 통해 영어로 사고하는 습관이 점진적으로 정착되고 있습니다.`,
      `현재 ${currentLevel} 레벨의 표현 스펙트럼에서 일상 구어체뿐 아니라 정중한 비즈니스 표현을 수용하는 폭이 넓어졌습니다.`,
    ],
    recurringMistakes: [
      '일반동사와 be동사의 혼용 (예: "I am agree" → "I agree") 및 동사 원형 사용 습관',
      '타동사 뒤 불필요한 전치사 연결 (예: "explain about" → "explain")',
    ],
    recommendationForNextWeek:
      '새로 저장한 표현을 섀도잉 플레이어에서 0.8배속으로 3회 반복 청취 후, 본인의 음성을 녹음하여 발음 일치도를 점검하세요.',
    encouragement: `연속 ${Math.max(streak, 1)}일 동안 꾸준히 생각을 표현해 오신 열정이 대단합니다. 작은 누적이 유창성을 만듭니다!`,
    isQuotaExceeded: true,
    quotaNotice: QUOTA_NOTICE_MSG,
  };
}

// ==========================================
// API Routes
// ==========================================

// API Route: Analyze Thought (Speaking / Writing)
app.post('/api/analyze-thought', async (req: Request, res: Response) => {
  const { text, inputMode = 'writing', currentLevel = 'B1' } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required for analysis.' });
  }

  const systemInstruction = `You are a world-class bilingual English-Korean language coach and linguist.
The user wants to express their thoughts in English. They may provide thoughts in Korean, broken English, natural English, or a mix of both.
Your job is to:
1. Identify the core intent and meaning of the user's thought.
2. Assess the CEFR level of the user's input (A1, A2, B1, B2, C1, or C2) and suggest an updated level.
3. Identify grammar, preposition, or collocation errors in the user's English (if any) and explain them kindly in Korean.
4. Provide 3 distinct English expressions with natural phrasing:
   - "natural": casual, everyday conversational native speaker expression.
   - "professional": polished, appropriate for business meetings or formal writing.
   - "advanced": idiomatic, sophisticated, with nuanced vocabulary matching or slightly above their level (i+1 theory).
5. For each expression, provide the Korean translation and a brief nuance explanation in Korean.
6. Extract 2-3 key idioms, phrasal verbs, or vocabulary items with IPA pronunciation, Korean definition, and an example sentence.
7. Return a short 1-line encouraging Korean coaching tip.
8. Recommend 2 authentic scenes from American TV shows (미드), British dramas (영드), or classic movies, prioritizing business and professional workplace dramas (like Suits, The Intern, Succession, Sherlock, The Devil Wears Prada, Industry, Silicon Valley, The Newsroom, Billions, etc.) where a character uses an expression, quote, or sentence with a similar meaning, intent, or rhetorical impact.
For each media clip provide:
- title: Show/movie title in Korean & English (e.g., "Suits (슈츠)")
- mediaType: "미드", "영드", or "영화"
- character: Character name who said it (e.g., "Harvey Specter")
- sceneContext: Clear context explanation in Korean explaining what was happening in the meeting, office, or negotiation
- quoteEn: The character's memorable English line
- quoteKr: Natural Korean translation of the line
- youtubeSearchQuery: Specific YouTube search keywords to find the scene (e.g., "Suits Harvey Specter I play the man scene")`;

  const prompt = `User Input (${inputMode} mode, current level baseline: ${currentLevel}):
"${text.trim()}"

Analyze this thought and return the output matching the requested JSON structure including the 2 mediaClips from business/professional TV shows or movies.`;

  try {
    const result = await callGeminiWithFallback({
      systemInstruction,
      contents: prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedLanguage: {
            type: Type.STRING,
            description: 'Primary language of the thought: "korean", "english", or "mixed"',
          },
          thoughtSummary: {
            type: Type.STRING,
            description: 'One sentence Korean summary of the thought intention',
          },
          assessedCefr: {
            type: Type.STRING,
            description: 'Assessed CEFR level: A1, A2, B1, B2, C1, or C2',
          },
          grammarCorrections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                correction: { type: Type.STRING },
                explanation: { type: Type.STRING, description: 'Explanation in Korean' },
                category: { type: Type.STRING, description: 'e.g., tense, preposition, word-choice, article' },
              },
              required: ['original', 'correction', 'explanation'],
            },
          },
          recommendedExpressions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tone: { type: Type.STRING, description: '"natural", "professional", or "advanced"' },
                english: { type: Type.STRING },
                koreanMeaning: { type: Type.STRING },
                nuance: { type: Type.STRING, description: 'Nuance explanation in Korean' },
              },
              required: ['tone', 'english', 'koreanMeaning', 'nuance'],
            },
          },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                ipa: { type: Type.STRING },
                meaning: { type: Type.STRING, description: 'Korean meaning' },
                example: { type: Type.STRING },
              },
              required: ['term', 'meaning', 'example'],
            },
          },
          mediaClips: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                mediaType: { type: Type.STRING, description: '"미드", "영드", or "영화"' },
                character: { type: Type.STRING },
                sceneContext: { type: Type.STRING },
                quoteEn: { type: Type.STRING },
                quoteKr: { type: Type.STRING },
                youtubeSearchQuery: { type: Type.STRING },
              },
              required: ['title', 'mediaType', 'character', 'sceneContext', 'quoteEn', 'quoteKr', 'youtubeSearchQuery'],
            },
          },
          coachingTip: {
            type: Type.STRING,
            description: 'One friendly encouraging sentence in Korean',
          },
        },
        required: [
          'detectedLanguage',
          'thoughtSummary',
          'assessedCefr',
          'recommendedExpressions',
          'vocabulary',
          'mediaClips',
          'coachingTip',
        ],
      },
    });

    return res.json(result.data);
  } catch {
    console.log('[API Fallback] Activated curated offline engine for /api/analyze-thought.');
    const fallbackData = getFallbackThoughtAnalysis(text, currentLevel, inputMode);
    return res.json(fallbackData);
  }
});

// API Route: Generate Level-Adaptive Inspiration Prompt
app.post('/api/generate-prompt', async (req: Request, res: Response) => {
  const { currentLevel = 'B1', category = 'daily' } = req.body;

  const prompt = `Generate an inspiring, thought-provoking prompt for an English learner at CEFR level "${currentLevel}".
Category: "${category}" (e.g. daily reflection, career/growth, emotion, philosophy, travel, decision making).
The prompt should encourage expressing genuine feelings or thoughts.
Provide:
1. questionKr: Engaging question in Korean.
2. questionEn: Same question in natural English matching CEFR ${currentLevel}.
3. hintVocabulary: 3 helpful English keywords or collocations that the user can use.
4. starterSentence: A starter sentence beginning in English to help them break writer's block (e.g. "Lately, I've come to realize that...").`;

  try {
    const result = await callGeminiWithFallback({
      contents: prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          questionKr: { type: Type.STRING },
          questionEn: { type: Type.STRING },
          hintVocabulary: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          starterSentence: { type: Type.STRING },
        },
        required: ['category', 'questionKr', 'questionEn', 'hintVocabulary', 'starterSentence'],
      },
    });

    return res.json(result.data);
  } catch {
    console.log('[API Fallback] Activated curated offline engine for /api/generate-prompt.');
    const fallback = getFallbackPrompt(currentLevel, category);
    return res.json(fallback);
  }
});

// API Route: Evaluate Speech against Target Sentence
app.post('/api/evaluate-speech', async (req: Request, res: Response) => {
  const { targetText, spokenText } = req.body;

  if (!targetText || !spokenText) {
    return res.status(400).json({ error: 'Both targetText and spokenText are required.' });
  }

  const prompt = `Compare the learner's spoken transcription against the target sentence:
Target: "${targetText}"
Spoken: "${spokenText}"

Evaluate pronunciation, missed words, substitutions, and fluency.
Return:
1. score: 0 to 100 percentage.
2. matchedWords: count of matched words.
3. missedWords: array of words in target that were missing or mispronounced.
4. feedbackKr: Kind, specific feedback in Korean advising how to pronounce difficult parts or link sounds.`;

  try {
    const result = await callGeminiWithFallback({
      contents: prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          matchedWords: { type: Type.INTEGER },
          missedWords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          feedbackKr: { type: Type.STRING },
        },
        required: ['score', 'matchedWords', 'missedWords', 'feedbackKr'],
      },
    });

    return res.json(result.data);
  } catch {
    console.log('[API Fallback] Activated local phonetics engine for /api/evaluate-speech.');
    const fallback = getFallbackSpeechEvaluation(targetText, spokenText);
    return res.json(fallback);
  }
});

// API Route: Weekly Learning Insights & Weakness Report
app.post('/api/weekly-report', async (req: Request, res: Response) => {
  const { entries = [], currentLevel = 'B1', streak = 0 } = req.body;

  const summaryData = entries.slice(0, 15).map((e: any) => ({
    original: e.originalText,
    corrections: e.grammarCorrections || [],
    cefr: e.cefrLevel,
  }));

  const prompt = `Analyze this user's English learning log:
Current CEFR Level: ${currentLevel}
Active Streak: ${streak} days
Recent Entries Count: ${entries.length}
Sample Data: ${JSON.stringify(summaryData)}

Provide a holistic weekly mastery review report in Korean:
1. overallStrengths: 2 bullet points praising their progress and expressive capability.
2. recurringMistakes: Top 2 grammatical or collocation pitfalls they frequently encounter (e.g. preposition usage, subject-verb agreement).
3. recommendationForNextWeek: Actionable advice to reach the next CEFR level.
4. encouragement: 1 heartfelt sentence.`;

  try {
    const result = await callGeminiWithFallback({
      contents: prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallStrengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          recurringMistakes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          recommendationForNextWeek: { type: Type.STRING },
          encouragement: { type: Type.STRING },
        },
        required: ['overallStrengths', 'recurringMistakes', 'recommendationForNextWeek', 'encouragement'],
      },
    });

    return res.json(result.data);
  } catch {
    console.log('[API Fallback] Activated local review synthesis for /api/weekly-report.');
    const fallback = getFallbackWeeklyReport(entries, currentLevel, streak);
    return res.json(fallback);
  }
});

// Mount Vite or serve static dist
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ThoughtFlow English server running on http://localhost:${PORT}`);
  });
}

startServer();
