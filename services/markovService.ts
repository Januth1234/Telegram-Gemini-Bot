/**
 * Simple bigram Markov chain for generating short message suggestions
 * from the user's own history + seed phrases, so suggestions feel familiar and save time.
 */

const SEED_PHRASES = [
  "Explain in simple terms",
  "Summarize this for me",
  "What is the history of",
  "Write a short story about",
  "How do I fix",
  "Compare and contrast",
  "Give me a recipe for",
  "Translate to Sinhala",
  "Explain like I'm a beginner",
  "What are the benefits of",
  "Tell me about Sri Lanka",
  "How does this work",
  "Suggest ideas for",
  "Break this down step by step",
  "What is the best way to",
  "Explain quantum computing",
  "Write code in Python",
  "Describe in detail",
  "Give me 3 examples of",
  "Why does this happen",
];

const MIN_WORDS = 3;
const MAX_WORDS = 10;
const DEFAULT_COUNT = 3;

function tokenize(text: string): string[] {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function buildChain(texts: string[]): { starts: string[]; transitions: Map<string, string[]> } {
  const starts: string[] = [];
  const transitions = new Map<string, string[]>();

  const addTransition = (from: string, to: string) => {
    const list = transitions.get(from) ?? [];
    list.push(to);
    transitions.set(from, list);
  };

  for (const text of texts) {
    const words = tokenize(text);
    if (words.length === 0) continue;
    starts.push(words[0]);
    for (let i = 0; i < words.length - 1; i++) {
      addTransition(words[i], words[i + 1]);
    }
  }

  return { starts, transitions };
}

/**
 * Build a Markov model from user message texts (and seed phrases so we always have data).
 */
export function buildMarkovModel(userTexts: string[]): { starts: string[]; transitions: Map<string, string[]> } {
  const combined = [...SEED_PHRASES, ...userTexts.filter(Boolean)];
  return buildChain(combined);
}

/**
 * Generate up to `count` unique short phrases from the model (each phrase has MIN_WORDS to MAX_WORDS).
 */
export function generateSuggestions(
  model: { starts: string[]; transitions: Map<string, string[]> },
  count: number = DEFAULT_COUNT
): string[] {
  const { starts, transitions } = model;
  if (starts.length === 0) return [];

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const generateOne = (): string => {
    let word = pick(starts);
    const phrase: string[] = [word];

    while (phrase.length < MAX_WORDS) {
      const nextList = transitions.get(word);
      if (!nextList || nextList.length === 0) break;
      word = pick(nextList);
      phrase.push(word);
    }

    let result = phrase.join(" ").trim();
    if (result.split(" ").length < MIN_WORDS && starts.length > 0) {
      const extra = pick(starts);
      result = result ? `${result} ${extra}` : extra;
    }
    return capitalize(result);
  };

  const seen = new Set<string>();
  const out: string[] = [];
  let attempts = 0;
  const maxAttempts = count * 10;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const s = generateOne();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }

  return out;
}

/**
 * One-shot: build model from user texts and return suggestion strings.
 * Use this when you have a list of past user messages and want 3 quick suggestions.
 */
export function getMarkovSuggestions(userMessageTexts: string[], count: number = DEFAULT_COUNT): string[] {
  const model = buildMarkovModel(userMessageTexts);
  return generateSuggestions(model, count);
}

/** MarkovModel type alias for caching */
export type MarkovModel = { starts: string[]; transitions: Map<string, string[]>; builtAt?: number };

/** Serialize model to a JSON-safe object for cacheService storage */
export function serializeMarkovModel(model: { starts: string[]; transitions: Map<string, string[]> }): string {
  return JSON.stringify({
    starts: model.starts,
    transitions: Array.from(model.transitions.entries()),
    builtAt: Date.now(),
  });
}

/** Deserialize a cached model back to a usable Markov model + builtAt timestamp */
export function deserializeMarkovModel(raw: string): { starts: string[]; transitions: Map<string, string[]>; builtAt: number } | null {
  try {
    const parsed = JSON.parse(raw);
    return {
      starts: parsed.starts ?? [],
      transitions: new Map(parsed.transitions ?? []),
      builtAt: parsed.builtAt ?? 0,
    };
  } catch {
    return null;
  }
}

/** Returns true if the cached model was built less than 30 minutes ago */
export function isMarkovCacheValid(model: { builtAt?: number }): boolean {
  if (!model.builtAt) return false;
  return Date.now() - model.builtAt < 30 * 60 * 1000;
}
