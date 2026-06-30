/**
 * Dify integration — /dify/*
 */

import type { ToolDef, ToolGroup } from "../../types.js";
import { makeBotCrudTools, makeFetchSessionsTool } from "./botFactory.js";

const tools: ToolDef[] = [
  ...makeBotCrudTools({ group: "dify", base: "dify", label: "Dify" }),
  makeFetchSessionsTool("dify", "dify", "Dify"),
];

export const difyGroup: ToolGroup = {
  group: "dify",
  core: false,
  label: "Dify",
  tools,
};
