# タス助 - 競合分析・技術リサーチレポート

## 1. 競合ツール分析サマリー

### 総合比較

| 項目 | Asana | Trello | Notion | ClickUp | Linear | Monday.com | Todoist | Jira |
|------|-------|--------|--------|---------|--------|------------|---------|------|
| 主な用途 | チームPM | カンバン | オールインワン | 多機能PM | 開発チーム | ワークフロー | 個人タスク | Agile開発 |
| 無料プラン | 10名 | 10名/10ボード | 充実 | 非常に充実 | 250 Issue | 2人/3ボード | 5PJ | 10人 |
| 有料最安/月 | $10.99 | $5 | $10 | $7 | $8 | $9 | $4 | $7.53 |
| Google Cal連携 | 同期あり | Power-Up | 間接 | 片方向 | 公式連携 | 双方向 | 双方向 | Marketplace |
| UI速度 | 普通 | 普通 | 普通 | やや重い | 最速 | 普通 | 軽量 | 重い |
| 学習コスト | 低〜中 | 最低 | 中〜高 | 高 | 低 | 低〜中 | 最低 | 最高 |

### 各ツールの強み（参考にすべきポイント）

#### Asana
- 5つのビュー（リスト/ボード/タイムライン/ガント/カレンダー）の切り替え
- 70以上の自動化ルール
- インボックス（通知センター）の設計が秀逸
- タスクの右パネル展開（コンテキスト維持）

#### Trello
- 学習曲線ゼロの直感的UI
- ドラッグ&ドロップの視覚フィードバック（影+傾き+マグネティック）
- Butler自動化（ルール/カードボタン/ボードボタン/期限コマンド）
- シンプルさが最大の武器

#### Linear
- 爆速のUI（パフォーマンス最優先設計）
- キーボードファースト操作
- ミニマルで洗練されたデザイン
- コマンドパレット（Cmd+K）

#### Notion
- ブロックベースエディタの柔軟性
- データベース+複数ビュー

#### Monday.com
- Google Calendar双方向同期
- 色分けされたステータス表示

#### Todoist
- 自然言語入力
- Google Calendar双方向連携が最も成熟

### 各ツールの弱み（差別化チャンス）

| 弱み | 該当ツール | タス助での改善案 |
|------|-----------|----------------|
| 担当者1人制限 | Asana | 複数担当者対応 |
| 大規模時のパフォーマンス | ClickUp, Jira, Monday | Linearのような高速UI |
| 学習コストが高い | ClickUp, Jira, Notion | Trelloのようなシンプルさ |
| Google連携が弱い/片方向 | ClickUp, Notion, Jira | 双方向同期を標準搭載 |
| 通知過多 | Asana | 通知設定の柔軟さ |
| 無料プランの制限 | Trello, Monday, Todoist | 寛大な無料枠 |
| モバイルアプリの質 | ClickUp, Notion | レスポンシブ設計で対応 |
| チーム内チャット不在 | Trello | コメント+メンション充実 |

---

## 2. タス助のポジショニング

### コンセプト
**「Trelloのシンプルさ × Linearの高速UI × Googleエコシステム統合」**

- Trelloのように学習コストゼロで始められる
- Linearのようにサクサク動く
- Google Calendar/Tasksとネイティブ双方向同期
- チームでもソロでも使える
- ホワイトベース・GoogleライクなクリーンUI

### ターゲットユーザー
- 小〜中規模チーム（2〜30人）
- Google Workspaceを日常的に使っているチーム
- Jira/ClickUpは複雑すぎると感じるチーム
- AsanaやTrelloの無料プラン制限に不満のあるユーザー

---

## 3. 機能要件（優先度順）

### Phase 1: MVP（コア機能）
- [ ] ユーザー認証（NextAuth.js + Google OAuth）
- [ ] ワークスペース/チーム管理
- [ ] プロジェクト CRUD
- [ ] タスク管理（作成/編集/削除/完了）
  - タイトル、説明、期限、優先度、担当者（複数可）、ラベル
  - サブタスク
- [ ] カンバンボードビュー（ドラッグ&ドロップ）
- [ ] リストビュー
- [ ] サイドバーナビゲーション
- [ ] タスク詳細パネル（右パネル展開）
- [ ] インライン編集
- [ ] レスポンシブデザイン（モバイル対応）

### Phase 2: チーム機能
- [ ] メンバー招待/ロール管理（管理者/メンバー/閲覧者）
- [ ] コメント + @メンション
- [ ] 通知システム（インボックス）
- [ ] アクティビティログ
- [ ] キーボードショートカット
- [ ] コマンドパレット（Cmd+K）

### Phase 3: Google連携
- [ ] Google Calendar 双方向同期
- [ ] Google Tasks 双方向同期
- [ ] カレンダービュー
- [ ] OAuth スコープの段階的要求

### Phase 4: 高度な機能
- [ ] タイムラインビュー
- [ ] タスク依存関係
- [ ] ダッシュボード（進捗可視化）
- [ ] 自動化ルール
- [ ] テンプレート
- [ ] ダークモード

---

## 4. 技術スタック（確定）

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フレームワーク | Next.js 14 (App Router) | ユーザー指定 + 経験あり |
| 言語 | TypeScript | 型安全性 |
| スタイリング | Tailwind CSS | ユーザー指定 |
| DB | Neon PostgreSQL | ユーザー指定 |
| ORM | Prisma | 経験あり（land-finder） |
| デプロイ | Vercel | ユーザー指定 |
| 認証 | NextAuth.js (Google Provider) | Google OAuth必須 |
| 状態管理 | Zustand | 軽量(~3KB)、ボイラープレート最小 |
| D&D | @dnd-kit | モジュラー、タッチ対応、~10KB |
| コマンドパレット | cmdk | ヘッドレス、Vercel製、ファジー検索 |
| ショートカット | react-hotkeys-hook | 軽量、スコープ対応 |
| ダークモード | next-themes | 2行で実装 |
| UIコンポーネント | shadcn/ui | Tailwind互換、コピペ型 |

---

## 5. データモデル（初期設計）

```
User
├── id, name, email, image, googleAccessToken, googleRefreshToken
├── workspaceMembers[] → WorkspaceMember
└── taskAssignments[] → TaskAssignment

Workspace
├── id, name, slug, createdAt
├── members[] → WorkspaceMember
└── projects[] → Project

WorkspaceMember
├── id, role (OWNER/ADMIN/MEMBER/VIEWER)
├── userId → User
└── workspaceId → Workspace

Project
├── id, name, description, color, position
├── workspaceId → Workspace
├── sections[] → Section
└── views[] → ProjectView

Section (カンバンのカラム)
├── id, name, position, color
├── projectId → Project
└── tasks[] → Task

Task
├── id, title, description, priority (P0-P3)
├── status (TODO/IN_PROGRESS/DONE/ARCHIVED)
├── dueDate, startDate, completedAt
├── position (セクション内の並び順)
├── sectionId → Section
├── parentTaskId → Task (サブタスク)
├── assignees[] → TaskAssignment
├── labels[] → TaskLabel
├── comments[] → Comment
├── googleCalendarEventId (同期用)
├── googleTaskId (同期用)
└── createdById → User

TaskAssignment (複数担当者対応)
├── taskId → Task
└── userId → User

Label
├── id, name, color
└── workspaceId → Workspace

TaskLabel
├── taskId → Task
└── labelId → Label

Comment
├── id, content, createdAt
├── taskId → Task
└── userId → User

Notification
├── id, type, message, read, createdAt
├── userId → User
└── taskId → Task (optional)
```

---

## 6. UI設計方針

### デザインテイスト
- **ホワイトベース**: 背景 #FFFFFF、カード #F8F9FA
- **Googleライク**: Material Design的なクリーンさ
- **シンプル**: 余計な装飾なし、コンテンツファースト
- **色使い**: アクセントカラーは最小限（Google Blue #4285F4 系）

### ナビゲーション構造
```
[サイドバー] 240px, 折りたたみ可
├── ワークスペース切替
├── 検索 / Cmd+K
├── マイタスク
├── 通知（インボックス）
├── ── プロジェクト一覧 ──
│   ├── プロジェクトA
│   │   ├── ボードビュー
│   │   ├── リストビュー
│   │   └── カレンダービュー
│   └── プロジェクトB
└── 設定

[メインコンテンツ]
├── ヘッダー（プロジェクト名 + ビュー切替タブ + フィルター）
├── コンテンツエリア（ボード/リスト/カレンダー）
└── [右パネル] タスク詳細（クリックで展開）
```

### 操作性
- ドラッグ&ドロップ（カンバン）
- インラインタスク追加（＋ボタン or Enter）
- タスククリック → 右パネル展開（画面遷移なし）
- Cmd+K でコマンドパレット
- キーボードショートカット（n: 新規タスク, /: 検索 等）

---

## 7. Google連携アーキテクチャ

### 同期パターン: DRL（Declarative Reconciliation Loop）

```
Observe → Project → Diff → Actuate
```

1. **Observe**: syncTokenで増分データ取得
2. **Project**: アプリタスク ↔ Googleイベント/タスクのマッピング
3. **Diff**: 追加/更新/削除の差分検出
4. **Actuate**: 差分のみAPI反映

### マッピング

| タス助 | Google Calendar | Google Tasks |
|--------|----------------|-------------|
| title | summary | title |
| description | description | notes |
| startDate | start.dateTime | - |
| dueDate | end.dateTime | due |
| completed | - | status:"completed" |

### 注意点
- 無限ループ防止（自己更新の通知を無視）
- コンフリクト解決（タイムスタンプベース楽観的ロック）
- APIレート制限対応（バッチ処理+キャッシュ）
- 冪等性の確保
