/**
 * Fetches release descriptions from GitHub Releases API.
 * Used by the "What's New" / Official Releases component to show update descriptions.
 */

import { APP_CONFIG } from '../config';

export interface GitHubReleaseItem {
  version: string;
  date: string;
  features: string[];
  body: string;
  htmlUrl: string;
}

const GITHUB_RELEASES_URL = (repo: string) =>
  `https://api.github.com/repos/${repo}/releases`;

/** Optional. When set (e.g. VITE_GITHUB_TOKEN), requests use auth and get 5000 req/h instead of 60/h per IP. */
function getGitHubToken(): string | undefined {
  const token =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN) ||
    (typeof process !== 'undefined' && process.env?.VITE_GITHUB_TOKEN);
  return typeof token === 'string' && token.trim() ? token.trim() : undefined;
}

function extractFeatures(body: string | null): string[] {
  if (!body) return ["System stability synchronization", "Neural protocol refinement"];

  const lines = body.split('\n');
  const features = lines
    .filter((line) => /^\s*[-*+]\s+/.test(line) || /^\s*[0-9]+\.\s+/.test(line) || /^\*\*[^*]+\*\*/.test(line))
    .map((line) =>
      line
        .replace(/^\s*[-*+]\s+/, '')
        .replace(/^\s*[0-9]+\.\s+/, '')
        .replace(/\*\*/g, '')
        .trim()
    )
    .filter((line) => line.length > 3 && line.length < 100)
    .slice(0, 6);

  return features.length > 0 ? features : ["Verified production artifact", "Architecture synchronization"];
}

function mapRelease(rel: { tag_name?: string; published_at?: string; body?: string; html_url?: string }): GitHubReleaseItem {
  const version = (rel.tag_name || '0.0.0').replace(/^v/, '');
  const date = rel.published_at
    ? new Date(rel.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  return {
    version,
    date,
    features: extractFeatures(rel.body ?? null),
    body: rel.body?.trim() || "No description for this release.",
    htmlUrl: rel.html_url || `https://github.com/${APP_CONFIG.githubRepo}/releases`,
  };
}

class GitHubReleasesService {
  private cache: GitHubReleaseItem[] | null = null;

  /** Clear cached releases so next getReleases() fetches from GitHub again. */
  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Get release descriptions from GitHub.
   * @param forceRefresh - If true, ignores cache and fetches from GitHub.
   * @returns List of releases (newest first), or [] on error.
   */
  async getReleases(forceRefresh = false): Promise<GitHubReleaseItem[]> {
    if (!forceRefresh && this.cache) return this.cache;

    const repo = APP_CONFIG.githubRepo;
    if (!repo) return [];

    try {
      const token = getGitHubToken();
      const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(GITHUB_RELEASES_URL(repo), { headers });

      if (!response.ok) throw new Error(`GitHub API: ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data)) return [];

      const releases = data.map(mapRelease);
      this.cache = releases;
      return releases;
    } catch {
      return [];
    }
  }
}

export const githubReleasesService = new GitHubReleasesService();
