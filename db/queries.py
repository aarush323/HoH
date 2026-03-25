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
        rows = conn.execute(
            text("""
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
        """)
        ).fetchall()

    result = []
    for row in rows:
        r = row._mapping
        result.append(
            {
                "customer_id": r["customer_id"],
                "name": f"Customer {r['customer_id']}",
                "risk_score": float(r["ensemble_score"])
                if r["ensemble_score"] is not None
                else 0.0,
                "risk_level": r["risk_band"] or "Low",
                "observation_week": str(r["observation_week"]),
                "product_type": r["product_type"],
                "customer_segment": r["customer_segment"],
                "pipeline_status": {
                    "ingested": True,
                    "scored": True,
                    "analysed": bool(r["has_analysis"]),
                    "outreach": bool(r["has_outreach"]),
                },
                "signals": {
                    "salary_delay": int(r["salary_delay_days"] or 0),
                    "auto_debit_failures": int(r["auto_debit_failures"] or 0),
                    "savings_drawdown": float(r["savings_drawdown_pct"] or 0.0),
                    "utility_delay": int(r["utility_payment_delay_days"] or 0),
                },
            }
        )

    return sorted(result, key=lambda x: x["risk_score"], reverse=True)


def get_customer_full_profile(customer_id: str) -> dict | None:
    with get_connection() as conn:
        customer = conn.execute(
            text("""
            SELECT * FROM customers WHERE customer_id = :cid
        """),
            {"cid": customer_id},
        ).fetchone()

        if not customer:
            return None

        history = conn.execute(
            text("""
            SELECT * FROM weekly_features
            WHERE customer_id = :cid
            ORDER BY observation_week DESC
        """),
            {"cid": customer_id},
        ).fetchall()

    return {
        "customer": dict(customer._mapping),
        "weekly_history": [dict(r._mapping) for r in history],
    }


def get_latest_as_kafka_message(customer_id: str) -> dict | None:
    """
    Returns a dict shaped exactly like a Kafka producer message.
    Field names must match producer.py exactly — this goes directly into predict().
    """
    with get_connection() as conn:
        row = conn.execute(
            text("""
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
        """),
            {"cid": customer_id},
        ).fetchone()

    if not row:
        return None

    return {
        "customer_id": row.customer_id,
        "observation_week": str(row.observation_week),
        "event_timestamp": str(row.observation_week),
        "source": "db_fetch",
        "age": row.age,
        "customer_segment": row.customer_segment,
        "geography_zone": row.geography_zone,
        "product_type": row.product_type,
        "account_vintage_months": row.account_vintage_months,
        "emi_to_income_ratio": float(row.emi_to_income_ratio),
        "salary_delay_days": row.salary_delay_days,
        "salary_drop_pct": float(row.salary_drop_pct),
        "avg_daily_balance_inr": float(row.avg_daily_balance_inr),
        "balance_trend_pct": float(row.balance_trend_pct),
        "net_cashflow_ratio": float(row.net_cashflow_ratio),
        "savings_drawdown_pct": float(row.savings_drawdown_pct),
        "savings_withdrawal_count": row.savings_withdrawal_count,
        "utility_payment_delay_days": row.utility_payment_delay_days,
        "num_bills_paid_late_last_4w": row.num_bills_paid_late_last_4w,
        "discretionary_spend_inr": float(row.discretionary_spend_inr),
        "discretionary_vs_4w_avg_pct": float(row.discretionary_vs_4w_avg_pct),
        "gambling_lottery_spend_inr": float(row.gambling_lottery_spend_inr),
        "gambling_4w_change_pct": float(row.gambling_4w_change_pct),
        "upi_to_lending_apps_count": row.upi_to_lending_apps_count,
        "upi_to_lending_apps_amount_inr": float(row.upi_to_lending_apps_amount_inr),
        "atm_vs_4w_avg_pct": float(row.atm_vs_4w_avg_pct),
        "auto_debit_failures": row.auto_debit_failures,
        "credit_card_utilization_pct": float(row.credit_card_utilization_pct),
        "credit_inquiries_last_30d": row.credit_inquiries_last_30d,
        "paying_minimum_only_flag": bool(row.paying_minimum_only_flag),
        "mobile_app_logins": row.mobile_app_logins,
        "financial_stress_queries": row.financial_stress_queries,
        "customer_service_calls": row.customer_service_calls,
        "will_default_next_2_4_weeks": bool(row.will_default_next_2_4_weeks),
    }


def get_intervention_history(customer_id: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            text("""
            SELECT * FROM interventions
            WHERE customer_id = :cid
            ORDER BY created_at DESC
        """),
            {"cid": customer_id},
        ).fetchall()
    return [dict(r._mapping) for r in rows]


def get_score_details(customer_id: str) -> dict | None:
    with get_connection() as conn:
        prediction = conn.execute(
            text("""
            SELECT * FROM model_predictions
            WHERE customer_id = :cid
            ORDER BY predicted_at DESC
            LIMIT 1
        """),
            {"cid": customer_id},
        ).fetchone()

        if not prediction:
            return None

        shap = conn.execute(
            text("""
            SELECT feature_name AS feature, shap_value AS contribution, feature_value AS value
            FROM shap_explanations
            WHERE prediction_id = :pid
            ORDER BY ABS(shap_value) DESC
        """),
            {"pid": prediction.id},
        ).fetchall()

        return {
            "customer_id": prediction.customer_id,
            "risk_score": float(prediction.ensemble_score),
            "lgb_p": float(prediction.lightgbm_score)
            if prediction.lightgbm_score is not None
            else None,
            "gru_p": float(prediction.gru_score)
            if prediction.gru_score is not None
            else None,
            "risk_level": prediction.risk_band,
            "shap_factors": [dict(r._mapping) for r in shap],
            "observation_week": str(prediction.observation_week),
            "model_version": prediction.model_version,
        }


def get_stress_analysis(customer_id: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            text("""
            SELECT * FROM stress_context
            WHERE customer_id = :cid
            ORDER BY created_at DESC
            LIMIT 1
        """),
            {"cid": customer_id},
        ).fetchone()

    return dict(row._mapping) if row else None


def get_customer_detail_overview(customer_id: str) -> dict | None:
    profile = get_customer_full_profile(customer_id)
    if not profile:
        return None

    score = get_score_details(customer_id)
    stress = get_stress_analysis(customer_id)
    audit = get_audit_log(customer_id)

    return {"profile": profile, "score": score, "stress": stress, "audit": audit}


def get_audit_log(customer_id: str = None) -> list[dict]:
    """
    Joins interventions with voice_sessions using column names
    from the existing postgre_schema.sql schema.
    """
    with get_connection() as conn:
        if customer_id:
            rows = conn.execute(
                text("""
                SELECT i.*, vs.outcome AS voice_outcome,
                       vs.turns_taken AS voice_turns,
                       vs.escalate AS voice_escalate,
                       vs.escalate_reason AS voice_escalate_reason
                FROM interventions i
                LEFT JOIN voice_sessions vs ON vs.intervention_id = i.id
                WHERE i.customer_id = :cid
                ORDER BY i.created_at DESC
                LIMIT 500
            """),
                {"cid": customer_id},
            ).fetchall()
        else:
            rows = conn.execute(
                text("""
                SELECT i.*, vs.outcome AS voice_outcome,
                       vs.turns_taken AS voice_turns,
                       vs.escalate AS voice_escalate,
                       vs.escalate_reason AS voice_escalate_reason
                FROM interventions i
                LEFT JOIN voice_sessions vs ON vs.intervention_id = i.id
                ORDER BY i.created_at DESC
                LIMIT 500
            """)
            ).fetchall()
    return [dict(r._mapping) for r in rows]


def get_weekly_observations_live(customer_id: str) -> list[dict]:
    """
    Returns all weekly_features rows for this customer
    ordered by observation_week ASC.
    Returns them formatted as kafka_message dicts —
    same exact format as get_latest_as_kafka_message() returns.
    """
    with get_connection() as conn:
        rows = conn.execute(
            text("""
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
                wf.emi_bounced_flag,
                wf.monthly_income_inr, wf.emi_amount_inr, wf.emi_due_this_week,
                wf.available_funds_inr, wf.emi_paid_flag, wf.missed_emi_count_rolling,
                wf.external_shock_flag, wf.shock_type
            FROM customers c
            JOIN weekly_features wf ON c.customer_id = wf.customer_id
            WHERE c.customer_id = :cid
            ORDER BY wf.observation_week ASC
        """),
            {"cid": customer_id},
        ).fetchall()

    result = []
    for row in rows:
        result.append(
            {
                "customer_id": row.customer_id,
                "observation_week": str(row.observation_week),
                "event_timestamp": str(row.observation_week),
                "source": "db_fetch",
                "age": row.age,
                "customer_segment": row.customer_segment,
                "geography_zone": row.geography_zone,
                "product_type": row.product_type,
                "account_vintage_months": row.account_vintage_months,
                "emi_to_income_ratio": float(row.emi_to_income_ratio),
                "salary_delay_days": row.salary_delay_days,
                "salary_drop_pct": float(row.salary_drop_pct),
                "avg_daily_balance_inr": float(row.avg_daily_balance_inr),
                "balance_trend_pct": float(row.balance_trend_pct),
                "net_cashflow_ratio": float(row.net_cashflow_ratio),
                "savings_drawdown_pct": float(row.savings_drawdown_pct),
                "savings_withdrawal_count": row.savings_withdrawal_count,
                "utility_payment_delay_days": row.utility_payment_delay_days,
                "num_bills_paid_late_last_4w": row.num_bills_paid_late_last_4w,
                "discretionary_spend_inr": float(row.discretionary_spend_inr),
                "discretionary_vs_4w_avg_pct": float(row.discretionary_vs_4w_avg_pct),
                "gambling_lottery_spend_inr": float(row.gambling_lottery_spend_inr),
                "gambling_4w_change_pct": float(row.gambling_4w_change_pct),
                "upi_to_lending_apps_count": row.upi_to_lending_apps_count,
                "upi_to_lending_apps_amount_inr": float(
                    row.upi_to_lending_apps_amount_inr
                ),
                "atm_vs_4w_avg_pct": float(row.atm_vs_4w_avg_pct),
                "auto_debit_failures": row.auto_debit_failures,
                "credit_card_utilization_pct": float(row.credit_card_utilization_pct),
                "credit_inquiries_last_30d": row.credit_inquiries_last_30d,
                "paying_minimum_only_flag": bool(row.paying_minimum_only_flag),
                "mobile_app_logins": row.mobile_app_logins,
                "financial_stress_queries": row.financial_stress_queries,
                "customer_service_calls": row.customer_service_calls,
                "will_default_next_2_4_weeks": bool(row.will_default_next_2_4_weeks),
                "emi_bounced_flag": bool(getattr(row, "emi_bounced_flag", False)),
                "monthly_income_inr": float(getattr(row, "monthly_income_inr", 0) or 0),
                "emi_amount_inr": float(getattr(row, "emi_amount_inr", 0) or 0),
                "emi_due_this_week": bool(getattr(row, "emi_due_this_week", False)),
                "available_funds_inr": float(
                    getattr(row, "available_funds_inr", 0) or 0
                ),
                "emi_paid_flag": bool(getattr(row, "emi_paid_flag", False)),
                "missed_emi_count_rolling": getattr(row, "missed_emi_count_rolling", 0),
                "external_shock_flag": bool(getattr(row, "external_shock_flag", False)),
                "shock_type": getattr(row, "shock_type", None),
            }
        )
    return result


def store_ml_prediction(payload: dict) -> int:
    """
    Stores the ML ensemble result and all associated SHAP factors.
    Returns the new prediction_id.
    """
    with get_connection() as conn:
        with conn.begin():
            # 1. Insert prediction
            res = conn.execute(
                text("""
                INSERT INTO model_predictions (
                    customer_id, observation_week, 
                    lightgbm_score, gru_score, ensemble_score, 
                    risk_band, model_version
                ) VALUES (
                    :cid, :oweek, 
                    :lgb, :gru, :ensemble, 
                    :band, :version
                ) RETURNING id
            """),
                {
                    "cid": payload["customer_id"],
                    "oweek": payload["observation_week"],
                    "lgb": payload.get("lightgbm_score"),
                    "gru": payload.get("gru_score"),
                    "ensemble": payload["risk_score"],
                    "band": payload["risk_level"],
                    "version": payload.get("model_version", "ensemble-2.0.0"),
                },
            )
            prediction_id = res.scalar()

            # 2. Bulk insert SHAP factors
            shap_factors = payload.get("shap_factors", [])
            if shap_factors:
                # We use rank for ordering in the UI later
                for i, factor in enumerate(shap_factors):
                    conn.execute(
                        text("""
                        INSERT INTO shap_explanations (
                            prediction_id, customer_id, feature_name, 
                            shap_value, feature_value, rank
                        ) VALUES (
                            :pid, :cid, :feature, 
                            :sval, :fval, :rank
                        )
                    """),
                        {
                            "pid": prediction_id,
                            "cid": payload["customer_id"],
                            "feature": factor["feature"],
                            "sval": factor["contribution"],
                            "fval": factor["value"],
                            "rank": i + 1,
                        },
                    )

            return prediction_id


def get_all_customers_tabular() -> list[dict]:
    """
    Returns all customers with their latest prediction and weekly features.
    Used for Dashboard/Portfolio 'All Customers' tab.
    """
    with get_connection() as conn:
        rows = conn.execute(
            text("""
            SELECT DISTINCT ON (c.customer_id)
                c.customer_id, c.name, c.customer_segment, c.product_type,
                c.loan_amount, c.relationship_value,
                mp.ensemble_score, mp.risk_band, mp.observation_week,
                wf.salary_delay_days, wf.auto_debit_failures, 
                wf.savings_drawdown_pct, wf.utility_payment_delay_days,
                (SELECT COUNT(*) > 0 FROM stress_context sc WHERE sc.customer_id = c.customer_id) as has_analysis,
                (SELECT COUNT(*) > 0 FROM interventions i WHERE i.customer_id = c.customer_id) as has_outreach,
                (SELECT i.selected_channel FROM interventions i 
                 WHERE i.customer_id = c.customer_id 
                 ORDER BY i.created_at DESC LIMIT 1) as last_channel,
                (SELECT i.outcome FROM interventions i 
                 WHERE i.customer_id = c.customer_id 
                 ORDER BY i.created_at DESC LIMIT 1) as last_outcome,
                (SELECT i.status FROM interventions i 
                 WHERE i.customer_id = c.customer_id 
                 ORDER BY i.created_at DESC LIMIT 1) as last_status
            FROM customers c
            LEFT JOIN model_predictions mp ON c.customer_id = mp.customer_id
            LEFT JOIN weekly_features wf ON c.customer_id = wf.customer_id 
                AND wf.observation_week = mp.observation_week
            ORDER BY c.customer_id, mp.predicted_at DESC NULLS LAST
        """)
        ).fetchall()

    result = []
    for row in rows:
        r = row._mapping
        result.append(
            {
                "customer_id": r["customer_id"],
                "name": r["name"] or f"Customer {r['customer_id']}",
                "risk_score": float(r["ensemble_score"])
                if r["ensemble_score"] is not None
                else 0.0,
                "risk_level": r["risk_band"] or "Low",
                "observation_week": str(r["observation_week"])
                if r["observation_week"]
                else None,
                "product_type": r["product_type"],
                "customer_segment": r["customer_segment"],
                "loan_amount": float(r["loan_amount"]) if r["loan_amount"] else 0.0,
                "pipeline_status": {
                    "ingested": True,
                    "scored": r["ensemble_score"] is not None,
                    "analysed": bool(r["has_analysis"]),
                    "outreach": bool(r["has_outreach"]),
                },
                "signals": {
                    "salary_delay": int(r["salary_delay_days"] or 0),
                    "auto_debit_failures": int(r["auto_debit_failures"] or 0),
                    "savings_drawdown": float(r["savings_drawdown_pct"] or 0.0),
                    "utility_delay": int(r["utility_payment_delay_days"] or 0),
                },
                "last_channel": r["last_channel"],
                "last_outcome": r["last_outcome"],
                "last_status": r["last_status"],
            }
        )

    return sorted(result, key=lambda x: x["risk_score"], reverse=True)


def get_voice_customers() -> list[dict]:
    """
    Returns customers who received voice interventions.
    Used for Dashboard/Portfolio 'Voice Interventions' tab.
    """
    with get_connection() as conn:
        rows = conn.execute(
            text("""
            SELECT DISTINCT ON (c.customer_id)
                c.customer_id, c.name, c.customer_segment, c.product_type,
                c.loan_amount, c.relationship_value,
                mp.ensemble_score, mp.risk_band, mp.observation_week,
                wf.salary_delay_days, wf.auto_debit_failures,
                wf.savings_drawdown_pct, wf.utility_payment_delay_days,
                i.intervention_method, i.outcome, i.status, i.created_at as intervention_date,
                (SELECT COUNT(*) > 0 FROM stress_context sc WHERE sc.customer_id = c.customer_id) as has_analysis
            FROM customers c
            JOIN interventions i ON c.customer_id = i.customer_id
            LEFT JOIN model_predictions mp ON c.customer_id = mp.customer_id
            LEFT JOIN weekly_features wf ON c.customer_id = wf.customer_id
            WHERE i.selected_channel = 'voice'
            ORDER BY c.customer_id, i.created_at DESC
        """)
        ).fetchall()

    result = []
    for row in rows:
        r = row._mapping
        result.append(
            {
                "customer_id": r["customer_id"],
                "name": r["name"] or f"Customer {r['customer_id']}",
                "risk_score": float(r["ensemble_score"])
                if r["ensemble_score"] is not None
                else 0.0,
                "risk_level": r["risk_band"] or "Low",
                "observation_week": str(r["observation_week"])
                if r["observation_week"]
                else None,
                "product_type": r["product_type"],
                "customer_segment": r["customer_segment"],
                "loan_amount": float(r["loan_amount"]) if r["loan_amount"] else 0.0,
                "intervention_method": r["intervention_method"],
                "outcome": r["outcome"],
                "status": r["status"],
                "intervention_date": str(r["intervention_date"])
                if r["intervention_date"]
                else None,
                "pipeline_status": {
                    "ingested": True,
                    "scored": r["ensemble_score"] is not None,
                    "analysed": bool(r["has_analysis"]),
                    "outreach": True,
                },
                "signals": {
                    "salary_delay": int(r["salary_delay_days"] or 0),
                    "auto_debit_failures": int(r["auto_debit_failures"] or 0),
                    "savings_drawdown": float(r["savings_drawdown_pct"] or 0.0),
                    "utility_delay": int(r["utility_payment_delay_days"] or 0),
                },
            }
        )

    return sorted(result, key=lambda x: x["risk_score"], reverse=True)


def get_dashboard_stats() -> dict:
    """
    Returns aggregated statistics for Dashboard KPIs.
    """
    with get_connection() as conn:
        # Get customer counts and risk distribution
        customer_stats = conn.execute(
            text("""
            SELECT 
                COUNT(DISTINCT c.customer_id) as total_customers,
                COUNT(DISTINCT CASE WHEN mp.risk_band = 'High' THEN c.customer_id END) as high_risk_count,
                COUNT(DISTINCT CASE WHEN mp.risk_band = 'Medium' THEN c.customer_id END) as medium_risk_count,
                COUNT(DISTINCT CASE WHEN mp.risk_band = 'Low' THEN c.customer_id END) as low_risk_count,
                COALESCE(SUM(c.loan_amount), 0) as total_exposure
            FROM customers c
            LEFT JOIN (
                SELECT DISTINCT ON (customer_id) id, customer_id, risk_band
                FROM model_predictions
                ORDER BY customer_id, predicted_at DESC
            ) mp ON c.customer_id = mp.customer_id
        """)
        ).fetchone()

        # Get intervention stats
        intervention_stats = conn.execute(
            text("""
            SELECT 
                COUNT(DISTINCT CASE WHEN selected_channel = 'voice' THEN id END) as voice_count,
                COUNT(DISTINCT CASE WHEN selected_channel = 'email' THEN id END) as email_count,
                COUNT(DISTINCT CASE WHEN selected_channel = 'sms_whatsapp' THEN id END) as sms_count,
                COUNT(DISTINCT CASE WHEN status = 'dispatched' THEN id END) as active_interventions,
                COUNT(DISTINCT CASE WHEN status = 'Resolved' THEN id END) as resolved_count,
                COUNT(DISTINCT CASE WHEN outcome IS NOT NULL AND outcome != '' THEN id END) as total_interventions,
                COUNT(DISTINCT CASE WHEN outcome LIKE '%accepted%' THEN id END) as accepted_count
            FROM interventions
        """)
        ).fetchone()

        # Get product-based risk
        product_stats = conn.execute(
            text("""
            SELECT 
                COALESCE(SUM(CASE WHEN c.product_type ILIKE '%home%' AND mp.risk_band IN ('High', 'Medium') THEN 1 ELSE 0 END), 0) as home_loan_at_risk,
                COALESCE(SUM(CASE WHEN c.product_type ILIKE '%credit%' AND mp.risk_band IN ('High', 'Medium') THEN 1 ELSE 0 END), 0) as credit_card_at_risk,
                COALESCE(SUM(CASE WHEN c.product_type ILIKE '%personal%' AND mp.risk_band IN ('High', 'Medium') THEN 1 ELSE 0 END), 0) as personal_loan_at_risk
            FROM customers c
            LEFT JOIN (
                SELECT DISTINCT ON (customer_id) id, customer_id, risk_band
                FROM model_predictions
                ORDER BY customer_id, predicted_at DESC
            ) mp ON c.customer_id = mp.customer_id
        """)
        ).fetchone()

        # Get top stress factors (most common SHAP features)
        top_factors = conn.execute(
            text("""
            SELECT 
                se.feature_name,
                COUNT(*) as count,
                AVG(ABS(se.shap_value)) as avg_contribution
            FROM shap_explanations se
            JOIN (
                SELECT DISTINCT ON (customer_id) id, customer_id
                FROM model_predictions
                ORDER BY customer_id, predicted_at DESC
            ) mp ON se.prediction_id = mp.id
            WHERE se.feature_name NOT IN ('_intercept_', 'baseline')
            GROUP BY se.feature_name
            ORDER BY avg_contribution DESC
            LIMIT 5
        """)
        ).fetchall()

        risk_dist = customer_stats._mapping
        int_stats = intervention_stats._mapping
        prod_stats = product_stats._mapping

        total_customers = risk_dist["total_customers"] or 0
        at_risk = (risk_dist["high_risk_count"] or 0) + (
            risk_dist["medium_risk_count"] or 0
        )

        return {
            "total_customers": total_customers,
            "high_risk_count": risk_dist["high_risk_count"] or 0,
            "medium_risk_count": risk_dist["medium_risk_count"] or 0,
            "low_risk_count": risk_dist["low_risk_count"] or 0,
            "total_exposure": float(risk_dist["total_exposure"])
            if risk_dist["total_exposure"]
            else 0.0,
            "at_risk_percentage": round((at_risk / total_customers * 100), 1)
            if total_customers > 0
            else 0,
            "channel_mix": {
                "voice": int_stats["voice_count"] or 0,
                "email": int_stats["email_count"] or 0,
                "sms": int_stats["sms_count"] or 0,
            },
            "active_interventions": int_stats["active_interventions"] or 0,
            "resolution_rate": round(
                (int_stats["resolved_count"] or 0)
                / (int_stats["total_interventions"] or 1)
                * 100,
                1,
            ),
            "acceptance_rate": round(
                (int_stats["accepted_count"] or 0)
                / (int_stats["total_interventions"] or 1)
                * 100,
                1,
            ),
            "risk_by_product": {
                "home_loan": {"at_risk": prod_stats["home_loan_at_risk"] or 0},
                "credit_card": {"at_risk": prod_stats["credit_card_at_risk"] or 0},
                "personal_loan": {"at_risk": prod_stats["personal_loan_at_risk"] or 0},
            },
            "top_stress_factors": [
                {
                    "factor": r.feature_name,
                    "count": r.count,
                    "avg_contribution": float(r.avg_contribution)
                    if r.avg_contribution
                    else 0,
                }
                for r in top_factors
            ],
        }
