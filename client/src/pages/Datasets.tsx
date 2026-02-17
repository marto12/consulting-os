import { useState } from "react";
import { Database, Upload, Table, FileSpreadsheet, X, ChevronLeft, ChevronRight, ArrowUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DatasetRow {
  [key: string]: string | number;
}

interface Dataset {
  name: string;
  type: string;
  rows: number;
  updated: string;
  icon: typeof FileSpreadsheet;
  color: string;
  iconColor: string;
  columns: string[];
  data: DatasetRow[];
}

const sampleDatasets: Dataset[] = [
  {
    name: "Market Research Q4",
    type: "CSV",
    rows: 24,
    updated: "2 days ago",
    icon: FileSpreadsheet,
    color: "#DBEAFE",
    iconColor: "#3B82F6",
    columns: ["Region", "Segment", "Revenue ($K)", "Growth (%)", "Market Share (%)", "Customers", "Satisfaction"],
    data: [
      { Region: "North America", Segment: "Enterprise", "Revenue ($K)": 4250, "Growth (%)": 12.3, "Market Share (%)": 34.2, Customers: 187, Satisfaction: 4.5 },
      { Region: "North America", Segment: "Mid-Market", "Revenue ($K)": 2180, "Growth (%)": 8.7, "Market Share (%)": 22.1, Customers: 412, Satisfaction: 4.2 },
      { Region: "North America", Segment: "SMB", "Revenue ($K)": 890, "Growth (%)": 15.4, "Market Share (%)": 18.6, Customers: 1243, Satisfaction: 4.0 },
      { Region: "Europe", Segment: "Enterprise", "Revenue ($K)": 3100, "Growth (%)": 9.1, "Market Share (%)": 28.5, Customers: 134, Satisfaction: 4.3 },
      { Region: "Europe", Segment: "Mid-Market", "Revenue ($K)": 1750, "Growth (%)": 11.2, "Market Share (%)": 19.8, Customers: 328, Satisfaction: 4.1 },
      { Region: "Europe", Segment: "SMB", "Revenue ($K)": 620, "Growth (%)": 18.9, "Market Share (%)": 14.3, Customers: 876, Satisfaction: 3.9 },
      { Region: "Asia Pacific", Segment: "Enterprise", "Revenue ($K)": 2800, "Growth (%)": 22.5, "Market Share (%)": 19.7, Customers: 98, Satisfaction: 4.4 },
      { Region: "Asia Pacific", Segment: "Mid-Market", "Revenue ($K)": 1420, "Growth (%)": 28.3, "Market Share (%)": 15.2, Customers: 267, Satisfaction: 4.0 },
      { Region: "Asia Pacific", Segment: "SMB", "Revenue ($K)": 510, "Growth (%)": 35.1, "Market Share (%)": 11.8, Customers: 654, Satisfaction: 3.8 },
      { Region: "Latin America", Segment: "Enterprise", "Revenue ($K)": 1200, "Growth (%)": 14.7, "Market Share (%)": 24.1, Customers: 56, Satisfaction: 4.1 },
      { Region: "Latin America", Segment: "Mid-Market", "Revenue ($K)": 680, "Growth (%)": 19.8, "Market Share (%)": 16.5, Customers: 189, Satisfaction: 3.9 },
      { Region: "Latin America", Segment: "SMB", "Revenue ($K)": 290, "Growth (%)": 25.6, "Market Share (%)": 9.7, Customers: 432, Satisfaction: 3.7 },
      { Region: "Middle East", Segment: "Enterprise", "Revenue ($K)": 980, "Growth (%)": 31.2, "Market Share (%)": 12.4, Customers: 42, Satisfaction: 4.2 },
      { Region: "Middle East", Segment: "Mid-Market", "Revenue ($K)": 540, "Growth (%)": 27.4, "Market Share (%)": 8.9, Customers: 118, Satisfaction: 4.0 },
      { Region: "Middle East", Segment: "SMB", "Revenue ($K)": 180, "Growth (%)": 42.1, "Market Share (%)": 5.3, Customers: 287, Satisfaction: 3.6 },
      { Region: "Africa", Segment: "Enterprise", "Revenue ($K)": 450, "Growth (%)": 38.5, "Market Share (%)": 8.2, Customers: 23, Satisfaction: 4.0 },
      { Region: "Africa", Segment: "Mid-Market", "Revenue ($K)": 220, "Growth (%)": 44.2, "Market Share (%)": 5.1, Customers: 67, Satisfaction: 3.8 },
      { Region: "Africa", Segment: "SMB", "Revenue ($K)": 95, "Growth (%)": 52.3, "Market Share (%)": 3.2, Customers: 156, Satisfaction: 3.5 },
      { Region: "North America", Segment: "Government", "Revenue ($K)": 1850, "Growth (%)": 5.2, "Market Share (%)": 42.1, Customers: 34, Satisfaction: 4.6 },
      { Region: "Europe", Segment: "Government", "Revenue ($K)": 1320, "Growth (%)": 3.8, "Market Share (%)": 38.7, Customers: 28, Satisfaction: 4.4 },
      { Region: "Asia Pacific", Segment: "Government", "Revenue ($K)": 760, "Growth (%)": 12.1, "Market Share (%)": 22.3, Customers: 19, Satisfaction: 4.2 },
      { Region: "North America", Segment: "Education", "Revenue ($K)": 520, "Growth (%)": 7.4, "Market Share (%)": 31.5, Customers: 89, Satisfaction: 4.3 },
      { Region: "Europe", Segment: "Education", "Revenue ($K)": 380, "Growth (%)": 9.1, "Market Share (%)": 26.8, Customers: 72, Satisfaction: 4.1 },
      { Region: "Asia Pacific", Segment: "Education", "Revenue ($K)": 290, "Growth (%)": 16.5, "Market Share (%)": 18.4, Customers: 58, Satisfaction: 3.9 },
    ],
  },
  {
    name: "Financial Projections",
    type: "Excel",
    rows: 18,
    updated: "1 week ago",
    icon: Table,
    color: "#D1FAE5",
    iconColor: "#10B981",
    columns: ["Year", "Quarter", "Revenue ($M)", "COGS ($M)", "Gross Margin (%)", "EBITDA ($M)", "Net Income ($M)", "Headcount"],
    data: [
      { Year: 2024, Quarter: "Q1", "Revenue ($M)": 12.4, "COGS ($M)": 4.8, "Gross Margin (%)": 61.3, "EBITDA ($M)": 3.2, "Net Income ($M)": 1.8, Headcount: 124 },
      { Year: 2024, Quarter: "Q2", "Revenue ($M)": 13.8, "COGS ($M)": 5.1, "Gross Margin (%)": 63.0, "EBITDA ($M)": 3.9, "Net Income ($M)": 2.3, Headcount: 131 },
      { Year: 2024, Quarter: "Q3", "Revenue ($M)": 15.2, "COGS ($M)": 5.5, "Gross Margin (%)": 63.8, "EBITDA ($M)": 4.5, "Net Income ($M)": 2.8, Headcount: 142 },
      { Year: 2024, Quarter: "Q4", "Revenue ($M)": 17.1, "COGS ($M)": 6.0, "Gross Margin (%)": 64.9, "EBITDA ($M)": 5.3, "Net Income ($M)": 3.4, Headcount: 155 },
      { Year: 2025, Quarter: "Q1", "Revenue ($M)": 18.9, "COGS ($M)": 6.4, "Gross Margin (%)": 66.1, "EBITDA ($M)": 6.1, "Net Income ($M)": 4.0, Headcount: 168 },
      { Year: 2025, Quarter: "Q2", "Revenue ($M)": 21.3, "COGS ($M)": 7.0, "Gross Margin (%)": 67.1, "EBITDA ($M)": 7.2, "Net Income ($M)": 4.8, Headcount: 179 },
      { Year: 2025, Quarter: "Q3", "Revenue ($M)": 23.8, "COGS ($M)": 7.6, "Gross Margin (%)": 68.1, "EBITDA ($M)": 8.4, "Net Income ($M)": 5.7, Headcount: 192 },
      { Year: 2025, Quarter: "Q4", "Revenue ($M)": 26.5, "COGS ($M)": 8.2, "Gross Margin (%)": 69.1, "EBITDA ($M)": 9.8, "Net Income ($M)": 6.7, Headcount: 208 },
      { Year: 2026, Quarter: "Q1", "Revenue ($M)": 29.4, "COGS ($M)": 8.8, "Gross Margin (%)": 70.1, "EBITDA ($M)": 11.2, "Net Income ($M)": 7.8, Headcount: 225 },
      { Year: 2026, Quarter: "Q2", "Revenue ($M)": 32.8, "COGS ($M)": 9.5, "Gross Margin (%)": 71.0, "EBITDA ($M)": 12.9, "Net Income ($M)": 9.1, Headcount: 243 },
      { Year: 2026, Quarter: "Q3", "Revenue ($M)": 36.5, "COGS ($M)": 10.2, "Gross Margin (%)": 72.1, "EBITDA ($M)": 14.8, "Net Income ($M)": 10.5, Headcount: 261 },
      { Year: 2026, Quarter: "Q4", "Revenue ($M)": 40.1, "COGS ($M)": 10.8, "Gross Margin (%)": 73.1, "EBITDA ($M)": 16.9, "Net Income ($M)": 12.1, Headcount: 280 },
      { Year: 2027, Quarter: "Q1", "Revenue ($M)": 44.2, "COGS ($M)": 11.5, "Gross Margin (%)": 74.0, "EBITDA ($M)": 19.2, "Net Income ($M)": 13.8, Headcount: 302 },
      { Year: 2027, Quarter: "Q2", "Revenue ($M)": 48.9, "COGS ($M)": 12.2, "Gross Margin (%)": 75.1, "EBITDA ($M)": 21.8, "Net Income ($M)": 15.7, Headcount: 325 },
      { Year: 2027, Quarter: "Q3", "Revenue ($M)": 53.1, "COGS ($M)": 12.8, "Gross Margin (%)": 75.9, "EBITDA ($M)": 24.5, "Net Income ($M)": 17.8, Headcount: 348 },
      { Year: 2027, Quarter: "Q4", "Revenue ($M)": 58.2, "COGS ($M)": 13.4, "Gross Margin (%)": 77.0, "EBITDA ($M)": 27.4, "Net Income ($M)": 20.1, Headcount: 372 },
      { Year: 2028, Quarter: "Q1", "Revenue ($M)": 63.5, "COGS ($M)": 14.0, "Gross Margin (%)": 78.0, "EBITDA ($M)": 30.8, "Net Income ($M)": 22.5, Headcount: 398 },
      { Year: 2028, Quarter: "Q2", "Revenue ($M)": 69.1, "COGS ($M)": 14.5, "Gross Margin (%)": 79.0, "EBITDA ($M)": 34.2, "Net Income ($M)": 25.1, Headcount: 425 },
    ],
  },
  {
    name: "Customer Survey Results",
    type: "CSV",
    rows: 20,
    updated: "3 days ago",
    icon: FileSpreadsheet,
    color: "#FEF3C7",
    iconColor: "#F59E0B",
    columns: ["Respondent ID", "Industry", "Company Size", "NPS Score", "Product Rating", "Support Rating", "Likelihood to Renew (%)", "Feature Request"],
    data: [
      { "Respondent ID": "R-001", Industry: "Technology", "Company Size": "500+", "NPS Score": 9, "Product Rating": 4.8, "Support Rating": 4.5, "Likelihood to Renew (%)": 95, "Feature Request": "API integrations" },
      { "Respondent ID": "R-002", Industry: "Healthcare", "Company Size": "200-500", "NPS Score": 8, "Product Rating": 4.3, "Support Rating": 4.7, "Likelihood to Renew (%)": 88, "Feature Request": "HIPAA compliance" },
      { "Respondent ID": "R-003", Industry: "Finance", "Company Size": "500+", "NPS Score": 7, "Product Rating": 4.1, "Support Rating": 3.9, "Likelihood to Renew (%)": 72, "Feature Request": "Custom reports" },
      { "Respondent ID": "R-004", Industry: "Retail", "Company Size": "50-200", "NPS Score": 10, "Product Rating": 4.9, "Support Rating": 4.8, "Likelihood to Renew (%)": 98, "Feature Request": "Mobile app" },
      { "Respondent ID": "R-005", Industry: "Manufacturing", "Company Size": "500+", "NPS Score": 6, "Product Rating": 3.8, "Support Rating": 4.2, "Likelihood to Renew (%)": 65, "Feature Request": "ERP integration" },
      { "Respondent ID": "R-006", Industry: "Education", "Company Size": "50-200", "NPS Score": 9, "Product Rating": 4.6, "Support Rating": 4.4, "Likelihood to Renew (%)": 91, "Feature Request": "LMS connector" },
      { "Respondent ID": "R-007", Industry: "Technology", "Company Size": "200-500", "NPS Score": 8, "Product Rating": 4.4, "Support Rating": 4.1, "Likelihood to Renew (%)": 85, "Feature Request": "SSO support" },
      { "Respondent ID": "R-008", Industry: "Finance", "Company Size": "200-500", "NPS Score": 5, "Product Rating": 3.5, "Support Rating": 3.2, "Likelihood to Renew (%)": 52, "Feature Request": "Audit logs" },
      { "Respondent ID": "R-009", Industry: "Healthcare", "Company Size": "500+", "NPS Score": 9, "Product Rating": 4.7, "Support Rating": 4.6, "Likelihood to Renew (%)": 93, "Feature Request": "Data encryption" },
      { "Respondent ID": "R-010", Industry: "Retail", "Company Size": "10-50", "NPS Score": 7, "Product Rating": 4.0, "Support Rating": 4.3, "Likelihood to Renew (%)": 78, "Feature Request": "Inventory sync" },
      { "Respondent ID": "R-011", Industry: "Technology", "Company Size": "10-50", "NPS Score": 10, "Product Rating": 4.9, "Support Rating": 4.9, "Likelihood to Renew (%)": 99, "Feature Request": "Webhooks" },
      { "Respondent ID": "R-012", Industry: "Manufacturing", "Company Size": "200-500", "NPS Score": 6, "Product Rating": 3.7, "Support Rating": 3.8, "Likelihood to Renew (%)": 61, "Feature Request": "Batch processing" },
      { "Respondent ID": "R-013", Industry: "Education", "Company Size": "10-50", "NPS Score": 8, "Product Rating": 4.5, "Support Rating": 4.6, "Likelihood to Renew (%)": 87, "Feature Request": "Grading tools" },
      { "Respondent ID": "R-014", Industry: "Finance", "Company Size": "500+", "NPS Score": 4, "Product Rating": 3.2, "Support Rating": 3.0, "Likelihood to Renew (%)": 40, "Feature Request": "Compliance dashboard" },
      { "Respondent ID": "R-015", Industry: "Healthcare", "Company Size": "50-200", "NPS Score": 8, "Product Rating": 4.4, "Support Rating": 4.5, "Likelihood to Renew (%)": 86, "Feature Request": "Patient portal" },
      { "Respondent ID": "R-016", Industry: "Retail", "Company Size": "200-500", "NPS Score": 9, "Product Rating": 4.6, "Support Rating": 4.3, "Likelihood to Renew (%)": 92, "Feature Request": "POS integration" },
      { "Respondent ID": "R-017", Industry: "Technology", "Company Size": "500+", "NPS Score": 7, "Product Rating": 4.2, "Support Rating": 3.7, "Likelihood to Renew (%)": 74, "Feature Request": "GraphQL API" },
      { "Respondent ID": "R-018", Industry: "Manufacturing", "Company Size": "50-200", "NPS Score": 8, "Product Rating": 4.3, "Support Rating": 4.4, "Likelihood to Renew (%)": 84, "Feature Request": "IoT dashboard" },
      { "Respondent ID": "R-019", Industry: "Education", "Company Size": "200-500", "NPS Score": 9, "Product Rating": 4.7, "Support Rating": 4.8, "Likelihood to Renew (%)": 94, "Feature Request": "Analytics" },
      { "Respondent ID": "R-020", Industry: "Finance", "Company Size": "50-200", "NPS Score": 6, "Product Rating": 3.9, "Support Rating": 4.0, "Likelihood to Renew (%)": 68, "Feature Request": "Multi-currency" },
    ],
  },
];

const PAGE_SIZE = 10;

function DataViewer({ dataset, onClose }: { dataset: Dataset; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");

  const filtered = dataset.data.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return dataset.columns.some((col) => String(row[col]).toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    const va = a[sortCol];
    const vb = b[sortCol];
    if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
    setPage(0);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-[95%] max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: dataset.color }}>
              <dataset.icon size={18} color={dataset.iconColor} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{dataset.name}</h2>
              <span className="text-xs text-muted-foreground">{dataset.type} &middot; {dataset.data.length} rows &middot; {dataset.columns.length} columns</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search rows..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 h-8 w-[200px]"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length === dataset.data.length ? `${dataset.data.length} rows` : `${filtered.length} of ${dataset.data.length} rows`}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                {dataset.columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={cn(
                      "px-3 py-2 text-left text-xs font-medium cursor-pointer hover:bg-accent transition-colors whitespace-nowrap",
                      sortCol === col ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      <ArrowUpDown size={12} className={cn("opacity-40", sortCol === col && "opacity-100")} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row, ri) => (
                <tr key={ri} className="border-t border-border hover:bg-muted/50 transition-colors">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{page * PAGE_SIZE + ri + 1}</td>
                  {dataset.columns.map((col) => (
                    <td key={col} className="px-3 py-2 whitespace-nowrap">
                      {typeof row[col] === "number" ? (
                        <span className="font-mono text-xs">{row[col]}</span>
                      ) : (
                        row[col]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={dataset.columns.length + 1} className="px-3 py-8 text-center text-muted-foreground">No matching rows</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={14} /> Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Datasets() {
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Datasets</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage data sources for your analysis</p>
        </div>
        <Button disabled>
          <Upload size={16} />
          Upload Dataset
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sampleDatasets.map((ds, i) => (
          <Card key={i} className="cursor-pointer hover:shadow-md transition-all p-4" onClick={() => setActiveDataset(ds)}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: ds.color }}>
                <ds.icon size={20} color={ds.iconColor} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{ds.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{ds.type}</Badge>
                  <span>{ds.data.length} rows</span>
                  <span>{ds.updated}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground mt-6">
        <Database size={32} />
        <p>Connect your data sources or upload files to power your analysis pipeline.</p>
        <p className="text-xs">Supports CSV, Excel, JSON, and API connections.</p>
      </div>

      {activeDataset && (
        <DataViewer dataset={activeDataset} onClose={() => setActiveDataset(null)} />
      )}
    </div>
  );
}
