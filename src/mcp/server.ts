import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerProjectTools } from './tools/projects.js';
import { registerSectionTools } from './tools/sections.js';
import { registerSubtaskTools } from './tools/subtasks.js';
import { registerLabelTools } from './tools/labels.js';
import { registerCommentTools } from './tools/comments.js';
import { registerDashboardTools } from './tools/dashboard.js';
import { registerNotificationTools } from './tools/notifications.js';
import { registerCalendarTools } from './tools/calendar.js';
import { registerWorkspaceTools } from './tools/workspaces.js';
import { registerMemberTools } from './tools/members.js';
import { registerAttachmentTools } from './tools/attachments.js';
import { registerAutomationTools } from './tools/automations.js';
import { registerTemplateTools } from './tools/templates.js';
import { registerGitHubTools } from './tools/github.js';
import { registerGoogleTasksTools } from './tools/google-tasks.js';
import { registerSettingsTools } from './tools/settings.js';
import { registerMeetingTools } from './tools/meetings.js';

const server = new McpServer({
  name: 'tasuke',
  version: '1.0.0',
});

registerTaskTools(server);
registerProjectTools(server);
registerSectionTools(server);
registerSubtaskTools(server);
registerLabelTools(server);
registerCommentTools(server);
registerDashboardTools(server);
registerNotificationTools(server);
registerCalendarTools(server);
registerWorkspaceTools(server);
registerMemberTools(server);
registerAttachmentTools(server);
registerAutomationTools(server);
registerTemplateTools(server);
registerGitHubTools(server);
registerGoogleTasksTools(server);
registerSettingsTools(server);
registerMeetingTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => {
  process.exit(1);
});
