# Script para sincronizar alterações com o HuggingFace Space
# Uso: .\scripts\sync-huggingface.ps1 [-Message "sua mensagem de commit"]

param(
    [string]$Message = "sync: update HuggingFace Space files"
)

Write-Host "🚀 Sincronizando com HuggingFace Space..." -ForegroundColor Cyan

# Navegar para o diretório do HuggingFace Space
$HFSpaceDir = Join-Path $PSScriptRoot "..\huggingface-space"

if (-not (Test-Path $HFSpaceDir)) {
    Write-Host "❌ Diretório huggingface-space não encontrado!" -ForegroundColor Red
    exit 1
}

Push-Location $HFSpaceDir

try {
    # Verificar se há alterações
    $status = git status --porcelain
    
    if (-not $status) {
        Write-Host "✅ Nenhuma alteração para sincronizar." -ForegroundColor Green
        Pop-Location
        exit 0
    }
    
    Write-Host "📝 Alterações detectadas:" -ForegroundColor Yellow
    git status --short
    
    # Adicionar todas as alterações
    Write-Host "`n📦 Adicionando arquivos..." -ForegroundColor Cyan
    git add -A
    
    # Commit
    Write-Host "💾 Criando commit..." -ForegroundColor Cyan
    git commit -m $Message
    
    # Push
    Write-Host "🔄 Enviando para HuggingFace Space..." -ForegroundColor Cyan
    git push origin main
    
    Write-Host "`n✅ Sincronização concluída com sucesso!" -ForegroundColor Green
    Write-Host "🔗 Acesse: https://huggingface.co/spaces/do2anjos/eduscore-yolo-api" -ForegroundColor Blue
    
} catch {
    Write-Host "❌ Erro durante a sincronização: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
