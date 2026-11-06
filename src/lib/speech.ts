// Web Speech API STT and TTS utilities

// Type declarations for browser SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

export interface STTOptions {
  lang?: 'en-US' | 'ko-KR';
  continuous?: boolean;
  interimResults?: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export class SpeechToTextController {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor() {
    if (isSpeechRecognitionSupported()) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
    }
  }

  start(options: STTOptions) {
    if (!this.recognition) {
      options.onError?.('브라우저가 음성 인식을 지원하지 않습니다. Chrome 또는 Edge 브라우저를 권장합니다.');
      return;
    }

    try {
      this.recognition.lang = options.lang || 'en-US';
      this.recognition.continuous = options.continuous ?? true;
      this.recognition.interimResults = options.interimResults ?? true;

      this.recognition.onstart = () => {
        this.isListening = true;
        options.onStart?.();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        options.onResult(text, Boolean(finalTranscript));
      };

      this.recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          options.onError?.('마이크 사용 권한이 차단되었습니다. 브라우저 설정에서 마이크를 허용해주세요.');
        } else if (event.error === 'no-speech') {
          // ignore silent pause
        } else {
          options.onError?.(`음성 인식 오류: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        options.onEnd?.();
      };

      this.recognition.start();
    } catch (e: any) {
      console.warn('Recognition start error:', e);
      options.onError?.(e.message || '음성 인식을 시작할 수 없습니다.');
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
    this.isListening = false;
  }

  get listening(): boolean {
    return this.isListening;
  }
}

// Text-to-Speech Controller
export interface TTSPlayOptions {
  text: string;
  lang?: 'en-US' | 'en-GB' | 'ko-KR';
  rate?: number; // 0.7 to 1.5
  pitch?: number; // 0.8 to 1.2
  onStart?: () => void;
  onEnd?: () => void;
}

export class TextToSpeechController {
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (typeof window === 'undefined') return;
    this.voices = window.speechSynthesis.getVoices();
  }

  public getEnglishVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0) {
      this.loadVoices();
    }
    return this.voices.filter(v => v.lang.startsWith('en'));
  }

  public speak(options: TTSPlayOptions) {
    if (!isSpeechSynthesisSupported()) return;

    window.speechSynthesis.cancel(); // cancel any active speech

    const utterance = new SpeechSynthesisUtterance(options.text);
    utterance.lang = options.lang || 'en-US';
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;

    // Pick a high-quality natural voice if available
    const voices = this.getEnglishVoices();
    const matchedVoice = voices.find(v => {
      if (options.lang === 'en-GB') return v.lang.includes('GB') || v.name.includes('British');
      return v.lang.includes('US') || v.name.includes('Google') || v.name.includes('Natural');
    }) || voices[0];

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    if (options.onStart) utterance.onstart = options.onStart;
    if (options.onEnd) utterance.onend = options.onEnd;
    utterance.onerror = () => {
      options.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop() {
    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  public isSpeaking(): boolean {
    return isSpeechSynthesisSupported() ? window.speechSynthesis.speaking : false;
  }
}

// Global singletons
export const sttController = new SpeechToTextController();
export const ttsController = new TextToSpeechController();
