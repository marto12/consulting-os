import { BarChart3, TrendingUp, PieChart, LineChart } from "lucide-react";
import { Card } from "@/components/ui/card";

const analysisTypes = [
  { name: "Trend Analysis", desc: "Identify patterns and trends over time", icon: TrendingUp, color: "#3B82F6" },
  { name: "Comparative Analysis", desc: "Compare datasets and segments", icon: BarChart3, color: "#8B5CF6" },
  { name: "Distribution Analysis", desc: "Understand data distributions", icon: PieChart, color: "#059669" },
  { name: "Forecasting", desc: "Project future outcomes with AI models", icon: LineChart, color: "#D97706" },
];

export default function Analysis() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">Run AI-powered analysis on your datasets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {analysisTypes.map((at, i) => (
          <Card key={i} className="cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all p-5">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
              style={{ background: at.color + "18" }}
            >
              <at.icon size={22} color={at.color} />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{at.name}</h3>
            <p className="text-sm text-muted-foreground">{at.desc}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Recent Analyses</h2>
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
          <BarChart3 size={28} />
          <p>No analyses yet. Select an analysis type above to get started.</p>
        </div>
      </div>
    </div>
  );
}
