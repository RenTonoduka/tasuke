'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * タスク説明などのMarkdownを安全に整形表示する（HTMLは描画しない）。
 * ダークモードは既存の g-* CSS変数で対応。
 */
export function MarkdownView({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn('text-sm leading-relaxed text-g-text', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="mb-2 mt-3 text-lg font-bold" {...p} />,
          h2: (p) => <h2 className="mb-2 mt-3 text-base font-bold" {...p} />,
          h3: (p) => <h3 className="mb-1 mt-2 text-sm font-semibold" {...p} />,
          p: (p) => <p className="my-2 whitespace-pre-wrap" {...p} />,
          ul: (p) => <ul className="my-2 list-disc pl-5" {...p} />,
          ol: (p) => <ol className="my-2 list-decimal pl-5" {...p} />,
          li: (p) => <li className="my-0.5" {...p} />,
          a: (p) => (
            <a
              className="text-blue-600 underline hover:opacity-80 dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
              {...p}
            />
          ),
          code: (p) => (
            <code
              className="rounded bg-g-surface-hover px-1 py-0.5 font-mono text-xs"
              {...p}
            />
          ),
          pre: (p) => (
            <pre
              className="my-2 overflow-x-auto rounded bg-g-surface-hover p-3 text-xs"
              {...p}
            />
          ),
          blockquote: (p) => (
            <blockquote
              className="my-2 border-l-2 border-g-border pl-3 text-g-text-secondary"
              {...p}
            />
          ),
          table: (p) => (
            <table className="my-2 w-full border-collapse text-xs" {...p} />
          ),
          th: (p) => (
            <th className="border border-g-border px-2 py-1 text-left font-semibold" {...p} />
          ),
          td: (p) => <td className="border border-g-border px-2 py-1" {...p} />,
          hr: () => <hr className="my-3 border-g-border" />,
          input: (p) => (
            <input className="mr-1 align-middle" disabled {...p} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
