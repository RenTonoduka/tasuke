interface ProjectProgressProps {
  data: { id: string; name: string; total: number; completed: number; color: string }[];
}

export function ProjectProgress({ data }: ProjectProgressProps) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#E8EAED]">
      <h2 className="mb-4 text-sm font-semibold text-[#202124]">プロジェクト別進捗</h2>
      {data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-[#80868B]">データなし</div>
      ) : (
        <ul className="space-y-4">
          {data.map((project) => {
            const rate = project.total > 0 ? Math.round((project.completed / project.total) * 100) : 0;
            return (
              <li key={project.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate text-sm text-[#202124]">{project.name}</span>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-[#5F6368]">
                    {project.completed}/{project.total} ({rate}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F3F4]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${rate}%`, backgroundColor: project.color }}
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
