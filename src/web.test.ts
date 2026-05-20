import { describe, expect, it } from "vitest";
import { extractTranscriptFromHtml, normalizeWebUrl } from "./webParse";

describe("normalizeWebUrl", () => {
  it("accepts http and https URLs", () => {
    expect(normalizeWebUrl(" https://example.com/path ")).toBe("https://example.com/path");
    expect(normalizeWebUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("rejects non-web URLs", () => {
    expect(() => normalizeWebUrl("obsidian://note-format")).toThrow(/http/);
  });
});

describe("extractTranscriptFromHtml", () => {
  it("extracts only Mira transcript messages and ignores the summary", () => {
    const html = `
      <div class="section-label">Summary</div>
      <div class="summary"><h2>Quick recap</h2><ul><li>Do not include this.</li></ul></div>
      <div class="section-label">Transcript</div>
      <div class="transcript">
        <div class="message">
          <div class="timestamp">[11:17:06 AM]</div>
          <div class="msg-body"><span class="speaker other">Speaker 1:</span> Oh, okay.</div>
        </div>
        <div class="message">
          <div class="timestamp">[11:17:43 AM]</div>
          <div class="msg-body"><span class="speaker other">Speaker 2:</span> I can&#x27;t do that &amp; need help.</div>
        </div>
      </div>
      <div class="footer">Mira</div>
    `;

    expect(extractTranscriptFromHtml(html)).toBe(
      "[11:17:06 AM]\nSpeaker 1: Oh, okay.\n\n[11:17:43 AM]\nSpeaker 2: I can't do that & need help."
    );
  });

  it("falls back to text after a Transcript marker", () => {
    const html = `
      <h2>Summary</h2>
      <p>Do not include this.</p>
      <h2>Transcript</h2>
      <p>[9:00 AM]</p>
      <p>Speaker 1: Keep this.</p>
    `;

    expect(extractTranscriptFromHtml(html)).toBe("[9:00 AM]\nSpeaker 1: Keep this.");
  });
});
