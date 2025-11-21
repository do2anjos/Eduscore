/**
 * Script para limpar imagens temporárias antigas
 * Remove imagens temporárias (temp_resposta_*) que não foram finalizadas
 * e têm mais de X horas de idade
 * 
 * USO:
 * Execute: node scripts/limpar-imagens-temp.js [horas]
 * 
 * Por padrão, remove imagens com mais de 24 horas
 */

const fs = require('fs');
const path = require('path');

const TEMPO_LIMITE_HORAS = parseInt(process.argv[2]) || 24; // Padrão: 24 horas
const imagensTempDir = path.join(__dirname, '../uploads/imagens/temp');

function limparImagensTemporarias() {
  console.log(`🧹 Limpando imagens temporárias com mais de ${TEMPO_LIMITE_HORAS} horas...\n`);

  if (!fs.existsSync(imagensTempDir)) {
    console.log('✓ Diretório de imagens temporárias não existe. Nada a limpar.');
    return;
  }

  const arquivos = fs.readdirSync(imagensTempDir);
  const agora = Date.now();
  let removidos = 0;
  let totalTamanho = 0;

  arquivos.forEach(arquivo => {
    if (arquivo.startsWith('temp_resposta_')) {
      const caminhoCompleto = path.join(imagensTempDir, arquivo);
      
      try {
        const stats = fs.statSync(caminhoCompleto);
        const idadeHoras = (agora - stats.mtimeMs) / (1000 * 60 * 60);

        if (idadeHoras > TEMPO_LIMITE_HORAS) {
          const tamanho = stats.size;
          fs.unlinkSync(caminhoCompleto);
          removidos++;
          totalTamanho += tamanho;
          console.log(`  ✓ Removido: ${arquivo} (${idadeHoras.toFixed(2)} horas, ${(tamanho / 1024).toFixed(2)} KB)`);
        }
      } catch (err) {
        console.error(`  ❌ Erro ao processar ${arquivo}:`, err.message);
      }
    }
  });

  if (removidos > 0) {
    console.log(`\n✅ Limpeza concluída:`);
    console.log(`   - ${removidos} imagem(ns) temporária(s) removida(s)`);
    console.log(`   - ${(totalTamanho / 1024 / 1024).toFixed(2)} MB liberado(s)`);
  } else {
    console.log(`\n✅ Nenhuma imagem temporária antiga encontrada.`);
  }
}

limparImagensTemporarias();

