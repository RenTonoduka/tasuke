interface SectionProgressProps {
  data: { id: string; name: string; total: number; completed: number; color: string | null }[];
}

const DEFAULT_COLORS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#A142F4', '#24C1E0'];

export function SectionProgress({ data }: SectionProgressProps) {
  return (
    <div className="rounded-lg bg-g-bg p-5 shadow-sm ring-1 ring-g-border">
      <h2 className="mb-4 text-sm font-semibold text-g-text">セクション別進捗</h2>
      {data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-g-text-muted">データなし</div>
      ) : (
        <ul className="space-y-4">
          {data.map((section, i) => {
            const rate = section.total > 0 ? Math.round((section.completed / section.total) * 100) : 0;
            const color = section.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            return (
              <li key={section.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate text-sm text-g-text">{section.name}</span>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-g-text-secondary">
                    {section.completed}/{section.total} ({rate}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-g-surface-hover">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${rate}%`, backgroundColor: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
