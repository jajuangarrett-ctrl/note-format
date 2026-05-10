import { requestUrl } from "obsidian";

export interface VoiceRecorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export async function startRecording(): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickSupportedMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });
  recorder.start();

  const stopTracks = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener("stop", () => {
          stopTracks();
          const type = recorder.mimeType || mimeType || "audio/webm";
          resolve(new Blob(chunks, { type }));
        });
        recorder.addEventListener("error", (e) => {
          stopTracks();
          reject(e instanceof Error ? e : new Error("Recorder error"));
        });
        try {
          recorder.stop();
        } catch (e) {
          stopTracks();
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      }),
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
      stopTracks();
    },
  };
}

function pickSupportedMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

export async function transcribeWhisper(audio: Blob, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API key not set in plugin settings");

  const filename = filenameForBlob(audio);
  const audioBuf = new Uint8Array(await audio.arrayBuffer());
  const boundary = `----note-format-${Math.random().toString(16).slice(2)}`;
  const body = buildMultipart(boundary, [
    {
      name: "file",
      filename,
      contentType: audio.type || "audio/webm",
      data: audioBuf,
    },
    { name: "model", data: "whisper-1" },
    { name: "response_format", data: "json" },
  ]);

  const res = await requestUrl({
    url: "https://api.openai.com/v1/audio/transcriptions",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
    throw: false,
  });

  if (res.status >= 400) {
    throw new Error(`Whisper ${res.status}: ${truncate(res.text, 300)}`);
  }
  const json = res.json as { text?: string };
  return (json.text || "").trim();
}

export interface FormatContext {
  acronyms: string;
}

export async function formatTranscript(
  text: string,
  apiKey: string,
  ctx: FormatContext
): Promise<string> {
  if (!apiKey) return text;
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const system = buildFormatSystemPrompt(ctx);

  const res = await requestUrl({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: trimmed },
      ],
    }),
    throw: false,
  });

  if (res.status >= 400) {
    throw new Error(`OpenAI format ${res.status}: ${truncate(res.text, 300)}`);
  }
  const json = res.json as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const out = json.choices?.[0]?.message?.content;
  return stripWrappingCodeFence((out || trimmed).trim());
}

function buildFormatSystemPrompt(ctx: FormatContext): string {
  const lines = [
    "You reformat raw transcripts into comprehensive, hierarchical Markdown notes for Dean Franklin Garrett.",
    "The user will paste, dictate, or share a transcript (lecture, meeting, conversation, dictation, PDF text).",
    "Your job is to organize the content into a scannable analytical note that captures the structure, comparisons, decisions, and takeaways.",
    "",
    "Output format (Markdown, in this exact order, no other text):",
    "",
    "1. OPENING TITLE — a single line: \"### Summary of [Topic]\". Always H3 (`### `), NEVER H1 or H2. The [Topic] is a 5-15 word description of the transcript subject.",
    "",
    "2. OVERVIEW PARAGRAPH — a blank line, then 1-3 sentences of prose introducing what the transcript covers. Use **bold** for key terms or names introduced. This is prose, not bullets.",
    "",
    "3. SEPARATOR — a blank line, then `---` on its own line, then a blank line.",
    "",
    "4. BODY SECTIONS — one or more sections, each in this pattern:",
    "   - Heading: `### [Descriptive Section Title]` (always H3, sentence case).",
    "   - Content (use whichever fits best for the material):",
    "     - Bulleted lists with `- ` (one idea per bullet, sub-bullets allowed for nested detail). Use `**Bold:**` at the start of a bullet to label a key concept being defined or a recommendation.",
    "     - Markdown pipe tables with a header row when comparing two or more things across multiple attributes (e.g., feature comparisons), or when listing terms with definitions.",
    "     - Brief prose paragraphs only when bullets and tables would feel forced.",
    "   - End each section with `---` on its own line (blank lines before and after).",
    "",
    "5. CLOSING SECTIONS — after the body sections, ALWAYS include the following in this exact order:",
    "",
    "   a. `### Summary Table of Key Terms` — INCLUDE ONLY IF the transcript introduces specialized terms, products, acronyms, or concepts worth defining. Use a Markdown pipe table with two columns: \"Term\" and \"Definition / Purpose\". Skip this section entirely if there are no terms worth defining. Follow with `---`.",
    "",
    "   b. `### Conclusion` — ALWAYS. 1-3 short prose paragraphs synthesizing the most important takeaways. Use **bold** to highlight the single most important conclusion. Do NOT bullet this section.  Follow with `---`.",
    "",
    "   c. `### Keywords` — ALWAYS. A single bullet line with 8-20 comma-separated keywords/topics from the transcript. Format: `- Keyword 1, Keyword 2, Keyword 3, ...`",
    "",
    "Rules:",
    "- Headings are ALWAYS H3 (`### `). Never use `#`, `##`, `####`, or higher.",
    "- Use sentence case for headings (capitalize the first word and proper nouns only).",
    "- Insert `---` horizontal rules between every section, including before and after each closing section (except after `### Keywords`, which ends the note).",
    "- Use **bold** liberally to highlight key terms, names, products, and concepts the first time they appear.",
    "- Use Markdown pipe tables freely when content is comparative or definitional — they read better than bullets for those shapes.",
    "- Preserve every fact, name, number, date, and decision from the transcript.",
    "- Do not invent content the transcript does not contain.",
    "- Do not include a preamble, explanation, or wrapping code fence — output only the Markdown note.",
    "- Preserve exact quotes when the speaker emphasized them; otherwise paraphrase tightly.",
    "- If the transcript is short or unstructured, still produce the opening title + overview paragraph + at least one body section + Conclusion + Keywords (skip the Summary Table of Key Terms if there are no terms).",
  ];
  const acronyms = ctx.acronyms.trim();
  if (acronyms) {
    lines.push("", `Preserve these acronyms verbatim: ${acronyms}`);
  }
  return lines.join("\n");
}

export function stripWrappingCodeFence(text: string): string {
  const t = text.trim();
  const fenceMatch = t.match(/^```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return t;
}

interface MultipartField {
  name: string;
  filename?: string;
  contentType?: string;
  data: Uint8Array | string;
}

function buildMultipart(boundary: string, fields: MultipartField[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const f of fields) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"`;
    if (f.filename) header += `; filename="${f.filename}"`;
    header += "\r\n";
    if (f.contentType) header += `Content-Type: ${f.contentType}\r\n`;
    header += "\r\n";
    parts.push(enc.encode(header));
    parts.push(typeof f.data === "string" ? enc.encode(f.data) : f.data);
    parts.push(enc.encode("\r\n"));
  }
  parts.push(enc.encode(`--${boundary}--\r\n`));

  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

function filenameForBlob(b: Blob): string {
  const t = (b.type || "").toLowerCase();
  if (t.includes("mp4")) return "audio.m4a";
  if (t.includes("mpeg")) return "audio.mp3";
  if (t.includes("wav")) return "audio.wav";
  return "audio.webm";
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}
