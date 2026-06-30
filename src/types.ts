/**
 * Shared types for tool definitions and groups.
 */

import type { z } from "zod";
import type { EvolutionClient } from "./client.js";

/** A single MCP tool backed by an Evolution API endpoint. */
export interface ToolDef {
  /** Unique tool name, e.g. "evolution_message_send_text". */
  name: string;
  /** One-line description shown to the model. */
  description: string;
  /** Zod object schema describing the tool arguments. */
  inputSchema: z.ZodObject<z.ZodRawShape>;
  /** Executes the call. Returns raw JSON-serializable data. */
  handler: (client: EvolutionClient, args: Record<string, unknown>) => Promise<unknown>;
}

/** A named group of tools that can be enabled/disabled via EVOLUTION_TOOLS. */
export interface ToolGroup {
  /** Stable group key used in the allowlist, e.g. "message". */
  group: string;
  /** Whether the group is exposed by default (core) or opt-in. */
  core: boolean;
  /** Human label for docs/listing. */
  label: string;
  tools: ToolDef[];
}
