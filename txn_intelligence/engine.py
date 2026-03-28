import requests
import json
import os
from typing import Optional

OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

MCC_CATEGORIES = {
    "5812": "restaurant",
    "5814": "fast_food",
    "5311": "retail",
    "5411": "groceries",
    "4834": "telecom",
    "4900": "utilities",
    "6011": "atm",
    "6051": "quasi_cash",
    "4121": "transportation",
    "7512": "car_rental",
}

KEYWORD_PATTERNS = {
    "gambling": [
        "dream11",
        "fantasy",
        "bet365",
        "betway",
        "parimatch",
        "lottery",
        "casino",
        "rummy",
        "poker",
        "bingo",
        "slot",
        "kbc",
        "satka",
        "matka",
        "cricket",
        "ipl",
        "1xbet",
        "melbet",
    ],
    "discretionary": [
        "zomato",
        "swiggy",
        "amazon",
        "flipkart",
        "myntra",
        "bookmyshow",
        "fashion",
        "jewellery",
        "luxury",
        "apparel",
        "shopping",
        "ajio",
        "westside",
        "pantaloons",
        "shoppers stop",
    ],
    "luxury": [
        "gucci",
        "louis vuitton",
        "rolex",
        "tanishq",
        "cartier",
        "dior",
        "hermes",
        "prada",
        "versace",
        "burberry",
        "fendi",
        "channel",
        "tanishq",
        "malabargold",
        "joyalukkas",
        "kalyan jewellers",
        "boss",
        "armani",
        "diesel",
        "ford",
        "bmw",
        "mercedes",
        "audi",
    ],
    "gig_income": [
        "ola",
        "uber",
        "rapido",
        "swiggy instamart",
        "zepto",
        "blinkit",
        "urbanclap",
        "urbancompany",
        "taskrabbit",
        " Dunzo",
        "pickup",
        "porter",
        "locus",
        "deliveree",
        "bharatpe",
        "paytm money",
    ],
    "recreation": [
        "netflix",
        "spotify",
        "prime video",
        "hotstar",
        "sonyliv",
        "jio cinema",
        "voot",
        "zee5",
        "steam",
        "playstation",
        "xbox",
        "Nintendo",
        "epic games",
        "garena",
        "freefire",
        "pubg",
        "gaming",
    ],
    "lending_app": [
        "cred",
        "cashe",
        "moneytap",
        "kreditbee",
        "flexmoney",
        "earlysalary",
        "slice",
        "nitro",
        "meme",
        "lending",
        "loan",
    ],
    "essential": [
        "bill",
        "electricity",
        "water",
        "gas",
        "recharge",
        "mutual",
        "sip",
        "insurance",
        "emi",
        "rent",
        "broadband",
    ],
    "salary": [
        "salary",
        "payroll",
        "hdfc bank",
        "icici bank",
        "sbi",
        "axis bank",
        "inward",
        "credit salary",
        "google pay",
        "phonepe",
    ],
    "transfer": ["upi", "neft", "rtgs", "imps", "bank transfer", "wallet", "paytm"],
}


def mcc_classify(merchant: str, mcc: str = None) -> Optional[dict]:
    if mcc and mcc in MCC_CATEGORIES:
        return {
            "category": MCC_CATEGORIES[mcc],
            "source": "MCC Layer",
            "confidence": 0.95,
            "reason": f"MCC code {mcc} maps to {MCC_CATEGORIES[mcc]}",
        }
    return None


def keyword_classify(merchant: str, amount: float = None) -> Optional[dict]:
    merchant_lower = merchant.lower()

    for category, keywords in KEYWORD_PATTERNS.items():
        for kw in keywords:
            if kw in merchant_lower:
                return {
                    "category": category,
                    "source": "Keyword Intelligence Layer",
                    "confidence": 0.92,
                    "reason": f"Keyword '{kw}' matched {category} pattern",
                }
    return None


def llm_classify(merchant: str, amount: float = None) -> dict:
    prompt = f"""Classify this bank transaction into ONE category.

Merchant: {merchant}
Amount: ₹{amount if amount else "N/A"}

Categories: gambling, discretionary, luxury, gig_income, recreation, lending_app, essential, salary, transfer, atm, other

Respond ONLY with JSON in this exact format:
{{"category": "category_name", "confidence": 0.0-1.0, "reason": "brief explanation"}}"""

    # Try Cerebras first (fast cloud API)
    try:
        from app.llm import get_llm

        llm = get_llm(temperature=0.3)
        if llm:
            response = llm.invoke(prompt)
            content = (
                response.content if hasattr(response, "content") else str(response)
            )
            try:
                data = json.loads(content)
                if "category" in data:
                    data["source"] = "AI Classification Layer"
                    print(f"LLM: Used Cerebras for {merchant}")
                    return data
            except (json.JSONDecodeError, AttributeError):
                pass
    except Exception as e:
        print(f"Cerebras failed: {e}, falling back to Ollama")

    # Fallback to Ollama
    try:
        response = requests.post(
            f"{OLLAMA_BASE}/api/generate",
            json={
                "model": "phi3",
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.3},
            },
            timeout=30,
        )

        if response.status_code == 200:
            result = response.json()
            content = result.get("response", "{}")
            try:
                data = json.loads(content)
                if "category" in data:
                    data["source"] = "AI Classification Layer"
                    print(f"LLM: Used Ollama fallback for {merchant}")
                    return data
            except json.JSONDecodeError:
                pass
    except Exception as e:
        print(f"LLM classify error: {e}")

    return {
        "category": "other",
        "source": "AI Classification Layer",
        "confidence": 0.5,
        "reason": "LLM unavailable, defaulting to other",
    }


def classify_transaction(merchant: str, amount: float = None, mcc: str = None) -> dict:
    result = mcc_classify(merchant, mcc)
    if result:
        return result

    result = keyword_classify(merchant, amount)
    if result:
        return result

    return llm_classify(merchant, amount)


def get_empty_features() -> dict:
    return {
        "gambling_lottery_spend_inr": 0,
        "discretionary_spend_inr": 0,
        "luxury_spend_inr": 0,
        "gig_income_inr": 0,
        "recreation_spend_inr": 0,
        "lending_app_count": 0,
        "lending_app_amount_inr": 0,
        "essential_spend_inr": 0,
        "salary_income_inr": 0,
        "atm_withdrawals": 0,
        "total_transactions": 0,
    }


def aggregate_transactions(transactions: list[dict]) -> dict:
    features = get_empty_features()

    for txn in transactions:
        cat = txn.get("category", "other")
        amt = txn.get("amount", 0)

        if cat == "gambling":
            features["gambling_lottery_spend_inr"] += amt
        elif cat == "discretionary":
            features["discretionary_spend_inr"] += amt
        elif cat == "luxury":
            features["luxury_spend_inr"] += amt
        elif cat == "gig_income":
            features["gig_income_inr"] += amt
        elif cat == "recreation":
            features["recreation_spend_inr"] += amt
        elif cat == "lending_app":
            features["lending_app_count"] += 1
            features["lending_app_amount_inr"] += amt
        elif cat == "essential":
            features["essential_spend_inr"] += amt
        elif cat == "salary":
            features["salary_income_inr"] += amt
        elif cat in ["atm", "quasi_cash"]:
            features["atm_withdrawals"] += 1

    features["total_transactions"] = len(transactions)
    return features


def calculate_velocity(current: float, baseline: float) -> float:
    if baseline == 0:
        return 0.0
    return ((current - baseline) / baseline) * 100


def calculate_gig_worker_score(transactions: list[dict]) -> float:
    """Calculate probability of being a gig worker based on transaction patterns"""
    gig_count = 0
    total_count = len(transactions)

    for txn in transactions:
        cat = txn.get("category", "")
        if cat == "gig_income":
            gig_count += 1

    if total_count == 0:
        return 0.0

    # Score based on frequency of gig transactions
    ratio = gig_count / total_count

    # Scale: 0.3 * ratio + 0.7 if any gig income (baseline gig worker indicator)
    score = min(1.0, (ratio * 2) + 0.3) if gig_count > 0 else 0.0
    return round(score, 2)


def derive_personas(totals: dict, trends: dict, distribution: list[dict], gig_score: float) -> list[dict]:
    """Identify high-level personas based on transaction patterns"""
    personas = []
    
    # 1. Luxurious Lifestyle
    lux_spend = totals.get("luxury_spend_inr", 0)
    lux_dist = next((c for c in distribution if c["category"] == "luxury"), None)
    lux_pct = lux_dist["percentage"] if lux_dist else 0
    
    if lux_spend > 25000 or lux_pct > 10:
        score = min(1.0, (lux_spend / 100000) + (lux_pct / 40))
        personas.append({
            "title": "Luxurious Lifestyle",
            "score": round(score, 2),
            "reason": f"High luxury spending (₹{lux_spend:,.0f}) representing {lux_pct}% of transaction volume.",
            "type": "luxury"
        })

    # 2. Recreational Spender
    rec_spend = totals.get("recreation_spend_inr", 0)
    rec_vel = trends.get("recreation_velocity", 0)
    
    if rec_spend > 5000 or rec_vel > 15:
        score = min(1.0, (rec_spend / 30000) + (max(0, rec_vel) / 100))
        personas.append({
            "title": "Recreational Spender",
            "score": round(score, 2),
            "reason": f"Active recreation & entertainment spending with a {rec_vel}% velocity trend.",
            "type": "recreation"
        })

    # 3. Gig Job Worker
    if gig_score > 0.4:
        personas.append({
            "title": "Gig Job Worker",
            "score": gig_score,
            "reason": "Dominant pattern of income from on-demand platforms (Ola, Uber, etc.).",
            "type": "gig"
        })

    # 4. Credit Reliant
    lend_amt = totals.get("lending_app_amount_inr", 0)
    lend_count = totals.get("lending_app_count", 0)
    lend_vel = trends.get("lending_app_velocity", 0)
    
    if lend_amt > 5000 or lend_count > 2:
        score = min(1.0, (lend_amt / 40000) + (lend_count / 8))
        personas.append({
            "title": "Credit Reliant",
            "score": round(score, 2),
            "reason": f"Frequent interaction with {lend_count} lending platforms and ₹{lend_amt:,.0f} volume.",
            "type": "debt"
        })

    # 5. Gambler / High Risk
    gam_spend = totals.get("gambling_lottery_spend_inr", 0)
    gam_vel = trends.get("gambling_lottery_spend_velocity", 0)
    if gam_spend > 0:
        score = min(1.0, (gam_spend / 20000) + (max(0, gam_vel) / 50))
        personas.append({
            "title": "High Risk Speculator",
            "score": round(score, 2),
            "reason": f"Active participation in wagering/lottery with ₹{gam_spend:,.0f} total exposure.",
            "type": "risk"
        })

    return personas


def aggregate_12_weeks(transactions_by_week: dict) -> dict:
    """
    Aggregate transactions across 12 weeks with trends.

    Input: {"2026-W01": [txns], "2026-W02": [txns], ..., "2026-W12": [txns]}
    Output: {weekly_features, totals, trends, gig_worker_score, classification_breakdown, score_factors}
    """
    weekly_features = {}
    all_transactions = []
    classification_breakdown = []

    # Sort weeks chronologically
    sorted_weeks = sorted(transactions_by_week.keys())

    for week in sorted_weeks:
        txns = transactions_by_week.get(week, [])
        week_classified = []
        for txn in txns:
            # Classify each transaction and track the result
            result = classify_transaction(
                merchant=txn.get("merchant", ""),
                amount=txn.get("amount", 0),
                mcc=txn.get("mcc"),
            )
            classified = {
                "merchant": txn.get("merchant", ""),
                "amount": txn.get("amount", 0),
                "week": week,
                "category": result.get("category", "other"),
                "layer": result.get("source", "Unknown"),
                "confidence": result.get("confidence", 0),
                "reason": result.get("reason", ""),
            }
            week_classified.append(classified)
            classification_breakdown.append(classified)

        all_transactions.extend(week_classified)
        weekly_features[week] = aggregate_transactions(week_classified)

    # Calculate totals
    totals = aggregate_transactions(all_transactions)

    # Calculate trends (last 4 weeks vs previous 8 weeks)
    last_4_weeks = sorted_weeks[-4:] if len(sorted_weeks) >= 4 else sorted_weeks
    first_8_weeks = sorted_weeks[:-4] if len(sorted_weeks) > 4 else []

    # Aggregate last 4 weeks
    last_4_txns = []
    for week in last_4_weeks:
        last_4_txns.extend(transactions_by_week.get(week, []))
    last_4_agg = aggregate_transactions(last_4_txns)

    # Aggregate first 8 weeks (baseline)
    first_8_txns = []
    for week in first_8_weeks:
        first_8_txns.extend(transactions_by_week.get(week, []))
    first_8_agg = aggregate_transactions(first_8_txns)

    # Calculate velocity for each category
    trends = {}
    category_keys = [
        "gambling_lottery_spend_inr",
        "discretionary_spend_inr",
        "luxury_spend_inr",
        "gig_income_inr",
        "recreation_spend_inr",
        "lending_app_amount_inr",
        "essential_spend_inr",
        "salary_income_inr",
    ]

    for key in category_keys:
        current = last_4_agg.get(key, 0)
        baseline = first_8_agg.get(key, 0)
        velocity = calculate_velocity(current, baseline)

        # Cap velocity at reasonable range
        velocity = max(-100, min(500, velocity))
        trends[key.replace("_inr", "").replace("_amount", "") + "_velocity"] = round(
            velocity, 1
        )

    # Calculate gig worker score with factors
    gig_count = sum(1 for t in all_transactions if t.get("category") == "gig_income")
    total_count = len(all_transactions)
    gig_ratio = gig_count / total_count if total_count > 0 else 0

    gig_worker_score = calculate_gig_worker_score(all_transactions)

    # Score calculation breakdown
    score_factors = {
        "gig_transaction_count": gig_count,
        "total_transactions": total_count,
        "gig_ratio": round(gig_ratio, 3),
        "calculation": f"min(1.0, ({gig_ratio:.2f} × 2) + 0.3) = {gig_worker_score}",
        "has_gig_income": gig_count > 0,
        "formula": "min(1.0, (gig_ratio × 2) + 0.3) if gig_count > 0 else 0.0",
    }

    # Category distribution
    category_counts = {}
    for t in all_transactions:
        cat = t.get("category", "other")
        category_counts[cat] = category_counts.get(cat, 0) + 1

    category_distribution = [
        {
            "category": cat,
            "count": count,
            "percentage": round(count / total_count * 100, 1) if total_count > 0 else 0,
        }
        for cat, count in sorted(category_counts.items(), key=lambda x: -x[1])
    ]

    # Derive Personas
    personas = derive_personas(totals, trends, category_distribution, gig_worker_score)

    return {
        "weekly": weekly_features,
        "totals": totals,
        "trends": trends,
        "gig_worker_score": gig_worker_score,
        "week_count": len(sorted_weeks),
        "classification_breakdown": classification_breakdown,
        "score_factors": score_factors,
        "category_distribution": category_distribution,
        "personas": personas,
    }


def process_customer_transactions(customer_id: str, transactions: list[dict]) -> dict:
    classified_txns = []

    for txn in transactions:
        result = classify_transaction(
            merchant=txn.get("merchant", ""),
            amount=txn.get("amount", 0),
            mcc=txn.get("mcc"),
        )
        classified_txns.append(
            {
                "merchant": txn.get("merchant", ""),
                "amount": txn.get("amount", 0),
                "mcc": txn.get("mcc"),
                **result,
            }
        )

    features = aggregate_transactions(classified_txns)
    gig_score = calculate_gig_worker_score(classified_txns)

    return {
        "customer_id": customer_id,
        "transaction_count": len(transactions),
        "classified_transactions": classified_txns,
        "derived_features": features,
        "gig_worker_score": gig_score,
    }


# Sample transactions for demo
SAMPLE_TRANSACTIONS = [
    {"merchant": "PAYTM*DREAM11", "amount": 500},
    {"merchant": "ZOMATO", "amount": 350},
    {"merchant": "AMAZON.IN", "amount": 1200},
    {"merchant": "CRED", "amount": 2000},
    {"merchant": "BSES YAMUNA POWER", "amount": 850},
    {"merchant": "HDFC SALARY CREDIT", "amount": 50000},
    {"merchant": "ATM WITHDRAWAL", "amount": 5000},
    {"merchant": "SPOTIFY", "amount": 199},
    {"merchant": "BETWAY", "amount": 1000},
    {"merchant": "SWIGGY", "amount": 280},
]


# Sample customer profiles - each has different transaction patterns
# Key: profile name, Value: dict with customer_id and transactions_by_week


def generate_week_label(week_num: int) -> str:
    return f"2026-W{week_num:02d}"


SAMPLE_PROFILES = {
    "gig_worker_rahul": {
        "customer_id": "C001",
        "name": "Rahul S.",
        "profile": "Gig Worker - Ola/Uber Driver",
        "description": "Primary income from ride-sharing, irregular salary",
        "transactions_by_week": {
            generate_week_label(1): [
                {"merchant": "OLA", "amount": 3200},
                {"merchant": "FUEL", "amount": 800},
                {"merchant": "SWIGGY", "amount": 450},
            ],
            generate_week_label(2): [
                {"merchant": "UBER", "amount": 2800},
                {"merchant": "FUEL", "amount": 750},
                {"merchant": "ZOMATO", "amount": 380},
            ],
            generate_week_label(3): [
                {"merchant": "RAPIDO", "amount": 1900},
                {"merchant": "FUEL", "amount": 900},
                {"merchant": "SPOTIFY", "amount": 199},
            ],
            generate_week_label(4): [
                {"merchant": "OLA", "amount": 4100},
                {"merchant": "FUEL", "amount": 850},
                {"merchant": "JIO", "amount": 299},
            ],
            generate_week_label(5): [
                {"merchant": "UBER", "amount": 2200},
                {"merchant": "FUEL", "amount": 700},
                {"merchant": "SWIGGY", "amount": 520},
            ],
            generate_week_label(6): [
                {"merchant": "RAPIDO", "amount": 3500},
                {"merchant": "FUEL", "amount": 950},
                {"merchant": "NETFLIX", "amount": 499},
            ],
            generate_week_label(7): [
                {"merchant": "OLA", "amount": 2900},
                {"merchant": "FUEL", "amount": 800},
                {"merchant": "ZOMATO", "amount": 410},
            ],
            generate_week_label(8): [
                {"merchant": "UBER", "amount": 3800},
                {"merchant": "FUEL", "amount": 880},
                {"merchant": "MYNTRAA", "amount": 1200},
            ],
            generate_week_label(9): [
                {"merchant": "RAPIDO", "amount": 2400},
                {"merchant": "FUEL", "amount": 720},
                {"merchant": "SWIGGY", "amount": 390},
            ],
            generate_week_label(10): [
                {"merchant": "OLA", "amount": 3100},
                {"merchant": "FUEL", "amount": 850},
                {"merchant": "JIO", "amount": 299},
            ],
            generate_week_label(11): [
                {"merchant": "UBER", "amount": 2700},
                {"merchant": "FUEL", "amount": 780},
                {"merchant": "SPOTIFY", "amount": 199},
            ],
            generate_week_label(12): [
                {"merchant": "RAPIDO", "amount": 3300},
                {"merchant": "FUEL", "amount": 900},
                {"merchant": "ZOMATO", "amount": 450},
            ],
        },
    },
    "salaried_priya": {
        "customer_id": "C002",
        "name": "Priya M.",
        "profile": "Salaried - IT Professional",
        "description": "Stable monthly salary, controlled spending",
        "transactions_by_week": {
            generate_week_label(1): [
                {"merchant": "SALARY", "amount": 85000},
                {"merchant": "HDFC EMI", "amount": 25000},
                {"merchant": "GROCERY", "amount": 2500},
            ],
            generate_week_label(2): [
                {"merchant": "SWIGGY", "amount": 800},
                {"merchant": "NETFLIX", "amount": 499},
                {"merchant": "AMAZON", "amount": 1500},
            ],
            generate_week_label(3): [
                {"merchant": "ELECTRICITY", "amount": 1800},
                {"merchant": "BROADBAND", "amount": 999},
                {"merchant": "ZOMATO", "amount": 650},
            ],
            generate_week_label(4): [
                {"merchant": "MUTUAL FUND", "amount": 10000},
                {"merchant": "SWIGGY", "amount": 700},
                {"merchant": "SPOTIFY", "amount": 199},
            ],
            generate_week_label(5): [
                {"merchant": "SALARY", "amount": 85000},
                {"merchant": "HDFC EMI", "amount": 25000},
                {"merchant": "GROCERY", "amount": 2800},
            ],
            generate_week_label(6): [
                {"merchant": "INSURANCE", "amount": 5000},
                {"merchant": "AMAZON", "amount": 3200},
                {"merchant": "SWIGGY", "amount": 900},
            ],
            generate_week_label(7): [
                {"merchant": "ELECTRICITY", "amount": 1650},
                {"merchant": "SWIGGY", "amount": 750},
                {"merchant": "NETFLIX", "amount": 499},
            ],
            generate_week_label(8): [
                {"merchant": "SALARY", "amount": 85000},
                {"merchant": "HDFC EMI", "amount": 25000},
                {"merchant": "GROCERY", "amount": 2600},
            ],
            generate_week_label(9): [
                {"merchant": "MUTUAL FUND", "amount": 10000},
                {"merchant": "FLIPKART", "amount": 2100},
                {"merchant": "ZOMATO", "amount": 680},
            ],
            generate_week_label(10): [
                {"merchant": "BROADBAND", "amount": 999},
                {"merchant": "SWIGGY", "amount": 820},
                {"merchant": "SPOTIFY", "amount": 199},
            ],
            generate_week_label(11): [
                {"merchant": "SALARY", "amount": 85000},
                {"merchant": "HDFC EMI", "amount": 25000},
                {"merchant": "GROCERY", "amount": 2400},
            ],
            generate_week_label(12): [
                {"merchant": "ELECTRICITY", "amount": 1900},
                {"merchant": "AMAZON", "amount": 1800},
                {"merchant": "SWIGGY", "amount": 710},
            ],
        },
    },
    "gambler_vicky": {
        "customer_id": "C003",
        "name": "Vicky K.",
        "profile": "High Risk - Gambling Activity",
        "description": "Escalating gambling transactions, declining salary",
        "transactions_by_week": {
            generate_week_label(1): [
                {"merchant": "SALARY", "amount": 35000},
                {"merchant": "DREAM11", "amount": 2000},
                {"merchant": "BETWAY", "amount": 1500},
            ],
            generate_week_label(2): [
                {"merchant": "SALARY", "amount": 32000},
                {"merchant": "DREAM11", "amount": 5000},
                {"merchant": "BETWAY", "amount": 3000},
            ],
            generate_week_label(3): [
                {"merchant": "SALARY", "amount": 35000},
                {"merchant": "CASINO", "amount": 8000},
                {"merchant": "BETWAY", "amount": 4500},
            ],
            generate_week_label(4): [
                {"merchant": "DREAM11", "amount": 12000},
                {"merchant": "LOTTERY", "amount": 5000},
                {"merchant": "ATM", "amount": 10000},
            ],
            generate_week_label(5): [
                {"merchant": "SALARY", "amount": 28000},
                {"merchant": "BETWAY", "amount": 8000},
                {"merchant": "POKER", "amount": 6000},
            ],
            generate_week_label(6): [
                {"merchant": "DREAM11", "amount": 15000},
                {"merchant": "CASINO", "amount": 12000},
                {"merchant": "ATM", "amount": 15000},
            ],
            generate_week_label(7): [
                {"merchant": "SALARY", "amount": 25000},
                {"merchant": "BETWAY", "amount": 10000},
                {"merchant": "LOTTERY", "amount": 8000},
            ],
            generate_week_label(8): [
                {"merchant": "DREAM11", "amount": 18000},
                {"merchant": "RUMMY", "amount": 9000},
                {"merchant": "ATM", "amount": 12000},
            ],
            generate_week_label(9): [
                {"merchant": "SALARY", "amount": 22000},
                {"merchant": "BETWAY", "amount": 15000},
                {"merchant": "CASINO", "amount": 10000},
            ],
            generate_week_label(10): [
                {"merchant": "DREAM11", "amount": 25000},
                {"merchant": "POKER", "amount": 15000},
                {"merchant": "ATM", "amount": 20000},
            ],
            generate_week_label(11): [
                {"merchant": "SALARY", "amount": 18000},
                {"merchant": "BETWAY", "amount": 20000},
                {"merchant": "LOTTERY", "amount": 12000},
            ],
            generate_week_label(12): [
                {"merchant": "DREAM11", "amount": 30000},
                {"merchant": "CASINO", "amount": 25000},
                {"merchant": "ATM", "amount": 25000},
            ],
        },
    },
    "luxury_spender_amit": {
        "customer_id": "C004",
        "name": "Amit J.",
        "profile": "High Spender - Luxury",
        "description": "High income but increasing luxury spending",
        "transactions_by_week": {
            generate_week_label(1): [
                {"merchant": "SALARY", "amount": 150000},
                {"merchant": "TANISHQ", "amount": 25000},
                {"merchant": "AMAZON", "amount": 5000},
            ],
            generate_week_label(2): [
                {"merchant": "SALARY", "amount": 150000},
                {"merchant": "FLIPKART", "amount": 15000},
                {"merchant": "NETFLIX", "amount": 499},
            ],
            generate_week_label(3): [
                {"merchant": "TANISHQ", "amount": 50000},
                {"merchant": "AMAZON", "amount": 8000},
                {"merchant": "SWIGGY", "amount": 2000},
            ],
            generate_week_label(4): [
                {"merchant": "SALARY", "amount": 150000},
                {"merchant": "ROLEX", "amount": 150000},
                {"merchant": "MYNTRAA", "amount": 25000},
            ],
            generate_week_label(5): [
                {"merchant": "LUXURY CAR", "amount": 500000},
                {"merchant": "TANISHQ", "amount": 75000},
                {"merchant": "AMAZON", "amount": 12000},
            ],
            generate_week_label(6): [
                {"merchant": "SALARY", "amount": 150000},
                {"merchant": "DIOR", "amount": 45000},
                {"merchant": "FLIPKART", "amount": 18000},
            ],
            generate_week_label(7): [
                {"merchant": "TANISHQ", "amount": 100000},
                {"merchant": "GUCCI", "amount": 85000},
                {"merchant": "SWIGGY", "amount": 3500},
            ],
            generate_week_label(8): [
                {"merchant": "SALARY", "amount": 150000},
                {"merchant": "AMAZON", "amount": 22000},
                {"merchant": "NETFLIX", "amount": 499},
            ],
            generate_week_label(9): [
                {"merchant": "HERMES", "amount": 120000},
                {"merchant": "MYNTRAA", "amount": 35000},
                {"merchant": "AMAZON", "amount": 15000},
            ],
            generate_week_label(10): [
                {"merchant": "SALARY", "amount": 150000},
                {"merchant": "PRADA", "amount": 95000},
                {"merchant": "FLIPKART", "amount": 20000},
            ],
            generate_week_label(11): [
                {"merchant": "TANISHQ", "amount": 150000},
                {"merchant": "CAR", "amount": 300000},
                {"merchant": "AMAZON", "amount": 18000},
            ],
            generate_week_label(12): [
                {"merchant": "SALARY", "amount": 150000},
                {"merchant": "ROLEX", "amount": 250000},
                {"merchant": "SWIGGY", "amount": 4000},
            ],
        },
    },
    "struggling_family": {
        "customer_id": "C005",
        "name": "Sunita R.",
        "profile": "Struggling - High Lending App Usage",
        "description": "Multiple lending apps, financial stress indicators",
        "transactions_by_week": {
            generate_week_label(1): [
                {"merchant": "SALARY", "amount": 28000},
                {"merchant": "CRED", "amount": 5000},
                {"merchant": "KREDITBEE", "amount": 3000},
            ],
            generate_week_label(2): [
                {"merchant": "CRED", "amount": 8000},
                {"merchant": "CASHE", "amount": 5000},
                {"merchant": "GROCERY", "amount": 3500},
            ],
            generate_week_label(3): [
                {"merchant": "SALARY", "amount": 26000},
                {"merchant": "KREDITBEE", "amount": 7000},
                {"merchant": "SLICE", "amount": 4000},
            ],
            generate_week_label(4): [
                {"merchant": "CRED", "amount": 10000},
                {"merchant": "EARLYSALARY", "amount": 6000},
                {"merchant": "GROCERY", "amount": 3200},
            ],
            generate_week_label(5): [
                {"merchant": "SALARY", "amount": 24000},
                {"merchant": "CRED", "amount": 12000},
                {"merchant": "KREDITBEE", "amount": 8000},
            ],
            generate_week_label(6): [
                {"merchant": "CASHE", "amount": 10000},
                {"merchant": "SLICE", "amount": 7000},
                {"merchant": "GROCERY", "amount": 3000},
            ],
            generate_week_label(7): [
                {"merchant": "SALARY", "amount": 22000},
                {"merchant": "CRED", "amount": 15000},
                {"merchant": "KREDITBEE", "amount": 9000},
            ],
            generate_week_label(8): [
                {"merchant": "EARLYSALARY", "amount": 12000},
                {"merchant": "CASHE", "amount": 8000},
                {"merchant": "GROCERY", "amount": 2800},
            ],
            generate_week_label(9): [
                {"merchant": "SALARY", "amount": 20000},
                {"merchant": "CRED", "amount": 18000},
                {"merchant": "SLICE", "amount": 10000},
            ],
            generate_week_label(10): [
                {"merchant": "KREDITBEE", "amount": 15000},
                {"merchant": "CASHE", "amount": 12000},
                {"merchant": "GROCERY", "amount": 2500},
            ],
            generate_week_label(11): [
                {"merchant": "SALARY", "amount": 18000},
                {"merchant": "CRED", "amount": 20000},
                {"merchant": "EARLYSALARY", "amount": 15000},
            ],
            generate_week_label(12): [
                {"merchant": "CRED", "amount": 25000},
                {"merchant": "KREDITBEE", "amount": 18000},
                {"merchant": "SLICE", "amount": 12000},
            ],
        },
    },
    "mixed_income_kiran": {
        "customer_id": "C006",
        "name": "Kiran P.",
        "profile": "Mixed Income - Part-time Gig",
        "description": "Primary salary + side gig income, moderate risk",
        "transactions_by_week": {
            generate_week_label(1): [
                {"merchant": "SALARY", "amount": 45000},
                {"merchant": "UBER", "amount": 3500},
                {"merchant": "SWIGGY", "amount": 800},
            ],
            generate_week_label(2): [
                {"merchant": "SALARY", "amount": 45000},
                {"merchant": "OLA", "amount": 2800},
                {"merchant": "ZOMATO", "amount": 650},
            ],
            generate_week_label(3): [
                {"merchant": "UBER", "amount": 4200},
                {"merchant": "RAPIDO", "amount": 2500},
                {"merchant": "GROCERY", "amount": 3000},
            ],
            generate_week_label(4): [
                {"merchant": "SALARY", "amount": 45000},
                {"merchant": "OLA", "amount": 3100},
                {"merchant": "AMAZON", "amount": 2500},
            ],
            generate_week_label(5): [
                {"merchant": "UBER", "amount": 5500},
                {"merchant": "SWIGGY", "amount": 1200},
                {"merchant": "FLIPKART", "amount": 4000},
            ],
            generate_week_label(6): [
                {"merchant": "SALARY", "amount": 45000},
                {"merchant": "OLA", "amount": 3800},
                {"merchant": "ZOMATO", "amount": 900},
            ],
            generate_week_label(7): [
                {"merchant": "RAPIDO", "amount": 4500},
                {"merchant": "URBANCOMPANY", "amount": 2000},
                {"merchant": "NETFLIX", "amount": 499},
            ],
            generate_week_label(8): [
                {"merchant": "SALARY", "amount": 45000},
                {"merchant": "UBER", "amount": 3200},
                {"merchant": "SWIGGY", "amount": 750},
            ],
            generate_week_label(9): [
                {"merchant": "OLA", "amount": 4800},
                {"merchant": "RAPIDO", "amount": 2100},
                {"merchant": "AMAZON", "amount": 3500},
            ],
            generate_week_label(10): [
                {"merchant": "SALARY", "amount": 45000},
                {"merchant": "UBER", "amount": 3600},
                {"merchant": "GROCERY", "amount": 2800},
            ],
            generate_week_label(11): [
                {"merchant": "OLA", "amount": 5200},
                {"merchant": "SWIGGY", "amount": 1800},
                {"merchant": "FLIPKART", "amount": 2200},
            ],
            generate_week_label(12): [
                {"merchant": "SALARY", "amount": 45000},
                {"merchant": "UBER", "amount": 4000},
                {"merchant": "ZOMATO", "amount": 850},
            ],
        },
    },
    "minimal_tracking": {
        "customer_id": "C007",
        "name": "Raj M.",
        "profile": "Low Risk - Minimal Activity",
        "description": "Stable income, essential spending only",
        "transactions_by_week": {
            generate_week_label(1): [
                {"merchant": "SALARY", "amount": 65000},
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "GROCERY", "amount": 4000},
            ],
            generate_week_label(2): [
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "ELECTRICITY", "amount": 2000},
                {"merchant": "GROCERY", "amount": 3800},
            ],
            generate_week_label(3): [
                {"merchant": "SALARY", "amount": 65000},
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "BROADBAND", "amount": 999},
            ],
            generate_week_label(4): [
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "GROCERY", "amount": 4200},
                {"merchant": "WATER", "amount": 450},
            ],
            generate_week_label(5): [
                {"merchant": "SALARY", "amount": 65000},
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "GROCERY", "amount": 3900},
            ],
            generate_week_label(6): [
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "ELECTRICITY", "amount": 2200},
                {"merchant": "INSURANCE", "amount": 3000},
            ],
            generate_week_label(7): [
                {"merchant": "SALARY", "amount": 65000},
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "GROCERY", "amount": 4100},
            ],
            generate_week_label(8): [
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "BROADBAND", "amount": 999},
                {"merchant": "GROCERY", "amount": 3700},
            ],
            generate_week_label(9): [
                {"merchant": "SALARY", "amount": 65000},
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "GROCERY", "amount": 4000},
            ],
            generate_week_label(10): [
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "ELECTRICITY", "amount": 2100},
                {"merchant": "GROCERY", "amount": 3800},
            ],
            generate_week_label(11): [
                {"merchant": "SALARY", "amount": 65000},
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "GROCERY", "amount": 3950},
            ],
            generate_week_label(12): [
                {"merchant": "EMI", "amount": 15000},
                {"merchant": "WATER", "amount": 450},
                {"merchant": "GROCERY", "amount": 4050},
            ],
        },
    },
}


def get_sample_profiles():
    """Return list of sample profiles for frontend dropdown"""
    return [
        {
            "key": key,
            "name": data["name"],
            "profile": data["profile"],
            "description": data["description"],
        }
        for key, data in SAMPLE_PROFILES.items()
    ]


def get_profile_transactions(profile_key: str):
    """Get transactions for a specific profile"""
    if profile_key in SAMPLE_PROFILES:
        return SAMPLE_PROFILES[profile_key]["transactions_by_week"]
    return {}


# Backward compatibility
SAMPLE_12_WEEKS = SAMPLE_PROFILES["gig_worker_rahul"]["transactions_by_week"]
