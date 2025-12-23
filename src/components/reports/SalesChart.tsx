import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { dealStageData } from '@/data/mockData';

export function SalesChart() {
  return (
    <div className="rounded-xl bg-card p-6 shadow-card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Pipeline by Stage</h3>
        <p className="text-sm text-muted-foreground">Deal count and value per stage</p>
      </div>
      
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={dealStageData} layout="vertical">
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
            formatter={(value: number, name: string) => [
              name === 'value' ? `$${value.toLocaleString()}` : value,
              name === 'value' ? 'Value' : 'Deals',
            ]}
          />
          <Legend />
          <Bar dataKey="value" fill="hsl(221, 83%, 53%)" name="Value" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
