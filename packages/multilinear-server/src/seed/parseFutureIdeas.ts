/**
 * Parser for `multilinear-plan/06-FUTURE-IDEAS.md` (02-PHASE-1 §E): turns the
 * parking-lot bullets into seedable issue drafts. Pure string → data.
 */

export type FutureIdeaSection = "near" | "later" | "team-edition";

export interface ParsedIdea {
  readonly title: string;
  readonly body: string;
  readonly section: FutureIdeaSection;
}

const SECTION_HEADINGS: ReadonlyArray<{ prefix: string; section: FutureIdeaSection | null }> = [
  { prefix: "## Near", section: "near" },
  { prefix: "## Later", section: "later" },
  { prefix: "## Team edition", section: "team-edition" },
  { prefix: "## ", section: null },
];

const BULLET_START = /^- \*\*(.+?)\*\*\s*(.*)$/;

const cleanTitle = (raw: string): string => raw.trim().replace(/[.:]$/, "");

/** Dedent bullet continuation lines and join into one markdown body. */
const joinBody = (firstLine: string, continuation: ReadonlyArray<string>): string =>
  [firstLine, ...continuation.map((line) => line.replace(/^ {2}/, ""))].join("\n").trim();

export const parseFutureIdeas = (markdown: string): ReadonlyArray<ParsedIdea> => {
  const lines = markdown.split("\n");
  const ideas: ParsedIdea[] = [];
  let section: FutureIdeaSection | null = null;
  let currentTitle: string | null = null;
  let currentFirstLine = "";
  let currentContinuation: string[] = [];
  let teamEditionLines: string[] = [];

  const flushBullet = () => {
    if (section !== null && section !== "team-edition" && currentTitle !== null) {
      ideas.push({
        title: cleanTitle(currentTitle),
        body: joinBody(currentFirstLine, currentContinuation),
        section,
      });
    }
    currentTitle = null;
    currentFirstLine = "";
    currentContinuation = [];
  };

  const flushTeamEdition = () => {
    const body = teamEditionLines.join("\n").trim();
    if (body !== "") {
      ideas.push({ title: "Team edition (far future)", body, section: "team-edition" });
    }
    teamEditionLines = [];
  };

  for (const line of lines) {
    const heading = SECTION_HEADINGS.find((candidate) => line.startsWith(candidate.prefix));
    if (heading !== undefined) {
      flushBullet();
      if (section === "team-edition") flushTeamEdition();
      section = heading.section;
      continue;
    }
    if (section === null) continue;

    if (section === "team-edition") {
      teamEditionLines.push(line);
      continue;
    }

    const bullet = BULLET_START.exec(line);
    if (bullet !== null) {
      flushBullet();
      currentTitle = bullet[1] ?? "";
      currentFirstLine = (bullet[2] ?? "").trim();
      continue;
    }
    if (currentTitle !== null) {
      currentContinuation.push(line);
    }
  }
  flushBullet();
  if (section === "team-edition") flushTeamEdition();

  return ideas;
};
