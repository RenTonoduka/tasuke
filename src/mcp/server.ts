import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerProjectTools } from './tools/projects.js';
import { registerSectionTools } from './tools/sections.js';

const server = new McpServer({
  name: 'tasuke',
  version: '1.0.0',
});

registerTaskTools(server);
registerProjectTools(server);
registerSectionTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => {
  process.exit(1);
});
