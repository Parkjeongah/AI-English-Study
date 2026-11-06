# Media Clips Recommendation (미드·영드·영화 실제 대사 클립 추천)

한국어 또는 영어로 작성된 생각 분석 결과에 맞춰, 실제 미드(American TV shows), 영드(British dramas), 명작 영화 속 비즈니스·전문직(슈츠, 인턴, 셜록, 석세션 등) 등장인물이 유사한 표현이나 뉘앙스를 사용한 명장면 대사와 상황 맥락을 추천하고 훈련할 수 있는 시스템 구현 계획입니다.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> 사용자의 선택에 따라 **생각 분석 결과 카드 내 실제 미디어 사용 장면 섹션**으로 배치하며, **비즈니스 및 전문직 드라마(슈츠, 인턴 등)** 작품을 우선 매칭합니다.

- **표시 위치**: `ThoughtStudio`의 생각 분석 결과 카드 하단에 독립된 '실제 미디어 대사 클립 (Media Scene Clips)' 섹션 탑재.
- **선호 장르 및 작품군**: 비즈니스, 커리어, 오피스, 법정, 전문직 드라마 및 영화 (e.g., *Suits*, *The Intern*, *Succession*, *Sherlock*, *The Devil Wears Prada*, *Industry*, *Silicon Valley* 등) 우선 매칭.
- **클립 데이터 구성**:
  1. 작품명(영문/한글) 및 미디어 유형 (미드 / 영드 / 영화).
  2. 등장인물(Character) 및 상황 맥락 (어떤 회의, 협상, 의사결정 상황에서 발화되었는지).
  3. 실제 영어 대사(Quote) 및 한국어 번역.
  4. 원어민 발음 청취(TTS) 및 대사 섀도잉.
  5. 유튜브 실제 명장면 1초 검색 바로가기 (라이선스 차단 없이 유튜브에서 실제 장면을 즉시 시청 가능).
  6. 해당 미디어 대사를 원클릭으로 내 망각곡선 복습 덱에 추가.

---

### 1. Overview & Core Concept

- **What It Does**: 사용자가 생각을 말하거나 쓰면, AI가 해당 생각의 감정·뉘앙스·주제와 가장 잘 부합하는 영미권 미디어(미드/영드/영화) 속 실제 대사 장면 2개를 선별하여 함께 추천합니다.
- **Why It Matters**: 교과서적인 문장이 아니라 "드라마 *슈츠(Suits)*의 하비 스펙터가 협상 테이블에서 쓴 표현", "*인턴(The Intern)*의 벤이 동료에게 조언할 때 쓴 표현"을 함께 보며 원어민의 실제 사용 맥락을 생생하게 체득할 수 있습니다.
- **Key Value**: 단순 어휘 학습을 넘어, 미디어 장면 연상을 통한 시각적·상황적 기억 고착화(Episodic Memory) 극대화.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **생각 분석 실행**: 사용자가 생각을 녹음하거나 텍스트를 입력하고 'AI 분석 & 교정 받기' 클릭.
  2. **미디어 클립 카드 확인**:
     - 분석 카드 내에 '미드·영드·영화 속 실제 사용 장면' 탭/카드 렌더링.
     - 작품 포스터 무드의 미디어 뱃지 (예: `미드 · Suits`, `영화 · The Intern`).
     - 상황 설명: "하비가 의뢰인의 무리한 요구를 정중하지만 단호하게 거절하며 협상 주도권을 가져오는 장면".
     - 명대사 인용구: 큰따옴표 이탤릭 타이포그래피로 강조.
  3. **인터랙티브 학습 액션**:
     - 스피커 버튼 클릭 시 원어민 음성(TTS)으로 대사 낭독.
     - '유튜브에서 장면 보기' 버튼 클릭 시 새 탭에서 실제 클립 검색 결과로 직행.
     - '이 대사 복습 카드에 추가' 클릭 시 바로 개인 SRS 망각곡선 덱에 등록.

- **Visual Identity**:
  - 시네마틱 무드의 딥 네이비/인디고 보더와 필름 릴 아이콘 (`Film`, `Clapperboard`).
  - 정갈한 인라인 메타데이터 (`Suits S2E04` · `미드` · `Harvey Specter`).
  - 안티 슬롭(Anti-Slop) 원칙: 불필요한 번쩍임이나 장식용 뱃지 대신, 명확한 가독성과 영화적 타이포그래피 인용구 구성.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Side Gemini JSON Schema Expansion**:
  - *Chosen Approach*: `/api/analyze-thought` 엔드포인트의 Gemini 3.8 Flash 프롬프트 및 `responseSchema`에 `mediaClips` 배열 필드를 추가.
  - *Why*: 클라이언트가 별도 추가 요청을 보낼 필요 없이 한 번의 분석 호출로 교정, 톤별 표현, 어휘와 함께 관련 미디어 클립까지 완벽한 동기화로 수신.
- **Decision 2: Direct YouTube Scene Query vs Embedded Player**:
  - *Chosen Approach*: 신뢰할 수 있는 정확한 검색 쿼리(`https://www.youtube.com/results?search_query=${encodeURIComponent(clipQuery)}`) 원클릭 버튼 제공.
  - *Why*: 유튜브 임베드 영상은 저작권 차단(Error 150/101)이나 특정 지역 재생 제한이 빈번하여 사용자 경험을 해치는 반면, 스마트 쿼리 링크는 실제 클립 영상, 공식 채널 하이라이트, 쇼츠 클립으로 안정적이고 합법적으로 연결됨.
- **Decision 3: SRS Flashcard Integration**:
  - *Chosen Approach*: 미디어 클립의 대사도 사용자의 개인 망각곡선 복습 덱에 원클릭으로 추가할 수 있도록 지원.
  - *Why*: "내가 감명 깊게 본 드라마 명대사"를 망각 주기에 맞춰 복습하면 기억 정착률이 월등히 높아짐.

---

### 4. Technical Architecture & Component Mapping

#### Data Model (`src/types/index.ts`)

```typescript
export interface MediaClip {
  title: string;           // e.g. "Suits (슈츠)"
  mediaType: '미드' | '영드' | '영화';
  character: string;       // e.g. "Harvey Specter"
  sceneContext: string;    // e.g. "무리한 요구를 정중하지만 단호하게 거절하는 협상 장면"
  quoteEn: string;         // e.g. "I don't play the odds, I play the man."
  quoteKr: string;         // e.g. "난 확률에 기대지 않아. 사람을 보고 승부하지."
  youtubeSearchQuery: string; // e.g. "Suits Harvey Specter I play the man scene"
}
```

#### Component & Server Changes
1. `src/types/index.ts`: `MediaClip` 인터페이스 추가 및 `ThoughtEntry`에 `mediaClips?: MediaClip[]` 반영.
2. `server.ts`:
   - `/api/analyze-thought`의 시스템 인스트럭션 및 `responseSchema`에 비즈니스/전문직 중심의 `mediaClips` 추출 지시 추가.
3. `src/components/ThoughtStudio.tsx`:
   - AI 분석 결과 카드 내 '미드·영드·영화 속 실제 사용 장면' 렌더링.
   - 대사 듣기(TTS), 유튜브 검색 링크, SRS 덱 추가 버튼 탑재.
4. `src/lib/storage.ts`: 초기 샘플 데이터(Seed Entries)에도 매력적인 슈츠/인턴 실제 미디어 클립 기본 탑재.
