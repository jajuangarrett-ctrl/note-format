export function normalizeWebUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Add a website URL first.");

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Website URL must start with http:// or https://.");
  }
  return parsed.toString();
}

export type WebFetchSource = "transcript" | "summary";

export function extractWebContentFromHtml(html: string, source: WebFetchSource): string {
  return source === "summary"
    ? extractSummaryFromHtml(html)
    : extractTranscriptFromHtml(html);
}

export function extractTranscriptFromHtml(html: string): string {
  const transcriptSection = sliceTranscriptSection(html);
  const messages = extractMiraMessages(transcriptSection);
  if (messages) return messages;

  const text = htmlToText(transcriptSection || html);
  return extractTranscriptFromText(text);
}

export function extractSummaryFromHtml(html: string): string {
  const summarySection = sliceLabeledSection(html, "Summary");
  const text = htmlToText(summarySection || html);
  return extractSummaryFromText(text);
}

function sliceTranscriptSection(html: string): string {
  return sliceLabeledSection(html, "Transcript");
}

function sliceLabeledSection(html: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startMatch = new RegExp(
    `<div\\s+class=["']section-label["']>\\s*${escapedLabel}\\s*<\\/div>`,
    "i"
  ).exec(html);
  if (!startMatch || startMatch.index === undefined) return "";

  const tail = html.slice(startMatch.index + startMatch[0].length);
  const endMatch = /<div\s+class=["']section-label["']>|<div\s+class=["']footer["']>|<script\b/i.exec(tail);
  return endMatch && endMatch.index !== undefined ? tail.slice(0, endMatch.index) : tail;
}

function extractMiraMessages(html: string): string {
  const messages: string[] = [];
  const messagePattern =
    /<div\s+class=["']message["']>\s*<div\s+class=["']timestamp["']>([\s\S]*?)<\/div>\s*<div\s+class=["']msg-body["']>([\s\S]*?)<\/div>\s*<\/div>/gi;

  let match: RegExpExecArray | null;
  while ((match = messagePattern.exec(html)) !== null) {
    const timestamp = htmlToText(match[1]).trim();
    const body = htmlToText(match[2]).trim();
    if (!timestamp && !body) continue;
    messages.push(timestamp ? `${timestamp}\n${body}` : body);
  }

  return messages.join("\n\n").trim();
}

function extractTranscriptFromText(text: string): string {
  const match = /(?:^|\n)\s*Transcript\s*(?:\n|$)/i.exec(text);
  const transcript = !match || match.index === undefined
    ? text
    : text.slice(match.index + match[0].length);
  return transcript.replace(/\n{2,}/g, "\n").trim();
}

function extractSummaryFromText(text: string): string {
  const summaryMatch = /(?:^|\n)\s*Summary\s*(?:\n|$)/i.exec(text);
  const transcriptMatch = /(?:^|\n)\s*Transcript\s*(?:\n|$)/i.exec(text);

  if (summaryMatch?.index !== undefined) {
    const start = summaryMatch.index + summaryMatch[0].length;
    const end = transcriptMatch?.index !== undefined && transcriptMatch.index > start
      ? transcriptMatch.index
      : text.length;
    return text.slice(start, end).replace(/\n{3,}/g, "\n\n").trim();
  }

  if (transcriptMatch?.index !== undefined) {
    return text.slice(0, transcriptMatch.index).replace(/\n{3,}/g, "\n\n").trim();
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
  ).trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
