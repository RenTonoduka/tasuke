'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ActivityTrendProps {
  data: { date: string; count: number }[];
}

export function ActivityTrend({ data }: ActivityTrendProps) {
  const hasActivity = data.some((d) => d.count > 0);

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-[#E8EAED]">
      <h2 className="mb-4 text-sm font-semibold text-[#202124]">タスク完了トレンド（過去14日）</h2>
      {!hasActivity ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#80868B]">
          完了タスクがありません
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4285F4" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#4285F4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F4" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5F6368' }} interval={1} />
            <YAxis tick={{ fontSize: 11, fill: '#5F6368' }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [value, '完了タスク数']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#4285F4"
              strokeWidth={2}
              fill="url(#completionGradient)"
              dot={{ fill: '#4285F4', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
