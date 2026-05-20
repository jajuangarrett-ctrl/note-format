export function normalizeWebUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Add a website URL first.");

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Website URL must start with http:// or https://.");
  }
  return parsed.toString();
}

export function extractTranscriptFromHtml(html: string): string {
  const transcriptSection = sliceTranscriptSection(html);
  const messages = extractMiraMessages(transcriptSection);
  if (messages) return messages;

  const text = htmlToText(transcriptSection || html);
  return extractTranscriptFromText(text);
}

function sliceTranscriptSection(html: string): string {
  const startMatch = /<div\s+class=["']section-label["']>\s*Transcript\s*<\/div>/i.exec(html);
  if (!startMatch || startMatch.index === undefined) return "";

  const tail = html.slice(startMatch.index + startMatch[0].length);
  const endMatch = /<div\s+class=["']footer["']>|<script\b/i.exec(tail);
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
