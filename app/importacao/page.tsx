'use client';

/**
 * ============================================================================
 * TELA: IMPORTAÇÃO E FECHAMENTO DE MINUTAS (CÁLCULO DE RPA 2,7% SEM DESC. 4%)
 * Localização no VS Code: empresa/app/importacao/page.tsx
 * Tecnologias: Next.js (React / TypeScript), XLSX, API Express, MongoDB Atlas
 * Descrição: Aplica exclusivamente o desconto de RPA (2,7%) sobre o Frete Bruto
 *            e soma o Pedágio integralmente para obter o Valor Líquido Final.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

// IMPORTAÇÃO DA BARRA LATERAL DE NAVEGAÇÃO
import Sidebar from '../components/Navbar';

interface MinutaModel {
  ref?: string;
  dataOp?: string;
  conteiner?: string;
  terminalOrigem?: string;
  terminalDestino?: string;
  cavalo?: string;
  servico?: string;
  tipoPgto?: string;
  dataEntrega?: string;
  valorFrete?: number;
  valorPedagio?: number;
  valorBruto?: number;
  valorRpa?: number;
  valorLiquidoFinal?: number;
  isDuplicado?: boolean;
  jaPagoNoBanco?: boolean;
  mensagemAlerta?: string;
  statusPagamento?: string;
  [key: string]: any;
}

export default function ImportacaoPage() {
  const router = useRouter();

  // Estados de sessão do utilizador
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  // Estados do ficheiro e lançamentos
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [listaMinutas, setListaMinutas] = useState<MinutaModel[]>([]);

  // Cartões de resumo financeiro
  const [resumo, setResumo] = useState({
    totalLiquido: 0,
    totalFrete: 0,
    totalPedagio: 0,
    totalBruto: 0,
    totalRpa: 0,
    qtdPendentes: 0,
    qtdPagas: 0,

    // Detalhamento dos Fretes À Vista
    aVista: {
      qtd: 0,
      freteBruto: 0,
      pedagio: 0,
      rpa: 0,
      liquidoFinal: 0,
    },

    // Detalhamento dos Fretes A Prazo
    aPrazo: {
      qtd: 0,
      freteBruto: 0,
      pedagio: 0,
      rpa: 0,
      liquidoFinal: 0,
    },
  });

  // Feedback visual
  const [carregando, setCarregando] = useState<boolean>(false);
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);

  // URL DO BACKEND OBTIDA DA VARIÁVEL DE AMBIENTE OU LOCALHOST
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  /**
   * Helper para formatar moeda com exatamente 2 casas decimais (ex: R$ 67.960,62)
   */
  const formatarMoeda = (valor: number) => {
    return Number(valor || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  /**
   * Recalcula os cartões superiores aplicando apenas o desconto de RPA (2,7%)
   */
  const calcularResumoFinanceiro = useCallback((minutas: MinutaModel[]) => {
    let freteTotal = 0;
    let pedagioTotal = 0;
    let rpaTotal = 0;
    let liquidoTotal = 0;
    let pendentes = 0;
    let pagas = 0;

    const aVista = {
      qtd: 0,
      freteBruto: 0,
      pedagio: 0,
      rpa: 0,
      liquidoFinal: 0,
    };

    const aPrazo = {
      qtd: 0,
      freteBruto: 0,
      pedagio: 0,
      rpa: 0,
      liquidoFinal: 0,
    };

    minutas.forEach((m) => {
      const vFrete = Number(m.valorFrete ?? m.frete ?? m['FRETE'] ?? m.valorBruto ?? 0);
      const vPedagio = Number(m.valorPedagio ?? m.pedagio ?? m['PEDAGIO'] ?? m['PEDÁGIO'] ?? 0);
      
      const tipoStr = String(m.tipoPgto || m['TIPO DE PGTO'] || '').toUpperCase();
      const isVista = tipoStr.includes('VISTA') || tipoStr.includes('AVISTA');

      // 1. Desconto do RPA de 2,7% sobre o Frete Bruto
      const vRpa = Number(m.valorRpa ?? (vFrete * 0.027));
      
      // 2. Líquido Final = (Frete Bruto - RPA 2,7%) + Pedágio
      const vLiq = Number(m.valorLiquidoFinal ?? ((vFrete - vRpa) + vPedagio));

      freteTotal += vFrete;
      pedagioTotal += vPedagio;
      rpaTotal += vRpa;
      liquidoTotal += vLiq;

      if (m.jaPagoNoBanco || m.statusPagamento === 'PAGO') {
        pagas++;
      } else {
        pendentes++;
      }

      // Separação dos valores entre À Vista e A Prazo
      if (isVista) {
        aVista.qtd++;
        aVista.freteBruto += vFrete;
        aVista.pedagio += vPedagio;
        aVista.rpa += vRpa;
        aVista.liquidoFinal += vLiq;
      } else {
        aPrazo.qtd++;
        aPrazo.freteBruto += vFrete;
        aPrazo.pedagio += vPedagio;
        aPrazo.rpa += vRpa;
        aPrazo.liquidoFinal += vLiq;
      }
    });

    setResumo({
      totalLiquido: liquidoTotal,
      totalFrete: freteTotal,
      totalPedagio: pedagioTotal,
      totalBruto: freteTotal + pedagioTotal,
      totalRpa: rpaTotal,
      qtdPendentes: pendentes,
      qtdPagas: pagas,
      aVista,
      aPrazo,
    });
  }, []);

  // 1. Autenticação e busca automática das minutas salvas no banco
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
      return;
    }

    const buscarMinutasBanco = async () => {
      try {
        const resposta = await fetch(`${apiUrl}/importacao`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const resultado = await resposta.json();

        if (resposta.ok && resultado.sucesso && Array.isArray(resultado.dados)) {
          setListaMinutas(resultado.dados);
          calcularResumoFinanceiro(resultado.dados);
        }
      } catch (erro) {
        console.warn('Não foi possível carregar minutas iniciais:', erro);
      }
    };

    buscarMinutasBanco();
  }, [router, apiUrl, calcularResumoFinanceiro]);

  /**
   * LEITURA DA PLANILHA EXCEL
   */
  const handleImportacaoDireta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setNomeArquivo(arquivo.name);
    setCarregando(true);
    setMensagemStatus('⏳ A ler planilha e a calcular valores com RPA de 2,7%...');

    const leitor = new FileReader();

    leitor.onload = async (evento) => {
      try {
        const buffer = new Uint8Array(evento.target?.result as ArrayBuffer);
        const livroExcel = XLSX.read(buffer, { type: 'array' });
        const primeiraAba = livroExcel.SheetNames[0];
        const folha = livroExcel.Sheets[primeiraAba];

        const lancamentosBrutos: any[] = XLSX.utils.sheet_to_json(folha);

        if (lancamentosBrutos.length === 0) {
          setMensagemStatus('⚠️ A planilha selecionada está vazia.');
          setCarregando(false);
          return;
        }

        const resAnalise = await fetch(`${apiUrl}/importacao/analisar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({ lancamentos: lancamentosBrutos }),
        });

        const textoAnalise = await resAnalise.text();
        if (textoAnalise.trim().startsWith('<')) {
          throw new Error('Servidor respondeu em HTML. Verifique se o backend está ligado.');
        }

        const resultadoAnalise = JSON.parse(textoAnalise);
        const minutasAnalisadas: MinutaModel[] = resultadoAnalise.lancamentos || [];

        const resConfirmar = await fetch(`${apiUrl}/importacao/confirmar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({ lancamentos: minutasAnalisadas }),
        });

        const textoConfirmar = await resConfirmar.text();
        const resultadoConfirmar = JSON.parse(textoConfirmar);

        if (resConfirmar.ok && resultadoConfirmar.sucesso) {
          const minutasExibicao = resultadoConfirmar.dadosAtualizados || minutasAnalisadas;
          setListaMinutas(minutasExibicao);
          calcularResumoFinanceiro(minutasExibicao);

          setMensagemStatus(`🎉 ${resultadoConfirmar.criados || minutasAnalisadas.length} viagem(ns) gravadas no banco com sucesso!`);
        } else {
          throw new Error(resultadoConfirmar.mensagem || 'Erro ao salvar lançamentos.');
        }
      } catch (erro: any) {
        console.error('Erro na importação:', erro);
        setMensagemStatus(`❌ ${erro.message || 'Erro ao comunicar com o servidor.'}`);
      } finally {
        setCarregando(false);
      }
    };

    leitor.readAsArrayBuffer(arquivo);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', color: '#0f172a' }}>
      <Sidebar usuario={usuarioLogado} />

      <main style={{ marginLeft: '250px', flex: 1, padding: '2rem 3rem' }}>
        
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Importação e Fechamento de Minutas
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: '500' }}>
            Desconto exclusivo de RPA (2,7%) sobre o Frete + Pedágio integral
          </p>
        </header>

        {/* ÁREA DE CARREGAMENTO DO FICHEIRO */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontWeight: '800', color: '#1e293b', fontSize: '1rem' }}>
                📁 {nomeArquivo ? nomeArquivo : 'Selecione a planilha (.xlsx)'}
              </p>
            </div>

            <input type="file" id="fileInput" accept=".xlsx, .xls" onChange={handleImportacaoDireta} style={{ display: 'none' }} />
            <label htmlFor="fileInput" style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: '800', fontSize: '0.875rem', cursor: 'pointer' }}>
              {carregando ? '⏳ A processar...' : '📂 Carregar Planilha Excel'}
            </label>
          </div>
        </section>

        {mensagemStatus && (
          <div style={{ marginBottom: '1.5rem', padding: '0.85rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '700', backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : '#f0fdf4', color: mensagemStatus.includes('❌') ? '#991b1b' : '#166534', border: '1px solid', borderColor: mensagemStatus.includes('❌') ? '#fecaca' : '#bbf7d0' }}>
            {mensagemStatus}
          </div>
        )}

        {/* CARTÕES DE RESUMO FINANCEIRO GERAL */}
        {listaMinutas.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* CARTÃO 1: TOTAL LÍQUIDO A RECEBER */}
              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>TOTAL LÍQUIDO A RECEBER</span>
                <strong style={{ fontSize: '1.8rem', color: '#16a34a', fontWeight: '900', margin: '0.4rem 0' }}>
                  R$ {formatarMoeda(resumo.totalLiquido)}
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                  Frete: R$ {formatarMoeda(resumo.totalFrete)} | Pedágio: R$ {formatarMoeda(resumo.totalPedagio)} | RPA: -R$ {formatarMoeda(resumo.totalRpa)}
                </span>
              </div>

              {/* CARTÃO 2: FRETES PENDENTES */}
              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>FRETES PENDENTES</span>
                <strong style={{ fontSize: '1.8rem', color: '#d97706', fontWeight: '900', margin: '0.4rem 0' }}>
                  {resumo.qtdPendentes}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>Aguardando pagamento</span>
              </div>

              {/* CARTÃO 3: FRETES PAGOS */}
              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>FRETES PAGOS</span>
                <strong style={{ fontSize: '1.8rem', color: '#2563eb', fontWeight: '900', margin: '0.4rem 0' }}>
                  {resumo.qtdPagas}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>Pagamentos efetuados</span>
              </div>

            </div>

            {/* PAINEL SECUNDÁRIO: CARTÕES DETALHADOS (À VISTA vs A PRAZO) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
              
              {/* CARTÃO DETALHADO: FRETES À VISTA */}
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#92400e', textTransform: 'uppercase' }}>
                    ⚡ FRETES À VISTA
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    {resumo.aVista.qtd} minuta(s)
                  </span>
                </div>

                <div style={{ margin: '0.75rem 0', fontSize: '0.825rem', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>• Frete Bruto: <strong>R$ {formatarMoeda(resumo.aVista.freteBruto)}</strong></div>
                  <div>• Pedágio (+): <strong>R$ {formatarMoeda(resumo.aVista.pedagio)}</strong></div>
                  <div>• RPA (-2,7%): <strong style={{ color: '#dc2626' }}>- R$ {formatarMoeda(resumo.aVista.rpa)}</strong></div>
                </div>

                <div style={{ borderTop: '1px solid #fde68a', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#92400e' }}>LÍQUIDO FINAL À VISTA:</span>
                  <strong style={{ fontSize: '1.5rem', color: '#b45309', fontWeight: '900', display: 'block' }}>
                    R$ {formatarMoeda(resumo.aVista.liquidoFinal)}
                  </strong>
                </div>
              </div>

              {/* CARTÃO DETALHADO: FRETES A PRAZO */}
              <div style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>
                    📅 FRETES A PRAZO
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', backgroundColor: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    {resumo.aPrazo.qtd} minuta(s)
                  </span>
                </div>

                <div style={{ margin: '0.75rem 0', fontSize: '0.825rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>• Frete Bruto: <strong>R$ {formatarMoeda(resumo.aPrazo.freteBruto)}</strong></div>
                  <div>• Pedágio (+): <strong>R$ {formatarMoeda(resumo.aPrazo.pedagio)}</strong></div>
                  <div>• RPA (-2,7%): <strong style={{ color: '#dc2626' }}>- R$ {formatarMoeda(resumo.aPrazo.rpa)}</strong></div>
                </div>

                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155' }}>LÍQUIDO FINAL A PRAZO:</span>
                  <strong style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: '900', display: 'block' }}>
                    R$ {formatarMoeda(resumo.aPrazo.liquidoFinal)}
                  </strong>
                </div>
              </div>

            </div>

            {/* TABELA DETALHADA DAS VIAGENS */}
            <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #cbd5e1', overflowX: 'auto', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>
                📋 Viagens Registadas ({listaMinutas.length})
              </h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', color: '#334155' }}>
                    <th style={estilos.th}>REF</th>
                    <th style={estilos.th}>Placa (Cavalo)</th>
                    <th style={estilos.th}>Contêiner</th>
                    <th style={estilos.th}>Tipo Pgto</th>
                    <th style={estilos.th}>Frete Bruto</th>
                    <th style={estilos.th}>Pedágio</th>
                    <th style={estilos.th}>RPA (2,7% Frete)</th>
                    <th style={estilos.th}>Líquido Final</th>
                    <th style={estilos.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {listaMinutas.map((item, idx) => {
                    const vFrete = Number(item.valorFrete ?? item.frete ?? item['FRETE'] ?? item.valorBruto ?? 0);
                    const vPedagio = Number(item.valorPedagio ?? item.pedagio ?? item['PEDAGIO'] ?? item['PEDÁGIO'] ?? 0);
                    const tipoStr = String(item.tipoPgto || item['TIPO DE PGTO'] || '').toUpperCase();
                    const isVista = tipoStr.includes('VISTA') || tipoStr.includes('AVISTA');

                    const vRpa = Number(item.valorRpa ?? (vFrete * 0.027));
                    const vLiq = Number(item.valorLiquidoFinal ?? ((vFrete - vRpa) + vPedagio));

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: item.jaPagoNoBanco ? '#fef2f2' : item.isDuplicado ? '#fffbeb' : '#ffffff',
                        }}
                      >
                        <td style={estilos.td}>{item.ref || '-'}</td>
                        <td style={{ ...estilos.td, fontWeight: '800' }}>{item.cavalo || item.CAVALO || '-'}</td>
                        <td style={{ ...estilos.td, fontWeight: '800', color: '#2563eb' }}>{item.conteiner || item.CONTEINER || '-'}</td>
                        <td style={estilos.td}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            backgroundColor: isVista ? '#fef3c7' : '#e2e8f0',
                            color: isVista ? '#92400e' : '#334155',
                          }}>
                            {item.tipoPgto || item['TIPO DE PGTO'] || 'A PRAZO'}
                          </span>
                        </td>
                        <td style={estilos.td}>R$ {vFrete.toFixed(2)}</td>
                        <td style={{ ...estilos.td, color: '#0284c7', fontWeight: '700' }}>+ R$ {vPedagio.toFixed(2)}</td>
                        <td style={{ ...estilos.td, color: '#dc2626' }}>- R$ {vRpa.toFixed(2)}</td>
                        <td style={{ ...estilos.td, fontWeight: '900', color: '#166534', fontSize: '0.9rem' }}>
                          R$ {vLiq.toFixed(2)}
                        </td>
                        <td style={{ ...estilos.td, fontWeight: '700', color: item.jaPagoNoBanco ? '#b91c1c' : item.isDuplicado ? '#b45309' : '#15803d' }}>
                          {item.mensagemAlerta || '✅ Pendente'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// Estilos padronizados
const estilos: { [key: string]: React.CSSProperties } = {
  cardPadrao: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  tituloCard: {
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  th: {
    padding: '0.75rem 0.5rem',
    borderBottom: '2px solid #cbd5e1',
  },
  td: {
    padding: '0.75rem 0.5rem',
  },
};