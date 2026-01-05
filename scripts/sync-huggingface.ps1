# Script para sincronizar HuggingFace Space
# Uso: .\scripts\sync-huggingface.ps1 "mensagem do commit"

param(
    [string]$CommitMessage = "update: sync changes to HuggingFace Space"
)

$HfSpacePath = Join-Path $PSScriptRoot "..\huggingface-space"

Write-Host "🚀 Sincronizando HuggingFace Space..." -ForegroundColor Cyan

# Navegar para o diretório
Push-Location $HfSpacePath

try {
    # Verificar status
    Write-Host "`n📋 Status atual:" -ForegroundColor Yellow
    git status --short

    # Verificar se há mudanças
    $changes = git status --porcelain
    if (-not $changes) {
        Write-Host "`n✅ Nenhuma mudança para sincronizar." -ForegroundColor Green
        exit 0
    }

    # Adicionar todas as mudanças
    Write-Host "`n📦 Adicionando mudanças..." -ForegroundColor Yellow
    git add .

    # Commit
    Write-Host "`n💾 Criando commit..." -ForegroundColor Yellow
    git commit -m $CommitMessage

    # Push
    Write-Host "`n🔄 Enviando para HuggingFace..." -ForegroundColor Yellow
    git push origin main

    Write-Host "`n✅ Sincronização concluída com sucesso!" -ForegroundColor Green
    Write-Host "🌐 URL: https://huggingface.co/spaces/do2anjos/eduscore-yolo-api" -ForegroundColor Cyan
}
catch {
    Write-Host "`n❌ Erro durante sincronização: $_" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
