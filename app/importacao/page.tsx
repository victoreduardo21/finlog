'use client';

/**
 * ============================================================================
 * TELA: IMPORTAÇÃO E FECHAMENTO DE MINUTAS (TRATAMENTO DE ERRO HTML FIX)
 * Localização no VS Code: empresa/app/importacao/page.tsx
 * Descrição: Trata a resposta da API garantindo que erros em formato HTML
 *            sejam capturados sem quebrar o parser JSON do navegador.
 * ============================================================================
 */

import React, { useState } from 'react';
import Sidebar from '../components/Navbar'; // ou do teu componente de menu

export default function ImportacaoPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // URL base da API do teu Backend (Certifica-te que está apontando para o Render em produção)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  /**
   * Captura o arquivo selecionado pelo usuário
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArquivo(e.target.files[0]);
      setMensagemStatus(null);
    }
  };

  /**
   * Envia a planilha para o backend
   */
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!arquivo) {
      setMensagemStatus({ tipo: 'erro', texto: '⚠️ Por favor, selecione uma planilha Excel (.xlsx) antes de carregar.' });
      return;
    }

    setCarregando(true);
    setMensagemStatus(null);

    // Cria o formulário em formato Multipart/Data para envio de arquivo
    const formData = new FormData();
    formData.append('file', arquivo); // ou 'planilha', conforme configurado no backend

    try {
      // Faz o pedido para o endpoint de upload no backend
      const resposta = await fetch(`${apiUrl}/importacao/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: formData,
      });

      // Lê a resposta como texto primeiro para evitar a falha do JSON.parse se for HTML
      const textoResposta = await resposta.text();

      // Se a resposta começar com '<', o servidor devolveu uma página HTML (Ex: 404 Not Found ou 500 Internal Error)
      if (textoResposta.trim().startsWith('<')) {
        console.error('❌ O servidor devolveu uma resposta em HTML:', textoResposta);
        throw new Error(`A rota de importação (${apiUrl}/importacao/upload) não foi encontrada ou o backend está inacessível.`);
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
          texto: `❌ Erro ao importar planilha: ${resultado.mensagem || 'Falha no processamento dos dados.'}`,
        });
      }
    } catch (erro: any) {
      console.error('Erro no upload da planilha:', erro);
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
      <main style={{ flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Importação e Fechamento de Minutas
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: '500' }}>
            Acompanhamento em tempo real com validação e apontamento de contêineres já pagos
          </p>
        </header>

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
