/**
 * Secret-pattern scan (01-ARCHITECTURE §7 invariant 5): secrets never appear
 * in issue payloads, context packs, or proof-of-work comments. The Store runs
 * this over comments, questions, and proofs from agent actors and rejects the
 * command before anything is persisted — agents can describe a secret's
 * existence, never paste its value. Browser-safe (no imports).
 *
 * Patterns are deliberately conservative: high-signal token shapes rather
 * than entropy heuristics, so legitimate discussion is not blocked.
 */

export interface SecretFinding {
  /** Human-readable pattern name, e.g. `GitHub token`. */
  readonly pattern: string;
  /** Redacted preview of the match — never the full value. */
  readonly preview: string;
}

interface SecretPattern {
  readonly name: string;
  readonly regex: RegExp;
}

const SECRET_PATTERNS: ReadonlyArray<SecretPattern> = [
  { name: "AWS access key id", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "GitHub token", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/ },
  { name: "GitHub fine-grained token", regex: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  // Covers OpenAI (sk-, sk-proj-) and Anthropic (sk-ant-) style keys.
  { name: "API secret key (sk-…)", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "npm token", regex: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { name: "Private key block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "JWT", regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  {
    name: "Credential assignment",
    regex: /\b(?:api[_-]?key|secret|token|password|passwd)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  },
];

const redact = (match: string): string =>
  match.length <= 8 ? `${match.slice(0, 2)}…` : `${match.slice(0, 6)}…(${match.length} chars)`;

/** Scan one text for secret-shaped values. Empty result = clean. */
export const scanTextForSecrets = (text: string): ReadonlyArray<SecretFinding> => {
  const findings: SecretFinding[] = [];
  for (const { name, regex } of SECRET_PATTERNS) {
    const match = regex.exec(text);
    if (match !== null) {
      findings.push({ pattern: name, preview: redact(match[0]) });
    }
  }
  return findings;
};

/**
 * Scan any JSON-serializable payload (e.g. a proof-of-work object) by
 * scanning its serialized form — catches secrets in nested fields.
 */
export const scanPayloadForSecrets = (payload: unknown): ReadonlyArray<SecretFinding> =>
  scanTextForSecrets(typeof payload === "string" ? payload : (JSON.stringify(payload) ?? ""));

export const describeFindings = (findings: ReadonlyArray<SecretFinding>): string =>
  findings.map((finding) => `${finding.pattern} (${finding.preview})`).join(", ");
