'use client';

/**
 * ============================================================================
 * TELA: IMPORTAÇÃO E FECHAMENTO DE MINUTAS (SEM SELETOR DE MODALIDADE)
 * Localização no VS Code: web/app/importacao/page.tsx
 * Tecnologias: Next.js (React / TypeScript), XLSX, API Express, MongoDB Atlas
 * Descrição: Exibe a tabela de minutas importadas mostrando o tipo de pagamento
 *            como texto simples (badge) sem permitir alteração por seletor.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Navbar';

interface MinutaModel {
  _id?: string;
  ref?: string;
  dataOp?: string;
  conteiner?: string;
  terminalOrigem?: string;
  terminalDestino?: string;
  cavalo?: string;
  servico?: string;
  tipoPgto?: string;
  dataEntrega?: string;
  valorFreteOriginal?: number;
  valorFrete?: number;
  valorPedagio?: number;
  valorBruto?: number;
  valorRpa?: number;
  descontoAVista?: number;
  valorLiquidoFinal?: number;
  valorFinalPago?: number;
  descontoAdicionalAplicado?: number;
  isDuplicado?: boolean;
  jaPagoNoBanco?: boolean;
  mensagemAlerta?: string;
  statusPagamento?: string;
  [key: string]: any;
}

export default function ImportacaoPage() {
  const router = useRouter();

  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [listaMinutas, setListaMinutas] = useState<MinutaModel[]>([]);
  const [filtroTipoPgto, setFiltroTipoPgto] = useState<'TODOS' | 'A VISTA' | 'PRAZO' | 'INTEGRAL'>('TODOS');

  const [resumo, setResumo] = useState({
    totalLiquido: 0,
    totalFrete: 0,
    totalPedagio: 0,
    totalBruto: 0,
    totalRpa: 0,
    totalDescontoAVista: 0,
    qtdPendentes: 0,
    qtdPagas: 0,

    aVistaIntegral: {
      qtd: 0,
      freteBruto: 0,
      pedagio: 0,
      rpa: 0,
      descontoAVista: 0,
      liquidoFinal: 0,
    },

    aPrazo: {
      qtd: 0,
      freteBruto: 0,
      pedagio: 0,
      rpa: 0,
      liquidoFinal: 0,
    },
  });

  const [carregando, setCarregando] = useState<boolean>(false);
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const formatarMoeda = (valor: number) => {
    return Number(valor || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  /**
   * CÁLCULO DOS TOTAIS FINANCEIROS SEGUINDO A ORDEM ESTRITA DE CÁLCULO
   */
  const calcularResumoFinanceiro = useCallback((minutas: MinutaModel[]) => {
    let freteTotal = 0;
    let pedagioTotal = 0;
    let rpaTotal = 0;
    let descAVistaTotal = 0;
    let liquidoTotal = 0;
    let pendentes = 0;
    let pagas = 0;

    const aVistaIntegral = {
      qtd: 0,
      freteBruto: 0,
      pedagio: 0,
      rpa: 0,
      descontoAVista: 0,
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
      const descAdd = Number(m.descontoAdicionalAplicado || 0);
      const vFreteBase = Number(m.valorFreteOriginal || m.valorFrete || m.frete || 0) + descAdd;
      const vPedagio = Number(m.valorPedagio || m.pedagio || 0);
      
      const tipoStr = String(m.tipoPgto || m['TIPO DE PGTO'] || 'PRAZO').toUpperCase().trim();
      const isAVista = tipoStr.includes('VISTA');
      const isVistaOuIntegral = isAVista || tipoStr.includes('INTEGRAL');

      // 1. Frete Ajustado após Desconto Adicional
      const freteAjustado = Math.max(0, vFreteBase - descAdd);

      // 2. Desconto À Vista (4%) sobre o valor ajustado
      const vDescAVista = isAVista ? Number((freteAjustado * 0.04).toFixed(2)) : 0;

      // 3. RPA (2,7%) sobre o valor ajustado
      const vRpa = Number((freteAjustado * 0.027).toFixed(2));

      // 4. Valor Líquido Final
      const vLiq = Number((freteAjustado - vDescAVista - vRpa + vPedagio).toFixed(2));

      freteTotal += vFreteBase;
      pedagioTotal += vPedagio;
      rpaTotal += vRpa;
      descAVistaTotal += vDescAVista;
      liquidoTotal += vLiq;

      if (m.jaPagoNoBanco || m.statusPagamento === 'PAGO') {
        pagas++;
      } else {
        pendentes++;
      }

      if (isVistaOuIntegral) {
        aVistaIntegral.qtd++;
        aVistaIntegral.freteBruto += vFreteBase;
        aVistaIntegral.pedagio += vPedagio;
        aVistaIntegral.rpa += vRpa;
        aVistaIntegral.descontoAVista += vDescAVista;
        aVistaIntegral.liquidoFinal += vLiq;
      } else {
        aPrazo.qtd++;
        aPrazo.freteBruto += vFreteBase;
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
      totalDescontoAVista: descAVistaTotal,
      qtdPendentes: pendentes,
      qtdPagas: pagas,
      aVistaIntegral,
      aPrazo,
    });
  }, []);

  const buscarMinutasBanco = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
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
  }, [apiUrl, calcularResumoFinanceiro]);

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

    buscarMinutasBanco();
  }, [router, buscarMinutasBanco]);

  /**
   * IMPORTAÇÃO E PROCESSAMENTO DA PLANILHA EXCEL
   */
  const handleImportacaoDireta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setNomeArquivo(arquivo.name);
    setCarregando(true);
    setMensagemStatus('⏳ A ler planilha e a processar com o servidor...');

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

        const resultadoAnalise = await resAnalise.json();
        const minutasAnalisadas: MinutaModel[] = resultadoAnalise.lancamentos || [];

        const resConfirmar = await fetch(`${apiUrl}/importacao/confirmar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify({ lancamentos: minutasAnalisadas }),
        });

        const resultadoConfirmar = await resConfirmar.json();

        if (resConfirmar.ok && resultadoConfirmar.sucesso) {
          await buscarMinutasBanco();
          setMensagemStatus(`🎉 ${resultadoConfirmar.mensagem}`);
        } else {
          throw new Error(resultadoConfirmar.mensagem || 'Erro ao salvar lançamentos.');
        }
      } catch (erro: any) {
        setMensagemStatus(`❌ ${erro.message || 'Erro ao comunicar com o servidor.'}`);
      } finally {
        setCarregando(false);
      }
    };

    leitor.readAsArrayBuffer(arquivo);
  };

  // Filtro de exibição na tabela
  const minutasExibicao = listaMinutas.filter((m) => {
    if (filtroTipoPgto === 'TODOS') return true;
    const tp = String(m.tipoPgto || '').toUpperCase();
    if (filtroTipoPgto === 'A VISTA') return tp.includes('VISTA');
    if (filtroTipoPgto === 'PRAZO') return tp.includes('PRAZO');
    if (filtroTipoPgto === 'INTEGRAL') return tp.includes('INTEGRAL');
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', color: '#0f172a' }}>
      <Sidebar usuario={usuarioLogado} />

      <main style={{ marginLeft: '250px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Importação e Fechamento de Minutas
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: '500' }}>
            Totais em tempo real recalculados com RPA (2,7%) e Desconto À Vista (4%)
          </p>
        </header>

        {/* ÁREA DE IMPORTAÇÃO DE PLANILHA */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.5rem' }}>
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

        {listaMinutas.length > 0 && (
          <>
            {/* CARTÕES FINANCEIROS GERAIS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>TOTAL LÍQUIDO A RECEBER</span>
                <strong style={{ fontSize: '1.8rem', color: '#16a34a', fontWeight: '900', margin: '0.4rem 0' }}>
                  R$ {formatarMoeda(resumo.totalLiquido)}
                </strong>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                  Frete: R$ {formatarMoeda(resumo.totalFrete)} | RPA: -R$ {formatarMoeda(resumo.totalRpa)}
                </span>
              </div>

              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>FRETES PENDENTES</span>
                <strong style={{ fontSize: '1.8rem', color: '#d97706', fontWeight: '900', margin: '0.4rem 0' }}>
                  {resumo.qtdPendentes}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>Aguardando pagamento</span>
              </div>

              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>FRETES PAGOS</span>
                <strong style={{ fontSize: '1.8rem', color: '#2563eb', fontWeight: '900', margin: '0.4rem 0' }}>
                  {resumo.qtdPagas}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>Pagamentos efetuados</span>
              </div>
            </div>

            {/* CARTÕES DETALHADOS: À VISTA/INTEGRAL VS A PRAZO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#92400e', textTransform: 'uppercase' }}>
                    ⚡ FRETES À VISTA / INTEGRAL
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    {resumo.aVistaIntegral.qtd} minuta(s)
                  </span>
                </div>

                <div style={{ margin: '0.75rem 0', fontSize: '0.825rem', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>• Frete Bruto: <strong>R$ {formatarMoeda(resumo.aVistaIntegral.freteBruto)}</strong></div>
                  <div>• RPA (-2,7%): <strong style={{ color: '#dc2626' }}>- R$ {formatarMoeda(resumo.aVistaIntegral.rpa)}</strong></div>
                  <div>• Desc. À Vista (-4%): <strong style={{ color: '#dc2626' }}>- R$ {formatarMoeda(resumo.aVistaIntegral.descontoAVista)}</strong></div>
                </div>

                <div style={{ borderTop: '1px solid #fde68a', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#92400e' }}>LÍQUIDO À VISTA / INTEGRAL:</span>
                  <strong style={{ fontSize: '1.5rem', color: '#b45309', fontWeight: '900', display: 'block' }}>
                    R$ {formatarMoeda(resumo.aVistaIntegral.liquidoFinal)}
                  </strong>
                </div>
              </div>

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
                  <div>• RPA (-2,7%): <strong style={{ color: '#dc2626' }}>- R$ {formatarMoeda(resumo.aPrazo.rpa)}</strong></div>
                </div>

                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155' }}>LÍQUIDO A PRAZO:</span>
                  <strong style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: '900', display: 'block' }}>
                    R$ {formatarMoeda(resumo.aPrazo.liquidoFinal)}
                  </strong>
                </div>
              </div>
            </div>

            {/* BOTÕES DE FILTRO POR MODALIDADE */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['TODOS', 'A VISTA', 'PRAZO', 'INTEGRAL'] as const).map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setFiltroTipoPgto(tipo)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    backgroundColor: filtroTipoPgto === tipo ? '#2563eb' : '#ffffff',
                    color: filtroTipoPgto === tipo ? '#ffffff' : '#334155',
                  }}
                >
                  {tipo}
                </button>
              ))}
            </div>

            {/* TABELA DE REGISTOS - TEXTO ESTÁTICO DO TIPO PGTO (SEM SELETOR) */}
            <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>
                📋 Viagens Registadas ({minutasExibicao.length})
              </h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', color: '#334155' }}>
                    <th style={estilos.th}>REF</th>
                    <th style={estilos.th}>Placa (Cavalo)</th>
                    <th style={estilos.th}>Contêiner</th>
                    <th style={estilos.th}>Tipo Pgto</th>
                    <th style={estilos.th}>Frete Bruto</th>
                    <th style={estilos.th}>RPA (2,7%)</th>
                    <th style={estilos.th}>Líquido Final</th>
                    <th style={estilos.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {minutasExibicao.map((item) => {
                    const descAdd = Number(item.descontoAdicionalAplicado || 0);
                    const vFreteBase = Number(item.valorFreteOriginal || item.valorFrete || item.frete || 0) + descAdd;
                    const vPedagio = Number(item.valorPedagio || item.pedagio || 0);
                    
                    const tipoStr = String(item.tipoPgto || 'PRAZO').toUpperCase().trim();
                    const isAVista = tipoStr.includes('VISTA');

                    const freteAjustado = Math.max(0, vFreteBase - descAdd);
                    const vDescAVista = isAVista ? Number((freteAjustado * 0.04).toFixed(2)) : 0;
                    const vRpa = Number((freteAjustado * 0.027).toFixed(2));
                    const vLiq = Number((freteAjustado - vDescAVista - vRpa + vPedagio).toFixed(2));

                    return (
                      <tr key={item._id || item.ref} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: item.jaPagoNoBanco || item.statusPagamento === 'PAGO' ? '#f0fdf4' : '#ffffff' }}>
                        <td style={estilos.td}>{item.ref || item.REF || '-'}</td>
                        <td style={{ ...estilos.td, fontWeight: '800' }}>{item.cavalo || item.CAVALO || '-'}</td>
                        <td style={{ ...estilos.td, fontWeight: '800', color: '#2563eb' }}>{item.conteiner || item.CONTEINER || '-'}</td>
                        <td style={estilos.td}>
                          <span style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: '800',
                            fontSize: '0.75rem',
                            display: 'inline-block',
                            backgroundColor: isAVista ? '#fef3c7' : '#f1f5f9',
                            color: isAVista ? '#b45309' : '#334155',
                            border: '1px solid',
                            borderColor: isAVista ? '#fde68a' : '#cbd5e1'
                          }}>
                            {tipoStr}
                          </span>
                        </td>
                        <td style={estilos.td}>R$ {vFreteBase.toFixed(2)}</td>
                        <td style={{ ...estilos.td, color: '#dc2626' }}>- R$ {vRpa.toFixed(2)}</td>
                        <td style={{ ...estilos.td, fontWeight: '900', color: '#166534', fontSize: '0.9rem' }}>
                          R$ {vLiq.toFixed(2)}
                        </td>
                        <td style={{ ...estilos.td, fontWeight: '700', color: item.statusPagamento === 'PAGO' ? '#15803d' : '#d97706' }}>
                          {item.statusPagamento === 'PAGO' ? '✅ Pago' : item.mensagemAlerta || '⏳ Pendente'}
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

const estilos: { [key: string]: React.CSSProperties } = {
  cardPadrao: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
  },
  tituloCard: {
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  th: { padding: '0.75rem 0.5rem', borderBottom: '2px solid #cbd5e1' },
  td: { padding: '0.75rem 0.5rem' },
};