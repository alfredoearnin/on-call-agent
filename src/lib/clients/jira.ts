import { getConfig, type AppConfig } from "@/lib/config";
import { httpRequest } from "./http";

interface JiraSearchResponse {
  total?: number;
  issues?: { fields?: { summary?: string } }[];
}

export interface VulnCounts {
  total: number;
  critical: number;
  high: number;
}

export class JiraClient {
  private cfg: AppConfig;
  constructor(cfg: AppConfig = getConfig()) {
    this.cfg = cfg;
  }

  private headers(): Record<string, string> {
    const token = Buffer.from(
      `${this.cfg.jira.email}:${this.cfg.jira.apiToken}`,
    ).toString("base64");
    return { Authorization: `Basic ${token}` };
  }

  /**
   * Count open vulnerability tickets by severity via the configured filter.
   * Severity is encoded in the summary prefix (e.g. "[VM,SCA] Critical ...").
   */
  async vulnerabilityCounts(): Promise<VulnCounts> {
    const jql = `filter=${this.cfg.jira.vulnFilterId} AND statusCategory != Done`;
    let startAt = 0;
    let total = 0;
    let critical = 0;
    let high = 0;

    for (let page = 0; page < 20; page++) {
      const res = await httpRequest<JiraSearchResponse>(
        `${this.cfg.jira.baseUrl}/rest/api/3/search`,
        {
          headers: this.headers(),
          query: {
            jql,
            startAt,
            maxResults: 100,
            fields: "summary",
          },
        },
      );
      const issues = res.issues ?? [];
      total = res.total ?? total;
      for (const issue of issues) {
        const s = (issue.fields?.summary ?? "").toLowerCase();
        if (s.includes("critical")) critical++;
        else if (s.includes("high")) high++;
      }
      startAt += issues.length;
      if (issues.length === 0 || startAt >= total) break;
    }

    return { total, critical, high };
  }
}
