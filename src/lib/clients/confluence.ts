import { getConfig, type AppConfig } from "@/lib/config";
import { httpRequest } from "./http";
import { titleMatchesMonitor } from "@/lib/analysis/cause-report";

/**
 * Reading Confluence pages the cause-investigation agent writes.
 *
 * The first thing in this dashboard that talks to Confluence directly. Until
 * now pages reached the repo the long way — an agent fetched one, committed a
 * markdown copy, and `npm run ingest` parsed it — which is fine for a weekly
 * handoff and useless for a finding you asked for a minute ago and want to read
 * now.
 *
 * READ ONLY. The agent owns these pages; this client never creates or edits
 * one. Uses the same Atlassian credentials as Jira, which is why
 * `hasConfluence` is defined as `hasJira`.
 */

interface ConfluenceSearchResponse {
  results?: {
    id?: string;
    title?: string;
    _links?: { webui?: string };
    version?: { createdAt?: string };
  }[];
}

interface ConfluencePageResponse {
  id?: string;
  title?: string;
  body?: {
    storage?: { value?: string };
    view?: { value?: string };
    atlas_doc_format?: { value?: string };
  };
  version?: { createdAt?: string };
  _links?: { webui?: string };
}

export interface ConfluencePage {
  id: string;
  title: string;
  /** Page body as text. Representation varies; callers scan rather than parse. */
  body: string;
  /** Absolute URL a person can open. */
  url: string;
  updatedAtIso?: string;
}

export class ConfluenceClient {
  private cfg: AppConfig;
  constructor(cfg: AppConfig = getConfig()) {
    this.cfg = cfg;
  }

  private headers(): Record<string, string> {
    // Confluence Cloud shares Jira's Atlassian credentials.
    const token = Buffer.from(
      `${this.cfg.jira.email}:${this.cfg.jira.apiToken}`,
    ).toString("base64");
    return { Authorization: `Basic ${token}` };
  }

  private absoluteUrl(webui: string | undefined): string {
    if (!webui) return this.cfg.jira.baseUrl;
    return webui.startsWith("http")
      ? webui
      : `${this.cfg.jira.baseUrl}/wiki${webui}`;
  }

  /**
   * The newest cause-investigation page for one monitor, or undefined.
   *
   * Found by title rather than by a stored page id, so the dashboard needs no
   * write-back channel and the agent needs no way to tell it anything: the
   * monitor id in the title is the whole contract. CQL matches on the id as
   * text, then `titleMatchesMonitor` re-checks it as a whole token, because CQL
   * `~` is a substring match and monitor ids nest — `1435` would otherwise
   * claim `143509449`.
   */
  async findMonitorCausePage(
    monitorId: string,
  ): Promise<ConfluencePage | undefined> {
    const cql = `space="${this.cfg.confluence.spaceKey}" and title ~ "${monitorId}" order by lastmodified desc`;

    const found = await httpRequest<ConfluenceSearchResponse>(
      `${this.cfg.jira.baseUrl}/wiki/rest/api/content/search`,
      {
        headers: this.headers(),
        query: { cql, limit: 10, expand: "version" },
      },
    );

    const match = (found.results ?? []).find((r) =>
      titleMatchesMonitor(r.title ?? "", monitorId),
    );
    if (!match?.id) return undefined;

    // `storage` is the authored source, which keeps fenced code blocks intact;
    // `view` is rendered HTML and would bury the JSON block in macro markup.
    const page = await httpRequest<ConfluencePageResponse>(
      `${this.cfg.jira.baseUrl}/wiki/rest/api/content/${encodeURIComponent(match.id)}`,
      { headers: this.headers(), query: { expand: "body.storage,version" } },
    );

    return {
      id: match.id,
      title: page.title ?? match.title ?? monitorId,
      body: page.body?.storage?.value ?? page.body?.view?.value ?? "",
      url: this.absoluteUrl(page._links?.webui ?? match._links?.webui),
      updatedAtIso: page.version?.createdAt ?? match.version?.createdAt,
    };
  }
}
