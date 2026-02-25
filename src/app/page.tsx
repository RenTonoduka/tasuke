import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function LandingPage() {
  // 認証済みユーザーはワークスペースへリダイレクト
  const session = await getAuthSession();
  if (session?.user) {
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true },
    });
    if (membership?.workspace) {
      redirect(`/${membership.workspace.slug}`);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">タス助</h1>
          <Link
            href="/login"
            className="rounded-lg bg-[#4285F4] px-5 py-2 text-sm font-medium text-white hover:bg-[#3367D6] transition-colors"
          >
            ログイン
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          チームのタスク管理を
          <br />
          シンプルに
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          タス助は、プロジェクト管理・タスク管理・スケジュール管理を一つにまとめたツールです。
          Googleカレンダーとの連携で、チームの生産性を最大化します。
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="rounded-lg bg-[#4285F4] px-8 py-3 text-base font-medium text-white hover:bg-[#3367D6] transition-colors"
          >
            無料で始める
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h3 className="mb-12 text-center text-2xl font-bold text-gray-900">主な機能</h3>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="プロジェクト管理"
              description="リスト・ボード・タイムラインなど、チームのスタイルに合わせた表示形式でタスクを管理できます。"
            />
            <FeatureCard
              title="Googleカレンダー連携"
              description="タスクをGoogleカレンダーに自動登録。スケジュールの空き時間に最適なタスク配置を提案します。"
            />
            <FeatureCard
              title="サブタスク・ラベル"
              description="タスクをサブタスクに分解し、ラベルで分類。進捗をひと目で把握できます。"
            />
            <FeatureCard
              title="チーム協業"
              description="メンバーへのタスク割り当て、コメント、アクティビティログで円滑なコミュニケーション。"
            />
            <FeatureCard
              title="自動化ルール"
              description="ステータス変更時の自動アクションなど、繰り返し作業を自動化できます。"
            />
            <FeatureCard
              title="API・MCP連携"
              description="APIトークンで外部サービスと連携。Claude等のAIツールからタスクを直接管理できます。"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-gray-500">
          <span>&copy; {new Date().getFullYear()} タス助</span>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-gray-700">利用規約</Link>
            <Link href="/privacy" className="hover:text-gray-700">プライバシーポリシー</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h4 className="mb-2 text-base font-semibold text-gray-900">{title}</h4>
      <p className="text-sm leading-relaxed text-gray-600">{description}</p>
    </div>
  );
}
