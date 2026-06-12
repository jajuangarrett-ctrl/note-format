import { describe, expect, it } from "vitest";
import {
  buildFormatSystemPrompt,
  buildSummaryNotesSystemPrompt,
} from "./formatPrompt";

describe("buildFormatSystemPrompt", () => {
  it("requires operational meeting notes and action item tables", () => {
    const prompt = buildFormatSystemPrompt({
      acronyms: "CalWORKs, VPSS",
    });

    expect(prompt).toContain("IMPORTANT: Do NOT create a summary of the meeting.");
    expect(prompt).toContain("detailed manual-style notes");
    expect(prompt).toContain("Retain nearly all substantive informational content");
    expect(prompt).toContain("Target 90-95% of meaningful details");
    expect(prompt).toContain("The formatted note may be long");
    expect(prompt).toContain("# Meeting Notes");
    expect(prompt).toContain("## [Topic Name]");
    expect(prompt).toContain("### Discussion");
    expect(prompt).toContain("### Decisions");
    expect(prompt).toContain("### Open Questions");
    expect(prompt).toContain("## Action Items");
    expect(prompt).toContain("| Owner | Action |");
    expect(prompt).toContain("Do not merge distinct points into one generic bullet");
    expect(prompt).toContain("Use sub-bullets to preserve supporting detail");
    expect(prompt).toContain("Could a manager who never attended this meeting understand");
    expect(prompt).toContain("Preserve these acronyms verbatim: CalWORKs, VPSS");
  });
});

describe("buildSummaryNotesSystemPrompt", () => {
  it("preserves already-summarized notes without transcript expansion", () => {
    const prompt = buildSummaryNotesSystemPrompt({
      acronyms: "CalWORKs, VPSS",
    });

    expect(prompt).toContain("already-summarized meeting notes");
    expect(prompt).toContain("Do NOT treat it like a raw transcript");
    expect(prompt).toContain("Keep the output close to the fetched summary text");
    expect(prompt).toContain("Do not add content from the transcript");
    expect(prompt).toContain("Preserve these acronyms verbatim: CalWORKs, VPSS");
  });
});
