'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants';

interface PriorityChartProps {
  data: { priority: string; count: number }[];
}

export function PriorityChart({ data }: PriorityChartProps) {
  const sorted = ['P0', 'P1', 'P2', 'P3'].map((p) => {
    const found = data.find((d) => d.priority === p);
    return { priority: p, label: PRIORITY_LABELS[p], count: found?.count ?? 0 };
  });

  // 修正5: 合計が0かどうかで空状態を判定（data は常に4要素あるため length チェックは不正確）
  const total = sorted.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#E8EAED]">
      <h2 className="mb-4 text-sm font-semibold text-[#202124]">優先度別タスク</h2>
      {total === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#80868B]">データなし</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sorted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5F6368' }} />
            <YAxis tick={{ fontSize: 12, fill: '#5F6368' }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value, 'タスク数']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {sorted.map((entry) => (
                <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
