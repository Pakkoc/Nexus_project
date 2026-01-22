"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { DailyTrendItem } from "@/hooks/queries/use-treasury-stats";

interface TreasuryTrendChartProps {
  data: DailyTrendItem[];
  totalIncome: number;
  totalExpense: number;
  isLoading?: boolean;
  currencyName?: string;
}

export function TreasuryTrendChart({
  data,
  totalIncome,
  totalExpense,
  isLoading,
  currencyName = "토피",
}: TreasuryTrendChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[160px] bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  const hasData = data.some((d) => d.income > 0 || d.expense > 0 || d.balance > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[160px] text-white/40">
        <p className="text-sm">국고 거래 데이터가 없습니다</p>
      </div>
    );
  }

  // 수입/지출 최대값 (왼쪽 Y축)
  const maxFlow = Math.max(
    ...data.map((d) => Math.max(d.income, d.expense)),
    1
  );
  const flowDomain: [number, number] = [0, Math.ceil(maxFlow * 1.2)];

  // 잔액 최대/최소값 (오른쪽 Y축)
  const balances = data.map((d) => d.balance);
  const maxBalance = Math.max(...balances, 1);
  const minBalance = Math.min(...balances, 0);
  const balancePadding = (maxBalance - minBalance) * 0.1 || maxBalance * 0.1;
  const balanceDomain: [number, number] = [
    Math.max(0, Math.floor(minBalance - balancePadding)),
    Math.ceil(maxBalance + balancePadding),
  ];

  // 수평 그리드 라인용 tick 계산 (왼쪽 Y축 기준)
  const yTickCount = 4;
  const yStep = (flowDomain[1] - flowDomain[0]) / (yTickCount - 1);
  const yTicks = Array.from({ length: yTickCount }, (_, i) => flowDomain[0] + yStep * i);

  return (
    <div className="space-y-2">
      {/* 범례 */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald-400 rounded-full" />
          <span className="text-white/60">수입</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-rose-400 rounded-full" />
          <span className="text-white/60">지출</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-400 rounded-full" />
          <span className="text-blue-400/80">총보유량</span>
        </div>
      </div>

      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 45, left: 10, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
              horizontal={false}
              vertical={true}
            />
            {/* 수평 그리드 라인 */}
            {yTicks.map((tick) => (
              <ReferenceLine
                key={tick}
                y={tick}
                yAxisId="flow"
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="3 3"
              />
            ))}
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            {/* 왼쪽 Y축: 수입/지출 */}
            <YAxis
              yAxisId="flow"
              orientation="left"
              domain={flowDomain}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              tickCount={yTickCount}
              width={35}
              tickFormatter={(value) => value.toLocaleString()}
            />
            {/* 오른쪽 Y축: 총보유량 */}
            <YAxis
              yAxisId="balance"
              orientation="right"
              domain={balanceDomain}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(96, 165, 250, 0.7)", fontSize: 10 }}
              tickCount={yTickCount}
              width={40}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toLocaleString()}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.1)" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const income = payload.find(p => p.dataKey === "income")?.value as number;
                  const expense = payload.find(p => p.dataKey === "expense")?.value as number;
                  const balance = payload.find(p => p.dataKey === "balance")?.value as number;
                  return (
                    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <p className="text-white font-medium mb-1">{label}</p>
                      <p className="text-emerald-400">
                        수입: {income?.toLocaleString()} {currencyName}
                      </p>
                      <p className="text-rose-400">
                        지출: {expense?.toLocaleString()} {currencyName}
                      </p>
                      <p className="text-blue-400">
                        잔액: {balance?.toLocaleString()} {currencyName}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* 수입 라인 */}
            <Line
              yAxisId="flow"
              type="monotone"
              dataKey="income"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ fill: "#10b981", strokeWidth: 2, stroke: "#fff", r: 4 }}
            />
            {/* 지출 라인 */}
            <Line
              yAxisId="flow"
              type="monotone"
              dataKey="expense"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={false}
              activeDot={{ fill: "#f43f5e", strokeWidth: 2, stroke: "#fff", r: 4 }}
            />
            {/* 총보유량 라인 */}
            <Line
              yAxisId="balance"
              type="monotone"
              dataKey="balance"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              activeDot={{ fill: "#60a5fa", strokeWidth: 2, stroke: "#fff", r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 하단 요약 */}
      <div className="flex items-center justify-end text-xs text-white/40">
        7일 순수익: <span className={`ml-1 ${totalIncome - totalExpense >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {(totalIncome - totalExpense).toLocaleString()} {currencyName}
        </span>
      </div>
    </div>
  );
}
