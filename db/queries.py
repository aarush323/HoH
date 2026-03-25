import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from db.postgres import get_connection




def get_total_events() -> int:
    with get_connection() as conn:
        return conn.execute(text("SELECT COUNT(*) FROM weekly_features")).scalar() or 0

def get_all_customers_with_risk() -> list[dict]:
    with get_connection() as conn:
        # Fetch the latest prediction and associated signals for each customer
        rows = conn.execute(text("""
            SELECT
                c.customer_id, c.customer_segment, c.product_type,
                mp.ensemble_score, mp.risk_band, mp.observation_week,
                wf.salary_delay_days, wf.auto_debit_failures, wf.savings_drawdown_pct, wf.utility_payment_delay_days,
                (SELECT COUNT(*) FROM stress_context sc WHERE sc.prediction_id = mp.id) > 0 as has_analysis,
                (SELECT COUNT(*) FROM interventions i WHERE i.prediction_id = mp.id) > 0 as has_outreach
            FROM customers c
            JOIN model_predictions mp ON c.customer_id = mp.customer_id
            JOIN weekly_features wf ON c.customer_id = wf.customer_id AND mp.observation_week = wf.observation_week
            WHERE mp.predicted_at = (
                SELECT MAX(mp2.predicted_at)
                FROM model_predictions mp2
                WHERE mp2.customer_id = c.customer_id
            )
        """)).fetchall()

    result = []
    for row in rows:
        r = row._mapping
        result.append({
            "customer_id":      r["customer_id"],
            "name":             f"Customer {r['customer_id']}",
            "risk_score":       float(r["ensemble_score"]) if r["ensemble_score"] is not None else 0.0,
            "risk_level":       r["risk_band"] or "Low",
            "observation_week": str(r["observation_week"]),
            "product_type":     r["product_type"],
            "customer_segment": r["customer_segment"],
            "pipeline_status": {
                "ingested": True,
                "scored":   True,
                "analysed": bool(r["has_analysis"]),
                "outreach": bool(r["has_outreach"])
            },
            "signals": {
                "salary_delay":      int(r["salary_delay_days"] or 0),
                "auto_debit_failures": int(r["auto_debit_failures"] or 0),
                "savings_drawdown":   float(r["savings_drawdown_pct"] or 0.0),
                "utility_delay":      int(r["utility_payment_delay_days"] or 0)
            }
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

def get_score_details(customer_id: str) -> dict | None:
    with get_connection() as conn:
        prediction = conn.execute(text("""
            SELECT * FROM model_predictions
            WHERE customer_id = :cid
            ORDER BY predicted_at DESC
            LIMIT 1
        """), {"cid": customer_id}).fetchone()

        if not prediction:
            return None

        shap = conn.execute(text("""
            SELECT feature_name AS feature, shap_value AS contribution, feature_value AS value
            FROM shap_explanations
            WHERE prediction_id = :pid
            ORDER BY ABS(shap_value) DESC
        """), {"pid": prediction.id}).fetchall()

        return {
            "customer_id":      prediction.customer_id,
            "risk_score":       float(prediction.ensemble_score),
            "lgb_p":            float(prediction.lightgbm_score) if prediction.lightgbm_score else None,
            "gru_p":            float(prediction.gru_score) if prediction.gru_score else None,
            "risk_level":       prediction.risk_band,
            "shap_factors":     [dict(r._mapping) for r in shap],
            "observation_week": str(prediction.observation_week),
            "model_version":    prediction.model_version
        }

def get_stress_analysis(customer_id: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(text("""
            SELECT * FROM stress_context
            WHERE customer_id = :cid
            ORDER BY created_at DESC
            LIMIT 1
        """), {"cid": customer_id}).fetchone()
    
    return dict(row._mapping) if row else None

def get_customer_detail_overview(customer_id: str) -> dict | None:
    profile = get_customer_full_profile(customer_id)
    if not profile:
        return None
    
    score = get_score_details(customer_id)
    stress = get_stress_analysis(customer_id)
    audit = get_audit_log(customer_id)
    
    return {
        "profile": profile,
        "score": score,
        "stress": stress,
        "audit": audit
    }


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

def get_weekly_observations_live(customer_id: str) -> list[dict]:
    """
    Returns all weekly_features rows for this customer
    ordered by observation_week ASC.
    Returns them formatted as kafka_message dicts —
    same exact format as get_latest_as_kafka_message() returns.
    """
    with get_connection() as conn:
        rows = conn.execute(text("""
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
                wf.customer_service_calls, wf.will_default_next_2_4_weeks,
                wf.emi_bounced_flag
            FROM customers c
            JOIN weekly_features wf ON c.customer_id = wf.customer_id
            WHERE c.customer_id = :cid
            ORDER BY wf.observation_week ASC
        """), {"cid": customer_id}).fetchall()

    result = []
    for row in rows:
        result.append({
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
            "emi_bounced_flag":               bool(getattr(row, "emi_bounced_flag", False))
        })
    return result
def store_ml_prediction(payload: dict) -> int:
    """
    Stores the ML ensemble result and all associated SHAP factors.
    Returns the new prediction_id.
    """
    with get_connection() as conn:
        with conn.begin():
            # 1. Insert prediction
            res = conn.execute(text("""
                INSERT INTO model_predictions (
                    customer_id, observation_week, 
                    lightgbm_score, gru_score, ensemble_score, 
                    risk_band, model_version
                ) VALUES (
                    :cid, :oweek, 
                    :lgb, :gru, :ensemble, 
                    :band, :version
                ) RETURNING id
            """), {
                "cid":      payload["customer_id"],
                "oweek":    payload["observation_week"],
                "lgb":      payload.get("lightgbm_score"),
                "gru":      payload.get("gru_score"),
                "ensemble": payload["risk_score"],
                "band":     payload["risk_level"],
                "version":  payload.get("model_version", "ensemble-2.0.0")
            })
            prediction_id = res.scalar()

            # 2. Bulk insert SHAP factors
            shap_factors = payload.get("shap_factors", [])
            if shap_factors:
                # We use rank for ordering in the UI later
                for i, factor in enumerate(shap_factors):
                    conn.execute(text("""
                        INSERT INTO shap_explanations (
                            prediction_id, customer_id, feature_name, 
                            shap_value, feature_value, rank
                        ) VALUES (
                            :pid, :cid, :feature, 
                            :sval, :fval, :rank
                        )
                    """), {
                        "pid":     prediction_id,
                        "cid":     payload["customer_id"],
                        "feature": factor["feature"],
                        "sval":    factor["contribution"],
                        "fval":    factor["value"],
                        "rank":    i + 1
                    })

            return prediction_id
