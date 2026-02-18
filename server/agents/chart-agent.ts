import OpenAI from "openai";

function hasApiKey(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  );
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
  }
  const objMatch = text.match(/[\[{][\s\S]*[\]}]/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }
  return JSON.parse(text);
}

export interface ChartSpec {
  chartType: "bar" | "line" | "pie" | "area" | "scatter";
  title: string;
  description: string;
  xAxisKey: string;
  yAxisKeys: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
  nameKey?: string;
  valueKey?: string;
  stacked?: boolean;
}

export async function generateChartSpec(
  datasetName: string,
  columns: string[],
  sampleRows: Record<string, any>[],
  userPrompt: string
): Promise<ChartSpec> {
  if (!hasApiKey()) {
    return getMockChartSpec(columns, userPrompt);
  }

  const client = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!,
  });

  const systemPrompt = `You are a data visualization expert. Given a dataset schema and sample data, generate a chart specification.

Return a JSON object with this exact structure:
{
  "chartType": "bar" | "line" | "pie" | "area" | "scatter",
  "title": "Chart title",
  "description": "Brief description of what the chart shows",
  "xAxisKey": "column name for x-axis (or category axis)",
  "yAxisKeys": ["column1", "column2"],  // columns to plot as values
  "xAxisLabel": "Label for X axis",
  "yAxisLabel": "Label for Y axis",
  "colors": ["#8884d8", "#82ca9d", "#ffc658"],  // hex colors for each series
  "nameKey": "column for pie chart segment names (only for pie charts)",
  "valueKey": "column for pie chart values (only for pie charts)",
  "stacked": false  // whether bar/area chart should be stacked
}

Rules:
- Choose the most appropriate chart type for the data and user request
- For pie charts, set nameKey and valueKey instead of xAxisKey/yAxisKeys
- Colors should be visually distinct and professional
- xAxisKey should be a categorical or time column
- yAxisKeys should be numeric columns
- Only use columns that exist in the dataset`;

  const userMessage = `Dataset: "${datasetName}"
Columns: ${JSON.stringify(columns)}
Sample data (first ${sampleRows.length} rows):
${JSON.stringify(sampleRows.slice(0, 5), null, 2)}

User request: ${userPrompt}`;

  const response = await client.chat.completions.create({
    model: "gpt-5-nano",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 1024,
  });

  const content = response.choices[0]?.message?.content || "";
  return extractJson(content) as ChartSpec;
}

function getMockChartSpec(columns: string[], userPrompt: string): ChartSpec {
  const lowerPrompt = userPrompt.toLowerCase();
  const numericCols = columns.filter(c => !["name", "label", "category", "date", "month", "year", "id", "type", "status"].some(k => c.toLowerCase().includes(k)));
  const categoryCols = columns.filter(c => ["name", "label", "category", "date", "month", "year", "type", "status"].some(k => c.toLowerCase().includes(k)));

  let chartType: ChartSpec["chartType"] = "bar";
  if (lowerPrompt.includes("pie")) chartType = "pie";
  else if (lowerPrompt.includes("line") || lowerPrompt.includes("trend")) chartType = "line";
  else if (lowerPrompt.includes("area")) chartType = "area";
  else if (lowerPrompt.includes("scatter")) chartType = "scatter";

  const xKey = categoryCols[0] || columns[0];
  const yKeys = numericCols.length > 0 ? numericCols.slice(0, 3) : [columns[1] || columns[0]];

  const defaultColors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE"];

  if (chartType === "pie") {
    return {
      chartType: "pie",
      title: `Distribution of ${yKeys[0]} by ${xKey}`,
      description: `Pie chart showing ${yKeys[0]} distribution`,
      xAxisKey: xKey,
      yAxisKeys: yKeys,
      nameKey: xKey,
      valueKey: yKeys[0],
      colors: defaultColors,
    };
  }

  return {
    chartType,
    title: `${yKeys.join(", ")} by ${xKey}`,
    description: `${chartType} chart of ${yKeys.join(", ")} across ${xKey}`,
    xAxisKey: xKey,
    yAxisKeys: yKeys,
    xAxisLabel: xKey,
    yAxisLabel: yKeys.join(", "),
    colors: defaultColors.slice(0, yKeys.length),
    stacked: false,
  };
}
