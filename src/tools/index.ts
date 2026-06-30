/**
 * Aggregates every tool group. Order here is the order tools are listed.
 */

import type { ToolGroup } from "../types.js";

import { instanceGroup } from "./instance.js";
import { settingsGroup } from "./settings.js";
import { messageGroup } from "./message.js";
import { chatGroup } from "./chat.js";
import { profileGroup } from "./profile.js";
import { labelGroup } from "./label.js";
import { groupGroup } from "./group.js";

import { webhookGroup } from "./integrations/webhook.js";
import { websocketGroup } from "./integrations/websocket.js";
import { rabbitmqGroup } from "./integrations/rabbitmq.js";
import { sqsGroup } from "./integrations/sqs.js";
import { chatwootGroup } from "./integrations/chatwoot.js";
import { typebotGroup } from "./integrations/typebot.js";
import { openaiGroup } from "./integrations/openai.js";
import { difyGroup } from "./integrations/dify.js";
import { evolutionBotGroup } from "./integrations/evolutionBot.js";
import { flowiseGroup } from "./integrations/flowise.js";

export const allGroups: ToolGroup[] = [
  // Core (enabled by default)
  instanceGroup,
  settingsGroup,
  messageGroup,
  chatGroup,
  profileGroup,
  labelGroup,
  groupGroup,
  webhookGroup,
  // Opt-in
  websocketGroup,
  rabbitmqGroup,
  sqsGroup,
  chatwootGroup,
  typebotGroup,
  openaiGroup,
  difyGroup,
  evolutionBotGroup,
  flowiseGroup,
];
