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


if __name__ == "__main__":
    defaults = {
        "industry": "Manufacturing",
        "shock_value": 100.0,
        "region": "US",
        "year": 2026,
    }
    params = merge_defaults(defaults, read_input())

    shock_value = float(params.get("shock_value", 100.0))
    multiplier = 1.35
    gdp_impact = round(shock_value * multiplier, 2)
    employment_impact = int(round(shock_value * 8.5))

    sector_impacts = [
        {"sector": "Suppliers", "impact": round(shock_value * 0.42, 2)},
        {"sector": "Logistics", "impact": round(shock_value * 0.18, 2)},
        {"sector": "Services", "impact": round(shock_value * 0.22, 2)},
    ]

    output = {
        "headline": "Input-output run complete",
        "region": params["region"],
        "industry": params["industry"],
        "year": params["year"],
        "gdp_impact": gdp_impact,
        "employment_impact": employment_impact,
        "sector_impacts": sector_impacts,
    }

    print(json.dumps(output))
