import { describe, it, expect } from "vitest";
import {
  buildFilename,
  buildFileContent,
  formatTimestampForFilename,
  formatTimestampForFrontmatter,
  pad2,
} from "./markdown";
import type { TranscriptItem } from "./types";

const MAY_4_AFTERNOON = new Date(2026, 4, 4, 14, 30, 5);
const JAN_1_MIDNIGHT = new Date(2026, 0, 1, 0, 0, 0);
const DEC_31_LATE = new Date(2099, 11, 31, 23, 59, 59);

describe("pad2", () => {
  it("zero-pads single digits", () => {
    expect(pad2(0)).toBe("00");
    expect(pad2(7)).toBe("07");
    expect(pad2(10)).toBe("10");
    expect(pad2(59)).toBe("59");
  });
});

describe("formatTimestampForFilename", () => {
  it("formats as YYYY-MM-DD-HHmmss in local time", () => {
    expect(formatTimestampForFilename(MAY_4_AFTERNOON)).toBe("2026-05-04-143005");
    expect(formatTimestampForFilename(JAN_1_MIDNIGHT)).toBe("2026-01-01-000000");
    expect(formatTimestampForFilename(DEC_31_LATE)).toBe("2099-12-31-235959");
  });
});

describe("formatTimestampForFrontmatter", () => {
  it("formats as YYYY-MM-DDTHH:mm:ss in local time", () => {
    expect(formatTimestampForFrontmatter(MAY_4_AFTERNOON)).toBe("2026-05-04T14:30:05");
    expect(formatTimestampForFrontmatter(JAN_1_MIDNIGHT)).toBe("2026-01-01T00:00:00");
  });
});

describe("buildFilename", () => {
  it("builds a note-{timestamp}.md filename", () => {
    expect(buildFilename(MAY_4_AFTERNOON)).toBe("note-2026-05-04-143005.md");
  });
});

describe("buildFileContent", () => {
  it("wraps the body in canonical frontmatter", () => {
    const item: TranscriptItem = { text: "# Title\n\n## Section\n- bullet" };
    expect(buildFileContent(item, MAY_4_AFTERNOON)).toBe(
      "---\ntype: note-format\ncaptured: 2026-05-04T14:30:05\n---\n\n# Title\n\n## Section\n- bullet\n"
    );
  });

  it("trims whitespace from the body", () => {
    const item: TranscriptItem = { text: "  hello world  \n\n" };
    expect(buildFileContent(item, MAY_4_AFTERNOON)).toBe(
      "---\ntype: note-format\ncaptured: 2026-05-04T14:30:05\n---\n\nhello world\n"
    );
  });

  it("preserves internal newlines in the body", () => {
    const item: TranscriptItem = { text: "Line one.\n\nLine two with details." };
    const out = buildFileContent(item, MAY_4_AFTERNOON);
    expect(out).toContain("\n---\n\nLine one.\n\nLine two with details.\n");
  });
});
