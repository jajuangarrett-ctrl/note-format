import { describe, expect, it } from "vitest";
import {
  extractSummaryFromHtml,
  extractTranscriptFromHtml,
  extractWebContentFromHtml,
  normalizeWebUrl,
} from "./webParse";

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

describe("extractSummaryFromHtml", () => {
  it("extracts only Mira summary notes and ignores transcript messages", () => {
    const html = `
      <div class="section-label">Summary</div>
      <div class="summary">
        <h2>Quick recap</h2>
        <ul>
          <li>Keep this summary item.</li>
          <li>Keep another summary item.</li>
        </ul>
      </div>
      <div class="section-label">Transcript</div>
      <div class="transcript">
        <div class="message">
          <div class="timestamp">[11:17:06 AM]</div>
          <div class="msg-body">Do not include this transcript line.</div>
        </div>
      </div>
      <div class="footer">Mira</div>
    `;

    expect(extractSummaryFromHtml(html)).toBe(
      "Quick recap\n\nKeep this summary item.\n\nKeep another summary item."
    );
  });

  it("falls back to text before a Transcript marker", () => {
    const html = `
      <h2>Summary</h2>
      <p>Keep this recap.</p>
      <h2>Transcript</h2>
      <p>[9:00 AM]</p>
      <p>Speaker 1: Do not keep this.</p>
    `;

    expect(extractSummaryFromHtml(html)).toBe("Keep this recap.");
  });

  it("uses top-of-page notes before Transcript when there is no Summary label", () => {
    const html = `
      <main>
        <h1>Meeting recap</h1>
        <p>Keep this top summary note.</p>
        <p>Keep this second summary note.</p>
        <h2>Transcript</h2>
        <p>[9:00 AM]</p>
        <p>Speaker 1: Do not keep this transcript line.</p>
      </main>
    `;

    expect(extractSummaryFromHtml(html)).toBe(
      "Meeting recap\n\nKeep this top summary note.\n\nKeep this second summary note."
    );
  });

  it("extracts a summary class block before Transcript without requiring a section label", () => {
    const html = `
      <div class="summary-content">
        <h2>Auto notes</h2>
        <p>Keep this summarized note.</p>
      </div>
      <div class="section-label">Transcript</div>
      <p>Speaker 1: Ignore this transcript.</p>
    `;

    expect(extractSummaryFromHtml(html)).toBe(
      "Auto notes\n\nKeep this summarized note."
    );
  });

  it("accepts Summarized Notes as the top section label", () => {
    const html = `
      <h2>Summarized Notes</h2>
      <p>Keep this summarized note.</p>
      <h2>Transcript</h2>
      <p>Speaker 1: Ignore this transcript.</p>
    `;

    expect(extractSummaryFromHtml(html)).toBe("Keep this summarized note.");
  });

  it("falls through empty summary-looking containers and keeps top notes", () => {
    const html = `
      <div class="summary-icon"></div>
      <main>
        <h1>Meeting recap</h1>
        <p>Keep this top note.</p>
        <h2>Transcript</h2>
        <p>Speaker 1: Ignore this transcript.</p>
      </main>
    `;

    expect(extractSummaryFromHtml(html)).toBe(
      "Meeting recap\n\nKeep this top note."
    );
  });
});

describe("extractWebContentFromHtml", () => {
  it("selects transcript or summary content", () => {
    const html = `
      <div class="section-label">Summary</div>
      <p>Summary only.</p>
      <div class="section-label">Transcript</div>
      <p>Transcript only.</p>
      <div class="footer">Mira</div>
    `;

    expect(extractWebContentFromHtml(html, "summary")).toBe("Summary only.");
    expect(extractWebContentFromHtml(html, "transcript")).toBe("Transcript only.");
  });
});
