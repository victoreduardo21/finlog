'use client';

/**
 * ============================================================================
 * TELA: IMPORTAÇÃO DE MINUTAS E FECHAMENTO
 * Localização no projeto: empresa/app/importacao/page.tsx
 * Descrição: Exibe a lista completa de minutas da planilha, marcando de forma
 *            evidente quais contêineres já foram pagos anteriormente.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Sidebar from './../components/Navbar';

interface ItemAnalisado {
  ref: string;
  cavalo: string;
  conteiner: string;
  terminalOrigem: string;
  terminalDestino: string;
  dataOp: string;
  dataOpFormatada: string;
  dataVencimento: string;
  tipoPgto: string;
  valorBruto: number;
  valorRpa: number;
  descontoAVista: number;
  valorLiquidoFinal: number;
  categoriaPgto: 'PRAZO' | 'AVISTA_INTEGRAL';
  isDuplicado: boolean;
  jaPagoNoBanco: boolean;
  mensagemAlerta?: string;
}

export default function ImportacaoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);
  const [dadosAnalisados, setDadosAnalisados] = useState<ItemAnalisado[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'TODOS' | 'PRAZO' | 'AVISTA_INTEGRAL' | 'DUPLICADOS' | 'JA_PAGOS'>('TODOS');
  const [nomeFicheiro, setNomeFicheiro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  const [totais, setTotais] = useState({
    brutoPrazo: 0,
    rpaPrazo: 0,
    liquidoPrazo: 0,
    qtdPrazo: 0,
    brutoAvista: 0,
    rpaAvista: 0,
    descontoAvista: 0,
    liquidoAvista: 0,
    qtdAvista: 0,
    duplicadosCount: 0,
    jaPagosCount: 0,
    dataQuintaFeira: '',
  });

  const parseDataExcel = (dataExcel: string | number): Date => {
    if (typeof dataExcel === 'number') {
      return new Date(Math.round((dataExcel - 25569) * 86400 * 1000));
    }
    if (!dataExcel) return new Date();

    const partes = String(dataExcel).split('/');
    if (partes.length === 3) {
      return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
    }
    const d = new Date(dataExcel);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const processarListaMinutas = useCallback((linhas: any[]) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diaDaSemana = hoje.getDay();
    const diasAteQuinta = (4 - diaDaSemana + 7) % 7;
    const proximaQuinta = new Date(hoje);
    proximaQuinta.setDate(hoje.getDate() + diasAteQuinta);

    let sumBrutoPrazo = 0, sumRpaPrazo = 0, sumLiquidoPrazo = 0, countPrazo = 0;
    let sumBrutoAvista = 0, sumRpaAvista = 0, sumDescAvista = 0, sumLiquidoAvista = 0, countAvista = 0;
    let numDuplicados = 0;
    let numJaPagos = 0;

    const analisados: ItemAnalisado[] = linhas.map((linha) => {
      const valorBruto = Number(linha.valorBruto ?? linha['Valor Bruto'] ?? linha['valor a pagar'] ?? linha.FRETE ?? 0);
      
      const rawDataOp = linha.dataOp || linha['DATA DA OP'] || linha['DATA DE ENTREGA'];
      const objectoDataOp = parseDataExcel(rawDataOp);
      
      const tipoPgtoBruto = String(linha.tipoPgto || linha['TIPO DE PGTO'] || '').toUpperCase().trim();
      const cavaloPlaca = String(linha.cavalo || linha.CAVALO || linha.placa || '-').toUpperCase().trim();
      const refCode = String(linha.ref || linha.REF || '-');
      const conteinerCode = String(linha.conteiner || linha.CONTEINER || '-').trim();
      const origem = String(linha.terminalOrigem || linha['TERMINAL ORIGEM'] || '-').trim();
      const destino = String(linha.terminalDestino || linha['TERMINAL DESTINO'] || '-').trim();

      const jaPagoNoBanco = Boolean(linha.jaPagoNoBanco || linha.statusPagamento === 'PAGO');
      if (jaPagoNoBanco) numJaPagos++;

      const ehDuplicado = Boolean(linha.isDuplicado) && !jaPagoNoBanco;
      if (ehDuplicado) numDuplicados++;

      const valorRpa = Number(linha.valorRpa ?? (valorBruto * 0.027));
      const isAVista = tipoPgtoBruto.includes('AVISTA') || tipoPgtoBruto.includes('INTEGRAL') || tipoPgtoBruto.includes('A VISTA');
      const descontoAVista = Number(linha.descontoAVista ?? (isAVista ? valorBruto * 0.04 : 0));
      const valorLiquidoFinal = Number(linha.valorLiquidoFinal ?? (valorBruto - valorRpa - descontoAVista));

      let categoriaPgto: 'PRAZO' | 'AVISTA_INTEGRAL' = 'PRAZO';

      if (isAVista) {
        categoriaPgto = 'AVISTA_INTEGRAL';
        if (!jaPagoNoBanco) {
          sumBrutoAvista += valorBruto;
          sumRpaAvista += valorRpa;
          sumDescAvista += descontoAVista;
          sumLiquidoAvista += valorLiquidoFinal;
          countAvista++;
        }
      } else {
        categoriaPgto = 'PRAZO';
        if (!jaPagoNoBanco) {
          sumBrutoPrazo += valorBruto;
          sumRpaPrazo += valorRpa;
          sumLiquidoPrazo += valorLiquidoFinal;
          countPrazo++;
        }
      }

      let mensagemAlerta = '✅ Registo Pendente';
      if (jaPagoNoBanco) {
        mensagemAlerta = `⛔ PAGO: Contêiner ${conteinerCode} (Placa ${cavaloPlaca}) já baixado!`;
      } else if (ehDuplicado) {
        mensagemAlerta = `⚠️ Contêiner repetido`;
      }

      return {
        ref: refCode,
        cavalo: cavaloPlaca,
        conteiner: conteinerCode,
        terminalOrigem: origem,
        terminalDestino: destino,
        dataOp: objectoDataOp.toISOString(),
        dataOpFormatada: objectoDataOp.toLocaleDateString('pt-BR'),
        dataVencimento: proximaQuinta.toISOString(),
        tipoPgto: tipoPgtoBruto,
        valorBruto,
        valorRpa,
        descontoAVista,
        valorLiquidoFinal,
        categoriaPgto,
        isDuplicado: ehDuplicado,
        jaPagoNoBanco,
        mensagemAlerta,
      };
    });

    setDadosAnalisados(analisados);
    setTotais({
      brutoPrazo: sumBrutoPrazo,
      rpaPrazo: sumRpaPrazo,
      liquidoPrazo: sumLiquidoPrazo,
      qtdPrazo: countPrazo,
      brutoAvista: sumBrutoAvista,
      rpaAvista: sumRpaAvista,
      descontoAvista: sumDescAvista,
      liquidoAvista: sumLiquidoAvista,
      qtdAvista: countAvista,
      duplicadosCount: numDuplicados,
      jaPagosCount: numJaPagos,
      dataQuintaFeira: proximaQuinta.toLocaleDateString('pt-BR'),
    });
  }, []);

  const carregarMinutasDoBanco = useCallback(async () => {
    setCarregando(true);
    setMensagemStatus('⏳ A carregar minutas da base de dados...');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resposta = await fetch(`${apiUrl}/importacao`);
      const resultado = await resposta.json();

      if (resposta.ok && resultado.dados) {
        processarListaMinutas(resultado.dados);
        if (resultado.dados.length === 0) {
          setMensagemStatus('🎉 Nenhuma minuta pendente no banco de dados!');
        } else {
          setMensagemStatus(`✅ Exibindo ${resultado.dados.length} minuta(s) pendente(s).`);
        }
      }
    } catch (erro: any) {
      setMensagemStatus('⚠️ Falha ao conectar ao servidor backend na porta 3001.');
    } finally {
      setCarregando(false);
    }
  }, [processarListaMinutas]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }
    setUsuario(JSON.parse(usuarioSalvo));
    carregarMinutasDoBanco();
  }, [router, carregarMinutasDoBanco]);

  const analisarEGravarPlanilha = async (dadosPlanilha: any[]) => {
    setCarregando(true);
    setMensagemStatus('⏳ A analisar planilha e a cruzar com a base de dados...');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resAnalise = await fetch(`${apiUrl}/importacao/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lancamentos: dadosPlanilha }),
      });

      const resultadoAnalise = await resAnalise.json();
      if (!resAnalise.ok) throw new Error(resultadoAnalise.mensagem || 'Erro ao analisar a planilha.');

      const resConfirmar = await fetch(`${apiUrl}/importacao/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lancamentos: resultadoAnalise.lancamentos }),
      });

      const resultadoConfirmar = await resConfirmar.json();
      if (!resConfirmar.ok) throw new Error(resultadoConfirmar.mensagem || 'Erro ao gravar os dados.');

      if (resultadoAnalise.lancamentos) {
        processarListaMinutas(resultadoAnalise.lancamentos);
      }

      setMensagemStatus(
        `🎉 Processamento concluído! ${resultadoConfirmar.criados || 0} novo(s) contêiner(es) cadastrado(s). ${resultadoAnalise.qtdJaPagos || 0} contêiner(es) já foram PAGOS e foram apontados!`
      );
    } catch (erro: any) {
      setMensagemStatus(`❌ Erro ao importar planilha: ${erro.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNomeFicheiro(file.name);
    setCarregando(true);
    setMensagemStatus('⏳ A ler ficheiro Excel...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const data = XLSX.utils.sheet_to_json<any>(ws);
        analisarEGravarPlanilha(data);
      } catch (erro) {
        setMensagemStatus('❌ Erro ao ler a planilha.');
        setCarregando(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const dadosFiltrados = dadosAnalisados.filter((item) => {
    if (abaAtiva === 'PRAZO') return item.categoriaPgto === 'PRAZO' && !item.jaPagoNoBanco;
    if (abaAtiva === 'AVISTA_INTEGRAL') return item.categoriaPgto === 'AVISTA_INTEGRAL' && !item.jaPagoNoBanco;
    if (abaAtiva === 'DUPLICADOS') return item.isDuplicado && !item.jaPagoNoBanco;
    if (abaAtiva === 'JA_PAGOS') return item.jaPagoNoBanco;
    return true;
  });

  const formatarMoeda = (valor: number) => {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (!usuario) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      <Sidebar usuario={usuario} />

      <main style={{ marginLeft: '260px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Importação e Fechamento de Minutas
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Acompanhamento em tempo real com validação e apontamento de contêineres já pagos
          </p>
        </header>

        {/* ÁREA DE UPLOAD */}
        <section style={estilos.cardUpload}>
          <div style={estilos.areaDrop}>
            <span style={{ fontSize: '2.5rem' }}>⚡</span>
            <h3 style={{ margin: '0.5rem 0', color: '#0f172a' }}>
              {nomeFicheiro ? nomeFicheiro : 'Importar Planilha (.xlsx)'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
              Carregue a planilha para incluir novos lançamentos e visualizar contêineres já pagos.
            </p>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" style={estilos.botaoEscolher}>
              Carregar Planilha Excel
            </label>
          </div>

          {mensagemStatus && (
            <div
              style={{
                ...estilos.status,
                backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : mensagemStatus.includes('🎉') ? '#f0fdf4' : '#fffbeb',
                color: mensagemStatus.includes('❌') ? '#991b1b' : mensagemStatus.includes('🎉') ? '#166534' : '#b45309',
                borderColor: mensagemStatus.includes('❌') ? '#fecaca' : mensagemStatus.includes('🎉') ? '#bbf7d0' : '#fde68a',
              }}
            >
              {mensagemStatus}
            </div>
          )}
        </section>

        {/* RESUMO DOS KPIS */}
        {dadosAnalisados.length > 0 && (
          <>
            <section style={estilos.gridTotais}>
              <div style={estilos.cardKpiPrazo}>
                <span style={estilos.tituloKpiPrazo}>📅 A PRAZO ({totais.dataQuintaFeira})</span>
                <p style={{ ...estilos.valorKpi, color: '#1d4ed8' }}>
                  {formatarMoeda(totais.liquidoPrazo)}
                </p>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Bruto: {formatarMoeda(totais.brutoPrazo)} | RPA (2,7%): -{formatarMoeda(totais.rpaPrazo)}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 'bold', marginTop: '0.5rem', display: 'block' }}>
                  {totais.qtdPrazo} minutas pendentes
                </span>
              </div>

              <div style={estilos.cardKpiVista}>
                <span style={estilos.tituloKpiVista}>⚡ À VISTA / INTEGRAL</span>
                <p style={{ ...estilos.valorKpi, color: '#15803d' }}>
                  {formatarMoeda(totais.liquidoAvista)}
                </p>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Bruto: {formatarMoeda(totais.brutoAvista)} | Retenções: -{formatarMoeda(totais.rpaAvista + totais.descontoAvista)}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold', marginTop: '0.5rem', display: 'block' }}>
                  {totais.qtdAvista} minutas pendentes
                </span>
              </div>

              <div
                onClick={() => setAbaAtiva('JA_PAGOS')}
                style={{
                  ...estilos.cardKpi,
                  backgroundColor: '#fef2f2',
                  borderColor: '#fecaca',
                  cursor: 'pointer',
                }}
              >
                <span style={{ ...estilos.tituloKpi, color: '#dc2626' }}>⛔ CONTÊINERES JÁ PAGOS</span>
                <p style={{ ...estilos.valorKpi, color: '#dc2626' }}>
                  {totais.jaPagosCount} Já Pagos
                </p>
                <span style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 'bold' }}>
                  Clique para ver os {totais.jaPagosCount} contêineres ➔
                </span>
              </div>
            </section>

            {/* BARRA DE ABAS */}
            <div style={estilos.containerAbas}>
              <button
                onClick={() => setAbaAtiva('TODOS')}
                style={{ ...estilos.botaoAba, ...(abaAtiva === 'TODOS' ? estilos.botaoAbaAtivo : {}) }}
              >
                Todas ({dadosAnalisados.length})
              </button>
              <button
                onClick={() => setAbaAtiva('PRAZO')}
                style={{ ...estilos.botaoAba, ...(abaAtiva === 'PRAZO' ? estilos.botaoAbaAtivo : {}) }}
              >
                A Prazo ({totais.qtdPrazo})
              </button>
              <button
                onClick={() => setAbaAtiva('AVISTA_INTEGRAL')}
                style={{ ...estilos.botaoAba, ...(abaAtiva === 'AVISTA_INTEGRAL' ? estilos.botaoAbaAtivo : {}) }}
              >
                À Vista / Integral ({totais.qtdAvista})
              </button>
              <button
                onClick={() => setAbaAtiva('DUPLICADOS')}
                style={{
                  ...estilos.botaoAba,
                  ...(abaAtiva === 'DUPLICADOS' ? estilos.botaoAbaAlertaAtivo : {}),
                  color: abaAtiva === 'DUPLICADOS' ? '#ffffff' : '#b45309',
                }}
              >
                ⚠️ Repetidos ({totais.duplicadosCount})
              </button>

              {totais.jaPagosCount > 0 && (
                <button
                  onClick={() => setAbaAtiva('JA_PAGOS')}
                  style={{
                    ...estilos.botaoAba,
                    backgroundColor: abaAtiva === 'JA_PAGOS' ? '#dc2626' : '#fef2f2',
                    color: abaAtiva === 'JA_PAGOS' ? '#ffffff' : '#dc2626',
                    border: '1px solid #fecaca',
                    fontWeight: '800',
                  }}
                >
                  ⛔ Ver os {totais.jaPagosCount} Já Pagos
                </button>
              )}
            </div>

            {/* TABELA DE REGISTOS */}
            <section style={{ marginTop: '1rem' }}>
              <div style={estilos.containerTabela}>
                <table style={estilos.tabela}>
                  <thead>
                    <tr>
                      <th style={estilos.th}>REF / Contêiner</th>
                      <th style={estilos.th}>Placa (Cavalo)</th>
                      <th style={estilos.th}>Data OP</th>
                      <th style={estilos.th}>Origem → Destino</th>
                      <th style={estilos.th}>Tipo PGTO</th>
                      <th style={estilos.th}>Valor Líquido</th>
                      <th style={estilos.th}>Status / Apontamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosFiltrados.map((item, index) => (
                      <tr
                        key={index}
                        style={{
                          backgroundColor: item.jaPagoNoBanco ? '#fef2f2' : item.isDuplicado ? '#fef3c7' : '#ffffff',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <td style={estilos.td}>
                          <strong>{item.ref}</strong>
                          <br />
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: item.jaPagoNoBanco ? '#dc2626' : '#0f172a' }}>
                            📦 {item.conteiner}
                          </span>
                        </td>
                        <td style={estilos.td}><strong>{item.cavalo}</strong></td>
                        <td style={{ ...estilos.td, fontWeight: '700', color: '#0f172a' }}>
                          📅 {item.dataOpFormatada}
                        </td>
                        <td style={estilos.td}>{item.terminalOrigem} → {item.terminalDestino}</td>
                        <td style={estilos.td}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: item.categoriaPgto === 'PRAZO' ? '#dbeafe' : '#dcfce7', color: item.categoriaPgto === 'PRAZO' ? '#1e40af' : '#15803d' }}>
                            {item.tipoPgto}
                          </span>
                        </td>

                        <td style={{ ...estilos.td, fontWeight: '800', color: item.jaPagoNoBanco ? '#dc2626' : '#16a34a' }}>
                          {formatarMoeda(item.valorLiquidoFinal)}
                        </td>

                        <td style={estilos.td}>
                          {item.jaPagoNoBanco ? (
                            <span style={{ color: '#dc2626', fontWeight: '800', fontSize: '0.8rem' }}>
                              ⛔ JÁ PAGO NO SISTEMA (Contêiner {item.conteiner})
                            </span>
                          ) : item.isDuplicado ? (
                            <span style={{ color: '#b45309', fontWeight: 'bold', fontSize: '0.8rem' }}>
                              ⚠️ Repetido
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '0.8rem' }}>
                              ✅ Novo / Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

const estilos: { [key: string]: React.CSSProperties } = {
  cardUpload: { backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '2rem' },
  areaDrop: { border: '2px dashed #cbd5e1', padding: '2rem', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc' },
  botaoEscolher: { backgroundColor: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'inline-block', marginTop: '0.5rem' },
  status: { marginTop: '1rem', padding: '0.85rem', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center', border: '1px solid', fontWeight: '700' },
  gridTotais: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' },
  cardKpi: { backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' },
  cardKpiPrazo: { backgroundColor: '#eff6ff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #bfdbfe' },
  cardKpiVista: { backgroundColor: '#f0fdf4', padding: '1.5rem', borderRadius: '12px', border: '1px solid #bbf7d0' },
  tituloKpi: { fontSize: '0.8rem', fontWeight: '600', color: '#64748b' },
  tituloKpiPrazo: { fontSize: '0.8rem', fontWeight: '800', color: '#1e40af' },
  tituloKpiVista: { fontSize: '0.8rem', fontWeight: '800', color: '#166534' },
  valorKpi: { margin: '0.5rem 0', fontSize: '1.6rem', fontWeight: '700' },
  containerAbas: { display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' },
  botaoAba: { padding: '0.65rem 1.2rem', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  botaoAbaAtivo: { backgroundColor: '#2563eb', color: '#ffffff' },
  botaoAbaAlertaAtivo: { backgroundColor: '#d97706', color: '#ffffff' },
  containerTabela: { backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' },
  tabela: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' },
  th: { padding: '0.85rem 1rem', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600' },
  td: { padding: '0.85rem 1rem', color: '#1e293b' },
};