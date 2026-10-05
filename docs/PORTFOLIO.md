# QueryMate: demo script & Upwork write-up

## Run locally

**macOS / Linux**
```bash
cd querymate
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # add GOOGLE_API_KEY
uvicorn api.main:app --reload   # terminal 1
cd frontend && npm install && npm run dev   # terminal 2 → http://localhost:5173
pytest                          # 57 tests, no API key needed
```

**Windows (PowerShell)**
```powershell
cd querymate
py -3.11 -m venv .venv; .venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # add GOOGLE_API_KEY
uvicorn api.main:app --reload   # terminal 1
cd frontend; npm install; npm run dev       # terminal 2 → http://localhost:5173
pytest
```

**Docker (one container):** `docker build -t querymate . && docker run -p 8000:8000 --env-file .env querymate`

## 5-step demo script (for the GIF)

1. **Start on the landing page** and scroll slowly through the animations, then click **Launch the app** and expand *Invoice* in the schema explorer.
2. **Click "Which 5 countries generated the most revenue?"**: show the summary, sorted bar chart, table, then open **🔍 View SQL** and click **💡 Explain this SQL**.
3. **Type "Show the monthly revenue trend for 2013"** (line chart), then the follow-up **"now only for USA"** and open View SQL to show the added `WHERE`.
4. **Type "Delete all customers"** to show the 🛡️ read-only block message.
5. **Switch the data source to "Upload files"**, drag in a CSV, ask a question about it, then open the **Query history** tab and click **Export history (CSV)**.

Record at 1440×900 with a tool like ScreenToGif (Windows) or Kap (macOS) and save to `docs/demo.gif`.

## Upwork portfolio entry

**Title (≤70 chars):** QueryMate: AI Text-to-SQL App, Ask Your Database in Plain English

**Description (~150 words):**

*Problem:* Business teams depend on analysts for every data question, and writing SQL is a bottleneck that slows decisions.

*Solution:* QueryMate is a chat app where anyone types a question like "Which 5 countries generated the most revenue?" and instantly gets a chart, a result table, a plain-English summary and the SQL behind it. Follow-up questions keep context, users can upload their own CSV/Excel files, and PostgreSQL/MySQL are supported.

*Tech:* Python, FastAPI, LangChain (LCEL) with Google Gemini and OpenAI, SQLAlchemy 2, sqlglot for SQL validation, pandas, pytest and Docker on the backend; React, Tailwind, Framer Motion and Recharts on the frontend.

*Result:* A production-style, read-only Text-to-SQL assistant with layered safety (AST validation, blocked write keywords, row limits, read-only connections), automatic error self-correction, query history export, a scroll-animated landing page and a 57-test suite, deployable for free on Render and Vercel.

**Skills (5):** Python · LangChain · FastAPI · React · Generative AI
