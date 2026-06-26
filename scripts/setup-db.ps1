# Migration base StockBTP
# Prérequis : Node.js 20+ et pnpm installés
# Usage : clic droit > Exécuter avec PowerShell  OU  .\scripts\setup-db.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js est requis. Installez-le depuis https://nodejs.org puis relancez." -ForegroundColor Red
  exit 1
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host "Installation de pnpm..." -ForegroundColor Yellow
  npm install -g pnpm
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installation des dependances..." -ForegroundColor Yellow
  pnpm install
}

Write-Host "Migration SQL (production_schema_v2)..." -ForegroundColor Cyan
pnpm db:migrate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Synchronisation schema Drizzle..." -ForegroundColor Cyan
pnpm db:push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Seed donnees demo..." -ForegroundColor Cyan
pnpm db:seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Base de donnees prete." -ForegroundColor Green
