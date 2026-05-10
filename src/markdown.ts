import type { TranscriptItem } from "./types";

const FRONTMATTER_TYPE = "note-format";

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatTimestampForFilename(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}-${mm}-${dd}-${hh}${mi}${ss}`;
}

export function formatTimestampForFrontmatter(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

export function buildFilename(capturedAt: Date): string {
  return `note-${formatTimestampForFilename(capturedAt)}.md`;
}

export function buildFileContent(item: TranscriptItem, capturedAt: Date): string {
  const captured = formatTimestampForFrontmatter(capturedAt);
  const body = item.text.trim();
  return `---\ntype: ${FRONTMATTER_TYPE}\ncaptured: ${captured}\n---\n\n${body}\n`;
}
