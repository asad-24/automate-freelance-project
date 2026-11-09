"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 12, stroke: "hsl(var(--muted-foreground))" };
const GRID = "hsl(var(--border))";
const PRIMARY = "hsl(var(--primary))";
const PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

function Box({ children, height = 280 }: { children: any; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "hsl(var(--popover-foreground))",
  },
};

export function MarginAreaChart({ data }: { data: { month: string; revenue: number; cost: number; margin: number }[] }) {
  return (
    <Box>
      <AreaChart data={data} margin={{ left: -10, right: 10, top: 10 }}>
        <defs>
          <linearGradient id="gMargin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.4} />
            <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Area type="monotone" dataKey="margin" stroke={PRIMARY} strokeWidth={2} fill="url(#gMargin)" />
      </AreaChart>
    </Box>
  );
}

export function RevenueBarChart({ data }: { data: { month: string; revenue: number; cost: number; margin: number }[] }) {
  return (
    <Box>
      <BarChart data={data} margin={{ left: -10, right: 10, top: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cost" fill="#ec4899" radius={[4, 4, 0, 0]} />
      </BarChart>
    </Box>
  );
}

export function FunnelBarChart({ data }: { data: { stage: string; value: number }[] }) {
  return (
    <Box height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 30, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis dataKey="stage" type="category" tick={AXIS} tickLine={false} axisLine={false} width={110} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </Box>
  );
}

export function SimpleLineChart({ data, dataKey = "amount", xKey = "month" }: { data: any[]; dataKey?: string; xKey?: string }) {
  return (
    <Box>
      <LineChart data={data} margin={{ left: -10, right: 10, top: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey={dataKey} stroke={PRIMARY} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </Box>
  );
}

export function CategoryPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Box>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
      </PieChart>
    </Box>
  );
}
