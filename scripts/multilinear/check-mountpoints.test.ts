import { assert, describe, it } from "@effect/vitest";

import { parseMountpoints, verifyMountpoint } from "./check-mountpoints.ts";

const table = (rows: string[]): string =>
  [
    "# MOUNTPOINTS.md",
    "",
    "Prose that mentions `inline code` and — dashes.",
    "",
    "| File | Lines | Purpose | Date |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");

describe("parseMountpoints", () => {
  it("returns no entries for an empty table", () => {
    assert.deepStrictEqual(parseMountpoints(table([])), []);
  });

  it("parses data rows and strips backticks from the file cell", () => {
    const entries = parseMountpoints(
      table([
        "| `AGENTS.md` | `## Some heading` | registers a thing | 2026-07-04 |",
        "| CLAUDE.md | — | symlink | 2026-07-04 |",
      ]),
    );
    assert.deepStrictEqual(entries, [
      {
        file: "AGENTS.md",
        ref: "`## Some heading`",
        purpose: "registers a thing",
        date: "2026-07-04",
      },
      { file: "CLAUDE.md", ref: "—", purpose: "symlink", date: "2026-07-04" },
    ]);
  });
});

describe("verifyMountpoint", () => {
  const entry = (ref: string) => ({
    file: "a.ts",
    ref,
    purpose: "test",
    date: "2026-07-04",
  });

  it("fails when the file is gone (null content)", () => {
    assert.strictEqual(verifyMountpoint(entry("—"), null), "file not found: a.ts");
  });

  it("passes an existence-only entry when the file exists", () => {
    assert.isNull(verifyMountpoint(entry("—"), "hello\n"));
    assert.isNull(verifyMountpoint(entry("-"), "hello\n"));
    assert.isNull(verifyMountpoint(entry(""), "hello\n"));
  });

  it("checks line ranges against the file length", () => {
    const content = "one\ntwo\nthree\n";
    assert.isNull(verifyMountpoint(entry("2-4"), content));
    assert.isNull(verifyMountpoint(entry("3"), content));
    assert.include(verifyMountpoint(entry("5"), content) ?? "", "expects line 5");
  });

  it("checks backtick-quoted anchors as substrings", () => {
    const content = "// multilinear:routes\nexport {};\n";
    assert.isNull(verifyMountpoint(entry("`// multilinear:routes`"), content));
    assert.include(
      verifyMountpoint(entry("`// renamed-anchor`"), content) ?? "",
      "anchor not found",
    );
  });

  it("rejects unrecognized reference formats", () => {
    assert.include(
      verifyMountpoint(entry("somewhere near the top"), "x\n") ?? "",
      "unrecognized reference format",
    );
  });
});
