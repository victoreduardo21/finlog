'use client';

/**
 * ============================================================================
 * TELA: RELATÓRIO DE PAGOS (CORREÇÃO DE COR DE TEXTO NOS INPUTS)
 * Localização no projeto: web/app/relatorios/page.tsx
 * Tecnologias: Next.js (React / TypeScript), Express API, MongoDB Atlas
 * Descrição: Garante que o texto digitado e as datas fiquem em tom azul/preto
 *            escuro bem visível (#0f172a).
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Navbar';

interface RelatorioItem {
  _id: string;
  placa: string;
  favorecido: string;
  dataPagamento: string;
  valorPago: number;
}

export default function RelatorioPagosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);

  const [listaRelatorio, setListaRelatorio] = useState<RelatorioItem[]>([]);
  const [termoPlaca, setTermoPlaca] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  const [carregando, setCarregando] = useState<boolean>(false);
  const [mensagemStatus, setMensagemStatus] = useState<string>('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Formatação de moeda BRL
  const formatarMoeda = (valor: number) => {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Formatação de data BR (DD/MM/AAAA)
  const formatarDataBR = (dataStr?: string) => {
    if (!dataStr) return '-';
    const data = new Date(dataStr);
    return isNaN(data.getTime()) ? '-' : data.toLocaleDateString('pt-BR');
  };

  /**
   * BUSCA O RELATÓRIO NO BACKEND
   */
  const carregarRelatorioPagos = useCallback(async () => {
    setCarregando(true);
    setMensagemStatus('⏳ A carregar relatório de pagamentos...');

    try {
      const resposta = await fetch(`${apiUrl}/importacao/relatorio-pagos`);
      const resultado = await resposta.json();

      if (resposta.ok && Array.isArray(resultado.dados)) {
        setListaRelatorio(resultado.dados);
        if (resultado.dados.length === 0) {
          setMensagemStatus('⚠️ Nenhuma baixa registrada até o momento.');
        } else {
          setMensagemStatus(`✅ Encontrados ${resultado.dados.length} registo(s) pago(s).`);
        }
      } else {
        setMensagemStatus('⚠️ Nenhum registo pago encontrado.');
      }
    } catch (erro) {
      setMensagemStatus('❌ Falha ao conectar ao servidor backend.');
    } finally {
      setCarregando(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }
    setUsuario(JSON.parse(usuarioSalvo));
    carregarRelatorioPagos();
  }, [router, carregarRelatorioPagos]);

  // FILTRAGEM DOS DADOS
  const relatorioFiltrado = listaRelatorio.filter((item) => {
    const bateuPlaca = item.placa.includes(termoPlaca.toUpperCase().trim());
    if (!bateuPlaca) return false;

    if (dataInicio || dataFim) {
      if (!item.dataPagamento) return false;
      const dataItem = new Date(item.dataPagamento).getTime();

      if (dataInicio) {
        const inicioMs = new Date(`${dataInicio}T00:00:00`).getTime();
        if (dataItem < inicioMs) return false;
      }

      if (dataFim) {
        const fimMs = new Date(`${dataFim}T23:59:59`).getTime();
        if (dataItem > fimMs) return false;
      }
    }

    return true;
  });

  const valorTotalQuitado = relatorioFiltrado.reduce((acc, item) => acc + item.valorPago, 0);

  if (!usuario) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      {/* INJEÇÃO DE CSS GLOBAL PARA SOBRESCREVER COR DO NAVEGADOR/TAILWIND */}
      <style jsx global>{`
        /* Força a cor preta/azul escura em todos os inputs da página */
        main input,
        main input[type="text"],
        main input[type="date"] {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
          background-color: #ffffff !important;
          opacity: 1 !important;
          font-weight: 600 !important;
        }

        /* Estilo do texto de ajuda (placeholder) */
        main input::placeholder {
          color: #94a3b8 !important;
          -webkit-text-fill-color: #94a3b8 !important;
          opacity: 1 !important;
        }

        /* Ícone do calendário nos inputs de data */
        main input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.2) !important;
          cursor: pointer;
        }
      `}</style>

      <Sidebar usuario={usuario} />

      <main style={{ marginLeft: '240px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Relatório de Pagos
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Visão simplificada de pagamentos efetuados por placa, favorecido e data
          </p>
        </header>

        {mensagemStatus && (
          <div style={{
            padding: '0.85rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : mensagemStatus.includes('✅') ? '#f0fdf4' : '#fffbeb',
            color: mensagemStatus.includes('❌') ? '#991b1b' : mensagemStatus.includes('✅') ? '#166534' : '#b45309',
            border: '1px solid',
            borderColor: mensagemStatus.includes('❌') ? '#fecaca' : mensagemStatus.includes('✅') ? '#bbf7d0' : '#fde68a',
          }}>
            {mensagemStatus}
          </div>
        )}

        {/* ÁREA DE FILTROS */}
        <section style={estilos.cardBox}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={estilos.labelFiltro}>🔍 Pesquisar por Placa</label>
              <input
                type="text"
                placeholder="Ex: ABC1D23..."
                value={termoPlaca}
                onChange={(e) => setTermoPlaca(e.target.value)}
                style={estilos.inputFiltro}
              />
            </div>

            <div>
              <label style={estilos.labelFiltro}>📅 Data Inicial</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                style={estilos.inputFiltro}
              />
            </div>

            <div>
              <label style={estilos.labelFiltro}>📅 Data Final</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                style={estilos.inputFiltro}
              />
            </div>

            <button
              onClick={() => {
                setTermoPlaca('');
                setDataInicio('');
                setDataFim('');
              }}
              style={estilos.botaoLimpar}
            >
              🔄 Limpar
            </button>
          </div>
        </section>

        {/* CARD DE TOTALIZADORES */}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem' }}>
          <div style={{ ...estilos.cardResumo, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', minWidth: '280px' }}>
            <span style={estilos.rotuloCard}>VALOR TOTAL QUITADO</span>
            <strong style={{ fontSize: '1.6rem', color: '#16a34a' }}>{formatarMoeda(valorTotalQuitado)}</strong>
          </div>
          <div style={{ ...estilos.cardResumo, minWidth: '200px' }}>
            <span style={estilos.rotuloCard}>TOTAL DE REGISTROS</span>
            <strong style={{ fontSize: '1.6rem', color: '#0f172a' }}>{relatorioFiltrado.length}</strong>
          </div>
        </div>

        {/* TABELA DE RESULTADOS */}
        <section style={{ ...estilos.cardBox, marginTop: '1.25rem' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={estilos.tabela}>
              <thead>
                <tr>
                  <th style={estilos.th}>Placa</th>
                  <th style={estilos.th}>Favorecido</th>
                  <th style={estilos.th}>Data de Pagamento</th>
                  <th style={estilos.th}>Valor Pago</th>
                </tr>
              </thead>
              <tbody>
                {relatorioFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Nenhum pagamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  relatorioFiltrado.map((item, index) => (
                    <tr key={item._id || `rel_${index}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={estilos.td}>
                        <strong style={{ color: '#2563eb', fontSize: '1rem' }}>{item.placa}</strong>
                      </td>
                      <td style={estilos.td}>
                        <strong style={{ color: '#0f172a' }}>{item.favorecido}</strong>
                      </td>
                      <td style={estilos.td}>
                        {formatarDataBR(item.dataPagamento)}
                      </td>
                      <td style={{ ...estilos.td, fontWeight: 'bold', color: '#16a34a', fontSize: '1rem' }}>
                        {formatarMoeda(item.valorPago)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

// ESTILOS DE ESTRUTURA
const estilos: { [key: string]: React.CSSProperties } = {
  cardBox: { backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' },
  labelFiltro: { display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: '700', color: '#0f172a' },
  inputFiltro: { 
    width: '100%', 
    padding: '0.55rem 0.75rem', 
    borderRadius: '6px', 
    border: '1px solid #cbd5e1', 
    fontSize: '0.85rem', 
    outline: 'none', 
    boxSizing: 'border-box',
  },
  botaoLimpar: { padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' },
  cardResumo: { backgroundColor: '#ffffff', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  rotuloCard: { fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' },
  tabela: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' },
  th: { padding: '0.85rem 1rem', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '700' },
  td: { padding: '0.85rem 1rem', color: '#1e293b' },
};