import { describe, expect, it } from "vitest";
import { buildFormatSystemPrompt } from "./formatPrompt";

describe("buildFormatSystemPrompt", () => {
  it("requires detailed notes and checkbox next steps", () => {
    const prompt = buildFormatSystemPrompt({
      acronyms: "CalWORKs, VPSS",
    });

    expect(prompt).toContain("Do NOT produce a short summary");
    expect(prompt).toContain("Produce the most detailed useful notes possible");
    expect(prompt).toContain("### Next steps");
    expect(prompt).toContain("Use Markdown task checkboxes only");
    expect(prompt).toContain("- [ ] Action or question...");
    expect(prompt).toContain("Preserve these acronyms verbatim: CalWORKs, VPSS");
  });
});
