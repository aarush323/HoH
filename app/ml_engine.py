"""
ml_engine.py — real-model scoring + SHAP explanation layer.

Exposes:
    get_real_score(customer_id)  → float | None
    get_real_shap(customer_id)   → dict  | None

Both query Postgres for the last 12 weeks of weekly_features,
return None when fewer than 12 rows exist, and use Redis caching.

Model logic is a 1-to-1 port of the training notebooks — do NOT
change the architecture, meta-feature construction, or SHAP
attribution without re-training.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import lightgbm as lgb
import shap
import joblib
from sklearn.preprocessing import LabelEncoder
from sqlalchemy import text

from db.postgres import get_connection
from db.redis_client import (
    get_cached_risk_score, cache_risk_score,
    get_client, REDIS_TTL,
)

# ── paths ────────────────────────────────────────────────────────────────────
BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")

# ── constants — must match training exactly ──────────────────────────────────
TARGET   = "will_default_next_2_4_weeks"
CAT_COLS = ["customer_segment", "geography_zone", "product_type", "shock_type"]
GRU_COLS = [
    "balance_velocity", "salary_delay_delta", "discretionary_velocity",
    "upi_lending_delta", "savings_drawdown_velocity",
    "emi_paid_flag", "emi_bounced_flag", "missed_emi_count_rolling",
]
LGB_DROP = [
    "customer_id", "observation_week",
    "balance_velocity", "salary_delay_delta",
    "discretionary_velocity", "upi_lending_delta",
    "savings_drawdown_velocity",
]
SEQ_LEN = 12

# ── load trained artefacts once at import ────────────────────────────────────
_device   = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_lgb      = lgb.Booster(model_file=os.path.join(BASE, "lgb_model.txt"))
_ens      = joblib.load(os.path.join(BASE, "ensemble_model.pkl"))
_ens_thr  = joblib.load(os.path.join(BASE, "ensemble_threshold.pkl"))
_scaler   = joblib.load(os.path.join(BASE, "gru_scaler.pkl"))


class GRUModel(nn.Module):
    """Architecture must match training exactly."""
    def __init__(self):
        super().__init__()
        self.gru = nn.GRU(len(GRU_COLS), 64, num_layers=2,
                          batch_first=True, dropout=0.3)
        self.fc  = nn.Linear(64, 1)

    def forward(self, x):
        out, _ = self.gru(x)
        return self.fc(out[:, -1, :]).squeeze(1)


_gru = GRUModel().to(_device)
_gru.load_state_dict(
    torch.load(os.path.join(BASE, "gru_model.pt"), map_location=_device)
)
_gru.eval()

# SHAP explainer — built once
_lgb_explainer    = shap.TreeExplainer(_lgb)
_lgb_feature_names = _lgb.feature_name()

# Meta-learner weights for contribution display
_lgb_weight = float(_ens.coef_[0][0])
_gru_weight = float(_ens.coef_[0][1])
_total_w    = abs(_lgb_weight) + abs(_gru_weight)
_lgb_pct    = round(abs(_lgb_weight) / _total_w * 100, 1)
_gru_pct    = round(abs(_gru_weight) / _total_w * 100, 1)


# ═══════════════════════════════════════════════════════════════════════════════
#  DATA LOADING + FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════════════════════

def _get_history(customer_id: str) -> pd.DataFrame:
    """Fetch last 12 weekly_features rows from Postgres."""
    with get_connection() as conn:
        rows = conn.execute(text("""
            SELECT * FROM weekly_features
            WHERE customer_id = :cid
            ORDER BY observation_week DESC
            LIMIT 12
        """), {"cid": customer_id})
        df = pd.DataFrame(rows.fetchall(), columns=rows.keys())
    return df.sort_values("observation_week").reset_index(drop=True)


def _engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute the engineered columns the models expect.
    These are week-over-week deltas / velocities derived from the raw
    weekly_features rows — mirrors the dataset generation logic exactly.
    """
    df = df.copy()

    # ── velocity / delta columns (week-over-week diff, first row = 0) ────
    df["balance_velocity"]          = df["avg_daily_balance_inr"].diff().fillna(0)
    df["salary_delay_delta"]        = df["salary_delay_days"].diff().fillna(0)
    df["discretionary_velocity"]    = df["discretionary_spend_inr"].diff().fillna(0)
    df["upi_lending_delta"]         = df["upi_to_lending_apps_count"].diff().fillna(0)
    df["savings_drawdown_velocity"] = df["savings_drawdown_pct"].diff().fillna(0)

    # ── EMI-related flags ────────────────────────────────────────────────
    # These were in the training CSV but aren't in weekly_features.
    # Derive from auto_debit_failures as the closest available proxy.
    df["emi_paid_flag"]           = (df["auto_debit_failures"] == 0).astype(int)
    df["emi_bounced_flag"]        = (df["auto_debit_failures"] > 0).astype(int)
    df["missed_emi_count_rolling"] = df["emi_bounced_flag"].cumsum()

    # ── shock_type (categorical) ─────────────────────────────────────────
    # Derive from the most stressed signal this week
    def _derive_shock(row):
        if row.get("salary_delay_days", 0) > 5:
            return "income_shock"
        if row.get("auto_debit_failures", 0) >= 2:
            return "payment_shock"
        if row.get("savings_drawdown_pct", 0) < -25:
            return "savings_shock"
        return "none"

    df["shock_type"] = df.apply(_derive_shock, axis=1)

    return df


# ═══════════════════════════════════════════════════════════════════════════════
#  SCORING
# ═══════════════════════════════════════════════════════════════════════════════

def get_real_score(customer_id: str) -> float | None:
    """
    Return ensemble risk probability for a customer, or None if we
    don't have 12 weeks of history yet.
    """
    # ── Redis cache hit ──────────────────────────────────────────────────
    cached = get_cached_risk_score(customer_id)
    if cached:
        return cached["risk_score"]

    # ── load + validate ──────────────────────────────────────────────────
    hist = _get_history(customer_id)
    if len(hist) < SEQ_LEN:
        return None

    hist = _engineer_features(hist)

    # ── LightGBM — current-week snapshot ─────────────────────────────────
    row = hist.tail(1).copy()
    for col in CAT_COLS:
        if col in row.columns:
            row[col] = LabelEncoder().fit_transform(row[col].astype(str))
    lgb_feats = [c for c in row.columns
                 if c not in LGB_DROP + [TARGET, "id", "synced_at"]]
    lgb_p = float(_lgb.predict(row[lgb_feats].fillna(0))[0])

    # ── GRU — 12-week sequence ───────────────────────────────────────────
    seq = hist[GRU_COLS].fillna(0).astype(float).values
    seq_scaled = _scaler.transform(seq).astype(np.float32)
    t = torch.tensor(seq_scaled).unsqueeze(0).to(_device)
    with torch.no_grad():
        gru_p = float(torch.sigmoid(_gru(t)).cpu().item())

    # ── Ensemble — 5 meta features matching training exactly ─────────────
    meta = np.array([[
        lgb_p,
        gru_p,
        abs(lgb_p - gru_p),
        lgb_p * gru_p,
        max(lgb_p, gru_p),
    ]])
    score = float(_ens.predict_proba(meta)[0][1])

    # ── cache + return ───────────────────────────────────────────────────
    cache_risk_score(customer_id, {"risk_score": score})
    return score


# ═══════════════════════════════════════════════════════════════════════════════
#  SHAP + GRADIENT ATTRIBUTION
# ═══════════════════════════════════════════════════════════════════════════════

def _get_lgb_top3(lgb_2d_row: np.ndarray) -> dict:
    """TreeSHAP on the single-row LGB feature vector."""
    sv = _lgb_explainer.shap_values(lgb_2d_row)[0]   # shape (n_feats,)
    top3 = sorted(
        zip(_lgb_feature_names, sv),
        key=lambda x: abs(x[1]), reverse=True,
    )[:3]
    return {feat: round(float(val), 4) for feat, val in top3}


def _get_gru_attribution(seq_tensor: torch.Tensor) -> tuple[dict, int]:
    """
    Gradient-based attribution on the GRU.
    Returns top-3 feature importances and the peak-stress week index.
    """
    _gru.train()                    # enable grad flow
    seq = seq_tensor.clone().requires_grad_(True)
    out = _gru(seq)
    out.backward()
    attr      = seq.grad.abs().squeeze(0).cpu().numpy()   # (12, 8)
    mean_attr = attr.mean(axis=0)                         # (8,)
    top3_idx  = mean_attr.argsort()[::-1][:3]
    active_week = int(attr.sum(axis=1).argmax()) + 1
    _gru.eval()                     # restore eval mode
    return (
        {GRU_COLS[i]: round(float(mean_attr[i]), 4) for i in top3_idx},
        active_week,
    )


def get_real_shap(customer_id: str) -> dict | None:
    """
    Full SHAP/attribution explanation for a customer, or None if
    fewer than 12 weeks of data exist.

    Returns dict with:
        ensemble_score, lgb_score, gru_score,
        lgb_contribution, gru_contribution,
        lgb_top3_signals, gru_top3_signals, gru_stress_peak_week
    """
    # ── Redis cache hit (separate key from risk score) ───────────────────
    redis = get_client()
    cached = redis.get(f"shap:{customer_id}")
    if cached:
        return json.loads(cached)

    # ── load + validate ──────────────────────────────────────────────────
    hist = _get_history(customer_id)
    if len(hist) < SEQ_LEN:
        return None

    hist = _engineer_features(hist)

    # ── LGB features + prob ──────────────────────────────────────────────
    row = hist.tail(1).copy()
    for col in CAT_COLS:
        if col in row.columns:
            row[col] = LabelEncoder().fit_transform(row[col].astype(str))
    lgb_feats = [c for c in row.columns
                 if c not in LGB_DROP + [TARGET, "id", "synced_at"]]
    lgb_2d = row[lgb_feats].fillna(0).values          # (1, n_feats)
    lgb_p  = float(_lgb.predict(lgb_2d)[0])

    # ── GRU sequence + prob ──────────────────────────────────────────────
    seq = hist[GRU_COLS].fillna(0).astype(float).values
    seq_scaled = _scaler.transform(seq).astype(np.float32)
    t = torch.tensor(seq_scaled).unsqueeze(0).to(_device)
    with torch.no_grad():
        gru_p = float(torch.sigmoid(_gru(t)).cpu().item())

    # ── ensemble score ───────────────────────────────────────────────────
    meta = np.array([[
        lgb_p, gru_p, abs(lgb_p - gru_p),
        lgb_p * gru_p, max(lgb_p, gru_p),
    ]])
    ensemble_p = float(_ens.predict_proba(meta)[0][1])

    # ── SHAP: LGB top 3 ─────────────────────────────────────────────────
    lgb_top3 = _get_lgb_top3(lgb_2d)

    # ── SHAP: GRU gradient attribution top 3 + peak week ────────────────
    gru_top3, active_week = _get_gru_attribution(t)

    result = {
        "ensemble_score":       round(ensemble_p, 4),
        "lgb_score":            round(lgb_p, 4),
        "gru_score":            round(gru_p, 4),
        "lgb_contribution":     f"{_lgb_pct}%",
        "gru_contribution":     f"{_gru_pct}%",
        "lgb_top3_signals":     lgb_top3,
        "gru_top3_signals":     gru_top3,
        "gru_stress_peak_week": active_week,
    }

    # ── cache for 24 h (same TTL as risk score) ──────────────────────────
    redis.setex(
        f"shap:{customer_id}",
        REDIS_TTL["risk_score"],
        json.dumps(result),
    )
    return result