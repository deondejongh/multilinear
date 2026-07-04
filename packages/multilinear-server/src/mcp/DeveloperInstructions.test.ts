import { assert, describe, it } from "@effect/vitest";

import { MULTILINEAR_DEVELOPER_INSTRUCTIONS } from "./DeveloperInstructions.ts";
import { MultilinearToolkit } from "./Toolkit.ts";

describe("developer instructions (MLT-56)", () => {
  it("mention every toolkit tool and the lazy-loading discovery hint", () => {
    for (const name of Object.keys(MultilinearToolkit.tools)) {
      assert.include(MULTILINEAR_DEVELOPER_INSTRUCTIONS, name);
    }
    assert.include(MULTILINEAR_DEVELOPER_INSTRUCTIONS, "tool_search");
    assert.include(MULTILINEAR_DEVELOPER_INSTRUCTIONS, "t3-code");
  });
});
