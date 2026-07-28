# Local PostgreSQL reset (without Docker).
# Requires PostgreSQL on localhost:5432 — same port as docker-compose.yml;
# stop Docker DB first: npm run db:down
#
# Superuser password: set PGPASSWORD before run, e.g.:
#   $env:PGPASSWORD = "postgres_password"
#   npm run db:reset:local

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$Psql = "C:\Program Files\PostgreSQL\10\bin\psql.exe"
$PgHost = "localhost"
$PgPort = "5432"
$PgSuperUser = "postgres"
$DbName = "hockey_bi"
$DbUser = "bi_user"
$DbPassword = "bi_password"

if (-not (Test-Path $Psql)) {
    Write-Error "psql not found at $Psql"
    exit 1
}

function Invoke-Psql {
    param(
        [string]$Database = "postgres",
        [string]$User = $PgSuperUser,
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    & $Psql -w -h $PgHost -p $PgPort -U $User -d $Database -v ON_ERROR_STOP=1 -c $Command
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Invoke-PsqlFile {
    param(
        [string]$Database = $DbName,
        [string]$User = $DbUser,
        [Parameter(Mandatory = $true)]
        [string]$File
    )

    & $Psql -w -h $PgHost -p $PgPort -U $User -d $Database -v ON_ERROR_STOP=1 -f $File
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Test-PsqlConnection {
    param(
        [string]$Database = "postgres",
        [string]$User = $PgSuperUser
    )

    $prev = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    & $Psql -w -h $PgHost -p $PgPort -U $User -d $Database -c "SELECT 1" *> $null
    $ok = $LASTEXITCODE -eq 0
    $ErrorActionPreference = $prev
    return $ok
}

if (-not $env:PGPASSWORD) {
    Write-Host "PGPASSWORD is not set. If psql asks for a password, set it first:"
    Write-Host '  $env:PGPASSWORD = "your_postgres_password"'
    Write-Host ""
}

Write-Host "==> Generating seed facts..."
npm run db:generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Checking PostgreSQL on ${PgHost}:${PgPort}..."
if (-not (Test-PsqlConnection)) {
    Write-Error @"
Cannot connect as $PgSuperUser to PostgreSQL on ${PgHost}:${PgPort}.
- Ensure local PostgreSQL is running (port 5432).
- Stop Docker DB if it conflicts: npm run db:down
- Set superuser password: `$env:PGPASSWORD = "..."`
"@
    exit 1
}

Write-Host "==> Ensuring role and database..."
$userExists = (& $Psql -w -h $PgHost -p $PgPort -U $PgSuperUser -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DbUser'" 2>$null).Trim()
if ($userExists -ne "1") {
    Invoke-Psql -Command "CREATE ROLE $DbUser WITH LOGIN PASSWORD '$DbPassword';"
} else {
    Invoke-Psql -Command "ALTER ROLE $DbUser WITH PASSWORD '$DbPassword';"
}

$dbExists = (& $Psql -w -h $PgHost -p $PgPort -U $PgSuperUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName'" 2>$null).Trim()
if ($dbExists -ne "1") {
    Invoke-Psql -Command "CREATE DATABASE $DbName OWNER $DbUser;"
}

Invoke-Psql -Database $DbName -Command "GRANT ALL ON SCHEMA public TO $DbUser;"
Invoke-Psql -Database $DbName -Command 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'

$prevPassword = $env:PGPASSWORD
$env:PGPASSWORD = $DbPassword

Write-Host "==> Dropping schema bi for clean reload..."
Invoke-Psql -Database $DbName -User $DbUser -Command "DROP SCHEMA IF EXISTS bi CASCADE;"

$dbDir = $PSScriptRoot
$sqlFiles = @(
    "01_schema.sql",
    "02_seed.sql",
    "03_seed_facts.sql",
    "04_views.sql"
)

foreach ($file in $sqlFiles) {
    $path = Join-Path $dbDir $file
    if (-not (Test-Path $path)) {
        Write-Error "Missing SQL file: $path"
        exit 1
    }
    Write-Host "==> Running $file..."
    Invoke-PsqlFile -File $path
}

Write-Host "==> Verifying loaded facts..."
& $Psql -w -h $PgHost -p $PgPort -U $DbUser -d $DbName -c @"
SELECT COUNT(*) AS sales FROM bi.sale;
SELECT COUNT(*) AS subscriptions FROM bi.subscription;
SELECT COALESCE(SUM(s.loyalty_discount_amount), 0) AS loyalty_discount_total
FROM bi.sale s
JOIN bi.revenue_stream rs ON rs.id = s.stream_id
WHERE rs.code = 'tickets';
"@
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($null -ne $prevPassword) {
    $env:PGPASSWORD = $prevPassword
} else {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "Done. Connection: localhost:${PgPort}, db=$DbName, user=$DbUser, password=$DbPassword"
