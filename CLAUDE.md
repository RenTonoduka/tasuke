# タス助 (Tasuke)

## タス助 CLI
タスク管理は `tasuke` CLIを使用。
環境変数 TASUKE_API_TOKEN を設定済み。

利用可能なコマンド一覧:
```
npx tsx src/cli/tasuke.ts --help
```

例:
```
npx tsx src/cli/tasuke.ts dashboard
npx tsx src/cli/tasuke.ts task:list --projectId xxx
npx tsx src/cli/tasuke.ts task:create --title "タスク名" --projectId xxx
```
