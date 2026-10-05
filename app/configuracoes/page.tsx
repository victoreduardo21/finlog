'use client';

/**
 * ============================================================================
 * TELA: CONFIGURAÇÕES E PERFIL DO UTILIZADOR (SISTEMA FINANCEIRO)
 * Localização no VS Code: empresa/app/configuracoes/page.tsx
 * Tecnologias: Next.js (React / TypeScript)
 * Descrição: Lê os dados do utilizador logado no localStorage e permite a 
 *            visualização do perfil e atualização de informações de conta.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './../components/Navbar';

interface UsuarioSessao {
  id?: string;
  nome: string;
  email: string;
  perfil: string;
}

export default function ConfiguracoesPage() {
  const router = useRouter();

  // Estados de dados do utilizador
  const [usuarioLogado, setUsuarioLogado] = useState<UsuarioSessao | null>(null);
  
  // Estados do formulário de edição
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  
  // Estados de feedback visual
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  // 1. Carrega os dados do utilizador armazenados no localStorage ao abrir a tela
  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario') || localStorage.getItem('user');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }

    try {
      const objUsuario: UsuarioSessao = JSON.parse(usuarioSalvo);
      setUsuarioLogado(objUsuario);
      
      // Preenche os inputs com os dados carregados do banco/localStorage
      setNome(objUsuario.nome || '');
      setEmail(objUsuario.email || '');
    } catch (erro) {
      console.error('Erro ao ler dados da sessão:', erro);
      router.push('/');
    }
  }, [router]);

  // 2. Submissão das alterações do perfil para a API backend
  const handleSalvarConfiguracoes = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      setMensagemStatus('⚠️ O nome é obrigatório.');
      return;
    }

    setCarregando(true);
    setMensagemStatus('⏳ A atualizar os dados da conta...');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resposta = await fetch(`${apiUrl}/auth/atualizar-perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          id: usuarioLogado?.id,
          nome: nome.trim(),
          senha: novaSenha.trim() ? novaSenha.trim() : undefined,
        }),
      });

      const textoResposta = await resposta.text();

      if (textoResposta.trim().startsWith('<')) {
        throw new Error('Erro no servidor ao tentar atualizar as configurações.');
      }

      const resultado = JSON.parse(textoResposta);

      if (resposta.ok && resultado.sucesso) {
        // Atualiza a sessão local no localStorage
        const usuarioAtualizado = {
          ...usuarioLogado,
          nome: nome.trim(),
        };

        localStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));
        localStorage.setItem('user', JSON.stringify(usuarioAtualizado));
        setUsuarioLogado(usuarioAtualizado as UsuarioSessao);

        setMensagemStatus('✅ Definições atualizadas com sucesso!');
        setNovaSenha('');
      } else {
        setMensagemStatus(`❌ ${resultado.mensagem || 'Erro ao atualizar configurações.'}`);
      }
    } catch (erro: any) {
      setMensagemStatus(`❌ ${erro.message || 'Falha ao conectar com o servidor.'}`);
    } finally {
      setCarregando(false);
    }
  };

  if (!usuarioLogado) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', color: '#0f172a' }}>
      <Sidebar usuario={usuarioLogado} />

      <main style={{ marginLeft: '260px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            ⚙️ Configurações da Conta
          </h1>
          <p style={{ color: '#475569', margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: '500' }}>
            Consulte os dados do seu perfil e gira as credenciais do sistema
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', maxWidth: '1000px' }}>
          
          {/* CARTÃO 1: RESUMO DO PERFIL */}
          <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              👤 Informações Pessoais
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Nome do Utilizador</span>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: '0.2rem 0 0 0' }}>{usuarioLogado.nome}</p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Endereço de E-mail</span>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: '0.2rem 0 0 0' }}>{usuarioLogado.email}</p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Nível de Acesso (Perfil)</span>
                <div style={{ marginTop: '0.3rem' }}>
                  <span
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      backgroundColor: usuarioLogado.perfil === 'ADMIN' ? '#dbeafe' : '#f1f5f9',
                      color: usuarioLogado.perfil === 'ADMIN' ? '#1e40af' : '#475569',
                      border: usuarioLogado.perfil === 'ADMIN' ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                    }}
                  >
                    🔑 {usuarioLogado.perfil}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* CARTÃO 2: FORMULÁRIO DE EDIÇÃO */}
          <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              ✏️ Atualizar Dados
            </h2>

            <form onSubmit={handleSalvarConfiguracoes} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={estilos.label}>Nome Completo *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  style={estilos.input}
                />
              </div>

              <div>
                <label style={estilos.label}>E-mail (Apenas leitura)</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  style={{ ...estilos.input, backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                />
              </div>

              <div>
                <label style={estilos.label}>Nova Palavra-passe (Opcional)</label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Deixe em branco para não alterar"
                  style={estilos.input}
                />
              </div>

              <button
                type="submit"
                disabled={carregando}
                style={estilos.botaoSubmit}
              >
                {carregando ? '⏳ A guardar...' : '💾 Salvar Alterações'}
              </button>
            </form>

            {mensagemStatus && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  textAlign: 'center',
                  border: '1px solid',
                  backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : mensagemStatus.includes('✅') ? '#f0fdf4' : '#eff6ff',
                  color: mensagemStatus.includes('❌') ? '#991b1b' : mensagemStatus.includes('✅') ? '#166534' : '#1e40af',
                  borderColor: mensagemStatus.includes('❌') ? '#fecaca' : mensagemStatus.includes('✅') ? '#bbf7d0' : '#bfdbfe',
                }}
              >
                {mensagemStatus}
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}

const estilos: { [key: string]: React.CSSProperties } = {
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: '0.4rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #94a3b8',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.95rem',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box',
  },
  botaoSubmit: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '0.85rem',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '800',
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
};