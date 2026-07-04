/**
 * Ready gate v0 (03-PHASE-2 §E). `ready` is a contract: specified well enough
 * for an agent to pick up (00-VISION). The gate is a soft lint on the issue
 * description — moving to `ready` with an empty acceptance-criteria section
 * warns; humans may override, agent actors may not (enforced in Store command
 * validation). Browser-safe (no imports) so the web UI runs the same lint.
 */

/** Description template offered when specifying an issue for `ready`. */
export const ISSUE_TEMPLATE = `## Acceptance criteria

-

## Affected area

-

## Out of scope

-
`;

export interface ReadyGateResult {
  readonly ok: boolean;
  /** Human-readable problems; empty when ok. */
  readonly problems: ReadonlyArray<string>;
}

/**
 * Extract the body of a markdown section by heading title (case-insensitive,
 * any heading level). Returns undefined when the heading is absent.
 */
const sectionBody = (markdown: string, title: string): string | undefined => {
  const lines = markdown.split("\n");
  const headingPattern = new RegExp(`^#{1,6}\\s+${title}\\s*$`, "i");
  const anyHeading = /^#{1,6}\s+\S/;
  let start = -1;
  for (const [index, line] of lines.entries()) {
    if (headingPattern.test(line.trim())) {
      start = index + 1;
      break;
    }
  }
  if (start === -1) return undefined;
  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    if (anyHeading.test(lines[index]?.trim() ?? "")) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
};

/** True when a section body contains actual content (not just empty bullets). */
const hasContent = (body: string): boolean =>
  body.split("\n").some((line) => /[^\s\-*>]/.test(line.replace(/^\s*(?:[-*+]|\d+\.)\s*/, "")));

/**
 * Lint a description against the Ready contract: it must have a non-empty
 * `Acceptance criteria` section. (Affected area / out of scope are part of
 * the template but not enforced — acceptance criteria is the load-bearing
 * section, 00-VISION "Spec-quality in, quality out".)
 */
export const readyGateLint = (description: string): ReadyGateResult => {
  const problems: string[] = [];
  const criteria = sectionBody(description, "Acceptance criteria");
  if (criteria === undefined) {
    problems.push('the description has no "Acceptance criteria" section');
  } else if (!hasContent(criteria)) {
    problems.push('the "Acceptance criteria" section is empty');
  }
  return { ok: problems.length === 0, problems };
};
