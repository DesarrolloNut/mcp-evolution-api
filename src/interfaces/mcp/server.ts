import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ZodError } from 'zod';
import { ChannelResolver } from '../../application/services/channelResolver.js';
import { buildUnifiedRegistry } from './registry.js';
import { wrapUntrustedContent } from '../../application/security/promptInjection.js';

export function createUnifiedMcpServer(resolver: ChannelResolver): Server {
  const registry = buildUnifiedRegistry();
  const server = new Server(
    { name: 'mcp-whatsapp', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = registry.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: toInputSchema(t.inputSchema),
    }));
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const tool = registry.byName.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const args = tool.inputSchema.parse(rawArgs ?? {});
      const data = await tool.handler(resolver, args);
      return {
        content: [{ type: 'text' as const, text: wrapUntrustedContent(data, name) }],
      };
    } catch (err) {
      let message: string;
      if (err instanceof ZodError) {
        message = `Invalid arguments: ${err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`;
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = String(err);
      }

      return {
        content: [{ type: 'text' as const, text: message }],
        isError: true,
      };
    }
  });

  return server;
}

export function toInputSchema(schema: Parameters<typeof zodToJsonSchema>[0]): Tool['inputSchema'] {
  const json = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  if (json.type !== 'object') {
    return { type: 'object', properties: {} };
  }
  return json as Tool['inputSchema'];
}
