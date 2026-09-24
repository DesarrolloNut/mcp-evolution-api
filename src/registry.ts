/**
 * Resolves which tool groups are active based on EVOLUTION_TOOLS, and flattens
 * the enabled groups into a name->tool map.
 */

import type { EvolutionConfig } from "./config.js";
import type { ToolDef, ToolGroup } from "./types.js";
import { allGroups } from "./tools/index.js";

export interface Registry {
  tools: ToolDef[];
  byName: Map<string, ToolDef>;
  enabledGroups: string[];
}

/**
 * Parse the allowlist:
 *  - unset/empty  -> all core groups
 *  - "all"        -> every group
 *  - "a,b,c"      -> exactly those groups (validated against known group keys)
 */
export function resolveEnabledGroups(allowlist: string | undefined): Set<string> {
  const known = new Set(allGroups.map((g) => g.group));

  if (!allowlist) {
    return new Set(allGroups.filter((g) => g.core).map((g) => g.group));
  }

  const requested = allowlist
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (requested.includes("all")) {
    return new Set(allGroups.map((g) => g.group));
  }

  const enabled = new Set<string>();
  const unknown: string[] = [];
  for (const key of requested) {
    if (known.has(key)) enabled.add(key);
    else unknown.push(key);
  }
  if (unknown.length > 0) {
    // Warn but do not crash — log to stderr so stdio transport stays clean.
    console.error(
      `[mcp-whatsapp] Unknown tool group(s) in EVOLUTION_TOOLS: ${unknown.join(", ")}. ` +
        `Known groups: ${[...known].join(", ")}`,
    );
  }
  return enabled;
}

export function buildRegistry(config: EvolutionConfig): Registry {
  const enabled = resolveEnabledGroups(config.toolsAllowlist);
  const groups: ToolGroup[] = allGroups.filter((g) => enabled.has(g.group));

  const tools: ToolDef[] = [];
  const byName = new Map<string, ToolDef>();
  for (const group of groups) {
    for (const tool of group.tools) {
      if (byName.has(tool.name)) {
        throw new Error(`Duplicate tool name detected: ${tool.name}`);
      }
      byName.set(tool.name, tool);
      tools.push(tool);
    }
  }

  return { tools, byName, enabledGroups: groups.map((g) => g.group) };
}
