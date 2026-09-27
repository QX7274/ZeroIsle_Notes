<#
.SYNOPSIS
ZeroIsle Notes Production Deployment Script
.DESCRIPTION
This script automates the deployment process for ZeroIsle Notes on Windows.
It requires a production environment file and runs the production Compose definition.
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvPath = Join-Path $ProjectRoot ".env.production"
$DockerComposeFile = Join-Path $ProjectRoot "docker-compose.prod.yml"

function Invoke-ReleaseProbe {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$Name,
        [int]$MaxAttempts = 30,
        [int]$DelaySeconds = 2
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                Write-Host "$Name probe passed (attempt $attempt/$MaxAttempts)." -ForegroundColor Green
                return
            }
            Write-Warning "$Name probe returned HTTP $($response.StatusCode) (attempt $attempt/$MaxAttempts)."
        } catch {
            Write-Warning "$Name probe is not ready (attempt $attempt/$MaxAttempts)."
        }

        if ($attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "$Name probe failed after $MaxAttempts attempts: $Uri"
}

Write-Host "🚀 ZeroIsle Notes Production Deployment" -ForegroundColor Cyan
Write-Host "======================================"

# 1. Check for production environment and Compose files
if (-not (Test-Path $EnvPath)) {
    throw "❌ .env.production not found at $EnvPath. Create it outside Git before deploying."
}

if (-not (Test-Path $DockerComposeFile)) {
    throw "❌ docker-compose.prod.yml not found at $DockerComposeFile."
}

# 2. Check for critical production configuration
$EnvContent = Get-Content $EnvPath -Raw -Encoding UTF8
if ($EnvContent -match "your-secret-key-here|changeme|your-sentry-dsn-here|__CHANGE_ME|__MONGO_PASSWORD__|__SENDGRID_API_KEY__") {
    throw "❌ .env.production contains placeholder secrets. Refusing to deploy."
}

$requiredKeys = @(
    'DJANGO_ENV',
    'DJANGO_SECRET_KEY',
    'MONGO_URI',
    'MONGO_DB',
    'MONGO_USER',
    'MONGO_PASSWORD',
    'NEO4J_PASSWORD'
)
foreach ($key in $requiredKeys) {
    $match = [regex]::Match($EnvContent, "(?m)^$([regex]::Escape($key))\s*=\s*(.+)$")
    if (-not $match.Success -or [string]::IsNullOrWhiteSpace($match.Groups[2].Value)) {
        throw "❌ Required production variable '$key' is missing or empty. Refusing to deploy."
    }
}

if ($EnvContent -match '(?im)^DEBUG\s*=\s*(true|1|yes)\s*$' -or
    $EnvContent -notmatch '(?im)^DJANGO_ENV\s*=\s*production\s*$') {
    throw "❌ Production environment must set DJANGO_ENV=production and DEBUG=False."
}

# 3. Build and Run via Docker Compose
Write-Host "Starting Docker Deployment..." -ForegroundColor Cyan

# Load env vars for docker-compose interpolation
foreach ($line in Get-Content $EnvPath) {
    if ($line -match "^([^#=]+)=(.*)") { # Simple regex for KEY=VALUE
        $name = $matches[1]
        $value = $matches[2]
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

try {
    docker compose --env-file $EnvPath -f $DockerComposeFile config --quiet
    docker compose --env-file $EnvPath -f $DockerComposeFile up --build -d
    Invoke-ReleaseProbe -Name "Liveness" -Uri "http://localhost:8000/health/"
    Invoke-ReleaseProbe -Name "Readiness" -Uri "http://localhost:8000/ready/"
    Write-Host "Deployment Successful!" -ForegroundColor Green
    Write-Host "API is running at http://localhost:8000"
    Write-Host "Health check: http://localhost:8000/health/"
    Write-Host "Readiness check: http://localhost:8000/ready/"
} catch {
    Write-Error "❌ Deployment Failed: $_"
    try {
        docker compose --env-file $EnvPath -f $DockerComposeFile logs --tail 100 backend
    } catch {
        Write-Warning "Unable to collect backend logs after deployment failure."
    }
    throw
}
