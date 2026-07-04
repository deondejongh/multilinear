import { assert, describe, it } from "@effect/vitest";

import { ISSUE_TEMPLATE, readyGateLint } from "./ReadyGate.ts";

describe("readyGateLint", () => {
  it("rejects a description without an acceptance-criteria section", () => {
    const result = readyGateLint("Fix the thing.\n\n## Notes\n\n- whatever");
    assert.isFalse(result.ok);
    assert.include(result.problems[0] ?? "", 'no "Acceptance criteria" section');
  });

  it("rejects the empty template (bullets without content)", () => {
    const result = readyGateLint(ISSUE_TEMPLATE);
    assert.isFalse(result.ok);
    assert.include(result.problems[0] ?? "", "empty");
  });

  it("accepts a filled acceptance-criteria section, any heading level", () => {
    for (const heading of ["## Acceptance criteria", "### acceptance CRITERIA"]) {
      const result = readyGateLint(`${heading}\n\n- the gate passes\n\n## Out of scope\n\n-`);
      assert.isTrue(result.ok, `heading: ${heading}`);
      assert.deepStrictEqual(result.problems, []);
    }
  });

  it("accepts prose criteria, not just bullets", () => {
    const result = readyGateLint("## Acceptance criteria\nDone when the tests pass.");
    assert.isTrue(result.ok);
  });

  it("ignores content that belongs to the next section", () => {
    const result = readyGateLint("## Acceptance criteria\n\n## Out of scope\n\n- lots here");
    assert.isFalse(result.ok);
  });
});
