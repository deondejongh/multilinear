import { assert, describe, it } from "@effect/vitest";

import { describeFindings, scanPayloadForSecrets, scanTextForSecrets } from "./SecretScan.ts";

describe("scanTextForSecrets", () => {
  const positives: ReadonlyArray<readonly [string, string]> = [
    ["AWS access key id", "creds are AKIAIOSFODNN7EXAMPLE ok"],
    ["GitHub token", "auth with ghp_0123456789abcdefghijklmnopqrstuv123456"],
    ["GitHub fine-grained token", "use github_pat_11ABCDEFG0123456789abcdef"],
    ["Slack token", "hook xoxb-123456789012-abcdefghijklm"],
    ["API secret key (sk-…)", "OPENAI key sk-proj-abc123def456ghi789jkl012"],
    ["API secret key (sk-…)", "sk-ant-api03-averyveryverylongsecretvalue"],
    ["Google API key", "maps AIzaSyA1234567890abcdefghijklmnopqrstuv"],
    ["npm token", "npm_abcdefghijklmnopqrstuvwxyz0123456789"],
    ["Private key block", "-----BEGIN RSA PRIVATE KEY-----\nMIIE..."],
    [
      "JWT",
      "bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9P",
    ],
    ["Credential assignment", 'set api_key = "supersecretvalue123"'],
  ];

  it.each(positives)("flags %s", (name, text) => {
    const findings = scanTextForSecrets(text);
    assert.isAbove(findings.length, 0, `expected a finding in: ${text}`);
    assert.include(
      findings.map((finding) => finding.pattern),
      name,
    );
  });

  it("never includes the full secret in a finding", () => {
    const token = "ghp_0123456789abcdefghijklmnopqrstuv123456";
    const findings = scanTextForSecrets(`push with ${token}`);
    const description = describeFindings(findings);
    assert.notInclude(description, token);
    assert.include(description, "GitHub token");
  });

  it("stays quiet on ordinary engineering text", () => {
    const clean = [
      "Rotate the GitHub token in CI settings; never commit it.",
      "The password field is validated client-side.",
      "Set MULTILINEAR_DB_PATH=/tmp/tracker.db for the jank check.",
      "skim through the results",
      "The token budget for this run is 50k.",
    ];
    for (const text of clean) {
      assert.deepStrictEqual(scanTextForSecrets(text), [], `false positive on: ${text}`);
    }
  });
});

describe("scanPayloadForSecrets", () => {
  it("scans nested payload fields via their JSON form", () => {
    const findings = scanPayloadForSecrets({
      summary: "clean",
      tests: [{ detail: "used AKIAIOSFODNN7EXAMPLE" }],
    });
    assert.strictEqual(findings[0]?.pattern, "AWS access key id");
  });
});
