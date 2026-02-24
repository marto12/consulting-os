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


def risk_band(fuel_index):
    if fuel_index >= 115:
        return "high"
    if fuel_index >= 105:
        return "medium"
    return "low"


if __name__ == "__main__":
    defaults = {
        "origin": "Chicago",
        "destination": "Dallas",
        "mode": "truck",
        "horizon_months": 6,
        "fuel_price_index": 108,
    }
    params = merge_defaults(defaults, read_input())

    horizon = max(int(params.get("horizon_months", 6)), 1)
    fuel_index = float(params.get("fuel_price_index", 108))

    series = []
    base = 100.0
    fuel_drag = (fuel_index - 100.0) * 0.08
    for i in range(horizon):
        trend = i * 2.5
        volume_index = round(base + trend - fuel_drag, 2)
        series.append({"month": i + 1, "volume_index": volume_index})

    output = {
        "headline": "Freight forecast ready",
        "origin": params["origin"],
        "destination": params["destination"],
        "mode": params["mode"],
        "forecast_series": series,
        "risk_band": risk_band(fuel_index),
    }

    print(json.dumps(output))
