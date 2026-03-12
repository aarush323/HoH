# HoH - PreDelinquency Engine

A multi-agent system built with LangGraph and FastAPI to predict and manage financial delinquency risks. The engine analyzes customer data, identifies stress factors, and suggests interventions with empathetic outreach messages.

## 🚀 Features

- **Automated Risk Analysis**: Processes SHAP values and risk scores to provide concise narratives.
- **Compliance Guardrails**: Automatic policy checks for fraud flags and existing restructurings.
- **Dynamic Interventions**: Suggests tone and content for customer outreach based on specific stress contexts.
- **Multi-LLM Support**: Primary support for Groq (Llama-3.1) with fallback to Cerebras.

## 🛠️ Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Orchestration**: [LangGraph](https://langchain-ai.github.io/langgraph/)
- **LLM Integration**: [LangChain](https://www.langchain.com/)
- **Providers**: Groq, Cerebras

## 📂 Project Structure

```text
├── app/
│   ├── main.py        # FastAPI routes and Pipeline demonstration
│   └── llm.py         # LLM configuration and initialization
├── graph/
│   ├── nodes.py       # Agent node implementations (Analyst, Compliance, Intervention)
│   ├── state.py       # LangGraph state definitions
│   └── __init__.py    # Graph construction and compilation
├── .gitignore         # Standard Python gitignore
├── requirements.txt   # Project dependencies
└── .env               # API keys and environment variables (not tracked)
```

## ⚙️ Setup

1. **Clone the repository and enter the directory.**
2. **Create a virtual environment:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Linux/macOS
   ```
3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   GROQ_API_KEY=your_groq_key_here
   CEREBRAS_API_KEY=your_cerebras_key_here
   ```

## 🏃 Usage

To run the sample pipeline demonstration:
```bash
python app/main.py
```

## 🤖 Graph Workflow

1. **Analyst Node**: Interprets SHAP values to identify stress types (e.g., liquidity).
2. **Compliance Node**: Validates customer eligibility for interventions.
3. **Intervention Node**: Selects the best approach (e.g., payment holiday) and drafts a message.

---
*Documentation generated for team developers.*
