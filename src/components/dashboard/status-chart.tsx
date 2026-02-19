'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';

interface StatusChartProps {
  data: { status: string; count: number }[];
  completionRate: number;
}

export function StatusChart({ data, completionRate }: StatusChartProps) {
  const chartData = data.map((d) => ({ ...d, label: STATUS_LABELS[d.status] ?? d.status }));

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#E8EAED]">
      <h2 className="mb-4 text-sm font-semibold text-[#202124]">ステータス別タスク</h2>
      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#80868B]">データなし</div>
      ) : (
        <div className="relative flex flex-col items-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="count"
                nameKey="label"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#ccc'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [value, '']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute top-1/2 -translate-y-1/2 text-center">
            <p className="text-2xl font-bold text-[#202124]">{completionRate}%</p>
            <p className="text-xs text-[#80868B]">完了率</p>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {chartData.map((d) => (
              <div key={d.status} className="flex items-center gap-1.5 text-xs text-[#5F6368]">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[d.status] }}
                />
                {d.label} ({d.count})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
