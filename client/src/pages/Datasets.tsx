import { Database, Upload, Table, FileSpreadsheet } from "lucide-react";
import "./Datasets.css";

const sampleDatasets = [
  { name: "Market Research Q4", type: "CSV", rows: "12,400", updated: "2 days ago", icon: FileSpreadsheet },
  { name: "Financial Projections", type: "Excel", rows: "3,200", updated: "1 week ago", icon: Table },
  { name: "Customer Survey Results", type: "CSV", rows: "8,750", updated: "3 days ago", icon: FileSpreadsheet },
];

export default function Datasets() {
  return (
    <div className="datasets-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Datasets</h1>
          <p className="page-subtitle">Manage data sources for your analysis</p>
        </div>
        <button className="btn-primary" disabled>
          <Upload size={16} />
          Upload Dataset
        </button>
      </div>

      <div className="datasets-grid">
        {sampleDatasets.map((ds, i) => (
          <div key={i} className="dataset-card card">
            <div className="dataset-card-icon" style={{ background: i === 0 ? "#DBEAFE" : i === 1 ? "#D1FAE5" : "#FEF3C7" }}>
              <ds.icon size={20} color={i === 0 ? "#3B82F6" : i === 1 ? "#10B981" : "#F59E0B"} />
            </div>
            <div className="dataset-card-info">
              <h3>{ds.name}</h3>
              <div className="dataset-card-meta">
                <span className="badge" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>{ds.type}</span>
                <span>{ds.rows} rows</span>
                <span>{ds.updated}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="datasets-empty-hint">
        <Database size={32} />
        <p>Connect your data sources or upload files to power your analysis pipeline.</p>
        <p className="datasets-hint-sub">Supports CSV, Excel, JSON, and API connections.</p>
      </div>
    </div>
  );
}
