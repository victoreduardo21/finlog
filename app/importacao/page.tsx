'use client';

/**
 * ============================================================================
 * TELA: IMPORTAÇÃO E FECHAMENTO DE MINUTAS (COM BARRA LATERAL E TRATAMENTO FIX)
 * Localização no VS Code: empresa/app/importacao/page.tsx
 * Tecnologias: Next.js (React / TypeScript)
 * Descrição: Renderiza o menu de navegação lateral, permite selecionar planilhas
 *            em formato Excel (.xlsx) e trata erros de resposta HTML com segurança.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// IMPORTAÇÃO DO COMPONENTE DE BARRA LATERAL DO PAINEL OPERACIONAL
import Sidebar from './../components/Navbar';

export default function ImportacaoPage() {
  const router = useRouter();

  // Estados de sessão do utilizador
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  // Estados do formulário de upload de arquivos
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState<{
    tipo: 'sucesso' | 'erro';
    texto: string;
  } | null>(null);

  // Define a URL base da API (usando variável de ambiente do Vercel/Render ou localhost)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Efeito para verificar a autenticação no localStorage ao carregar a página
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
      console.error('Erro ao carregar dados da sessão local.');
      router.push('/');
    }
  }, [router]);

  /**
   * Captura o ficheiro selecionado pelo utilizador no input
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArquivo(e.target.files[0]);
      setMensagemStatus(null);
    }
  };

  /**
   * Submete a planilha para o servidor backend
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
    setMensagemStatus(null);

    // Prepara o formulário Multipart/Form-Data para envio de arquivo
    const formData = new FormData();
    formData.append('file', arquivo);

    try {
      // Faz a requisição para a rota do backend Express
      const resposta = await fetch(`${apiUrl}/importacao/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: formData,
      });

      // Lê a resposta como texto primeiro para evitar a falha do JSON.parse se o servidor responder em HTML
      const textoResposta = await resposta.text();

      // Verifica se a resposta iniciou com HTML (ex: 404 Not Found ou erro interno)
      if (textoResposta.trim().startsWith('<')) {
        console.error('❌ Resposta HTML recebida do servidor:', textoResposta);
        throw new Error(
          `A rota (${apiUrl}/importacao/upload) não foi encontrada ou o servidor backend na porta 3001 está offline.`
        );
      }

      // Converte o texto para JSON com segurança
      const resultado = JSON.parse(textoResposta);

      if (resposta.ok && resultado.sucesso) {
        setMensagemStatus({
          tipo: 'sucesso',
          texto: `🎉 Planilha "${arquivo.name}" processada com sucesso! ${resultado.mensagem || ''}`,
        });
        setArquivo(null);
      } else {
        setMensagemStatus({
          tipo: 'erro',
          texto: `❌ ${resultado.mensagem || 'Erro ao processar os dados da planilha.'}`,
        });
      }
    } catch (erro: any) {
      console.error('Erro ao enviar planilha:', erro);
      setMensagemStatus({
        tipo: 'erro',
        texto: `❌ Erro ao importar planilha: ${erro.message || 'Erro de conexão com o servidor.'}`,
      });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', color: '#0f172a' }}>
      
      {/* 1. BARRA DE NAVEGAÇÃO LATERAL (RENDERIZADA NO LADO ESQUERDO DA TELA) */}
      <Sidebar usuario={usuarioLogado} />

      {/* 2. CONTEÚDO PRINCIPAL DA PÁGINA (COM MARGEM ESQUERDA PARA NÃO COBRIR O MENU) */}
      <main style={{ marginLeft: '250px', flex: 1, padding: '2rem 3rem' }}>
        
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Importação e Fechamento de Minutas
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: '500' }}>
            Acompanhamento em tempo real com validação e apontamento de contêineres já pagos
          </p>
        </header>

        {/* ÁREA DE CARREGAMENTO DE PLANILHA */}
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

          {/* MENSAGEM DE FEEDBACK VISUAL */}
          {mensagemStatus && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '0.85rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '700',
                textAlign: 'center',
                backgroundColor: mensagemStatus.tipo === 'erro' ? '#fef2f2' : '#f0fdf4',
                color: mensagemStatus.tipo === 'erro' ? '#b91c1c' : '#166534',
                border: '1px solid',
                borderColor: mensagemStatus.tipo === 'erro' ? '#fecaca' : '#bbf7d0',
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

// Estilos padronizados
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
