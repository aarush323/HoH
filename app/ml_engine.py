import os
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb
import torch
import torch.nn as nn
import shap
from db.cassandra_component import get_session
import psycopg2

import logging
logger = logging.getLogger(__name__)

# ==========================================
# SECTION 1: Constants
# ==========================================
GRU_COLS = [
    "balance_velocity",
    "salary_delay_delta",
    "discretionary_velocity",
    "upi_lending_delta",
    "savings_drawdown_velocity",
    "emi_due_this_week",
    "emi_paid_flag",
    "emi_bounced_flag"
]
SEQ_LEN = 12
GRU_N_FEATURES = 8

CAT_COLS = ["customer_segment", "geography_zone", "product_type", "shock_type"]

from sklearn.preprocessing import LabelEncoder

_cat_encoders = {}
try:
    _df = pd.read_csv("pipeline/pre_delinquency_dataset.csv")
    for col in CAT_COLS:
        le = LabelEncoder()
        le.fit(_df[col].fillna(""))
        _cat_encoders[col] = le
except Exception as e:
    logger.warning(f"Failed to load dataset for LabelEncoders: {e}")

# ==========================================
# SECTION 2: GRU Class Definition
# ==========================================
class GRUModel(nn.Module):
    def __init__(self, input_size=8, hidden_size=64, num_layers=2, dropout=0.3):
        super(GRUModel, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.gru = nn.GRU(input_size, hidden_size, num_layers, batch_first=True, dropout=dropout)
        self.fc = nn.Linear(hidden_size, 1)
        
    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.gru(x, h0)
        out = self.fc(out[:, -1, :])
        return out

# ==========================================
# SECTION 3: Model Loading
# ==========================================
MODEL_DIR = "models"
_lgb_model = None
_lgb_threshold = None
_gru_scaler = None
_gru_model = None
_ensemble_model = None
_ensemble_thr = None

try:
    _lgb_model = lgb.Booster(model_file=f"{MODEL_DIR}/lgb_model.txt")
    _lgb_threshold = joblib.load(f"{MODEL_DIR}/lgb_threshold.pkl")
    _gru_scaler = joblib.load(f"{MODEL_DIR}/gru_scaler.pkl")
    
    _gru_model = GRUModel(input_size=GRU_N_FEATURES)
    _gru_model.load_state_dict(torch.load(f"{MODEL_DIR}/gru_model.pt", map_location=torch.device('cpu')))
    _gru_model.eval()
    
    _ensemble_model = joblib.load(f"{MODEL_DIR}/ensemble_model.pkl")
    _ensemble_thr = joblib.load(f"{MODEL_DIR}/ensemble_threshold.pkl")
except Exception as e:
    logger.warning(f"[ML Engine] Failed to load models, fallback will be used: {e}")

# ==========================================
# SECTION 4: LGB Vector Builder
# ==========================================
def _encode_cat(col, val):
    if col not in _cat_encoders:
        return 0
    le = _cat_encoders[col]
    val = str(val) if val else ""
    if val in le.classes_:
        return int(le.transform([val])[0])
    return 0

def _build_lgb_vector(record: dict) -> np.ndarray:
    flat = dict(record)
    for col in CAT_COLS:
        val = flat.get(col, "")
        flat[col] = _encode_cat(col, val)
    
    feature_names = _lgb_model.feature_name()
    vec = [float(flat.get(feat, 0.0)) for feat in feature_names]
    return np.array([vec], dtype=np.float32)

# ==========================================
# SECTION 5: GRU History Fetcher
# ==========================================
def _fetch_gru_history(customer_id: str, current_record: dict) -> np.ndarray:
    cassandra_session = get_session()
    
    query = f"""
        SELECT observation_week, balance_velocity, salary_delay_delta, discretionary_velocity,
               upi_lending_delta, savings_drawdown_velocity, emi_due_this_week, 
               emi_paid_flag, emi_bounced_flag
        FROM weekly_feature_snapshots
        WHERE customer_id = '{customer_id}'
        LIMIT {SEQ_LEN}
    """
    rows = cassandra_session.execute(query)
    
    history = []
    for r in rows:
        history.append({
            "observation_week": r.observation_week,
            "balance_velocity": float(r.balance_velocity or 0),
            "salary_delay_delta": float(r.salary_delay_delta or 0),
            "discretionary_velocity": float(r.discretionary_velocity or 0),
            "upi_lending_delta": float(r.upi_lending_delta or 0),
            "savings_drawdown_velocity": float(r.savings_drawdown_velocity or 0),
            "emi_due_this_week": 1.0 if r.emi_due_this_week else 0.0,
            "emi_paid_flag": 1.0 if r.emi_paid_flag else 0.0,
            "emi_bounced_flag": 1.0 if r.emi_bounced_flag else 0.0
        })
    
    history = sorted(history, key=lambda x: x["observation_week"])
    
    if len(history) == 0:
        current_vec = [
            float(current_record.get("balance_velocity", 0)),
            float(current_record.get("salary_delay_delta", 0)),
            float(current_record.get("discretionary_velocity", 0)),
            float(current_record.get("upi_lending_delta", 0)),
            float(current_record.get("savings_drawdown_velocity", 0)),
            1.0 if current_record.get("emi_due_this_week") else 0.0,
            1.0 if current_record.get("emi_paid_flag") else 0.0,
            1.0 if current_record.get("emi_bounced_flag") else 0.0
        ]
        history_arr = np.tile(current_vec, (SEQ_LEN, 1)).astype(np.float32)
    else:
        vecs = []
        for h in history:
            vecs.append([
                h["balance_velocity"],
                h["salary_delay_delta"],
                h["discretionary_velocity"],
                h["upi_lending_delta"],
                h["savings_drawdown_velocity"],
                h["emi_due_this_week"],
                h["emi_paid_flag"],
                h["emi_bounced_flag"]
            ])
        arr = np.array(vecs, dtype=np.float32)
        
        N = len(vecs)
        if N < SEQ_LEN:
            padding = np.zeros((SEQ_LEN - N, GRU_N_FEATURES), dtype=np.float32)
            history_arr = np.vstack([padding, arr])
        else:
            history_arr = arr
            
    scaled_history = _gru_scaler.transform(history_arr)
    return scaled_history.astype(np.float32)

# ==========================================
# SECTION 6: LGB Scorer
# ==========================================
def _lgb_score(lgb_vec: np.ndarray) -> tuple:
    proba = _lgb_model.predict(lgb_vec)[0]
    
    explainer = shap.TreeExplainer(_lgb_model)
    shap_vals = explainer.shap_values(lgb_vec)
    if isinstance(shap_vals, list):
        shap_vals = shap_vals[0]
    
    if len(shap_vals.shape) > 1:
        shap_vals = shap_vals[0]
    
    top5_idx = np.argsort(np.abs(shap_vals))[::-1][:5]
    feature_names = _lgb_model.feature_name()
    
    shap_factors = []
    for idx in top5_idx:
        shap_factors.append({
            "feature": feature_names[idx],
            "value": float(lgb_vec[0, idx]),
            "contribution": float(abs(shap_vals[idx])),
            "direction": "increases_risk" if shap_vals[idx] > 0 else "decreases_risk"
        })
        
    return float(proba), shap_factors

# ==========================================
# SECTION 7: GRU Scorer
# ==========================================
def _gru_score(history_array: np.ndarray, current_record: dict) -> tuple:
    tensor = torch.tensor(history_array[np.newaxis, ...], dtype=torch.float32)
    
    _gru_model.eval()
    with torch.no_grad():
        proba = torch.sigmoid(_gru_model(tensor)).item()
        
    _gru_model.train()
    seq = tensor.clone().requires_grad_(True)
    out = _gru_model(seq)
    out.backward()
    
    attr = seq.grad.abs().squeeze(0).numpy()
    mean_attr = attr.mean(axis=0)
    
    top3_idx = np.argsort(mean_attr)[::-1][:3]
    
    gru_factors = []
    for idx in top3_idx:
        feat_name = GRU_COLS[idx]
        gru_factors.append({
            "feature": feat_name,
            "value": float(current_record.get(feat_name, 0)),
            "contribution": float(mean_attr[idx]),
            "direction": "increases_risk"
        })
        
    _gru_model.eval()
    return float(proba), gru_factors

# ==========================================
# SECTION 8: Public API
# ==========================================
def score_from_kafka(record: dict) -> tuple:
    if not all([_lgb_model, _gru_scaler, _gru_model, _ensemble_model]):
        raise RuntimeError("ML Engine models are not fully loaded")
        
    print("\n" + "="*50)
    print(f"[ML DEBUG] INFERENCE START: Customer {record.get('customer_id')}")
    print("="*50)

    # 1. LightGBM
    lgb_vec = _build_lgb_vector(record)
    print(f"[ML DEBUG] LGB Vector Shape: {lgb_vec.shape}")
    print(f"[ML DEBUG] LGB Vector: {lgb_vec}")
    lgb_p, lgb_shap = _lgb_score(lgb_vec)
    print(f"[ML DEBUG] LGB Probability: {lgb_p:.4f}")
    
    # 2. GRU
    history = _fetch_gru_history(record.get("customer_id", ""), record)
    print(f"[ML DEBUG] GRU History Tensor Shape: {history.shape}")
    print(f"[ML DEBUG] GRU History (last row): {history[-1] if len(history) > 0 else 'EMPTY'}")
    gru_p, gru_shap = _gru_score(history, record)
    print(f"[ML DEBUG] GRU Probability: {gru_p:.4f}")
    
    # 3. Meta-Ensemble
    lgb_p_f = float(lgb_p)
    gru_p_f = float(gru_p)
    meta_features = [lgb_p_f, gru_p_f, abs(lgb_p_f - gru_p_f), lgb_p_f * gru_p_f, max(lgb_p_f, gru_p_f)]
    
    print(f"[ML DEBUG] Meta-Ensemble Features (Unused for now): {meta_features}")
    
    import math
    base_lr = _ensemble_model.calibrated_classifiers_[0].estimator
    lgb_weight = float(base_lr.coef_[0][0])
    gru_weight = float(base_lr.coef_[0][1])
    intercept  = float(base_lr.intercept_[0])

    raw = lgb_weight * lgb_p_f + gru_weight * gru_p_f + intercept
    risk_score = round(1 / (1 + math.exp(-raw)), 4)
    
    print(f"[ML DEBUG] Final Ensemble Risk Score (Weighted): {risk_score:.4f}")
    
    # 4. SHAP
    merged_shap = lgb_shap + gru_shap
    merged_shap = sorted(merged_shap, key=lambda x: x["contribution"], reverse=True)[:5]
    print(f"[ML DEBUG] Top 5 Merged SHAP factors:")
    for s in merged_shap:
        print(f"  - {s['feature']}: contrib={s['contribution']:.4f}, dir={s['direction']}, val={s['value']}")
    
    print("="*50 + "\n")
    
    return round(float(risk_score), 4), merged_shap

def get_risk_level(score: float) -> str:
    # _ensemble_thr is loaded from ensemble_threshold.pkl
    # default fallback is 0.5833 if for some reason it's not loaded
    thr = _ensemble_thr if _ensemble_thr is not None else 0.5833
    
    if score >= thr:
        if score >= 0.75: return "High"
        return "Medium"
    return "Low"