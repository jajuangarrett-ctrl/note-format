import { requestUrl } from "obsidian";
import { extractTranscriptFromHtml, normalizeWebUrl } from "./webParse";

export async function fetchTranscriptFromUrl(url: string): Promise<string> {
  const normalizedUrl = normalizeWebUrl(url);
  const res = await requestUrl({
    url: normalizedUrl,
    method: "GET",
    throw: false,
  });

  if (res.status >= 400) {
    throw new Error(`Website fetch ${res.status}: ${truncate(res.text, 300)}`);
  }

  return extractTranscriptFromHtml(res.text);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}
