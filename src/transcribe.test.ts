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

    expect(prompt).toContain("Format and organize the provided text");
    expect(prompt).toContain("do not over-analyze or expand beyond what the text supports");
    expect(prompt).toContain("Preserve the meaningful details needed to understand and act on the discussion");
    expect(prompt).toContain("Be complete enough for follow-up, but do not preserve every turn of conversation");
    expect(prompt).toContain("Do not add analysis, implications, recommendations, or conclusions");
    expect(prompt).toContain("# Meeting Notes");
    expect(prompt).toContain("## [Topic Name]");
    expect(prompt).toContain("### Discussion");
    expect(prompt).toContain("### Decisions");
    expect(prompt).toContain("### Open Questions");
    expect(prompt).toContain("## Action Items");
    expect(prompt).toContain("| Owner | Action |");
    expect(prompt).toContain("If no decisions or open questions are stated for a topic");
    expect(prompt).toContain("Use sub-bullets sparingly");
    expect(prompt).toContain("more useful than a summary, less exhaustive than a transcript analysis");
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
