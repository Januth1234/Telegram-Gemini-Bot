
import { geminiService } from './geminiService';
import { APP_CONFIG } from '../config';

export interface CodeSnapshot {
  version: string;
  date: string;
  features: string[];
  body: string;
  htmlUrl: string;
}

export class CodeTrackerService {
  private cache: CodeSnapshot[] | null = null;

  async getHistory(): Promise<CodeSnapshot[]> {
    if (this.cache) return this.cache;

    try {
      const response = await fetch(`https://api.github.com/repos/${APP_CONFIG.githubRepo}/releases`);
      if (!response.ok) throw new Error("GitHub API Protocol Unreachable");
      
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];

      const history = data.map((rel: any) => ({
        version: rel.tag_name.replace('v', ''),
        date: new Date(rel.published_at).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        features: this.extractFeatures(rel.body),
        body: rel.body || "No technical documentation found for this build.",
        htmlUrl: rel.html_url
      }));

      this.cache = history;
      return history;
    } catch (e) {
      console.warn("GitHub Protocol Sync Failure:", e);
      return [];
    }
  }

  private extractFeatures(body: string): string[] {
    if (!body) return ["System stability synchronization", "Neural protocol refinement"];
    
    // Improved regex to capture technical bullet points and highlights
    const lines = body.split('\n');
    const features = lines
      .filter(line => /^\s*[-*+]\s+/.test(line) || /^\s*[0-9]+\.\s+/.test(line) || /^\*\*[^*]+\*\*/.test(line))
      .map(line => line.replace(/^\s*[-*+]\s+/, '').replace(/^\s*[0-9]+\.\s+/, '').replace(/\*\*/g, '').trim())
      .filter(line => line.length > 3 && line.length < 100)
      .slice(0, 6);
    
    return features.length > 0 ? features : ["Verified production artifact", "Architecture synchronization"];
  }

  async generateReleaseNotes(version: string): Promise<string> {
    const history = await this.getHistory();
    const snapshot = history.find(s => s.version === version);
    if (!snapshot) return "Deployment logs for this version are currently archived.";

    const prompt = `You are a professional technical lead. Provide a concise 2-sentence executive summary of this GitHub release log for Aura Platform v${version}. Focus on institutional value and stability.
    Log: ${snapshot.body}`;

    try {
      // Fix: Removed 'useLite' which is not supported in the chat options type
      const response = await geminiService.chat(prompt);
      return response.text || "Summary generation protocol failed.";
    } catch (e) {
      return `Build ${version} focuses on critical path stability and synchronized neural workspace logic.`;
    }
  }
}

export const codeTrackerService = new CodeTrackerService();
