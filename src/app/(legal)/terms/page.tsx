export const metadata = {
  title: '利用規約 - タス助',
};

export default function TermsPage() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-g-text">
      <div>
        <h1 className="text-2xl font-bold">利用規約</h1>
        <p className="mt-1 text-xs text-g-text-muted">最終更新日: 2026年2月21日</p>
      </div>

      <p>
        この利用規約（以下「本規約」）は、タス助（以下「本サービス」）の利用条件を定めるものです。
        本サービスをご利用いただくことにより、本規約に同意したものとみなします。
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. サービスの概要</h2>
        <p className="text-g-text-secondary">
          本サービスは、チーム向けのタスク管理ツールです。
          Googleアカウントと連携し、カレンダー同期やスケジュール提案などの機能を提供します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. アカウント</h2>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>本サービスの利用にはGoogleアカウントでのログインが必要です</li>
          <li>ユーザーは、自身のアカウントで行われるすべての活動に責任を負います</li>
          <li>アカウントの不正利用を発見した場合は、速やかにご連絡ください</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. 利用上のルール</h2>
        <p className="text-g-text-secondary">ユーザーは以下の行為を行ってはなりません。</p>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>法令または公序良俗に反する行為</li>
          <li>サービスの運営を妨害する行為</li>
          <li>他のユーザーの情報を不正に収集する行為</li>
          <li>サービスを逆コンパイル、リバースエンジニアリングする行為</li>
          <li>不正アクセスやセキュリティ機能の回避</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. 知的財産権</h2>
        <p className="text-g-text-secondary">
          本サービスのソフトウェア、デザイン、ロゴ等の知的財産権は運営者に帰属します。
          ユーザーが本サービスに入力・保存したコンテンツ（タスク、コメント等）の権利はユーザーに帰属します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. サービスの変更・停止</h2>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>運営者は、事前の通知なくサービスの内容を変更または停止することがあります</li>
          <li>サービスの変更・停止によりユーザーに生じた損害について、運営者は責任を負いません</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. 免責事項</h2>
        <ul className="list-inside list-disc space-y-0.5 text-g-text-secondary">
          <li>本サービスは「現状のまま」で提供され、特定の目的への適合性を保証しません</li>
          <li>Google APIとの連携により取得・表示される情報の正確性を保証しません</li>
          <li>スケジュール提案機能はあくまで参考であり、その結果について責任を負いません</li>
          <li>データの消失・破損について、運営者の故意または重大な過失がない限り責任を負いません</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. 規約の変更</h2>
        <p className="text-g-text-secondary">
          運営者は、必要に応じて本規約を変更できるものとします。
          変更後の規約は、本ページに掲載した時点で効力を生じます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">8. 準拠法・管轄</h2>
        <p className="text-g-text-secondary">
          本規約は日本法に準拠し、本サービスに関する紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">9. お問い合わせ</h2>
        <p className="text-g-text-secondary">
          本規約に関するお問い合わせは、以下までご連絡ください。
        </p>
        <p className="text-g-text-secondary">
          メール: <a href="mailto:ren10duka@gmail.com" className="text-[#4285F4] underline">ren10duka@gmail.com</a>
        </p>
      </section>
    </div>
  );
}
