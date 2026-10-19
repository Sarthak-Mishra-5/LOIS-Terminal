# Build the React frontend if needed, then start the API, which also serves the frontend, on the LAN.
#   powershell -ExecutionPolicy Bypass -File "LOIS Terminal\start.ps1"            # port 8600
#   powershell -ExecutionPolicy Bypass -File "LOIS Terminal\start.ps1" -Rebuild   # force a fresh frontend build
param([int]$Port = 8600, [switch]$Rebuild)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$python = Join-Path $root ".venv\Scripts\python.exe"
$frontend = Join-Path $here "frontend"

if ($Rebuild -or -not (Test-Path (Join-Path $frontend "dist\index.html"))) {
    Push-Location $frontend
    if (-not (Test-Path "node_modules")) { npm install --no-audit --no-fund }
    npm run build
    $built = $?
    Pop-Location
    if (-not $built) { Write-Error "Frontend build failed"; exit 1 }
}

& $python (Join-Path $here "backend\run.py") --port $Port
