import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useLeads } from '@/hooks/useLeads';

const COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(199, 89%, 48%)',
  'hsl(280, 65%, 60%)',
  'hsl(0, 84%, 60%)',
];

export function LeadSourceChart() {
  const { leads } = useLeads();

  const chartData = useMemo(() => {
    const sourceCount: Record<string, number> = {};
    
    leads.forEach((lead) => {
      const source = lead.source || 'Unknown';
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    const total = leads.length || 1;
    
    return Object.entries(sourceCount).map(([name, count], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
      value: Math.round((count / total) * 100),
      color: COLORS[index % COLORS.length],
    }));
  }, [leads]);

  const hasData = chartData.length > 0;

  return (
    <div className="rounded-xl bg-card p-6 shadow-card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Lead Sources</h3>
        <p className="text-sm text-muted-foreground">Distribution by channel</p>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-[280px] text-muted-foreground">
          No leads yet. Add some leads to see the chart!
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={4}
              dataKey="value"
              style={{ outline: 'none' }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{ outline: 'none' }}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: number) => [`${value}%`, 'Share']}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
