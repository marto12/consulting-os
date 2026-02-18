import { useRef, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";
import { Download } from "lucide-react";
import { Button } from "./ui/button";

const DEFAULT_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE", "#FF8042", "#00C49F", "#FFBB28"];

interface ChartConfig {
  chartType: string;
  title?: string;
  description?: string;
  xAxisKey?: string;
  yAxisKeys?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
  nameKey?: string;
  valueKey?: string;
  stacked?: boolean;
}

interface ChartRendererProps {
  config: ChartConfig;
  data: Record<string, any>[];
  height?: number;
  showDownload?: boolean;
  chartName?: string;
}

export default function ChartRenderer({ config, data, height = 350, showDownload = true, chartName }: ChartRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#09090b",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${chartName || config.title || "chart"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Failed to download chart:", err);
    }
  }, [chartName, config.title]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  const colors = config.colors || DEFAULT_COLORS;
  const yKeys = config.yAxisKeys || [];

  const renderChart = () => {
    switch (config.chartType) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={config.xAxisKey} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} label={config.xAxisLabel ? { value: config.xAxisLabel, position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))" } : undefined} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" } : undefined} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
              <Legend />
              {yKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                dataKey={config.valueKey || yKeys[0] || "value"}
                nameKey={config.nameKey || config.xAxisKey || "name"}
                cx="50%"
                cy="50%"
                outerRadius={height / 3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={config.xAxisKey} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
              <Legend />
              {yKeys.map((key, i) => (
                <Area key={key} type="monotone" dataKey={key} fill={colors[i % colors.length]} stroke={colors[i % colors.length]} fillOpacity={0.3} stackId={config.stacked ? "stack" : undefined} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={config.xAxisKey} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} name={config.xAxisLabel || config.xAxisKey} />
              <YAxis dataKey={yKeys[0]} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} name={config.yAxisLabel || yKeys[0]} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={data} fill={colors[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case "bar":
      default:
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={config.xAxisKey} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} label={config.xAxisLabel ? { value: config.xAxisLabel, position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))" } : undefined} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" } : undefined} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
              <Legend />
              {yKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} stackId={config.stacked ? "stack" : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="relative">
      <div ref={chartRef} className="p-4">
        {config.title && <h3 className="text-sm font-semibold mb-1">{config.title}</h3>}
        {config.description && <p className="text-xs text-muted-foreground mb-3">{config.description}</p>}
        {renderChart()}
      </div>
      {showDownload && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 opacity-60 hover:opacity-100"
          onClick={handleDownload}
          title="Download as PNG"
        >
          <Download size={14} />
        </Button>
      )}
    </div>
  );
}
