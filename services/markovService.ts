/**
 * Trigram Markov chain for message suggestions: uses word pairs as context
 * so suggestions sound more natural. Supports recency weighting, mode-aware
 * seeds, quality filtering, and optional persistence.
 */

import type { WorkspaceMode } from '../types';

const MIN_WORDS = 3;
const MAX_WORDS = 12;
const DEFAULT_COUNT = 3;
const MIN_LENGTH = 8;
const MIN_WORD_COUNT = 3;
const SKIP_PATTERNS = /^(yes|no|ok|okay|thanks|lol|haha|sure|hi|hello|hey|bye|goodbye|😊|👍|nice|cool|got it|yep|nope)/i;

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

/** Mode-aware seed phrases so suggestions fit the current workspace. Exhaustive over WorkspaceMode so missing keys are a type error. */
type SeedPhrasesMap = { [K in WorkspaceMode]: string[] } & { default: string[] };
export const SEED_PHRASES: SeedPhrasesMap = {
  chat: [
    "Explain in simple terms",
    "Summarize this for me",
    "What is the history of",
    "Compare and contrast",
    "Tell me about Sri Lanka",
    "How does this work",
    "Break this down step by step",
    "What is the best way to",
    "Give me 3 examples of",
    "Why does this happen",
  ],
  maths: [
    "Solve for x",
    "Find the derivative of",
    "Calculate the integral of",
    "Simplify this expression",
    "Explain this formula",
    "Graph the function",
    "What is the limit of",
    "Prove that",
  ],
  studio: [
    "Generate a realistic photo of",
    "Create a poster for",
    "Draw a futuristic",
    "Illustrate a scene with",
    "Make an image of",
    "Design a logo for",
  ],
  vision: [
    "What is in this image",
    "Read the text in",
    "Explain what you see",
    "Describe this diagram",
    "What does this picture show",
  ],
  voice: [
    "Tell me about",
    "Explain briefly",
    "What is",
    "How do I",
  ],
  translator: [
    "Translate this to Sinhala",
    "Translate to Tamil",
    "Translate to English",
    "How do you say in",
  ],
  agent: [
    "Find information about",
    "Summarize the key points",
    "Break this down into steps",
    "Research and compare",
    "Draft a short outline for",
  ],
  default: [
    "Help me with",
    "What does this mean",
    "Give me 3 examples of",
    "Explain like I'm a beginner",
  ],
};

export type MarkovModel = { starts: string[]; transitions: Map<string, string[]> };

/** Serializable shape for localStorage (Map entries as array). */
export type SerializedMarkovModel = {
  starts: string[];
  transitions: [string, string[]][];
  builtAt: number;
};

function tokenize(text: string): string[] {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function isQualityText(text: string): boolean {
  const t = text.trim();
  if (t.length < MIN_LENGTH) return false;
  if (SKIP_PATTERNS.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= MIN_WORD_COUNT;
}

/**
 * Build trigram chain from an array of phrases (already weighted and filtered).
 * Keys are "word1 word2", values are possible next words.
 */
function buildTrigramChain(texts: string[]): MarkovModel {
  const starts: string[] = [];
  const transitions = new Map<string, string[]>();

  const addTransition = (key: string, next: string) => {
    const list = transitions.get(key) ?? [];
    list.push(next);
    transitions.set(key, list);
  };

  for (const text of texts) {
    const words = tokenize(text);
    if (words.length < 2) continue;
    starts.push(`${words[0]} ${words[1]}`);
    for (let i = 0; i <= words.length - 3; i++) {
      const key = `${words[i]} ${words[i + 1]}`;
      addTransition(key, words[i + 2]);
    }
  }

  return { starts, transitions };
}

/**
 * Build a Markov model from user messages with optional recency weighting and mode-aware seeds.
 * Filters low-quality inputs (short, generic replies).
 */
export function buildMarkovModel(
  userTexts: string[],
  options?: { timestamps?: number[]; mode?: WorkspaceMode }
): MarkovModel {
  const now = Date.now();
  const weighted: string[] = [];
  const mode = options?.mode ?? 'chat';
  const seeds = [...(SEED_PHRASES[mode] ?? []), ...SEED_PHRASES.default];
  weighted.push(...seeds);

  const qualityTexts = userTexts.filter(isQualityText);
  qualityTexts.forEach((text, i) => {
    const age = options?.timestamps?.[i] != null ? now - options.timestamps[i]! : Infinity;
    const weight =
      age < DAY_MS ? 4
      : age < WEEK_MS ? 2
      : 1;
    for (let w = 0; w < weight; w++) weighted.push(text);
  });

  return buildTrigramChain(weighted);
}

/**
 * Generate up to `count` unique phrases from the trigram model.
 * Optionally exclude phrases in `exclude` (e.g. recently shown) to avoid repetition.
 */
export function generateSuggestions(
  model: MarkovModel,
  count: number = DEFAULT_COUNT,
  exclude: Set<string> = new Set()
): string[] {
  const { starts, transitions } = model;
  if (starts.length === 0) return [];

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const generateOne = (): string => {
    const pair = pick(starts);
    const parts = pair.split(' ');
    if (parts.length !== 2) return '';

    let w0 = parts[0]!;
    let w1 = parts[1]!;
    const phrase: string[] = [w0, w1];

    while (phrase.length < MAX_WORDS) {
      const key = `${w0} ${w1}`;
      const nextList = transitions.get(key);
      if (!nextList || nextList.length === 0) break;
      const next = pick(nextList);
      phrase.push(next);
      w0 = w1;
      w1 = next;
    }

    let result = phrase.join(' ').trim();
    if (result.split(' ').length < MIN_WORDS && starts.length > 0) {
      const extra = pick(starts).split(' ')[0] ?? '';
      result = result ? `${result} ${extra}` : extra;
    }
    return capitalize(result);
  };

  const seen = new Set<string>();
  const out: string[] = [];
  let attempts = 0;
  const maxAttempts = count * 15;
  let consecutiveEmpty = 0;
  const maxConsecutiveEmpty = 8;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const s = generateOne();
    if (s && !seen.has(s) && !exclude.has(s)) {
      seen.add(s);
      out.push(s);
      consecutiveEmpty = 0;
    } else {
      consecutiveEmpty++;
      if (consecutiveEmpty >= maxConsecutiveEmpty) break;
    }
  }

  return out;
}

/**
 * One-shot: build model from user texts (with optional timestamps and mode) and return suggestions.
 * Prefer keeping a model in a ref and calling generateSuggestions(model, count, exclude) so the model
 * can be cached and reused.
 */
export function getMarkovSuggestions(
  userMessageTexts: string[],
  count: number = DEFAULT_COUNT,
  options?: { mode?: WorkspaceMode; timestamps?: number[]; exclude?: Set<string> }
): string[] {
  const model = buildMarkovModel(userMessageTexts, {
    timestamps: options?.timestamps,
    mode: options?.mode,
  });
  return generateSuggestions(model, count, options?.exclude ?? new Set());
}

/** Serialize model for localStorage (Map → entries array). */
export function serializeMarkovModel(model: MarkovModel): SerializedMarkovModel {
  return {
    starts: model.starts,
    transitions: Array.from(model.transitions.entries()),
    builtAt: Date.now(),
  };
}

/** A valid start is a string with at least two words (used as bigram key). */
function isValidStart(s: unknown): s is string {
  return typeof s === 'string' && s.trim().split(/\s+/).length >= 2;
}

/** Deserialize from cache; returns null if data missing or invalid. */
export function deserializeMarkovModel(cached: unknown): MarkovModel | null {
  if (!cached || typeof cached !== 'object') return null;
  const o = cached as Record<string, unknown>;
  const starts = o.starts;
  const transitions = o.transitions;
  if (!Array.isArray(starts) || !Array.isArray(transitions)) return null;

  const validStarts = starts.filter(isValidStart);
  if (validStarts.length === 0) return null;

  const map = new Map<string, string[]>();
  for (const entry of transitions) {
    if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'string' &&
      Array.isArray(entry[1]) &&
      (entry[1] as unknown[]).every((v): v is string => typeof v === 'string')
    ) {
      map.set(entry[0], entry[1] as string[]);
    }
  }

  return { starts: validStarts, transitions: map };
}

const MARKOV_CACHE_MAX_AGE_MS = DAY_MS;

/** Return true if cached model is still valid to use (within 24h). */
export function isMarkovCacheValid(cached: { builtAt: number }): boolean {
  return Date.now() - cached.builtAt < MARKOV_CACHE_MAX_AGE_MS;
}
