import { requestUrl } from "obsidian";
import { buildFormatSystemPrompt } from "./formatPrompt";

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
  model: string;
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
      model: ctx.model || "gpt-4o-mini",
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
