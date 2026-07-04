import { assert, describe, it } from "@effect/vitest";

import { parseFutureIdeas } from "./parseFutureIdeas.ts";

const SAMPLE = `# 06 — Future ideas (parking lot)

Prose preamble that is not a bullet.

## Near (post-Phase-4 candidates, roughly by joy-per-effort)

- **Review-from-phone queue.** t3code remote mode already lets a Mac mini run
  everything; add a swipe-through review surface.
- **Duplicate radar.** Embeddings over the issue corpus; new cards get a
  "possibly same as {id}" hint.

## Later

- **Chief-of-staff agent.** Reads board + calendar, proposes the day's plan.

## Team edition (far future — insurance already paid)

Already in the schema by design: actor on every event.

1. **Stage 1 — shared house:** one machine runs the backend.

## Watchlist and tripwires (verify dates in STATUS.md)

- Upstream: #2829 merge; not an idea bullet.
`;

describe("parseFutureIdeas", () => {
  it("extracts titled bullets with dedented continuations per section", () => {
    const ideas = parseFutureIdeas(SAMPLE);
    assert.deepStrictEqual(
      ideas.map((idea) => [idea.section, idea.title]),
      [
        ["near", "Review-from-phone queue"],
        ["near", "Duplicate radar"],
        ["later", "Chief-of-staff agent"],
        ["team-edition", "Team edition (far future)"],
      ],
    );
    assert.strictEqual(
      ideas[0]?.body,
      "t3code remote mode already lets a Mac mini run\neverything; add a swipe-through review surface.",
    );
    assert.include(ideas[3]?.body, "Stage 1 — shared house");
  });

  it("ignores watchlist and non-idea sections", () => {
    const ideas = parseFutureIdeas(SAMPLE);
    assert.isFalse(ideas.some((idea) => idea.body.includes("#2829")));
  });

  it("parses the real 06-FUTURE-IDEAS.md into a sane number of ideas", async () => {
    const NodeFS = await import("node:fs/promises");
    const real = await NodeFS.readFile(
      new URL("../../../../multilinear-plan/06-FUTURE-IDEAS.md", import.meta.url),
      "utf8",
    );
    const ideas = parseFutureIdeas(real);
    // 22 near + 8 later + 1 team-edition as of 2026-07-04; tolerate appends.
    assert.isAtLeast(ideas.length, 25);
    assert.isTrue(ideas.every((idea) => idea.title.length > 3 && idea.body.length > 10));
    assert.isTrue(ideas.some((idea) => idea.title === "Duplicate radar"));
  });
});
