import Anthropic from '@anthropic-ai/sdk';
import type { ToolContext } from '@/mcp/tool-handlers';
import { executeCLICommand } from './cli-executor';
import { buildSystemPrompt } from './ai-prompt';
import { loadConversationHistory, saveConversationTurn } from './conversation-store';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

const TOOL_DEFINITION: Anthropic.Tool = {
  name: 'execute_cli',
  description: 'タス助CLIコマンドを実行します。コマンド文字列を指定してください。',
  input_schema: {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'CLIコマンド文字列。例: task:create --title "会議" --projectId abc',
      },
    },
    required: ['command'],
  },
};

const MAX_TOOL_CALLS = 5;

export async function handleAIMessage(
  userMessage: string,
  lineUserId: string,
  ctx: ToolContext,
): Promise<string> {
  const history = await loadConversationHistory(lineUserId);

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  let toolCallCount = 0;

  while (toolCallCount < MAX_TOOL_CALLS) {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: [TOOL_DEFINITION],
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      const reply = textBlock?.text ?? '処理が完了しました。';

      await saveConversationTurn(lineUserId, userMessage, reply);
      return reply;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (!toolUseBlock) break;

      toolCallCount++;
      const { command } = toolUseBlock.input as { command: string };
      const execResult = await executeCLICommand(command, ctx);

      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: execResult.result,
          is_error: !execResult.success,
        }],
      });

      continue;
    }

    // unexpected stop_reason
    break;
  }

  return '処理に時間がかかりすぎました。もう少し具体的に指示してください。';
}
