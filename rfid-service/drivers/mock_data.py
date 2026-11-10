# ==============================================================================
# SmartLib RFID Middleware — Mock RFID Data Generator
# Provides deterministic synthetic RFID telemetry for simulation.
# EPC format: 96-bit SGTIN-96 (hex, 24 chars)
# ==============================================================================

from __future__ import annotations
import random
import string
import time
from typing import Optional


# ---------------------------------------------------------------------------
# Deterministic catalog of mock book tags (linked to seeded backend data)
# ---------------------------------------------------------------------------

MOCK_CATALOG: list[dict] = [
    {
        "epc": "3034257BF4000B4000000001",   # Linked to ACC-2026-00001 (circulating)
        "accession_number": "ACC-2026-00001",
        "book_title": "Introduction to Algorithms",
        "isbn": "9780262046305",
        "shelf_location": "STACK-A/AISLE-01/SHELF-03",
        "eas_armed": False,                  # Disarmed — issued to STD-2026-1001
        "issued": True,
        "tag_type": "UHF_EPC_GEN2",
    },
    {
        "epc": "3034257BF4000B4000000002",   # Linked to ACC-2026-00002 (reference-only)
        "accession_number": "ACC-2026-00002",
        "book_title": "Introduction to Algorithms (Reference Copy)",
        "isbn": "9780262046305",
        "shelf_location": "STACK-A/AISLE-01/SHELF-03",
        "eas_armed": True,                   # Still armed — reference-only
        "issued": False,
        "tag_type": "UHF_EPC_GEN2",
    },
    {
        "epc": "3034257BF4000B4000000003",
        "accession_number": "ACC-2026-00003",
        "book_title": "Clean Code: A Handbook of Agile Software",
        "isbn": "9780132350884",
        "shelf_location": "STACK-B/AISLE-02/SHELF-05",
        "eas_armed": True,
        "issued": False,
        "tag_type": "UHF_EPC_GEN2",
    },
    {
        "epc": "3034257BF4000B4000000004",
        "accession_number": "ACC-2026-00004",
        "book_title": "Design Patterns: Elements of Reusable OO Software",
        "isbn": "9780201633610",
        "shelf_location": "STACK-B/AISLE-02/SHELF-07",
        "eas_armed": True,
        "issued": False,
        "tag_type": "UHF_EPC_GEN2",
    },
    {
        "epc": "3034257BF4000B4000000005",
        "accession_number": "ACC-2026-00005",
        "book_title": "The Pragmatic Programmer",
        "isbn": "9780135957059",
        "shelf_location": "STACK-C/AISLE-03/SHELF-01",
        "eas_armed": False,                  # Issued
        "issued": True,
        "tag_type": "UHF_EPC_GEN2",
    },
    {
        "epc": "3034257BF4000B4000000006",
        "accession_number": "ACC-2026-00006",
        "book_title": "Database System Concepts",
        "isbn": "9780078022159",
        "shelf_location": "STACK-D/AISLE-04/SHELF-02",
        "eas_armed": True,
        "issued": False,
        "tag_type": "UHF_EPC_GEN2",
    },
    {
        "epc": "3034257BF4000B4000000007",
        "accession_number": "ACC-2026-00007",
        "book_title": "Computer Networks",
        "isbn": "9780132126953",
        # Intentionally placed on WRONG shelf for misplacement demo
        "shelf_location": "STACK-A/AISLE-01/SHELF-02",   # Expected: STACK-D/AISLE-04/SHELF-06
        "expected_shelf": "STACK-D/AISLE-04/SHELF-06",
        "eas_armed": True,
        "issued": False,
        "tag_type": "UHF_EPC_GEN2",
    },
    {
        "epc": "3034257BF4000B4000000008",
        "accession_number": "ACC-2026-00008",
        "book_title": "Operating System Concepts",
        "isbn": "9781119800361",
        "shelf_location": "STACK-E/AISLE-05/SHELF-03",
        "eas_armed": True,
        "issued": False,
        "tag_type": "UHF_EPC_GEN2",
    },
]

# EPC → catalog entry lookup
EPC_CATALOG: dict[str, dict] = {item["epc"]: item for item in MOCK_CATALOG}

# Accession number → catalog entry
ACCESSION_CATALOG: dict[str, dict] = {
    item["accession_number"]: item for item in MOCK_CATALOG
}


def random_epc() -> str:
    """Generate a random 96-bit SGTIN-96 EPC hex string (24 hex chars)."""
    return "".join(random.choices(string.hexdigits.upper()[:16], k=24))


def random_rssi() -> float:
    """Generate a realistic RSSI value in dBm (typical UHF range: -70 to -40)."""
    return round(random.uniform(-70.0, -40.0), 1)


def lookup_epc(epc: str) -> Optional[dict]:
    """Return catalog entry for a known EPC, or None for unknown tags."""
    return EPC_CATALOG.get(epc)


def get_mock_catalog() -> list[dict]:
    return MOCK_CATALOG


def pick_random_catalog_epc(
    armed_only: bool = False,
    issued_only: bool = False,
) -> str:
    """Pick a random EPC from the mock catalog with optional filters."""
    pool = MOCK_CATALOG
    if armed_only:
        pool = [e for e in pool if e["eas_armed"]]
    if issued_only:
        pool = [e for e in pool if e["issued"]]
    if not pool:
        return random_epc()
    return random.choice(pool)["epc"]


def generate_cctv_ref(device_id: str) -> str:
    """Generate a deterministic CCTV frame reference token."""
    ts_ms = int(time.time() * 1000)
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"CCTV-{device_id}-{ts_ms}-{suffix}"


def pick_random_shelf_items(
    target_shelf: str, count: int
) -> list[dict]:
    """
    Return a mix of catalog items for a handheld shelf scan simulation:
    - Items whose shelf_location matches target_shelf → VERIFIED
    - Items from other shelves placed on this shelf → MISPLACED
    - Random unknown tags → UNCATALOGED
    
    Also identifies items expected on this shelf but not scanned → MISSING
    """
    result = []

    # Items expected on this shelf
    expected = [i for i in MOCK_CATALOG if i.get("shelf_location") == target_shelf]

    # Items from other shelves (simulated misplacement)
    other = [i for i in MOCK_CATALOG if i.get("shelf_location") != target_shelf]

    added_epcs: set[str] = set()

    # 1. Add some verified items
    verified_count = max(1, int(count * 0.5))
    for item in expected[:verified_count]:
        result.append({**item, "scan_status": "VERIFIED", "scanned_shelf": target_shelf})
        added_epcs.add(item["epc"])

    # 2. Add a misplaced item (from other shelves)
    if other and count > 3:
        misplaced = random.choice(other)
        if misplaced["epc"] not in added_epcs:
            result.append({
                **misplaced,
                "scan_status": "MISPLACED",
                "scanned_shelf": target_shelf,
                "expected_shelf": misplaced.get("shelf_location"),
            })
            added_epcs.add(misplaced["epc"])

    # 3. Fill remaining with unknown tags
    while len(result) < count:
        result.append({
            "epc": random_epc(),
            "accession_number": None,
            "book_title": None,
            "shelf_location": target_shelf,
            "scan_status": "UNCATALOGED",
            "scanned_shelf": target_shelf,
            "eas_armed": True,
            "issued": False,
            "tag_type": "UHF_EPC_GEN2",
        })

    # 4. Find MISSING items — expected on this shelf but not scanned
    missing = [
        i for i in expected
        if i["epc"] not in added_epcs
    ]

    return result, missing

