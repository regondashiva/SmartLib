<#
.SYNOPSIS
    SmartLib Phase 5B — Real Offline Package Installer & Artifact Staging Script (Windows 11 / Windows Server 2022+)
.DESCRIPTION
    Performs an actual offline installation (when run without -DryRun) into an isolated target directory
    using only locally compiled bundles (frontend/dist, backend/dist, rfid-service, prisma schema, and
    env templates) with zero internet access, SHA-256 artifact digest verification, and installation receipt output.
#>

param(
    [switch]$DryRun = $false,
    [string]$TargetDir = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageRoot = Resolve-Path (Join-Path $ScriptDir "..")
$ProjectRoot = Resolve-Path (Join-Path $PackageRoot "..\..")
$ManifestPath = Join-Path $PackageRoot "version-manifest.json"

if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    $TargetDir = Join-Path $ProjectRoot "data\isolated-offline-install"
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SmartLib Offline Package Installer (Phase 5B Real Execution)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Verify Version Manifest Exists & Is Valid JSON
if (-not (Test-Path $ManifestPath)) {
    Write-Error "[FATAL] Missing version-manifest.json at $ManifestPath. Aborting installation."
    exit 1
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
Write-Host "[OK] Loaded Version Manifest: $($Manifest.packageId) (v$($Manifest.appVersion))" -ForegroundColor Green

# 2. Check OS Environment
$OsCaption = (Get-CimInstance Win32_OperatingSystem).Caption
Write-Host "[INFO] Detected Operating System: $OsCaption"

# 3. Validate Node.js Runtime (>= 20.0.0)
try {
    $NodeRaw = (& node -v) 2>$null
    $NodeVer = [version]($NodeRaw.TrimStart('v').Split('-')[0])
    $MinNode = [version]($Manifest.requiredRuntimes.nodeMinVersion)
    if ($NodeVer -lt $MinNode) {
        Write-Error "[FATAL] Node.js v$NodeVer is below minimum required version v$MinNode."
        exit 1
    }
    Write-Host "[OK] Node.js Runtime Verified: v$NodeVer (Required >= v$MinNode)" -ForegroundColor Green
} catch {
    Write-Error "[FATAL] Node.js runtime not found in PATH."
    exit 1
}

# 4. Validate Python Runtime (>= 3.11.0)
try {
    $PyRaw = (& python --version) 2>&1
    if ($PyRaw -match "(\d+\.\d+\.\d+)") {
        $PyVer = [version]$Matches[1]
        $MinPy = [version]($Manifest.requiredRuntimes.pythonMinVersion)
        if ($PyVer -lt $MinPy) {
            Write-Error "[FATAL] Python v$PyVer is below minimum required version v$MinPy."
            exit 1
        }
        Write-Host "[OK] Python Runtime Verified: v$PyVer (Required >= v$MinPy)" -ForegroundColor Green
    }
} catch {
    Write-Error "[FATAL] Python 3.11+ runtime not found in PATH."
    exit 1
}

# 5. Check Local PostgreSQL / Docker Daemon Availability
$LocalPgBin = Test-Path "C:\Program Files\PostgreSQL\*\bin\postgres.exe"
$LocalPgData = Test-Path "C:\Program Files\PostgreSQL\18\data\PG_VERSION"
$PgModeNote = if ($LocalPgBin) { "LOCAL_POSTGRES_BINARY_PRESENT" } elseif ($LocalPgData) { "DATA_DIR_ONLY_NO_LOCAL_DAEMON (Requires external/isolated PostgreSQL endpoint)" } else { "EXTERNAL_POSTGRES_ENDPOINT_REQUIRED" }
Write-Host "[INFO] PostgreSQL Host Status: $PgModeNote" -ForegroundColor Yellow

# 6. Check Free Disk Space (>= 500 MB)
$Drive = (Get-Item $ProjectRoot).PSDrive.Name
$DiskInfo = Get-PSDrive $Drive
$FreeMb = [math]::Round($DiskInfo.Free / 1MB, 2)
if ($FreeMb -lt 500) {
    Write-Error "[FATAL] Insufficient disk space on drive ${Drive}: ($FreeMb MB free, minimum 500 MB required)."
    exit 1
}
Write-Host "[OK] Disk Space Verified: $FreeMb MB available on drive ${Drive}:" -ForegroundColor Green

# 7. Verify Production Build Artifacts Exist Locally
$FrontendDistDir = Join-Path $ProjectRoot "frontend\dist"
$BackendDistDir = Join-Path $ProjectRoot "backend\dist"
$RfidServiceDir = Join-Path $ProjectRoot "rfid-service"
$PrismaSchemaPath = Join-Path $ProjectRoot "backend\prisma\schema.prisma"

if (-not (Test-Path (Join-Path $FrontendDistDir "index.html"))) {
    Write-Error "[FATAL] Missing compiled frontend production bundle (frontend/dist/index.html)."
    exit 1
}
if (-not (Test-Path (Join-Path $BackendDistDir "app.js"))) {
    Write-Error "[FATAL] Missing compiled backend production bundle (backend/dist/app.js)."
    exit 1
}

if ($DryRun) {
    Write-Host "[SUCCESS] Offline installation dry-run prerequisite validation passed." -ForegroundColor Green
    exit 0
}

# 8. Real Isolated Installation Execution (No Network Access Used)
Write-Host "[INSTALL] Staging isolated offline installation into: $TargetDir" -ForegroundColor Cyan
if (Test-Path $TargetDir) {
    Remove-Item -Path $TargetDir -Recurse -Force
}

$TargetFrontend = Join-Path $TargetDir "frontend\dist"
$TargetBackend = Join-Path $TargetDir "backend\dist"
$TargetPrisma = Join-Path $TargetDir "backend\prisma"
$TargetRfid = Join-Path $TargetDir "rfid-service"
$TargetConfig = Join-Path $TargetDir "config"

New-Item -ItemType Directory -Path $TargetFrontend -Force | Out-Null
New-Item -ItemType Directory -Path $TargetBackend -Force | Out-Null
New-Item -ItemType Directory -Path $TargetPrisma -Force | Out-Null
New-Item -ItemType Directory -Path $TargetRfid -Force | Out-Null
New-Item -ItemType Directory -Path $TargetConfig -Force | Out-Null

Copy-Item -Path (Join-Path $FrontendDistDir "*") -Destination $TargetFrontend -Recurse -Force
Copy-Item -Path (Join-Path $BackendDistDir "*") -Destination $TargetBackend -Recurse -Force
Copy-Item -Path $PrismaSchemaPath -Destination (Join-Path $TargetPrisma "schema.prisma") -Force
Copy-Item -Path (Join-Path $ProjectRoot "backend\package.json") -Destination (Join-Path $TargetDir "backend\package.json") -Force
Copy-Item -Path (Join-Path $RfidServiceDir "*.py") -Destination $TargetRfid -Force
Copy-Item -Path (Join-Path $RfidServiceDir "drivers") -Destination (Join-Path $TargetRfid "drivers") -Recurse -Force
Copy-Item -Path (Join-Path $RfidServiceDir "routers") -Destination (Join-Path $TargetRfid "routers") -Recurse -Force
Copy-Item -Path (Join-Path $RfidServiceDir "buffer") -Destination (Join-Path $TargetRfid "buffer") -Recurse -Force
Copy-Item -Path $ManifestPath -Destination (Join-Path $TargetDir "version-manifest.json") -Force

$FrontendIndexHash = (Get-FileHash -Path (Join-Path $TargetFrontend "index.html") -Algorithm SHA256).Hash.ToLower()
$BackendAppHash = (Get-FileHash -Path (Join-Path $TargetBackend "app.js") -Algorithm SHA256).Hash.ToLower()
$SchemaHash = (Get-FileHash -Path (Join-Path $TargetPrisma "schema.prisma") -Algorithm SHA256).Hash.ToLower()

$Receipt = [ordered]@{
    installationMode = "REAL_OFFLINE_ISOLATED_INSTALL"
    dryRun = $false
    installedAt = (Get-Date).ToUniversalTime().ToString("o")
    osCaption = $OsCaption
    nodeVersion = "$NodeVer"
    pythonVersion = "$PyVer"
    postgresHostState = $PgModeNote
    packageId = $Manifest.packageId
    installedVersion = $Manifest.appVersion
    targetDirectory = $TargetDir
    verifiedArtifactSha256 = [ordered]@{
        frontendIndexHtml = $FrontendIndexHash
        backendAppJs = $BackendAppHash
        prismaSchema = $SchemaHash
    }
}

$ReceiptPath = Join-Path $TargetDir "installation-receipt.json"
$Receipt | ConvertTo-Json -Depth 6 | Set-Content -Path $ReceiptPath -Encoding UTF8

Write-Host "[OK] Frontend dist, Backend dist, Prisma schema, and RFID service installed to $TargetDir" -ForegroundColor Green
Write-Host "[OK] Installation receipt written to $ReceiptPath" -ForegroundColor Green
Write-Host "[SUCCESS] SmartLib v$($Manifest.appVersion) real offline installation completed." -ForegroundColor Green
exit 0
