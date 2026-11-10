# SmartLib v1.6.0 — Installation Guide

> **Official Submission Document**  
> **Master Reference:** [docs/INSTALLATION_AND_DEPLOYMENT_GUIDE.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/INSTALLATION_AND_DEPLOYMENT_GUIDE.md)

## System Requirements & Quick Setup

- **Host Environment**: Node.js 20+ LTS, npm 10+, Python 3.10+, PostgreSQL 15+.
- **Database Connection**: Supply valid PostgreSQL connection string in `backend/.env`.

### Quick Installation Commands
```powershell
# 1. Backend Setup
cd backend
npm install
npx prisma db push
npm run seed  # (optional initial data)

# 2. Frontend Setup
cd ../frontend
npm install
npm run build

# 3. Python RFID Middleware Setup
cd ../rfid-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Starting the System
Launch in 3 separate terminal sessions:
- Terminal 1: `cd backend && npm run dev` (Port 5000)
- Terminal 2: `cd rfid-service && .\venv\Scripts\activate && uvicorn main:app --port 8000 --reload`
- Terminal 3: `cd frontend && npm run dev` (Port 5173)

Open browser at `http://localhost:5173`.

For detailed production and offline air-gapped instructions, see [docs/INSTALLATION_AND_DEPLOYMENT_GUIDE.md](file:///c:/Users/shiva/OneDrive/Desktop/project/smartLib/docs/INSTALLATION_AND_DEPLOYMENT_GUIDE.md).

