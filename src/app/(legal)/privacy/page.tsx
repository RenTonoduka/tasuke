export const metadata = {
  title: 'プライバシーポリシー - タス助',
};

export default function PrivacyPage() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-g-text">
      <div>
        <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
        <p className="mt-1 text-xs text-g-text-muted">最終更新日: 2026年2月21日</p>
      </div>

      <p>
        タス助（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
        本ポリシーでは、本サービスが収集・利用する情報について説明します。
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. 収集する情報</h2>

        <div>
          <h3 className="font-medium">1.1 Googleアカウント情報</h3>
          <p className="mt-1 text-g-text-secondary">Googleログイン時に以下の情報を取得します。</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-g-text-secondary">
            <li>氏名</li>
            <li>メールアドレス</li>
            <li>プロフィール画像</li>
          </ul>
        </div>

        <div>
          <h3 className="font-medium">1.2 Google APIを通じて取得する情報</h3>
          <p className="mt-1 text-g-text-secondary">本サービスは、ユーザーの同意のもとで以下のGoogle APIにアクセスします。</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-g-border text-left">
                  <th className="pb-2 pr-4 font-medium">アクセス先</th>
                  <th className="pb-2 font-medium">使用目的</th>
                </tr>
              </thead>
              <tbody className="text-g-text-secondary">
                <tr className="border-b border-g-border">
                  <td className="py-2 pr-4">Googleカレンダー</td>
                  <td className="py-2">予定の取得（空き時間検出）、タスクの時間ブロックをカレンダーに登録</td>
                </tr>
                <tr className="border-b border-g-border">
                  <td className="py-2 pr-4">Google Tasks</td>
                  <td className="py-2">タス助のタスクをGoogle Tasksと同期</td>
                </tr>
                <tr className="border-b border-g-border">
                  <td className="py-2 pr-4">Google Drive（読み取り専用）</td>
                  <td className="py-2">タスクへのファイル添付時にDriveからファイルを選択</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Google Sheets</td>
                  <td className="py-2">タスクデータのスプレッドシートへのエクスポート</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-medium">1.3 サービス利用データ</h3>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-g-text-secondary">
            <li>作成したタスク、プロジェクト、コメント等のコンテンツ</li>
            <li>タスクの操作履歴（アクティビティログ）</li>
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. 情報の利用目的</h2>
        <p className="text-g-text-secondary">収集した情報は以下の目的にのみ使用します。</p>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>ユーザー認証とアカウント管理</li>
          <li>タスク管理機能の提供（スケジュール提案、カレンダー同期等）</li>
          <li>サービスの改善と不具合の修正</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. Google APIサービスユーザーデータポリシー</h2>
        <p className="text-g-text-secondary">
          本サービスにおけるGoogleユーザーデータの利用および他のアプリへの転送は、
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4285F4] underline"
          >
            Google APIサービスユーザーデータポリシー
          </a>
          （Limited Use要件を含む）に準拠します。
        </p>
        <p className="text-g-text-secondary">具体的には：</p>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>Google APIから取得したデータは、本ポリシーに記載した目的以外に使用しません</li>
          <li>第三者への販売・広告利用・データブローカーへの提供は行いません</li>
          <li>ユーザーが明示的に同意した場合、または法的義務がある場合を除き、第三者にデータを転送しません</li>
          <li>人間がユーザーデータを閲覧するのは、セキュリティ調査・法的義務・ユーザーの明示的な同意がある場合に限ります</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. データの保管</h2>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>データはセキュリティ対策を施したクラウドデータベースに保管します</li>
          <li>OAuthトークンは暗号化された状態で保管し、APIアクセスにのみ使用します</li>
          <li>Google APIから取得したデータのうち、必要最小限の情報のみをデータベースに保存します（カレンダーイベントのIDなど連携に必要な識別子のみ）</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. データの共有</h2>
        <p className="text-g-text-secondary">
          本サービスは、ユーザーのデータを第三者に販売、貸与、または共有しません。
          ただし、以下の場合を除きます。
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>同一ワークスペースのメンバー間でのタスク情報の共有（サービスの性質上必要な範囲）</li>
          <li>法令に基づく開示要求があった場合</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. データの削除</h2>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>ユーザーはいつでもアカウントの削除を要求できます</li>
          <li>アカウント削除時、ユーザーに関連する全てのデータ（タスク、プロジェクト、OAuthトークン等）を削除します</li>
          <li>
            Googleアカウントの権限は、
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#4285F4] underline">
              Googleアカウント設定
            </a>
            からいつでも取り消すことができます
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. セキュリティ</h2>
        <p className="text-g-text-secondary">
          本サービスは、ユーザーデータを保護するために合理的な技術的・組織的措置を講じます。
          ただし、インターネット上のデータ送信において、完全なセキュリティを保証することはできません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">8. ポリシーの変更</h2>
        <p className="text-g-text-secondary">
          本ポリシーを変更する場合は、本ページにて更新内容を掲載します。
          重大な変更がある場合は、サービス内で通知します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">9. お問い合わせ</h2>
        <p className="text-g-text-secondary">
          本ポリシーに関するお問い合わせは、以下までご連絡ください。
        </p>
        <p className="text-g-text-secondary">
          メール: <a href="mailto:ren10duka@gmail.com" className="text-[#4285F4] underline">ren10duka@gmail.com</a>
        </p>
      </section>
    </div>
  );
}
