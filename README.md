# Hydroclawnics-Simulation

Hydroclawnics monorepo for a real-time hydroponics farm simulation and AI agent dashboard.

## Structure

```text
hydroclawnics/
├── main.py
├── simulator.py
├── state.py
├── agent_bridge.py
├── requirements.txt
├── memory/
│   └── decisions.jsonl
├── sensors/
│   └── pod_states.json
└── frontend/
```

## Backend (dev)

Windows:
```bash
cd hydroclawnics
# create and activate a virtual environment
python -m venv .venv
.venv\Scripts\Activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Mac/Linux:
```bash
cd hydroclawnics
# create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Frontend (dev)

```bash
cd hydroclawnics/frontend
npm install
npm run dev
```

## Production build

```bash
cd hydroclawnics/frontend
npm run build
```

After building, FastAPI serves `frontend/dist/` automatically at `/`.

Credits:

<a href="https://www.flaticon.com/free-icons/lettuce" title="lettuce icons">Lettuce icons created by Freepik - Flaticon</a>
<br />
<a href="https://www.flaticon.com/free-icons/tomato" title="tomato icons">Tomato icons created by Freepik - Flaticon</a>
<br />
<a href="https://www.flaticon.com/free-icons/basil" title="basil icons">Basil icons created by Freepik - Flaticon</a>
<br />
<a href="https://www.flaticon.com/free-icons/spinach" title="spinach icons">Spinach icons created by Freepik - Flaticon</a>
<br />
<a href="https://www.flaticon.com/free-icons/lettuce" title="lettuce icons">Greens icons created by Freepik - Flaticon</a>
<br />
