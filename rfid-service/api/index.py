import sys
import os
from pathlib import Path

# Add root of rfid-service to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Set serverless environment flags
os.environ.setdefault("SQLITE_BUFFER_PATH", "/tmp/offline_events.db")
os.environ.setdefault("BACKEND_API_URL", "https://backend-six-omega-38.vercel.app/api/v1")
os.environ.setdefault("BACKEND_LOGIN_EMAIL", "admin@smartlib.institution.edu")
os.environ.setdefault("BACKEND_LOGIN_PASSWORD", "AdminPassword123!")

from main import app
