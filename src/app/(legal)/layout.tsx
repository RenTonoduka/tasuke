import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-g-bg">
      <header className="border-b border-g-border bg-g-surface px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/login" className="text-lg font-bold text-g-text">
            タス助
          </Link>
          <nav className="flex gap-4 text-xs text-g-text-secondary">
            <Link href="/privacy" className="hover:text-g-text">プライバシーポリシー</Link>
            <Link href="/terms" className="hover:text-g-text">利用規約</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
