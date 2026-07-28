$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Test-DockerReady {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    docker context use desktop-linux *> $null
    docker ps *> $null
    $ok = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prev
    return $ok
}

Write-Host "==> Generating seed facts..."
npm run db:generate

Write-Host "==> Waiting for Docker Desktop..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    if (Test-DockerReady) {
        $ready = $true
        Write-Host "Docker is ready."
        break
    }
    if ($i -eq 0) {
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 5
}

if (-not $ready) {
    Write-Error "Docker Desktop is not running. Start it manually, then run: npm run db:reset"
    exit 1
}

Write-Host "==> Recreating PostgreSQL volume and container..."
docker compose down -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker compose up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Waiting for PostgreSQL to become healthy..."
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    docker exec hockey-bi-db pg_isready -U bi_user -d hockey_bi *> $null
    $ok = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prev
    if ($ok) {
        $healthy = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $healthy) {
    Write-Error "PostgreSQL container did not become ready in time."
    exit 1
}

Write-Host "==> Verifying loaded facts..."
docker exec hockey-bi-db psql -U bi_user -d hockey_bi -c "SELECT COUNT(*) AS sales FROM bi.sale; SELECT COUNT(*) AS subscriptions FROM bi.subscription; SELECT COUNT(*) AS redemptions FROM bi.subscription_redemption; SELECT COALESCE(SUM(s.loyalty_discount_amount), 0) AS loyalty_discount_total FROM bi.sale s JOIN bi.revenue_stream rs ON rs.id = s.stream_id WHERE rs.code = 'tickets';"

Write-Host "Done. Connection: localhost:5432, db=hockey_bi, user=bi_user, password=bi_password"
