'use client';

/**
 * ============================================================================
 * TELA: IMPORTAÇÃO E FECHAMENTO DE MINUTAS (COM DIAGNÓSTICO DE SERVIDOR)
 * Localização no VS Code: empresa/app/importacao/page.tsx
 * Tecnologias: Next.js (React / TypeScript)
 * Descrição: Inclui barra lateral (Sidebar), verifica o estado do backend e
 *            trata respostas em HTML contra estouro de limites do Render.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// IMPORTAÇÃO DA BARRA DE NAVEGAÇÃO LATERAL
import Sidebar from '../components/Navbar';

export default function ImportacaoPage() {
  const router = useRouter();

  // Estados de sessão
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  // Estados do formulário e upload
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [statusBackend, setStatusBackend] = useState<'verificando' | 'online' | 'offline'>('verificando');
  const [mensagemStatus, setMensagemStatus] = useState<{
    tipo: 'sucesso' | 'erro' | 'info';
    texto: string;
  } | null>(null);

  // URL do backend em produção (Render) ou desenvolvimento local
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Verifica autenticação e testa se o servidor Render está ativo ("acordado")
  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }

    try {
      setUsuarioLogado(JSON.parse(usuarioSalvo));
    } catch (e) {
      router.push('/');
    }

    // Testa a ligação com o backend no Render
    const checarBackend = async () => {
      try {
        const res = await fetch(`${apiUrl}/auth/login`, { method: 'OPTIONS' });
        setStatusBackend('online');
      } catch (err) {
        console.warn('⚠️ Backend pode estar adormecido ou inacessível no Render.');
        setStatusBackend('offline');
      }
    };

    checarBackend();
  }, [router, apiUrl]);

  /**
   * Captura o ficheiro selecionado
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArquivo(e.target.files[0]);
      setMensagemStatus(null);
    }
  };

  /**
   * Envia a planilha com verificação de erros do Render
   */
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!arquivo) {
      setMensagemStatus({
        tipo: 'erro',
        texto: '⚠️ Por favor, selecione uma planilha Excel (.xlsx) antes de carregar.',
      });
      return;
    }

    setCarregando(true);
    setMensagemStatus({
      tipo: 'info',
      texto: '⏳ A ligar ao servidor... (Se o Render estiver adormecido, pode demorar até 1 minuto).',
    });

    const formData = new FormData();
    formData.append('file', arquivo);

    try {
      const resposta = await fetch(`${apiUrl}/importacao/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: formData,
      });

      const textoResposta = await resposta.text();

      // Se a resposta for HTML, o Render/Vercel devolveu erro 404, 502 ou 503
      if (textoResposta.trim().startsWith('<')) {
        console.error('❌ Resposta HTML recebida:', textoResposta);
        throw new Error(
          `O servidor no Render não encontrou a rota (${apiUrl}/importacao/upload) ou atingiu o limite do plano gratuito.`
        );
      }

      const resultado = JSON.parse(textoResposta);

      if (resposta.ok && resultado.sucesso) {
        setMensagemStatus({
          tipo: 'sucesso',
          texto: `🎉 Planilha "${arquivo.name}" importada com sucesso! ${resultado.mensagem || ''}`,
        });
        setArquivo(null);
      } else {
        setMensagemStatus({
          tipo: 'erro',
          texto: `❌ ${resultado.mensagem || 'Erro ao processar ficheiro no servidor.'}`,
        });
      }
    } catch (erro: any) {
      console.error('Erro de upload:', erro);
      setMensagemStatus({
        tipo: 'erro',
        texto: `❌ ${erro.message || 'Erro de conexão com o servidor.'}`,
      });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', color: '#0f172a' }}>
      
      {/* BARRA LATERAL RENDERIZADA */}
      <Sidebar usuario={usuarioLogado} />

      {/* CONTEÚDO PRINCIPAL COM MARGEM ESQUERDA */}
      <main style={{ marginLeft: '250px', flex: 1, padding: '2rem 3rem' }}>
        
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Importação e Fechamento de Minutas
            </h1>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: '500' }}>
              Acompanhamento em tempo real com validação e apontamento de contêineres já pagos
            </p>
          </div>

          {/* INDICADOR DE STATUS DO SERVIDOR (RENDER) */}
          <div style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            padding: '0.4rem 0.8rem',
            borderRadius: '20px',
            backgroundColor: statusBackend === 'online' ? '#dcfce7' : statusBackend === 'offline' ? '#fee2e2' : '#f1f5f9',
            color: statusBackend === 'online' ? '#166534' : statusBackend === 'offline' ? '#991b1b' : '#475569',
            border: '1px solid',
            borderColor: statusBackend === 'online' ? '#bbf7d0' : statusBackend === 'offline' ? '#fecaca' : '#cbd5e1',
          }}>
            {statusBackend === 'online' ? '🟢 Servidor Conectado' : statusBackend === 'offline' ? '🔴 Servidor Offline / Adormecido' : '🟡 A verificar servidor...'}
          </div>
        </header>

        {/* ÁREA DE CARREGAMENTO */}
        <section style={estilos.cardContainer}>
          <form onSubmit={handleUpload} style={estilos.areaDrop}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚡</div>
            <p style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '1.05rem' }}>
              {arquivo ? arquivo.name : 'importar sistema.xlsx'}
            </p>
            <p style={{ margin: '0.3rem 0 1.25rem 0', color: '#64748b', fontSize: '0.85rem' }}>
              Carregue a planilha para incluir novos lançamentos e visualizar contêineres já pagos.
            </p>

            <input
              type="file"
              id="fileInput"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <label htmlFor="fileInput" style={estilos.botaoSelecionar}>
                📂 {arquivo ? 'Alterar Planilha' : 'Selecionar Planilha'}
              </label>

              {arquivo && (
                <button type="submit" disabled={carregando} style={estilos.botaoCarregar}>
                  {carregando ? '⏳ A processar...' : 'Carregar Planilha Excel'}
                </button>
              )}
            </div>
          </form>

          {/* MENSAGEM DE FEEDBACK */}
          {mensagemStatus && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '0.85rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '700',
                textAlign: 'center',
                backgroundColor: mensagemStatus.tipo === 'erro' ? '#fef2f2' : mensagemStatus.tipo === 'sucesso' ? '#f0fdf4' : '#eff6ff',
                color: mensagemStatus.tipo === 'erro' ? '#b91c1c' : mensagemStatus.tipo === 'sucesso' ? '#166534' : '#1e40af',
                border: '1px solid',
                borderColor: mensagemStatus.tipo === 'erro' ? '#fecaca' : mensagemStatus.tipo === 'sucesso' ? '#bbf7d0' : '#bfdbfe',
              }}
            >
              {mensagemStatus.texto}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const estilos: { [key: string]: React.CSSProperties } = {
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '2rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  areaDrop: {
    border: '2px dashed #cbd5e1',
    borderRadius: '10px',
    padding: '3rem 2rem',
    textAlign: 'center',
    backgroundColor: '#fafafa',
  },
  botaoSelecionar: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.9rem',
    cursor: 'pointer',
    display: 'inline-block',
  },
  botaoCarregar: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
};
