/**
 * Evolution Bot integration — /evolutionBot/*
 */

import type { ToolDef, ToolGroup } from "../../types.js";
import { makeBotCrudTools, makeFetchSessionsTool } from "./botFactory.js";

const tools: ToolDef[] = [
  ...makeBotCrudTools({ group: "evolutionbot", base: "evolutionBot", label: "Evolution Bot" }),
  makeFetchSessionsTool("evolutionbot", "evolutionBot", "Evolution Bot"),
];

export const evolutionBotGroup: ToolGroup = {
  group: "evolutionbot",
  core: false,
  label: "Evolution Bot",
  tools,
};
