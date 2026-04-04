# Deploy Agent-Lock Dashboard to Azure Static Web Apps
# Run this script from the dashboard directory

Write-Host "🚀 Deploying Agent-Lock Dashboard to Azure..." -ForegroundColor Cyan

# Build the Next.js app
Write-Host "`n📦 Building Next.js application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green

# Deploy to Azure Static Web Apps using SWA CLI
Write-Host "`n🌐 Deploying to Azure..." -ForegroundColor Yellow

# Install SWA CLI if not already installed
if (-not (Get-Command swa -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Azure Static Web Apps CLI..." -ForegroundColor Yellow
    npm install -g @azure/static-web-apps-cli
}

# Deploy
swa deploy .next/standalone `
    --app-name agent-lock-dashboard `
    --resource-group agent-lock-rg `
    --env production

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
    Write-Host "🌐 Landing Page: https://agent-lock-dashboard.azurewebsites.net" -ForegroundColor Cyan
    Write-Host "📊 Dashboard: https://agent-lock-dashboard.azurewebsites.net/dashboard" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
    exit 1
}
