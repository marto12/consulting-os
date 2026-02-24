import json
import sys


def read_input():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def merge_defaults(defaults, payload):
    data = defaults.copy()
    if isinstance(payload, dict):
        for key, value in payload.items():
            if value is not None:
                data[key] = value
    return data


def shock_adjustment(shock):
    adjustments = {
        "energy_spike": (-0.4, 0.6, 0.2),
        "demand_surge": (0.5, 0.2, -0.1),
        "financial_tightening": (-0.6, -0.1, 0.3),
    }
    return adjustments.get(shock, (0.0, 0.0, 0.0))


if __name__ == "__main__":
    defaults = {
        "baseline_gdp": 2.1,
        "baseline_inflation": 3.2,
        "policy_rate": 4.75,
        "shock": "energy_spike",
    }
    params = merge_defaults(defaults, read_input())

    gdp_base = float(params.get("baseline_gdp", 2.1))
    inflation_base = float(params.get("baseline_inflation", 3.2))
    policy_rate = float(params.get("policy_rate", 4.75))
    shock = str(params.get("shock", "energy_spike"))

    gdp_adj, infl_adj, unemp_adj = shock_adjustment(shock)
    scenario = []
    for q in range(1, 5):
        gdp_growth = round(gdp_base + gdp_adj - (policy_rate - 4.0) * 0.08, 2)
        inflation = round(inflation_base + infl_adj - (policy_rate - 4.0) * 0.05, 2)
        unemployment = round(4.2 + unemp_adj + (policy_rate - 4.0) * 0.06, 2)
        scenario.append({
            "quarter": f"Q{q}",
            "gdp_growth": gdp_growth,
            "inflation": inflation,
            "unemployment": unemployment,
        })

    output = {
        "headline": "Macro scenario generated",
        "shock": shock,
        "scenario": scenario,
    }

    print(json.dumps(output))
