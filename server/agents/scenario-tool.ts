export interface ScenarioInput {
  baselineRevenue: number;
  growthRate: number;
  costReduction: number;
  timeHorizonYears: number;
  volatility?: number;
}

export interface ScenarioOutput {
  baseline: {
    year: number;
    revenue: number;
    costs: number;
    profit: number;
  }[];
  optimistic: {
    year: number;
    revenue: number;
    costs: number;
    profit: number;
  }[];
  pessimistic: {
    year: number;
    revenue: number;
    costs: number;
    profit: number;
  }[];
  summary: {
    baselineNPV: number;
    optimisticNPV: number;
    pessimisticNPV: number;
    expectedValue: number;
    riskAdjustedReturn: number;
  };
}

export function runScenarioTool(params: ScenarioInput): ScenarioOutput {
  const {
    baselineRevenue,
    growthRate,
    costReduction,
    timeHorizonYears,
    volatility = 0.15,
  } = params;

  const discountRate = 0.1;
  const baseCostRatio = 0.7;

  function buildScenario(
    revenueMultiplier: number,
    costMultiplier: number
  ) {
    const years = [];
    let currentRevenue = baselineRevenue;
    for (let y = 1; y <= timeHorizonYears; y++) {
      const adjustedGrowth = growthRate * revenueMultiplier;
      currentRevenue = currentRevenue * (1 + adjustedGrowth);
      const costs =
        currentRevenue * baseCostRatio * costMultiplier * (1 - costReduction);
      years.push({
        year: y,
        revenue: Math.round(currentRevenue * 100) / 100,
        costs: Math.round(costs * 100) / 100,
        profit: Math.round((currentRevenue - costs) * 100) / 100,
      });
    }
    return years;
  }

  const baseline = buildScenario(1.0, 1.0);
  const optimistic = buildScenario(1.0 + volatility, 1.0 - volatility * 0.5);
  const pessimistic = buildScenario(1.0 - volatility, 1.0 + volatility * 0.5);

  function npv(scenario: { profit: number }[]) {
    return scenario.reduce((sum, s, i) => {
      return sum + s.profit / Math.pow(1 + discountRate, i + 1);
    }, 0);
  }

  const baselineNPV = Math.round(npv(baseline) * 100) / 100;
  const optimisticNPV = Math.round(npv(optimistic) * 100) / 100;
  const pessimisticNPV = Math.round(npv(pessimistic) * 100) / 100;
  const expectedValue =
    Math.round(
      (optimisticNPV * 0.25 + baselineNPV * 0.5 + pessimisticNPV * 0.25) * 100
    ) / 100;
  const riskAdjustedReturn =
    Math.round(
      ((expectedValue / baselineRevenue - 1) * 100 * 100) / 100
    ) / 100;

  return {
    baseline,
    optimistic,
    pessimistic,
    summary: {
      baselineNPV,
      optimisticNPV,
      pessimisticNPV,
      expectedValue,
      riskAdjustedReturn,
    },
  };
}
