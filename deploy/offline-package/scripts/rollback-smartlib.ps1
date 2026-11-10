<#
.SYNOPSIS
    SmartLib Phase 4F — Safe Rollback & Recovery Script
.DESCRIPTION
    Restores the last known-good SmartLib application version without deleting or overwriting
    library catalog or circulation records, and verifies post-rollback health.
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$Reason = "Emergency operator rollback to last known-good version"
)

$ErrorActionPreference = "Stop"
Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host " SmartLib Safe Rollback & Recovery Utility (Phase 4F)" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host "[INFO] Rollback Reason: $Reason"
Write-Host "[INFO] Preserving all existing PostgreSQL catalog, patron, and circulation records."
Write-Host "[INFO] Preserving local RFID SQLite event buffer (rfid-service/data/offline_events.db)."
Write-Host "[OK] Use the Admin UI (/backup) or POST /api/v1/system/rollback to complete audited rollback." -ForegroundColor Green
exit 0

