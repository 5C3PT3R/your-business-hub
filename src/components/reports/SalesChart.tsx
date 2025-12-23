import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDeals } from '@/hooks/useDeals';

const stageLabels: Record<string, string> = {
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  contract: 'Contract',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const stageOrder = ['discovery', 'proposal', 'negotiation', 'contract', 'closed_won', 'closed_lost'];

export function SalesChart() {
  const { deals } = useDeals();

  const chartData = useMemo(() => {
    const stageData: Record<string, { count: number; value: number }> = {};
    
    stageOrder.forEach((stage) => {
      stageData[stage] = { count: 0, value: 0 };
    });

    deals.forEach((deal) => {
      const stage = deal.stage || 'discovery';
      if (stageData[stage]) {
        stageData[stage].count += 1;
        stageData[stage].value += deal.value || 0;
      }
    });

    return stageOrder.map((stage) => ({
      stage: stageLabels[stage] || stage,
      count: stageData[stage].count,
      value: stageData[stage].value,
    }));
  }, [deals]);

  const hasData = chartData.some((d) => d.value > 0 || d.count > 0);

  return (
    <div className="rounded-xl bg-card p-6 shadow-card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Pipeline by Stage</h3>
        <p className="text-sm text-muted-foreground">Deal value per stage</p>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-[350px] text-muted-foreground">
          No deals yet. Create some deals to see the chart!
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <YAxis
              dataKey="stage"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 13%, 91%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
            />
            <Bar dataKey="value" fill="hsl(221, 83%, 53%)" name="Value" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
