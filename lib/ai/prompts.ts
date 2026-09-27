import type { AiWordExplanation, ChatMessage } from "../types";

export const WORD_EXPLAIN_SYSTEM = [
  "你是一位资深英语词汇讲师，面向中文母语学习者讲解单词。",
  "严格只输出一个 JSON 对象，不要输出任何解释性文字或 Markdown 代码块。",
  "JSON 字段如下：",
  '{"word":string,"translation":string,"phonetic":string,"partOfSpeech":string,',
  '"examples":[{"en":string,"zh":string}],"roots":string,"collocations":string[],',
  '"confusions":string,"mnemonic":string}',
  "examples 至少 2 条，collocations 至少 3 条，全部使用简体中文讲解。",
].join("\n");

export function wordExplainMessages(word: string, level: string): ChatMessage[] {
  return [
    { role: "system", content: WORD_EXPLAIN_SYSTEM },
    { role: "user", content: `单词：${word}\n学习者水平：${level}\n请给出讲解。` },
  ];
}

export const EXAMPLE_SYSTEM = [
  "你是一位英语例句撰写助手，面向中文母语学习者。",
  "根据给定的单词与释义，写出一条地道、常用、适合学习的英文例句，并给出简体中文译文。",
  "严格只输出一个 JSON 对象，不要输出任何解释性文字或 Markdown 代码块。",
  'JSON 格式：{"en":string,"zh":string}',
  "例句要求：15-25 个词以内，语境清晰，必须自然使用目标单词。",
].join("\n");

export function exampleMessages(word: string, meaning: string): ChatMessage[] {
  return [
    { role: "system", content: EXAMPLE_SYSTEM },
    {
      role: "user",
      content: `单词：${word}\n释义：${meaning}\n请为该词生成一条英文例句及中文译文。`,
    },
  ];
}

export function tutorSystemPrompt(tone: string, level: string, words: string[]): string {
  const toneMap: Record<string, string> = {
    encouraging: "语气亲切、多鼓励，像耐心外教。",
    strict: "语气严谨、直接指出错误并纠正，像严格的考官。",
    humorous: "语气轻松幽默，可用有趣的联想帮助记忆。",
  };
  const focus = words.length ? `本轮重点练习这些词：${words.join(", ")}。` : "";
  return [
    "你是英语口语陪练 AI，用英文与中文学习者对话。",
    `学习者水平：${level}。${focus}`,
    toneMap[tone] ?? toneMap.encouraging,
    "每轮回复保持简短（2-4 句英文），最后用一行中文给出纠正或建议（以「💡」开头）。",
  ].join("\n");
}

export function mockExplanation(word: string): AiWordExplanation {
  return {
    word,
    translation: `（示例释义）${word} 的中文含义`,
    phonetic: "/ˈsæmplər/",
    partOfSpeech: "n. / v.",
    examples: [
      { en: `This is a sample sentence using "${word}".`, zh: `这是使用 “${word}” 的示例句子。` },
      { en: `Learners often meet "${word}" in exams.`, zh: `学习者常在考试中遇到 “${word}”。` },
    ],
    roots: "未配置 AI 时的占位内容。配置 AI_API_KEY 后点击「AI 精讲」即可获得真实讲解。",
    collocations: [`${word} up`, `a ${word} of`, `${word} with`],
    confusions: "暂无数据",
    mnemonic: "配置大模型后，这里会给出词根词缀与联想记忆法。",
  };
}

export const MOCK_TUTOR_REPLY =
  "Great to see you practicing! (当前为演示模式，配置 AI_API_KEY 后即可开启真实对话陪练。) 💡 提示：把 AI_BASE_URL / AI_API_KEY / AI_MODEL 填入环境变量即可。";