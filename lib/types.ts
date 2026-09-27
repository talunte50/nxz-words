export type WordStatus = "new" | "learning" | "review" | "mastered";

export interface Word {
  id: string;
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example?: string;
  exampleZh?: string;
  tags?: string[];
  bookId: string;
}

export interface WordBook {
  id: string;
  name: string;
  description: string;
  level: string;
  cover: string;
  /** 词库分类（如「中国考试」「国际考试」），qwerty 导入的词库均有 */
  category?: string;
  /** 语种代码，如 en / ja / de */
  language?: string;
  words: Word[];
}

export interface WordBookMeta {
  id: string;
  name: string;
  description: string;
  level: string;
  cover: string;
  /** 词库分类 */
  category?: string;
  /** 语种代码 */
  language?: string;
  wordCount: number;
  /** 管理端可控制词库是否对外可见 */
  enabled?: boolean;
}

export interface ReviewState {
  wordId: string;
  bookId: string;
  status: WordStatus;
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  due: string;
  lastReview: string | null;
}

export type ReviewGrade = "again" | "hard" | "good" | "easy";

export interface DailyStat {
  date: string;
  newCount: number;
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
  minutes: number;
}

export interface UserProfile {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  role: "admin" | "user";
  createdAt: string;
  currentBookId: string;
  dailyGoal: number;
  reminderTime: string;
  aiTone: "encouraging" | "strict" | "humorous";
  theme: "light" | "dark";
}

export interface UserData {
  profile: UserProfile;
  reviews: Record<string, ReviewState>;
  favorites: string[];
  stats: DailyStat[];
  sessions: ChatSession[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface AiWordExplanation {
  word: string;
  translation: string;
  phonetic: string;
  partOfSpeech: string;
  examples: { en: string; zh: string }[];
  roots: string;
  collocations: string[];
  confusions: string;
  mnemonic: string;
}

export interface ExampleCache {
  en: string;
  zh: string;
  model?: string;
  at?: string;
}

export interface GeneratedExample {
  wordId: string;
  en: string;
  zh: string;
  cached: boolean;
}

export interface SessionPayload {
  uid: string;
  username: string;
  exp: number;
}