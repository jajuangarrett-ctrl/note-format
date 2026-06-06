import { describe, expect, it } from "vitest";
import { buildFormatSystemPrompt } from "./formatPrompt";

describe("buildFormatSystemPrompt", () => {
  it("requires operational meeting notes and action item tables", () => {
    const prompt = buildFormatSystemPrompt({
      acronyms: "CalWORKs, VPSS",
    });

    expect(prompt).toContain("IMPORTANT: Do NOT create a summary of the meeting.");
    expect(prompt).toContain("Retain approximately 80-90% of the informational content");
    expect(prompt).toContain("# Meeting Notes");
    expect(prompt).toContain("## [Topic Name]");
    expect(prompt).toContain("### Discussion");
    expect(prompt).toContain("### Decisions");
    expect(prompt).toContain("### Open Questions");
    expect(prompt).toContain("## Action Items");
    expect(prompt).toContain("| Owner | Action |");
    expect(prompt).toContain("Could a manager who never attended this meeting understand");
    expect(prompt).toContain("Preserve these acronyms verbatim: CalWORKs, VPSS");
  });
});
