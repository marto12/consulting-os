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
  availableColumns?: string[];
}

export async function generateChartSpec(
  datasetName: string,
  columns: string[],
  sampleRows: Record<string, any>[],
  userPrompt: string
): Promise<ChartSpec> {
  if (!hasApiKey()) {
    return getMockChartSpec(columns, sampleRows, userPrompt);
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
  "yAxisKeys": ["column1", "column2"],
  "xAxisLabel": "Label for X axis",
  "yAxisLabel": "Label for Y axis",
  "colors": ["#8884d8", "#82ca9d", "#ffc658"],
  "nameKey": "column for pie chart segment names (only for pie charts)",
  "valueKey": "column for pie chart values (only for pie charts)",
  "stacked": false
}

CRITICAL RULES:
- Pay close attention to which specific columns/series the user asks for. If they say "chart Sales by Region", only include "Sales" in yAxisKeys, NOT all numeric columns.
- If the user mentions specific column names, ONLY include those columns in yAxisKeys.
- If the user says "all" or is vague about which columns, include all relevant numeric columns.
- Choose the most appropriate chart type for the data and user request.
- For pie charts, set nameKey and valueKey instead of xAxisKey/yAxisKeys.
- Colors should be visually distinct and professional.
- xAxisKey should be a categorical or time column.
- yAxisKeys should be numeric columns.
- Only use columns that exist in the dataset.`;

  const userMessage = `Dataset: "${datasetName}"
Columns: ${JSON.stringify(columns)}
Sample data (first ${sampleRows.length} rows):
${JSON.stringify(sampleRows.slice(0, 5), null, 2)}

User request: ${userPrompt}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || "";
    const spec = extractJson(content) as ChartSpec;
    spec.availableColumns = columns;
    return spec;
  } catch (err) {
    console.error("Chart generation LLM error, falling back to mock:", err);
    return getMockChartSpec(columns, sampleRows, userPrompt);
  }
}

function inferColumnTypes(columns: string[], sampleRows: Record<string, any>[]): { numeric: string[]; categorical: string[] } {
  const numeric: string[] = [];
  const categorical: string[] = [];

  for (const col of columns) {
    const values = sampleRows.map(r => r[col]).filter(v => v !== null && v !== undefined);
    const numericCount = values.filter(v => {
      const n = Number(v);
      return !isNaN(n) && typeof v !== 'boolean';
    }).length;

    if (values.length > 0 && numericCount / values.length > 0.7) {
      numeric.push(col);
    } else {
      categorical.push(col);
    }
  }

  return { numeric, categorical };
}

function parseRequestedColumns(prompt: string, allColumns: string[]): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const mentioned: string[] = [];

  for (const col of allColumns) {
    if (lowerPrompt.includes(col.toLowerCase())) {
      mentioned.push(col);
    }
  }

  return mentioned;
}

function getMockChartSpec(columns: string[], sampleRows: Record<string, any>[], userPrompt: string): ChartSpec {
  const lowerPrompt = userPrompt.toLowerCase();

  const { numeric: numericCols, categorical: categoryCols } = inferColumnTypes(columns, sampleRows);

  const mentionedCols = parseRequestedColumns(userPrompt, columns);
  const mentionedNumeric = mentionedCols.filter(c => numericCols.includes(c));
  const mentionedCategorical = mentionedCols.filter(c => categoryCols.includes(c));

  let chartType: ChartSpec["chartType"] = "bar";
  if (lowerPrompt.includes("pie")) chartType = "pie";
  else if (lowerPrompt.includes("line") || lowerPrompt.includes("trend") || lowerPrompt.includes("over time")) chartType = "line";
  else if (lowerPrompt.includes("area")) chartType = "area";
  else if (lowerPrompt.includes("scatter") || lowerPrompt.includes("correlation")) chartType = "scatter";

  const xKey = mentionedCategorical[0] || categoryCols[0] || columns[0];

  let yKeys: string[];
  if (mentionedNumeric.length > 0) {
    yKeys = mentionedNumeric;
  } else if (numericCols.length > 0) {
    yKeys = numericCols.slice(0, 3);
  } else {
    yKeys = columns.filter(c => c !== xKey).slice(0, 1);
    if (yKeys.length === 0) yKeys = [columns[0]];
  }

  const defaultColors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE", "#FF8042", "#00C49F"];

  if (chartType === "pie") {
    const pieValue = mentionedNumeric[0] || yKeys[0];
    const pieName = mentionedCategorical[0] || xKey;
    return {
      chartType: "pie",
      title: `Distribution of ${pieValue} by ${pieName}`,
      description: `Pie chart showing ${pieValue} distribution across ${pieName}`,
      xAxisKey: pieName,
      yAxisKeys: [pieValue],
      nameKey: pieName,
      valueKey: pieValue,
      colors: defaultColors,
      availableColumns: columns,
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
    stacked: lowerPrompt.includes("stacked"),
    availableColumns: columns,
  };
}
