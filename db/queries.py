import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from db.postgres import get_connection


def _compute_base_score(row) -> tuple[float, str]:
    """Deterministic score with no noise — for list views and caching."""
    def val(obj, attr):
        v = getattr(obj, attr, 0)
        return float(v) if v is not None else 0.0

    score = min(0.99, (
        (val(row, "salary_delay_days") / 10)           * 0.25 +
        (val(row, "auto_debit_failures") / 5)          * 0.30 +
        (abs(val(row, "savings_drawdown_pct")) / 100)  * 0.25 +
        (val(row, "utility_payment_delay_days") / 10)  * 0.20
    ))
    level = "High" if score >= 0.70 else "Medium" if score >= 0.40 else "Low"
    return round(score, 4), level


def get_all_customers_with_risk() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(text("""
            SELECT
                c.customer_id, c.customer_segment, c.product_type,
                wf.salary_delay_days, wf.auto_debit_failures,
                wf.savings_drawdown_pct, wf.utility_payment_delay_days,
                wf.observation_week
            FROM customers c
            JOIN weekly_features wf ON c.customer_id = wf.customer_id
            WHERE wf.observation_week = (
                SELECT MAX(w2.observation_week)
                FROM weekly_features w2
                WHERE w2.customer_id = c.customer_id
            )
        """)).fetchall()

    result = []
    for row in rows:
        score, level = _compute_base_score(row)
        result.append({
            "customer_id":      row.customer_id,
            "name":             f"Customer {row.customer_id}",
            "risk_score":       score,
            "risk_level":       level,
            "observation_week": str(row.observation_week),
            "product_type":     row.product_type,
            "customer_segment": row.customer_segment,
        })

    return sorted(result, key=lambda x: x["risk_score"], reverse=True)


def get_customer_full_profile(customer_id: str) -> dict | None:
    with get_connection() as conn:
        customer = conn.execute(text("""
            SELECT * FROM customers WHERE customer_id = :cid
        """), {"cid": customer_id}).fetchone()

        if not customer:
            return None

        history = conn.execute(text("""
            SELECT * FROM weekly_features
            WHERE customer_id = :cid
            ORDER BY observation_week DESC
        """), {"cid": customer_id}).fetchall()

    return {
        "customer":       dict(customer._mapping),
        "weekly_history": [dict(r._mapping) for r in history],
    }


def get_latest_as_kafka_message(customer_id: str) -> dict | None:
    """
    Returns a dict shaped exactly like a Kafka producer message.
    Field names must match producer.py exactly — this goes directly into predict().
    """
    with get_connection() as conn:
        row = conn.execute(text("""
            SELECT
                c.customer_id, c.age, c.customer_segment, c.geography_zone,
                c.product_type, c.account_vintage_months, c.emi_to_income_ratio,
                wf.observation_week,
                wf.salary_delay_days, wf.salary_drop_pct,
                wf.avg_daily_balance_inr, wf.balance_trend_pct,
                wf.net_cashflow_ratio, wf.savings_drawdown_pct,
                wf.savings_withdrawal_count, wf.utility_payment_delay_days,
                wf.num_bills_paid_late_last_4w, wf.discretionary_spend_inr,
                wf.discretionary_vs_4w_avg_pct, wf.gambling_lottery_spend_inr,
                wf.gambling_4w_change_pct, wf.upi_to_lending_apps_count,
                wf.upi_to_lending_apps_amount_inr, wf.atm_vs_4w_avg_pct,
                wf.auto_debit_failures, wf.credit_card_utilization_pct,
                wf.credit_inquiries_last_30d, wf.paying_minimum_only_flag,
                wf.mobile_app_logins, wf.financial_stress_queries,
                wf.customer_service_calls, wf.will_default_next_2_4_weeks
            FROM customers c
            JOIN weekly_features wf ON c.customer_id = wf.customer_id
            WHERE c.customer_id = :cid
            ORDER BY wf.observation_week DESC
            LIMIT 1
        """), {"cid": customer_id}).fetchone()

    if not row:
        return None

    return {
        "customer_id":                    row.customer_id,
        "observation_week":               str(row.observation_week),
        "event_timestamp":                str(row.observation_week),
        "source":                         "db_fetch",
        "age":                            row.age,
        "customer_segment":               row.customer_segment,
        "geography_zone":                 row.geography_zone,
        "product_type":                   row.product_type,
        "account_vintage_months":         row.account_vintage_months,
        "emi_to_income_ratio":            float(row.emi_to_income_ratio),
        "salary_delay_days":              row.salary_delay_days,
        "salary_drop_pct":                float(row.salary_drop_pct),
        "avg_daily_balance_inr":          float(row.avg_daily_balance_inr),
        "balance_trend_pct":              float(row.balance_trend_pct),
        "net_cashflow_ratio":             float(row.net_cashflow_ratio),
        "savings_drawdown_pct":           float(row.savings_drawdown_pct),
        "savings_withdrawal_count":       row.savings_withdrawal_count,
        "utility_payment_delay_days":     row.utility_payment_delay_days,
        "num_bills_paid_late_last_4w":    row.num_bills_paid_late_last_4w,
        "discretionary_spend_inr":        float(row.discretionary_spend_inr),
        "discretionary_vs_4w_avg_pct":    float(row.discretionary_vs_4w_avg_pct),
        "gambling_lottery_spend_inr":     float(row.gambling_lottery_spend_inr),
        "gambling_4w_change_pct":         float(row.gambling_4w_change_pct),
        "upi_to_lending_apps_count":      row.upi_to_lending_apps_count,
        "upi_to_lending_apps_amount_inr": float(row.upi_to_lending_apps_amount_inr),
        "atm_vs_4w_avg_pct":              float(row.atm_vs_4w_avg_pct),
        "auto_debit_failures":            row.auto_debit_failures,
        "credit_card_utilization_pct":    float(row.credit_card_utilization_pct),
        "credit_inquiries_last_30d":      row.credit_inquiries_last_30d,
        "paying_minimum_only_flag":       bool(row.paying_minimum_only_flag),
        "mobile_app_logins":              row.mobile_app_logins,
        "financial_stress_queries":       row.financial_stress_queries,
        "customer_service_calls":         row.customer_service_calls,
        "will_default_next_2_4_weeks":    bool(row.will_default_next_2_4_weeks),
    }


def get_intervention_history(customer_id: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(text("""
            SELECT * FROM interventions
            WHERE customer_id = :cid
            ORDER BY created_at DESC
        """), {"cid": customer_id}).fetchall()
    return [dict(r._mapping) for r in rows]


def get_audit_log(customer_id: str = None) -> list[dict]:
    """
    Joins interventions with voice_sessions using column names
    from the existing postgre_schema.sql schema.
    """
    with get_connection() as conn:
        if customer_id:
            rows = conn.execute(text("""
                SELECT i.*, vs.outcome AS voice_outcome,
                       vs.turns_taken AS voice_turns,
                       vs.escalate AS voice_escalate,
                       vs.escalate_reason AS voice_escalate_reason
                FROM interventions i
                LEFT JOIN voice_sessions vs ON vs.intervention_id = i.id
                WHERE i.customer_id = :cid
                ORDER BY i.created_at DESC
                LIMIT 500
            """), {"cid": customer_id}).fetchall()
        else:
            rows = conn.execute(text("""
                SELECT i.*, vs.outcome AS voice_outcome,
                       vs.turns_taken AS voice_turns,
                       vs.escalate AS voice_escalate,
                       vs.escalate_reason AS voice_escalate_reason
                FROM interventions i
                LEFT JOIN voice_sessions vs ON vs.intervention_id = i.id
                ORDER BY i.created_at DESC
                LIMIT 500
            """)).fetchall()
    return [dict(r._mapping) for r in rows]
