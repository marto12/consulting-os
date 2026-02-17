import { BarChart3, TrendingUp, PieChart, LineChart } from "lucide-react";
import "./Analysis.css";

const analysisTypes = [
  { name: "Trend Analysis", desc: "Identify patterns and trends over time", icon: TrendingUp, color: "#3B82F6" },
  { name: "Comparative Analysis", desc: "Compare datasets and segments", icon: BarChart3, color: "#8B5CF6" },
  { name: "Distribution Analysis", desc: "Understand data distributions", icon: PieChart, color: "#059669" },
  { name: "Forecasting", desc: "Project future outcomes with AI models", icon: LineChart, color: "#D97706" },
];

export default function Analysis() {
  return (
    <div className="analysis-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analysis</h1>
          <p className="page-subtitle">Run AI-powered analysis on your datasets</p>
        </div>
      </div>

      <div className="analysis-types-grid">
        {analysisTypes.map((at, i) => (
          <div key={i} className="analysis-type-card card card-clickable">
            <div className="analysis-type-icon" style={{ background: at.color + "18" }}>
              <at.icon size={22} color={at.color} />
            </div>
            <h3>{at.name}</h3>
            <p>{at.desc}</p>
          </div>
        ))}
      </div>

      <div className="analysis-recent">
        <h2 className="analysis-section-title">Recent Analyses</h2>
        <div className="analysis-empty">
          <BarChart3 size={28} />
          <p>No analyses yet. Select an analysis type above to get started.</p>
        </div>
      </div>
    </div>
  );
}
