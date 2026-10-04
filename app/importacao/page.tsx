'use client';
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
  dataOpFormatada: string;
  tipoPgto: string;
  dataPagamentoPrevista: string;
  valorBruto: number;
  valorRpa: number;
  descontoAVista: number;
  valorLiquidoFinal: number;
  categoriaPgto: 'PRAZO' | 'AVISTA_INTEGRAL';
  isDuplicado: boolean;
  mensagemAlerta?: string;
}

export default function ImportacaoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);
  const [dadosAnalisados, setDadosAnalisados] = useState<ItemAnalisado[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'TODOS' | 'PRAZO' | 'AVISTA_INTEGRAL' | 'DUPLICADOS'>('TODOS');
  const [nomeFicheiro, setNomeFicheiro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  const [totais, setTotais] = useState({
    // A Prazo
    brutoPrazo: 0,
    rpaPrazo: 0,
    liquidoPrazo: 0,
    qtdPrazo: 0,
    // À Vista
    brutoAvista: 0,
    rpaAvista: 0,
    descontoAvista: 0,
    liquidoAvista: 0,
    qtdAvista: 0,
    // Geral
    totalGeralLiquido: 0,
    duplicadosCount: 0,
    dataQuintaFeira: '',
  });

  const parseDataExcel = (dataExcel: string | number): Date => {
    if (typeof dataExcel === 'number') {
      return new Date(Math.round((dataExcel - 25569) * 86400 * 1000));
    }
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

    const mapaContagem = new Map<string, number>();
    linhas.forEach((l) => {
      const cav = String(l.CAVALO || l.cavalo || '').toUpperCase().trim();
      const cont = String(l.CONTEINER || l.conteiner || '').trim();
      const orig = String(l['TERMINAL ORIGEM'] || l.terminalOrigem || '').trim();
      const dest = String(l['TERMINAL DESTINO'] || l.terminalDestino || '').trim();
      const chave = `${cav}_${cont}_${orig}_${dest}`;
      mapaContagem.set(chave, (mapaContagem.get(chave) || 0) + 1);
    });

    const analisados: ItemAnalisado[] = linhas.map((linha) => {
      // Lê o Valor Bruto (suporta 'Valor Bruto', 'valor a pagar' ou 'FRETE')
      const valorBruto = Number(linha['Valor Bruto'] ?? linha['valor a pagar'] ?? linha.FRETE ?? linha.frete ?? 0);
      
      const rawDataOp = linha['DATA DA OP'] || linha.dataOp;
      const dataOp = parseDataExcel(rawDataOp);
      const tipoPgtoBruto = String(linha['TIPO DE PGTO'] || linha.tipoPgto || '').toUpperCase().trim();
      const cavaloPlaca = String(linha.CAVALO || linha.cavalo || '-').toUpperCase().trim();
      const refCode = String(linha.REF || linha.ref || '-');
      const conteinerCode = String(linha.CONTEINER || linha.conteiner || '-').trim();
      const origem = String(linha['TERMINAL ORIGEM'] || linha.terminalOrigem || '-').trim();
      const destino = String(linha['TERMINAL DESTINO'] || linha.terminalDestino || '-').trim();

      const chaveUnica = `${cavaloPlaca}_${conteinerCode}_${origem}_${destino}`;
      const qtdRepeticoes = mapaContagem.get(chaveUnica) || 1;

      const ehDuplicado = qtdRepeticoes > 1 || Boolean(linha.isDuplicado);
      if (ehDuplicado) numDuplicados++;

      // 1. Cálculo de RPA Fijo de 2,7%
      const valorRpa = valorBruto * 0.027;

      let categoriaPgto: 'PRAZO' | 'AVISTA_INTEGRAL' = 'PRAZO';
      let dataPagamentoPrevista = '';
      let descontoAVista = 0;

      const dataOpStr = dataOp.toLocaleDateString('pt-BR');
      const quintaStr = proximaQuinta.toLocaleDateString('pt-BR');

      const isAVista = tipoPgtoBruto.includes('AVISTA') || tipoPgtoBruto.includes('INTEGRAL') || tipoPgtoBruto.includes('A VISTA');

      if (isAVista) {
        categoriaPgto = 'AVISTA_INTEGRAL';
        dataPagamentoPrevista = 'HOJE / IMEDIATO';
        descontoAVista = valorBruto * 0.04; // 4% de taxa de adiantamento à vista
        
        sumBrutoAvista += valorBruto;
        sumRpaAvista += valorRpa;
        sumDescAvista += descontoAVista;
        sumLiquidoAvista += (valorBruto - valorRpa - descontoAVista);
        countAvista++;
      } else {
        categoriaPgto = 'PRAZO';
        dataPagamentoPrevista = quintaStr;
        
        sumBrutoPrazo += valorBruto;
        sumRpaPrazo += valorRpa;
        sumLiquidoPrazo += (valorBruto - valorRpa);
        countPrazo++;
      }

      const valorLiquidoFinal = valorBruto - valorRpa - descontoAVista;

      return {
        ref: refCode,
        cavalo: cavaloPlaca,
        conteiner: conteinerCode,
        terminalOrigem: origem,
        terminalDestino: destino,
        dataOpFormatada: dataOpStr,
        tipoPgto: tipoPgtoBruto,
        dataPagamentoPrevista,
        valorBruto,
        valorRpa,
        descontoAVista,
        valorLiquidoFinal,
        categoriaPgto,
        isDuplicado: ehDuplicado,
        mensagemAlerta: ehDuplicado ? `⚠️ Container ${conteinerCode} repetido (${qtdRepeticoes}x na planilha)` : '✅ Registo Pendente',
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
      totalGeralLiquido: sumLiquidoPrazo + sumLiquidoAvista,
      duplicadosCount: numDuplicados,
      dataQuintaFeira: proximaQuinta.toLocaleDateString('pt-BR'),
    });
  }, []);

  const carregarMinutasDoBanco = useCallback(async () => {
    setCarregando(true);
    setMensagemStatus('⏳ A carregar minutas pendentes...');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resposta = await fetch(`${apiUrl}/importacao`);
      const resultado = await resposta.json();

      if (resposta.ok && resultado.dados) {
        processarListaMinutas(resultado.dados);
        if (resultado.dados.length === 0) {
          setMensagemStatus('🎉 Todas as minutas foram pagas ou não há pendências!');
        } else {
          setMensagemStatus(`✅ Exibindo ${resultado.dados.length} minuta(s) pendente(s) de pagamento.`);
        }
      }
    } catch (erro: any) {
      setMensagemStatus('⚠️ Falha ao conectar ao servidor.');
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
    setMensagemStatus('⏳ A analisar e atualizar dados no sistema...');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resAnalise = await fetch(`${apiUrl}/importacao/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lancamentos: dadosPlanilha }),
      });

      const resultadoAnalise = await resAnalise.json();
      if (!resAnalise.ok) throw new Error(resultadoAnalise.mensagem || 'Erro ao analisar os dados.');

      const resConfirmar = await fetch(`${apiUrl}/importacao/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lancamentos: resultadoAnalise.lancamentos }),
      });

      const resultadoConfirmar = await resConfirmar.json();
      if (!resConfirmar.ok) throw new Error(resultadoConfirmar.mensagem || 'Erro ao atualizar a base.');

      if (resultadoConfirmar.dadosAtualizados) {
        processarListaMinutas(resultadoConfirmar.dadosAtualizados);
      }

      setMensagemStatus(`🎉 Planilha importada com sucesso! Total de minutas pendentes: ${resultadoConfirmar.criados}`);
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
    setMensagemStatus('⏳ A ler a planilha...');

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
    if (abaAtiva === 'PRAZO') return item.categoriaPgto === 'PRAZO';
    if (abaAtiva === 'AVISTA_INTEGRAL') return item.categoriaPgto === 'AVISTA_INTEGRAL';
    if (abaAtiva === 'DUPLICADOS') return item.isDuplicado;
    return true;
  });

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (!usuario) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      <Sidebar usuario={usuario} />

      <main style={{ marginLeft: '260px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Importação e Fechamento de Minutas
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Análise automática de Valor Bruto e Valor Líquido (RPA 2,7% e Taxa 4% À Vista)
          </p>
        </header>

        {/* Upload da Planilha */}
        <section style={estilos.cardUpload}>
          <div style={estilos.areaDrop}>
            <span style={{ fontSize: '2.5rem' }}>⚡</span>
            <h3 style={{ margin: '0.5rem 0', color: '#0f172a' }}>
              {nomeFicheiro ? nomeFicheiro : 'Importar Nova Planilha (.xlsx)'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
              Ao selecionar uma planilha, o sistema carregará e calculará os valores brutos e líquidos.
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

        {/* CARDS DE RESUMO DO SISTEMA (A PRAZO VS À VISTA) */}
        {dadosAnalisados.length > 0 && (
          <>
            <section style={estilos.gridTotais}>
              {/* PAINEL A PRAZO */}
              <div style={estilos.cardKpiPrazo}>
                <span style={estilos.tituloKpiPrazo}>📅 A PRAZO (Quinta-Feira {totais.dataQuintaFeira})</span>
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

              {/* PAINEL À VISTA */}
              <div style={estilos.cardKpiVista}>
                <span style={estilos.tituloKpiVista}>⚡ À VISTA / INTEGRAL (Hoje)</span>
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

              {/* ALERTAS DUPLICIDADE */}
              <div style={estilos.cardKpi}>
                <span style={estilos.tituloKpi}>⚠️️ ALERTAS DE DUPLICIDADE</span>
                <p style={{ ...estilos.valorKpi, color: totais.duplicadosCount > 0 ? '#b45309' : '#16a34a' }}>
                  {totais.duplicadosCount} Repetições
                </p>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Destacados na tabela</span>
              </div>
            </section>

            {/* SELEÇÃO DE ABAS */}
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
                ⚠️ Duplicados ({totais.duplicadosCount})
              </button>
            </div>

            {/* TABELA DE DADOS COM VALOR BRUTO E VALOR LÍQUIDO LADO A LADO */}
            <section style={{ marginTop: '1rem' }}>
              <div style={estilos.containerTabela}>
                <table style={estilos.tabela}>
                  <thead>
                    <tr>
                      <th style={estilos.th}>REF / Contêiner</th>
                      <th style={estilos.th}>Placa (Cavalo)</th>
                      <th style={estilos.th}>Origem → Destino</th>
                      <th style={estilos.th}>Tipo PGTO</th>
                      <th style={estilos.th}>Valor Bruto</th>
                      <th style={estilos.th}>RPA (2,7%)</th>
                      <th style={estilos.th}>Valor Líquido</th>
                      <th style={estilos.th}>Alerta / Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosFiltrados.map((item, index) => (
                      <tr
                        key={index}
                        style={{
                          backgroundColor: item.isDuplicado ? '#fef3c7' : '#ffffff',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <td style={estilos.td}>
                          <strong>{item.ref}</strong>
                          <br />
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.conteiner}</span>
                        </td>
                        <td style={estilos.td}><strong>{item.cavalo}</strong></td>
                        <td style={estilos.td}>{item.terminalOrigem} → {item.terminalDestino}</td>
                        <td style={estilos.td}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: item.categoriaPgto === 'PRAZO' ? '#dbeafe' : '#dcfce7', color: item.categoriaPgto === 'PRAZO' ? '#1e40af' : '#15803d' }}>
                            {item.tipoPgto}
                          </span>
                        </td>

                        {/* COLUNA: VALOR BRUTO ORIGINAL */}
                        <td style={{ ...estilos.td, fontWeight: '700', color: '#0f172a' }}>
                          {formatarMoeda(item.valorBruto)}
                        </td>

                        {/* COLUNA: DESCONTO RPA (2,7%) */}
                        <td style={{ ...estilos.td, color: '#dc2626' }}>
                          - {formatarMoeda(item.valorRpa)}
                        </td>

                        {/* COLUNA: VALOR LÍQUIDO FINAL */}
                        <td style={{ ...estilos.td, fontWeight: '800', color: item.categoriaPgto === 'PRAZO' ? '#1d4ed8' : '#15803d' }}>
                          {formatarMoeda(item.valorLiquidoFinal)}
                        </td>

                        <td style={estilos.td}>
                          {item.isDuplicado ? (
                            <span style={{ color: '#b45309', fontWeight: 'bold', fontSize: '0.8rem' }}>
                              {item.mensagemAlerta}
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '0.8rem' }}>
                              ✅ Registo Pendente
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
  status: { marginTop: '1rem', padding: '0.85rem', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center', border: '1px solid' },
  gridTotais: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' },
  cardKpi: { backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' },
  cardKpiPrazo: { backgroundColor: '#eff6ff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #bfdbfe' },
  cardKpiVista: { backgroundColor: '#f0fdf4', padding: '1.5rem', borderRadius: '12px', border: '1px solid #bbf7d0' },
  tituloKpi: { fontSize: '0.8rem', fontWeight: '600', color: '#64748b' },
  tituloKpiPrazo: { fontSize: '0.8rem', fontWeight: '800', color: '#1e40af' },
  tituloKpiVista: { fontSize: '0.8rem', fontWeight: '800', color: '#166534' },
  valorKpi: { margin: '0.5rem 0', fontSize: '1.6rem', fontWeight: '700' },
  containerAbas: { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  botaoAba: { padding: '0.65rem 1.2rem', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  botaoAbaAtivo: { backgroundColor: '#2563eb', color: '#ffffff' },
  botaoAbaAlertaAtivo: { backgroundColor: '#d97706', color: '#ffffff' },
  containerTabela: { backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' },
  tabela: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' },
  th: { padding: '0.85rem 1rem', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600' },
  td: { padding: '0.85rem 1rem', color: '#1e293b' },
};