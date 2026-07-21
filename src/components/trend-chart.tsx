"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export interface TrendPoint {
  label: string;
  alerts: number;
  runRate: number;
  active: number;
  stale: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No history yet — run a few syncs to build the trend.
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            stroke="var(--border)"
            minTickGap={24}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            stroke="var(--border)"
            allowDecimals={false}
            width={44}
            label={{
              value: "alerts",
              angle: -90,
              position: "insideLeft",
              style: { fill: "var(--muted-foreground)", fontSize: 11 },
            }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="alerts"
            name="Alerts (week-to-date)"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="runRate"
            name="Projected / week"
            stroke="var(--warn)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 2.5, fill: "var(--warn)", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="stale"
            name="Stale (carryover)"
            stroke="var(--alert)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--alert)", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
