
/**
 * Markov Chain Text Generator
 * Runs entirely client-side to generate dynamic, varied text for:
 * - Input placeholders
 * - Loading state messages
 * - Dynamic slogans/tips
 * - Demo content
 */

const SAMPLE_CORPUS = [
  "Ask me to write a creative story about Sri Lanka.",
  "Help me solve complex calculus problems step-by-step.",
  "Generate a Python script for data analysis.",
  "Translate this official document into Sinhala.",
  "Create a marketing strategy for a local tea brand.",
  "Explain quantum computing to a beginner.",
  "Write a professional cover letter for a job.",
  "Design a modern logo concept for a startup.",
  "What are the latest news updates in Colombo?",
  "Summarize this long article into bullet points.",
  "Draft a legal agreement for a contract.",
  "Debug this JavaScript code snippet immediately.",
  "Suggest a travel itinerary for Ella and Kandy.",
  "How do I start a business in Sri Lanka?",
  "Write a poem about the monsoon rain.",
  "Analyze this financial report for trends.",
  "Convert this image text into editable format.",
  "Compose an email to apply for leave.",
  "What is the best way to learn React?",
  "Analyze the legal implications of this clause.",
  "Optimize this database query for performance."
];

export class MarkovService {
  private chain: Record<string, string[]> = {};
  private startWords: string[] = [];

  constructor() {
    this.train();
  }

  /**
   * Seeding the Markov Chain with the sample corpus.
   * Breaks sentences into words and maps transitions.
   */
  private train() {
    SAMPLE_CORPUS.forEach(sentence => {
      // Remove punctuation for cleaner chaining, though keeping it can add structure
      const cleanSentence = sentence.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const words = cleanSentence.split(/\s+/);
      
      if (words.length > 0) this.startWords.push(words[0]);
      
      for (let i = 0; i < words.length - 1; i++) {
        const word = words[i];
        const next = words[i + 1];
        if (!this.chain[word]) this.chain[word] = [];
        this.chain[word].push(next);
      }
    });
  }

  /**
   * Generates a dynamic placeholder prompt.
   * Uses random walk through the chain.
   */
  generatePlaceholder(): string {
    if (this.startWords.length === 0) return "Ask me anything...";

    let current = this.startWords[Math.floor(Math.random() * this.startWords.length)];
    const result = [current];
    let length = 0;
    const maxLength = Math.floor(Math.random() * 5) + 4; // 4 to 9 words

    while (length < maxLength) {
      const nextOptions = this.chain[current];
      if (!nextOptions || nextOptions.length === 0) break;
      
      current = nextOptions[Math.floor(Math.random() * nextOptions.length)];
      result.push(current);
      length++;
    }

    return result.join(' ') + "...";
  }

  /**
   * Generates a dynamic loading state message ("Thinking...", "Analyzing...", etc.)
   * Uses a simpler template-based approach for consistency but varied vocabulary.
   */
  generateLoadingMessage(): string {
    const actions = ["Thinking", "Analyzing", "Processing", "Calculating", "Synthesizing", "Reading", "Connecting", "Decoding"];
    const targets = ["logic", "context", "data streams", "neural pathways", "knowledge graph", "parameters", "syntax", "vectors"];
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    return `${action} ${target}...`;
  }

  /**
   * Generates a dynamic slogan or tip of the day.
   */
  generateSlogan(): string {
    const subjects = ["Neural intelligence", "Local knowledge", "Deep reasoning", "Creative synthesis", "Seamless logic", "Bilingual core"];
    const verbs = ["for", "powering", "enhancing", "meeting", "bridging"];
    const objects = ["Sri Lanka", "your workflow", "the future", "professionals", "creators", "students"];
    
    return `${subjects[Math.floor(Math.random() * subjects.length)]} ${verbs[Math.floor(Math.random() * verbs.length)]} ${objects[Math.floor(Math.random() * objects.length)]}.`;
  }
}

export const markovService = new MarkovService();
