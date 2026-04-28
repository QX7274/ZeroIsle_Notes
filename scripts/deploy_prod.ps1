<#
.SYNOPSIS
ZeroIsle Notes Production Deployment Script
.DESCRIPTION
This script automates the deployment process for ZeroIsle Notes on Windows.
It checks for necessary environment files, prompts for missing secrets, and runs docker-compose.
#>

$ErrorActionPreference = "Stop"
$BackendPath = Join-Path $PSScriptRoot "..\backend"
$EnvPath = Join-Path $BackendPath ".env"
$EnvExamplePath = Join-Path $BackendPath ".env.example"

Write-Host "🚀 ZeroIsle Notes Production Deployment" -ForegroundColor Cyan
Write-Host "======================================"

# 1. Check for .env file
if (-not (Test-Path $EnvPath)) {
    Write-Warning "⚠️  .env file not found in backend directory."
    if (Test-Path $EnvExamplePath) {
        Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
        Copy-Item $EnvExamplePath $EnvPath
        Write-Host "✅ .env created." -ForegroundColor Green
    } else {
        Write-Error "❌ .env.example not found! Cannot proceed."
    }
}

# 2. Check for Critical Secrets
$EnvContent = Get-Content $EnvPath
$MissingSecrets = $false

if ($EnvContent -match "your-sentry-dsn-here") {
    Write-Warning "⚠️  SENTRY_DSN is not configured."
    $SentryDSN = Read-Host "Please enter your Sentry DSN (or press Enter to skip)"
    if ($SentryDSN) {
        (Get-Content $EnvPath) -replace "your-sentry-dsn-here", $SentryDSN | Set-Content $EnvPath
        Write-Host "✅ SENTRY_DSN updated." -ForegroundColor Green
    }
}

if ($EnvContent -match "your-secret-key-here") {
    Write-Warning "⚠️  DJANGO_SECRET_KEY is using the default value."
    $NewSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 50 | % {[char]$_})
    $Update = Read-Host "Generate a new secure secret key? (Y/n)"
    if ($Update -ne "n") {
         (Get-Content $EnvPath) -replace "your-secret-key-here", $NewSecret | Set-Content $EnvPath
         Write-Host "✅ DJANGO_SECRET_KEY generated and updated." -ForegroundColor Green
    }
}

# 3. Build and Run via Docker Compose
Write-Host "`n🐳 Starting Docker Deployment..." -ForegroundColor Cyan
$DockerComposeFile = Join-Path $PSScriptRoot "..\docker-compose.yml"

# Load env vars for docker-compose interpolation
foreach ($line in Get-Content $EnvPath) {
    if ($line -match "^([^#=]+)=(.*)") { # Simple regex for KEY=VALUE
        $name = $matches[1]
        $value = $matches[2]
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

try {
    docker-compose -f $DockerComposeFile up --build -d
    Write-Host "`n✅ Deployment Successful!" -ForegroundColor Green
    Write-Host "API is running at http://localhost:8000"
    Write-Host "Health check: http://localhost:8000/health/"
} catch {
    Write-Error "❌ Deployment Failed: $_"
}
