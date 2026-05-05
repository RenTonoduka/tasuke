---
name: meeting-after
description: 会議終了後の議事録→タスク抽出→承認フローを自動化するスキル。「会議終わった」「議事録から抽出」「meeting done」「会議のタスク化」「議事録レビュー」と言われたらこのスキルを起動。Drive上の最新議事録を検出 or URLから取得 → mcp__task-core__meeting_extract_from_drive で抽出 → 内容を提示 → ユーザー承認後 meeting_approve でタスク化、まで一気通貫。
version: 1.0.0
---

# Meeting After (会議終了→タスク化自動化)

会議が終わったら **「会議終わりました」** と言うだけで、議事録取得 → タスク抽出 → 承認 → Tasukeに本番タスク登録 まで自動実行する。

## When To Use

ユーザーが以下のように発話した時に **必ず起動**:
- 「会議終わりました / 終わった」
- 「議事録から抽出して」
- 「議事録のタスク化」
- 「meeting done」
- 「会議のタスクを取り込んで」
- 「議事録レビュー」

## Hard Requirements

- `mcp__task-core__*` ツール群（meeting_list/get/extract_from_drive/approve）が利用可能
- 未接続なら以下を案内して中断:
  ```
  claude mcp add task-core --transport http https://tasuke.app/api/mcp \
    --header "Authorization: Bearer tsk_xxx" --scope user
  ```

## 実行フロー

### Step 1: 議事録の特定（順に試行）

**A. Drive Watch経由で自動取込済みかチェック:**
```
mcp__task-core__meeting_list status='PENDING_REVIEW' limit=10
```
- 直近1時間以内に `source: 'DRIVE_WATCH'` で `extractedTasks: 0` なものがあれば → Step 4 (再抽出) へ
- 直近1時間以内に `source: 'DRIVE_WATCH'` でPENDING_REVIEWなものがあれば → Step 3 (確認) へ

**B. ユーザーにURLまたはfileIdを聞く（自動取込なしの場合）:**
ユーザー発話に Drive URL 含まれてれば抽出。  
含まれてなければ:
```
「議事録のGoogle DocのURLを教えてください（例: https://docs.google.com/document/d/xxx）。
 もしくは『手動で取得』と言えばDriveから検索します」
```

URLが来たら `https://docs.google.com/document/d/(\w+)` の `\w+` 部分を fileId として抽出。

### Step 2: 議事録取込

```
mcp__task-core__meeting_extract_from_drive fileId='<取得したID>'
```

レスポンス例:
```
{ "meetingId": "cm...", "extractedCount": 17, "url": "meetings/cm..." }
```

`extractedCount === 0` なら Step 4 (再抽出ロジック) へ。

### Step 3: 抽出結果を確認・提示

```
mcp__task-core__meeting_get meetingId='<前ステップのID>'
```

ユーザーに提示するフォーマット:
```
✅ 「<議事録タイトル>」から **<件数>件** 抽出しました

| # | 担当 | タスク | 期日 | 信頼度 |
|---|---|---|---|---|
| 1 | 高須賀 | XXXをXXXする | 5/9 | 95% |
| 2 | (未指定) | YYY... | - | 80% |
...

承認しますか？
- 「全部承認」/「OK」 → 一括承認
- 「個別」 → 1件ずつ確認
- 「<番号> をスキップ」 → 一部却下
- 「期日を変更したい」 → 編集してから承認
```

**注意**: status APPROVED や PENDING のものを混在させて表示しない。

### Step 4: 再抽出（既存Meetingで0件 or 失敗時）

```
mcp__task-core__meeting_re_extract meetingId='<該当ID>'
```
→ 新ID返却 → Step 3 へ

### Step 5: 編集（ユーザー要望時のみ）

ユーザーが「3番の期日を5/15に」のように指示した場合:
```
mcp__task-core__extracted_task_update extractedTaskId='<id>' finalDueDate='2026-05-15'
```
オプション: finalTitle, finalAssigneeId, finalProjectId, finalSectionId, finalDueDate, finalPriority

### Step 6: 承認実行

ユーザーが「OK」「全部承認」と言ったら:
```
mcp__task-core__meeting_approve meetingId='<id>' items=[
  { extractedTaskId: '<id1>', action: 'approve' },
  { extractedTaskId: '<id2>', action: 'approve' },
  ...
]
```

承認漏れ防止のため、PENDINGなExtractedTaskは全件 approve に含める（rejectedにしたいものは個別指定）。

### Step 7: 完了報告

```
✅ 完了
- N件のタスクをTask Coreに登録しました
- 「期限切れタスク」「進行中タスク」も合わせて確認するなら /deadline-triage を起動

🔗 https://tasuke.app/<workspaceSlug>/meetings/<id>
```

workspaceSlug が不明な場合は `mcp__task-core__workspace_list` で取得。

## エッジケース

| 状況 | 対応 |
|---|---|
| 抽出0件 | meeting_re_extract で再試行。それでも0件なら原因（短すぎ・形式不明）を報告 |
| 抽出件数 > 30件 | 多すぎる可能性。「全件表示しますか？それとも要約のみ？」と確認 |
| 信頼度 < 60% のタスクが多数 | 「自動承認は危険。個別レビュー推奨」と警告 |
| 担当未指定が多い | `mcp__task-core__member_list` でメンバー名を取得し、ユーザーに割当案を提示 |
| 既に同じdriveFileIdが取込済み | meeting_extract_from_drive がそれを返すので Step 3 へ進む |
| Drive権限エラー | 「Tasukeでgoogle再ログインしてください」と案内 |

## ❌ 絶対にやらないこと

- ユーザー承認なしの自動 approve
- 抽出結果が空でも「成功です」と虚偽報告
- 同じ議事録の重複抽出（meeting_extract_from_drive は冪等なのでOK、手動 meeting_extract は注意）
- DELETE系を勝手に実行

## 関連スキル

- `/deadline-triage` — 承認後のタスク全体を俯瞰して優先度・期限再配分（会議で大量タスク追加した直後に走らせると効果大）

## 配布

このリポジトリ内利用: 何もしない（Claude Code起動時に自動有効）

外部メンバー用:
1. このSKILL.mdをコピー → `~/.claude/skills/meeting-after/SKILL.md`
2. `claude mcp add task-core --transport http https://tasuke.app/api/mcp --header "Authorization: Bearer tsk_xxx" --scope user`
3. Claude Code再起動

CLAUDE.md に以下1行を入れると更に確実:
```
会議が終わったら meeting-after スキルを起動してタスク化する。
```

## 例: 期待される会話

```
ユーザー: 会議終わった

Claude: 直近1時間のレビュー待ち議事録を確認します...
       [mcp__task-core__meeting_list status=PENDING_REVIEW]
       → 「WJ: 週次定例 - 5/5」が見つかりました（17件抽出済み）

       | # | 担当 | タスク | 期日 | 信頼度 |
       |---|---|---|---|---|
       | 1 | Ren | Issue連携機能を実装 | - | 95% |
       | 2 | Tatsuya | PropSync UI作成 | - | 93% |
       ...

       承認しますか？

ユーザー: OK、5番だけ高須賀さんに変更して

Claude: 5番の担当を変更します...
       [extracted_task_update extractedTaskId=... finalAssigneeId=...]
       一括承認を実行...
       [meeting_approve ...]
       
       ✅ 17件のタスクをTask Coreに登録しました
       https://tasuke.app/ws-xxx/meetings/cm...
```
