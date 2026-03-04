import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDefaultUser, getDefaultWorkspace } from '../context.js';
import {
  handleGitHubStatus,
  handleGitHubRepos,
  handleGitHubIssues,
  handleGitHubMappingList,
  handleGitHubMappingSet,
  handleGitHubSync,
  handleGitHubImport,
} from '../tool-handlers.js';

async function getCtx() {
  return { userId: await getDefaultUser(), workspaceId: await getDefaultWorkspace() };
}

export function registerGitHubTools(server: McpServer) {
  server.tool(
    'github_status',
    'GitHub連携の状態を確認します',
    {},
    async () => handleGitHubStatus({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'github_repos',
    'GitHubリポジトリ一覧を取得します',
    {},
    async () => handleGitHubRepos({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'github_issues',
    'GitHubリポジトリのIssue一覧を取得します',
    {
      owner: z.string().describe('リポジトリオーナー'),
      repo: z.string().describe('リポジトリ名'),
    },
    async (params) => handleGitHubIssues(params, await getCtx()),
  );

  server.tool(
    'github_mapping_list',
    'GitHubリポジトリとプロジェクトのマッピング一覧',
    {},
    async () => handleGitHubMappingList({} as Record<string, never>, await getCtx()),
  );

  server.tool(
    'github_mapping_set',
    'GitHubリポジトリとプロジェクトのマッピングを設定します',
    {
      githubRepoFullName: z.string().describe('リポジトリのフルネーム（owner/repo）'),
      projectId: z.string().describe('プロジェクトID'),
    },
    async (params) => handleGitHubMappingSet(params, await getCtx()),
  );

  server.tool(
    'github_sync',
    'GitHubリポジトリの全Issueを一括同期します',
    {
      githubRepoFullName: z.string().describe('リポジトリのフルネーム（owner/repo）'),
      projectId: z.string().describe('同期先プロジェクトID'),
    },
    async (params) => handleGitHubSync(params, await getCtx()),
  );

  server.tool(
    'github_import',
    '選択したGitHub Issueをタスクとしてインポートします',
    {
      issues: z.array(z.object({
        githubIssueId: z.number().describe('Issue番号'),
        githubIssueNodeId: z.string().describe('IssueのノードID'),
        githubRepoFullName: z.string().describe('リポジトリのフルネーム'),
        title: z.string().describe('タイトル'),
        body: z.string().optional().nullable().describe('本文'),
        checklistItems: z.array(z.object({
          text: z.string(),
          checked: z.boolean(),
        })).optional().describe('チェックリスト項目'),
      })).min(1).max(50).describe('インポートするIssue配列'),
      projectId: z.string().describe('インポート先プロジェクトID'),
      sectionId: z.string().optional().nullable().describe('セクションID'),
      importSubtasks: z.boolean().optional().describe('チェックリストをサブタスクとしてインポート（デフォルトtrue）'),
    },
    async (params) => handleGitHubImport(params, await getCtx()),
  );
}
