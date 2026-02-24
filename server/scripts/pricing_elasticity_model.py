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
        "current_price": 120.0,
        "proposed_price": 132.0,
        "baseline_volume": 50000,
        "elasticity": -1.2,
    }
    params = merge_defaults(defaults, read_input())

    current_price = float(params.get("current_price", 120.0))
    proposed_price = float(params.get("proposed_price", 132.0))
    baseline_volume = float(params.get("baseline_volume", 50000))
    elasticity = float(params.get("elasticity", -1.2))

    price_change_pct = (proposed_price - current_price) / current_price
    volume_change_pct = elasticity * price_change_pct
    projected_volume = round(baseline_volume * (1 + volume_change_pct), 0)

    baseline_revenue = current_price * baseline_volume
    projected_revenue = proposed_price * projected_volume
    revenue_change_pct = round((projected_revenue - baseline_revenue) / baseline_revenue * 100, 2)
    margin_change_pct = round(revenue_change_pct - 2.5, 2)

    output = {
        "headline": "Pricing scenario evaluated",
        "projected_volume": projected_volume,
        "revenue_change_pct": revenue_change_pct,
        "margin_change_pct": margin_change_pct,
    }

    print(json.dumps(output))
