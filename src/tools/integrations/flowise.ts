/**
 * Flowise integration — /flowise/*
 */

import type { ToolDef, ToolGroup } from "../../types.js";
import { makeBotCrudTools, makeFetchSessionsTool } from "./botFactory.js";

const tools: ToolDef[] = [
  ...makeBotCrudTools({ group: "flowise", base: "flowise", label: "Flowise" }),
  makeFetchSessionsTool("flowise", "flowise", "Flowise"),
];

export const flowiseGroup: ToolGroup = {
  group: "flowise",
  core: false,
  label: "Flowise",
  tools,
};
