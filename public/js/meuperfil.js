    let usuarioAtual = null;

    // Carregar dados do usuário ao carregar a página
    document.addEventListener('DOMContentLoaded', async () => {
      await loadUserData();
      await carregarDadosPerfil();
    });

    async function carregarDadosPerfil() {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      try {
        const response = await apiFetch('/api/usuarios/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return;
          }
          throw new Error('Erro ao carregar dados do perfil');
        }

        const data = await response.json();

        if (data.sucesso && data.usuario) {
          usuarioAtual = data.usuario;
          preencherFormulario(data.usuario);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do perfil:', error);
        showToast('Erro ao carregar dados do perfil', 'error');
      }
    }

    function preencherFormulario(usuario) {
      document.getElementById('nome').value = usuario.nome || '';
      document.getElementById('email').value = usuario.email || '';
      document.getElementById('matricula').value = usuario.matricula || '';
      document.getElementById('telefone').value = usuario.telefone || '';
      document.getElementById('perfil').value = usuario.perfil ? usuario.perfil.charAt(0).toUpperCase() + usuario.perfil.slice(1) : '';

      // Atualizar foto de perfil
      const previewImg = document.getElementById('previewImagem');
      if (usuario.id) {
        // SEMPRE usar endpoint da API para fotos para evitar erro 431
        const token = localStorage.getItem('token');
        if (token) {
          // Limpar blob URL anterior se existir
          if (previewImg.src && previewImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(previewImg.src);
          }

          // Tentar carregar foto via API
          apiFetch(`/api/usuarios/${usuario.id}/foto?t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
            .then(response => {
              if (response.ok) {
                return response.blob();
              }
              // Se retornar 404, não há foto salva ainda
              if (response.status === 404) {
                return null;
              }
              throw new Error(`Erro ao carregar foto: ${response.status}`);
            })
            .then(blob => {
              if (blob) {
                // Criar blob URL para exibir a imagem
                const blobUrl = URL.createObjectURL(blob);
                previewImg.src = blobUrl;
                previewImg.alt = usuario.nome || 'Foto de Perfil';

                previewImg.onerror = function () {
                  URL.revokeObjectURL(blobUrl); // Limpar blob URL em caso de erro
                  this.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
                  this.alt = 'Foto de Perfil';
                  this.onerror = null;
                };
              } else {
                // Se blob for null (404), usar imagem padrão
                previewImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
                previewImg.alt = 'Foto de Perfil';
                previewImg.onerror = null;
              }
            })
            .catch(error => {
              previewImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
              previewImg.alt = 'Foto de Perfil';
              previewImg.onerror = null;
            });
        } else {
          previewImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
          previewImg.alt = 'Foto de Perfil';
          previewImg.onerror = null;
        }
      } else {
        previewImg.src = 'https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png';
        previewImg.alt = 'Foto de Perfil';
        previewImg.onerror = null;
      }
    }

    function previewImagemPerfil(event) {
      const input = event.target;
      const imagemPreview = document.getElementById('previewImagem');

      if (input.files && input.files[0]) {
        if (input.files[0].size > 5 * 1024 * 1024) {
          showToast('A imagem é muito grande. Por favor, selecione uma imagem menor que 5MB.', 'error');
          return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
          imagemPreview.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
      }
    }

    function formatarTelefone(input) {
      let value = input.value.replace(/\D/g, '');

      if (value.length > 11) {
        value = value.substring(0, 11);
      }

      if (value.length > 2) {
        value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
      }

      if (value.length > 10) {
        value = `${value.substring(0, 10)}-${value.substring(10)}`;
      }

      input.value = value;
    }

    async function atualizarPerfil(event) {
      event.preventDefault();

      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      const formData = {
        nome: document.getElementById('nome').value,
        telefone: document.getElementById('telefone').value.replace(/\D/g, '')
      };

      // Adicionar foto se foi selecionada
      const fileInput = document.getElementById('uploadFoto');
      if (fileInput.files && fileInput.files[0]) {
        // Validar tamanho antes de processar (máximo 1MB para evitar erro 431)
        if (fileInput.files[0].size > 1024 * 1024) { // 1MB máximo
          showToast('A imagem é muito grande. Por favor, selecione uma imagem menor que 1MB.', 'error');
          return;
        }

        // Comprimir a imagem antes de enviar
        await comprimirEEnviarImagem(fileInput.files[0], formData, token);
      } else {
        await enviarAtualizacao(formData, token);
      }
    }

    async function comprimirEEnviarImagem(file, formData, token) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          const img = new Image();
          img.onload = function () {
            // Criar canvas para redimensionar e comprimir
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;

            // Redimensionar mantendo proporção
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;

            // Desenhar imagem redimensionada no canvas com suavização
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Tentar diferentes níveis de qualidade até atingir o tamanho desejado
            let quality = 0.7; // Começar com 70% de qualidade
            let base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
            const MAX_SIZE = 250 * 1024; // 250KB máximo em base64 (reduzido para evitar erro 431)

            // Se ainda for muito grande, reduzir qualidade progressivamente
            while (base64.length > MAX_SIZE && quality > 0.3) {
              quality -= 0.1;
              base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
            }

            // Se ainda for muito grande após reduzir qualidade, redimensionar mais
            if (base64.length > MAX_SIZE) {
              // Redimensionar para 300x300
              canvas.width = 300;
              canvas.height = 300;
              ctx.clearRect(0, 0, 300, 300);
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, 300, 300);
              quality = 0.6;
              base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];

              // Se ainda for muito grande, reduzir mais
              if (base64.length > MAX_SIZE) {
                while (base64.length > MAX_SIZE && quality > 0.4) {
                  quality -= 0.1;
                  base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
                }
              }
            }

            // Verificação final - se ainda for muito grande, rejeitar
            if (base64.length > MAX_SIZE) {
              showToast('A imagem ainda é muito grande após compressão. Por favor, selecione uma imagem menor.', 'error');
              reject(new Error('Imagem muito grande'));
              return;
            }

              tamanhoOriginal: file.size,
              tamanhoComprimido: base64.length,
              tamanhoKB: Math.round(base64.length / 1024),
              qualidade: quality,
              dimensoes: `${width}x${height}`
            });

            // Armazenar apenas a parte base64 (sem prefixo data:)
            formData.foto_perfil = base64;
            enviarAtualizacao(formData, token).then(resolve).catch(reject);
          };
          img.onerror = function () {
            showToast('Erro ao processar a imagem. Tente novamente.', 'error');
            reject(new Error('Erro ao processar imagem'));
          };
          img.src = e.target.result;
        };
        reader.onerror = function () {
          showToast('Erro ao ler a imagem. Tente novamente.', 'error');
          reject(new Error('Erro ao ler arquivo'));
        };
        reader.readAsDataURL(file);
      });
    }

    async function enviarAtualizacao(formData, token) {
      try {
        document.getElementById('btnText').textContent = 'Salvando...';
        document.getElementById('btnSpinner').style.display = 'inline-block';
        document.getElementById('submitBtn').disabled = true;

        // Obter ID do usuário - tentar primeiro do usuarioAtual, depois do token
        let userId = null;

        if (usuarioAtual && usuarioAtual.id) {
          userId = usuarioAtual.id;
        } else {
          // Se usuarioAtual não estiver disponível, tentar carregar novamente
          try {
            const response = await apiFetch('/api/usuarios/me', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              const data = await response.json();
              if (data.sucesso && data.usuario && data.usuario.id) {
                usuarioAtual = data.usuario;
                userId = data.usuario.id;
              }
            }
          } catch (e) {
          }

          // Se ainda não tiver userId, tentar extrair do token
          if (!userId) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              userId = payload.userId;
            } catch (e) {
              throw new Error('Não foi possível identificar o usuário. Faça login novamente.');
            }
          }
        }

        if (!userId) {
          throw new Error('Não foi possível identificar o usuário. Faça login novamente.');
        }

        // Se a foto for muito grande (mais de 250KB em base64), não enviar
        if (formData.foto_perfil && formData.foto_perfil.length > 250 * 1024) {
          delete formData.foto_perfil;
          showToast('A imagem é muito grande. Por favor, selecione uma imagem menor.', 'warning');
        }

        if (formData.foto_perfil) {
            existe: true,
            tamanho: formData.foto_perfil.length,
            tamanhoKB: Math.round(formData.foto_perfil.length / 1024),
            primeirosCaracteres: formData.foto_perfil.substring(0, 50) + '...'
          });
        } else {
        }

        const response = await apiFetch(`/api/usuarios/${userId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return;
          }
          if (response.status === 404) {
            throw new Error(data.erro || 'Usuário não encontrado. Faça login novamente.');
          }
          throw new Error(data.erro || 'Erro ao atualizar perfil');
        }

        showToast('Perfil atualizado com sucesso!', 'success');

        // Limpar input de arquivo após salvar com sucesso
        const fileInput = document.getElementById('uploadFoto');
        if (fileInput) {
          fileInput.value = '';
        }

        // Atualizar usuarioAtual com os dados retornados do servidor
        if (data.sucesso && data.usuario) {
            id: data.usuario.id,
            nome: data.usuario.nome,
            temFoto: !!data.usuario.foto_perfil,
            tamanhoFoto: data.usuario.foto_perfil ? data.usuario.foto_perfil.length : 0
          });

          usuarioAtual = data.usuario;

          // Se tinha foto no upload, aguardar um pouco para garantir que o banco foi atualizado
          // antes de recarregar a foto do servidor
          if (formData.foto_perfil) {
            // Atualizar campos do formulário (exceto foto, que será recarregada)
            document.getElementById('nome').value = data.usuario.nome || '';
            document.getElementById('email').value = data.usuario.email || '';
            document.getElementById('matricula').value = data.usuario.matricula || '';
            document.getElementById('telefone').value = data.usuario.telefone || '';
            document.getElementById('perfil').value = data.usuario.perfil ? data.usuario.perfil.charAt(0).toUpperCase() + data.usuario.perfil.slice(1) : '';

            // Aguardar um pouco antes de recarregar a foto para garantir que o banco foi atualizado
            setTimeout(() => {
              preencherFormulario(data.usuario);
            }, 500);
          } else {
            // Se não tinha foto no upload, atualizar tudo imediatamente
            preencherFormulario(data.usuario);
          }
        } else {
        }

        // Recarregar dados do usuário para atualizar sidebar
        // Aguardar um pouco para garantir que o banco foi atualizado antes de recarregar
        setTimeout(async () => {
          await loadUserData();
        }, 1000);

      } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        showToast(`Erro ao atualizar perfil: ${error.message}`, 'error');
      } finally {
        document.getElementById('btnText').textContent = 'Salvar Alterações';
        document.getElementById('btnSpinner').style.display = 'none';
        document.getElementById('submitBtn').disabled = false;
      }
    }

    async function alterarSenha(event) {
      event.preventDefault();

      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login.html';
        return;
      }

      const senhaAtual = document.getElementById('senhaAtual').value;
      const novaSenha = document.getElementById('novaSenha').value;
      const confirmarNovaSenha = document.getElementById('confirmarNovaSenha').value;

      if (novaSenha !== confirmarNovaSenha) {
        showToast('As senhas não coincidem', 'error');
        return;
      }

      // Validar força da senha
      const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%*?&])[A-Za-z\d#@$!%*?&]{8,}$/;
      if (!PASSWORD_REGEX.test(novaSenha)) {
        showToast('A senha deve conter: 8+ caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 símbolo (#@$!%*?&)', 'error');
        return;
      }

      try {
        document.getElementById('btnSenhaText').textContent = 'Alterando...';
        document.getElementById('btnSenhaSpinner').style.display = 'inline-block';
        document.getElementById('submitSenhaBtn').disabled = true;

        // Obter ID do usuário do token se usuarioAtual não estiver disponível
        let userId = usuarioAtual?.id;
        if (!userId) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.userId;
          } catch (e) {
            showToast('Não foi possível identificar o usuário. Faça login novamente.', 'error');
            return;
          }
        }

        const response = await apiFetch(`/api/usuarios/${userId}/senha`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            senha_atual: senhaAtual,
            nova_senha: novaSenha
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.erro || 'Erro ao alterar senha');
        }

        showToast('Senha alterada com sucesso!', 'success');
        document.getElementById('formSenha').reset();

      } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showToast(`Erro ao alterar senha: ${error.message}`, 'error');
      } finally {
        document.getElementById('btnSenhaText').textContent = 'Alterar Senha';
        document.getElementById('btnSenhaSpinner').style.display = 'none';
        document.getElementById('submitSenhaBtn').disabled = false;
      }
    }