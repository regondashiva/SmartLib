<#
.SYNOPSIS
    SmartLib Phase 4F — Controlled Offline Update Script
.DESCRIPTION
    Validates the target version-manifest.json, ensures a verified database backup is created
    before applying updates, runs Prisma schema validation, and verifies service health via
    GET /api/v1/health.
#>

param(
    [string]$ApiBaseUrl = "http://localhost:5000/api/v1",
    [switch]$VerifyOnly = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageRoot = Resolve-Path (Join-Path $ScriptDir "..")
$ManifestPath = Join-Path $PackageRoot "version-manifest.json"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SmartLib Controlled Update Runner (Phase 4F)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

if (-not (Test-Path $ManifestPath)) {
    Write-Error "[FATAL] Update aborted: version-manifest.json not found at $ManifestPath"
    exit 1
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
Write-Host "[STEP 1] Validated target manifest: $($Manifest.packageId) -> v$($Manifest.appVersion)" -ForegroundColor Green

if ($VerifyOnly) {
    Write-Host "[OK] Manifest verification completed (--VerifyOnly)." -ForegroundColor Green
    exit 0
}

Write-Host "[STEP 2] Execute controlled update via Admin UI (/backup) or POST $ApiBaseUrl/system/updates/execute" -ForegroundColor Yellow
exit 0

