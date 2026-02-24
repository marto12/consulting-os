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


def bucket(probability):
    if probability >= 0.65:
        return "high"
    if probability >= 0.35:
        return "medium"
    return "low"


if __name__ == "__main__":
    defaults = {
        "account_tenure_months": 18,
        "nps": 12,
        "support_tickets": 5,
        "usage_change_pct": -18,
    }
    params = merge_defaults(defaults, read_input())

    tenure = float(params.get("account_tenure_months", 18))
    nps = float(params.get("nps", 12))
    tickets = float(params.get("support_tickets", 5))
    usage_change = float(params.get("usage_change_pct", -18))

    base = 0.22
    risk = base + max(0.0, -usage_change) * 0.01 + tickets * 0.03 - nps * 0.004 - tenure * 0.002
    risk = max(0.05, min(risk, 0.95))

    output = {
        "headline": "Churn risk scored",
        "churn_probability": round(risk, 2),
        "risk_bucket": bucket(risk),
    }

    print(json.dumps(output))
