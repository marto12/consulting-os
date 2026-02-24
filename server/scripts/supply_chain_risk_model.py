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
        "supplier_count": 12,
        "single_source_pct": 0.35,
        "lead_time_days": 48,
        "disruption_probability": 0.18,
    }
    params = merge_defaults(defaults, read_input())

    suppliers = float(params.get("supplier_count", 12))
    single_source = float(params.get("single_source_pct", 0.35))
    lead_time = float(params.get("lead_time_days", 48))
    disruption_prob = float(params.get("disruption_probability", 0.18))

    concentration_penalty = max(0.0, 1.0 - min(suppliers / 20.0, 1.0))
    risk_score = (single_source * 60.0) + (disruption_prob * 30.0) + (lead_time / 60.0 * 10.0) + (concentration_penalty * 5.0)
    risk_score = round(min(risk_score, 100.0), 2)

    expected_delay = round(lead_time * disruption_prob * (1 + single_source), 1)

    output = {
        "headline": "Supply chain stress test complete",
        "expected_delay_days": expected_delay,
        "risk_score": risk_score,
    }

    print(json.dumps(output))
