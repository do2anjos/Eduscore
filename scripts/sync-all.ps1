# Script para sincronizar TODOS os repositórios (GitHub + HuggingFace)
# Uso: .\scripts\sync-all.ps1 [-Message "sua mensagem de commit"]

param(
    [string]$Message = "sync: update all repositories"
)

Write-Host "🚀 Sincronizando TODOS os repositórios..." -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor DarkGray

$ProjectRoot = Split-Path $PSScriptRoot -Parent

# ========================================
# 1. GITHUB (Render)
# ========================================
Write-Host "`n📦 [1/2] GITHUB (Render)" -ForegroundColor Yellow
Write-Host "-" * 30 -ForegroundColor DarkGray

Push-Location $ProjectRoot

try {
    $status = git status --porcelain
    
    if ($status) {
        Write-Host "📝 Alterações detectadas no projeto principal" -ForegroundColor Cyan
        git add -A
        git commit -m $Message
        git push origin main
        Write-Host "✅ GitHub atualizado!" -ForegroundColor Green
    } else {
        Write-Host "✅ Nenhuma alteração no projeto principal." -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro ao sincronizar GitHub: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

# ========================================
# 2. HUGGINGFACE SPACE
# ========================================
Write-Host "`n📦 [2/2] HUGGINGFACE SPACE" -ForegroundColor Yellow
Write-Host "-" * 30 -ForegroundColor DarkGray

$HFSpaceDir = Join-Path $ProjectRoot "huggingface-space"
Push-Location $HFSpaceDir

try {
    $status = git status --porcelain
    
    if ($status) {
        Write-Host "📝 Alterações detectadas no HuggingFace Space" -ForegroundColor Cyan
        git add -A
        git commit -m $Message
        git push origin main
        Write-Host "✅ HuggingFace Space atualizado!" -ForegroundColor Green
    } else {
        Write-Host "✅ Nenhuma alteração no HuggingFace Space." -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro ao sincronizar HuggingFace: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

# ========================================
# RESUMO
# ========================================
Write-Host "`n" + "=" * 50 -ForegroundColor DarkGray
Write-Host "🎉 Sincronização completa!" -ForegroundColor Green
Write-Host "`n📍 Links:" -ForegroundColor Cyan
Write-Host "   GitHub:     https://github.com/Do2anjos/Eduscore" -ForegroundColor Blue
Write-Host "   HuggingFace: https://huggingface.co/spaces/do2anjos/eduscore-yolo-api" -ForegroundColor Blue
Write-Host "   Render:     (deploy automático após push no GitHub)" -ForegroundColor Blue
