import { requestUrl } from "obsidian";
import {
  extractWebContentFromHtml,
  normalizeWebUrl,
  type WebFetchSource,
} from "./webParse";

export async function fetchTranscriptFromUrl(
  url: string,
  source: WebFetchSource = "transcript"
): Promise<string> {
  const normalizedUrl = normalizeWebUrl(url);
  const res = await requestUrl({
    url: normalizedUrl,
    method: "GET",
    throw: false,
  });

  if (res.status >= 400) {
    throw new Error(`Website fetch ${res.status}: ${truncate(res.text, 300)}`);
  }

  return extractWebContentFromHtml(res.text, source);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}
