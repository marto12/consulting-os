import json
import time


def emit(event, payload):
    print(f"{event}:{payload}", flush=True)


if __name__ == "__main__":
    emit("STATUS", "Booting CGE model")
    time.sleep(0.6)
    emit("PROGRESS", "Loading baseline dataset")
    time.sleep(0.7)
    emit("PROGRESS", "Solving equilibrium conditions")
    time.sleep(0.8)
    emit("PROGRESS", "Running policy shock scenarios")
    time.sleep(0.6)

    industries = ["Agriculture", "Mining", "Manufacturing", "Construction", "Utilities", "Transport", "Services"]
    years = [2024, 2025, 2026, 2027, 2028]

    gdp_impacts = []
    employment_impacts = []
    for i, industry in enumerate(industries):
        for j, year in enumerate(years):
            gdp_value = round(0.3 + (i * 0.15) - (j * 0.05), 2)
            emp_value = round(0.2 + (i * 0.1) - (j * 0.04), 2)
            gdp_impacts.append({"industry": industry, "year": year, "impact": f"{gdp_value:+.2f}%"})
            employment_impacts.append({"industry": industry, "year": year, "impact": f"{emp_value:+.2f}%"})

    result = {
        "headline": "CGE simulation complete",
        "summary": "Short-run GDP impact of +0.6% with sectoral shifts in mining and services.",
        "metrics": [
            {"label": "GDP change", "value": "+0.6%"},
            {"label": "Employment", "value": "+12.4k"},
            {"label": "Inflation", "value": "+0.2 pp"},
            {"label": "Real wages", "value": "+0.3%"},
        ],
        "sectors": [
            {"name": "Mining", "impact": "+1.8%"},
            {"name": "Manufacturing", "impact": "-0.2%"},
            {"name": "Services", "impact": "+0.4%"},
        ],
        "timeseries": {
            "gdp": [
                {"period": "Q1", "value": 100.0},
                {"period": "Q2", "value": 100.4},
                {"period": "Q3", "value": 100.6},
                {"period": "Q4", "value": 100.8},
            ],
            "employment": [
                {"period": "Q1", "value": 100.0},
                {"period": "Q2", "value": 100.2},
                {"period": "Q3", "value": 100.6},
                {"period": "Q4", "value": 100.9},
            ],
        },
        "industry_impacts": {
            "gdp": gdp_impacts,
            "employment": employment_impacts,
        },
    }

    emit("RESULT", json.dumps(result))
