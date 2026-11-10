# ==============================================================================
# SmartLib RFID Middleware — Configuration
# ==============================================================================

import sys
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field

# Ensure rfid-service directory is on sys.path
SERVICE_DIR = Path(__file__).resolve().parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

ENV_FILE = SERVICE_DIR / ".env"
DEFAULT_DB_PATH = str(SERVICE_DIR / "data" / "offline_events.db")


class Settings(BaseSettings):
    # Service
    service_name: str = Field(default="smartlib-rfid-middleware")
    service_port: int = Field(default=8000)
    log_level: str = Field(default="INFO")
    mock_hardware: bool = Field(default=True)

    # Backend API
    backend_api_url: str = Field(default="http://localhost:5000/api/v1")
    backend_api_key: str = Field(default="")
    backend_login_email: str = Field(default="admin@smartlib.ac.in")
    backend_login_password: str = Field(default="Admin@SmartLib2026!")
    backend_request_timeout: int = Field(default=10)
    backend_max_retries: int = Field(default=3)
    backend_retry_delay: float = Field(default=2.0)

    # SQLite offline buffer
    sqlite_buffer_path: str = Field(default=DEFAULT_DB_PATH)
    buffer_max_events: int = Field(default=100000)
    sync_batch_size: int = Field(default=50)
    sync_interval_seconds: int = Field(default=30)

    # Device IDs (mock)
    staff_station_device_id: str = Field(default="DEV-SS-001")
    handheld_device_id: str = Field(default="DEV-HH-001")
    security_gate_device_id: str = Field(default="DEV-SG-001")

    gate_poll_rate_hz: int = Field(default=20)
    staff_station_max_tags: int = Field(default=5)

    # CORS
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://localhost:5000"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {
        "env_file": str(ENV_FILE),
        "case_sensitive": False,
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
