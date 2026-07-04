/**
 * Standing developer-instructions block steering t3code agent sessions
 * toward the multilinear board (MLT-56). Injected into every provider
 * session that supports developer instructions via a mount point in the
 * upstream instruction assembly (see MOUNTPOINTS.md) — the block itself
 * lives here so upstream carries only the interpolation.
 *
 * The tool list is generated from the toolkit, so adding a tool updates the
 * instructions automatically. Field-verified motivation: harnesses that
 * load MCP tools lazily (tool_search) concluded `ml_*` tools did not exist
 * because they were absent from the inline tool list.
 */
import { MultilinearToolkit } from "./Toolkit.ts";

const toolNames = Object.keys(MultilinearToolkit.tools).sort().join(", ");

export const MULTILINEAR_DEVELOPER_INSTRUCTIONS = `

## Multilinear task tracker

The multilinear board is the task tracker for this workspace. Its tools live on the \`t3-code\` MCP server: ${toolNames}. If they are not in your visible tool list, your harness loads MCP tools lazily — discover them (for example via \`tool_search\`) before concluding they are unavailable.

Work you discover while doing something else is filed with \`ml_create_issue\` and \`discovered_from\` provenance, never silently dropped. When you are blocked on a decision only the human can make, call \`ml_request_input\` instead of guessing — it flags the issue Agent Blocked on the board.
`;
