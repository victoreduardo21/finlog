'use client';

/**
 * ============================================================================
 * TELA: IMPORTAÇÃO E FECHAMENTO DE MINUTAS (CONEXÃO HÍBRIDA LOCAL / PRODUÇÃO)
 * Localização no VS Code: empresa/app/importacao/page.tsx
 * Tecnologias: Next.js (React / TypeScript), XLSX, API Express, MongoDB Atlas
 * Descrição: Processa planilhas Excel (.xlsx), comunica com o backend configurado
 *            na variável NEXT_PUBLIC_API_URL e calcula o fechamento financeiro.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
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
  valorBruto?: number;
  valorRpa?: number;
  descontoAVista?: number;
  valorLiquidoFinal?: number;
  isDuplicado?: boolean;
  jaPagoNoBanco?: boolean;
  mensagemAlerta?: string;
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
    totalBruto: 0,
    totalRpa: 0,
    totalDescontoVista: 0,
    qtdPendentes: 0,
    qtdPagas: 0,
    qtdAVista: 0,
    qtdAPrazo: 0,
    valorAVistaLiquido: 0,
    valorAPrazoLiquido: 0,
  });

  // Feedback visual
  const [carregando, setCarregando] = useState<boolean>(false);
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);

  // OBTÉM A URL DO BACKEND PELA VARIÁVEL DE AMBIENTE OU LOCALHOST
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Carrega dados da sessão local ao entrar na página
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
  }, [router]);

  /**
   * LEITURA DA PLANILHA E ENVIO PARA O BACKEND
   */
  const handleImportacaoDireta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setNomeArquivo(arquivo.name);
    setCarregando(true);
    setMensagemStatus('⏳ A ler planilha e a ligar ao servidor...');

    const leitor = new FileReader();

    leitor.onload = async (evento) => {
      try {
        const buffer = new Uint8Array(evento.target?.result as ArrayBuffer);
        const livroExcel = XLSX.read(buffer, { type: 'array' });
        const primeiraAba = livroExcel.SheetNames[0];
        const folha = livroExcel.Sheets[primeiraAba];

        // Converte as linhas do Excel para JSON
        const lancamentosBrutos: any[] = XLSX.utils.sheet_to_json(folha);

        if (lancamentosBrutos.length === 0) {
          setMensagemStatus('⚠️ A planilha selecionada está vazia ou é inválida.');
          setCarregando(false);
          return;
        }

        let minutasAnalisadas: MinutaModel[] = [];
        let salvouNoBanco = false;

        // TENTATIVA DE ENVIO PARA O BACKEND EXPRESS
        try {
          const resAnalise = await fetch(`${apiUrl}/importacao/analisar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
            },
            body: JSON.stringify({ lancamentos: lancamentosBrutos }),
          });

          const textoAnalise = await resAnalise.text();

          if (!textoAnalise.trim().startsWith('<')) {
            const resultadoAnalise = JSON.parse(textoAnalise);

            if (resAnalise.ok && resultadoAnalise.sucesso) {
              minutasAnalisadas = resultadoAnalise.lancamentos || [];

              // Confirmação e gravação no MongoDB Atlas[cite: 7]
              const resConfirmar = await fetch(`${apiUrl}/importacao/confirmar`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                },
                body: JSON.stringify({ lancamentos: minutasAnalisadas }),
              });

              const textoConfirmar = await resConfirmar.text();

              if (!textoConfirmar.trim().startsWith('<')) {
                const resultadoConfirmar = JSON.parse(textoConfirmar);
                if (resConfirmar.ok && resultadoConfirmar.sucesso) {
                  salvouNoBanco = true;
                }
              }
            }
          }
        } catch (erroBackend) {
          console.warn('⚠️ Servidor backend offline. Calculando valores localmente.');
        }

        // CÁLCULO LOCAL SE O BACKEND ESTIVER OFFLINE
        if (minutasAnalisadas.length === 0) {
          minutasAnalisadas = lancamentosBrutos.map((item) => {
            const vBruto = Number(item['Valor Bruto'] ?? item['valor a pagar'] ?? item.FRETE ?? item.frete ?? 0);
            const tipoStr = String(item['TIPO DE PGTO'] || item.tipoPgto || '').toUpperCase();
            const isVista = tipoStr.includes('VISTA') || tipoStr.includes('AVISTA');

            const vRpa = vBruto * 0.027;
            const vDescVista = isVista ? vBruto * 0.04 : 0;
            const vLiq = vBruto - vRpa - vDescVista;

            return {
              ref: String(item.REF || item.ref || ''),
              cavalo: String(item.CAVALO || item.cavalo || item.PLACA || item.placa || '').toUpperCase(),
              conteiner: String(item.CONTEINER || item.conteiner || ''),
              terminalOrigem: String(item['TERMINAL ORIGEM'] || item.terminalOrigem || ''),
              terminalDestino: String(item['TERMINAL DESTINO'] || item.terminalDestino || ''),
              tipoPgto: tipoStr,
              valorBruto: vBruto,
              valorRpa: vRpa,
              descontoAVista: vDescVista,
              valorLiquidoFinal: vLiq,
              statusPagamento: 'PENDENTE',
            };
          });
        }

        // SOMATÓRIO PARA OS CARTÕES SUPERIORES
        let bruto = 0;
        let rpa = 0;
        let descVista = 0;
        let liquido = 0;
        let pendentes = 0;
        let pagas = 0;
        let aVistaQtd = 0;
        let aPrazoQtd = 0;
        let aVistaLiq = 0;
        let aPrazoLiq = 0;

        minutasAnalisadas.forEach((m) => {
          const vBruto = Number(m.valorBruto || 0);
          const vRpa = Number(m.valorRpa || (vBruto * 0.027));
          const vDescVista = Number(m.descontoAVista || 0);
          const vLiq = Number(m.valorLiquidoFinal || (vBruto - vRpa - vDescVista));

          bruto += vBruto;
          rpa += vRpa;
          descVista += vDescVista;
          liquido += vLiq;

          if (m.jaPagoNoBanco || m.statusPagamento === 'PAGO') {
            pagas++;
          } else {
            pendentes++;
          }

          const tipoStr = String(m.tipoPgto || '').toUpperCase();
          if (tipoStr.includes('VISTA') || tipoStr.includes('AVISTA')) {
            aVistaQtd++;
            aVistaLiq += vLiq;
          } else {
            aPrazoQtd++;
            aPrazoLiq += vLiq;
          }
        });

        setListaMinutas(minutasAnalisadas);
        setResumo({
          totalLiquido: liquido,
          totalBruto: bruto,
          totalRpa: rpa,
          totalDescontoVista: descVista,
          qtdPendentes: pendentes,
          qtdPagas: pagas,
          qtdAVista: aVistaQtd,
          qtdAPrazo: aPrazoQtd,
          valorAVistaLiquido: aVistaLiq,
          valorAPrazoLiquido: aPrazoLiq,
        });

        if (salvouNoBanco) {
          setMensagemStatus(`✅ ${minutasAnalisadas.length} viagem(ns) analisada(s) e gravada(s) no banco de dados!`);
        } else {
          setMensagemStatus(`⚠️ ${minutasAnalisadas.length} viagem(ns) calculada(s) localmente. Verifique a conexão com o servidor backend.`);
        }
      } catch (erro: any) {
        console.error('Erro ao processar planilha:', erro);
        setMensagemStatus(`❌ ${erro.message || 'Erro ao processar o ficheiro Excel.'}`);
      } finally {
        setCarregando(false);
      }
    };

    leitor.readAsArrayBuffer(arquivo);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', color: '#0f172a' }}>
      
      {/* 1. BARRA LATERAL (SIDEBAR DE NAVEGAÇÃO) */}
      <Sidebar usuario={usuarioLogado} />

      {/* 2. CONTEÚDO PRINCIPAL DA PÁGINA */}
      <main style={{ marginLeft: '250px', flex: 1, padding: '2rem 3rem' }}>
        
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Importação e Fechamento de Minutas
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: '500' }}>
            Acompanhamento em tempo real com validação e apontamento de contêineres já pagos
          </p>
        </header>

        {/* ÁREA DE CARREGAMENTO DO FICHEIRO */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontWeight: '800', color: '#1e293b', fontSize: '1rem' }}>
                📁 {nomeArquivo ? nomeArquivo : 'Selecione a planilha (.xlsx)'}
              </p>
              <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                Carregue a planilha para salvar lançamentos e recalcular os valores em tempo real.
              </p>
            </div>

            <input
              type="file"
              id="fileInput"
              accept=".xlsx, .xls"
              onChange={handleImportacaoDireta}
              style={{ display: 'none' }}
            />

            <label htmlFor="fileInput" style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: '800', fontSize: '0.875rem', cursor: 'pointer' }}>
              {carregando ? '⏳ A processar...' : '📂 Carregar Planilha Excel'}
            </label>
          </div>
        </section>

        {/* ALERTA DE STATUS DE GRAVAÇÃO */}
        {mensagemStatus && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : mensagemStatus.includes('⚠️') ? '#fffbeb' : '#f0fdf4',
            color: mensagemStatus.includes('❌') ? '#991b1b' : mensagemStatus.includes('⚠️️') ? '#b45309' : '#166534',
            border: '1px solid',
            borderColor: mensagemStatus.includes('❌') ? '#fecaca' : mensagemStatus.includes('⚠️') ? '#fde68a' : '#bbf7d0',
          }}>
            {mensagemStatus}
          </div>
        )}

        {/* CARTÕES DE RESUMO FINANCEIRO */}
        {listaMinutas.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
              
              {/* CARTÃO 1: TOTAL LÍQUIDO A RECEBER */}
              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>TOTAL LÍQUIDO A RECEBER</span>
                <strong style={{ fontSize: '1.8rem', color: '#16a34a', fontWeight: '900', margin: '0.4rem 0' }}>
                  R$ {resumo.totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>
                  Bruto: R$ {resumo.totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | RPA: -R$ {resumo.totalRpa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* CARTÃO 2: FRETES PENDENTES */}
              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>FRETES PENDENTES</span>
                <strong style={{ fontSize: '1.8rem', color: '#d97706', fontWeight: '900', margin: '0.4rem 0' }}>
                  {resumo.qtdPendentes}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>
                  Aguardando pagamento
                </span>
              </div>

              {/* CARTÃO 3: FRETES PAGOS */}
              <div style={estilos.cardPadrao}>
                <span style={estilos.tituloCard}>FRETES PAGOS</span>
                <strong style={{ fontSize: '1.8rem', color: '#2563eb', fontWeight: '900', margin: '0.4rem 0' }}>
                  {resumo.qtdPagas}
                </strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>
                  Pagamentos efetuados
                </span>
              </div>

            </div>

            {/* PAINEL SECUNDÁRIO: SEPARAÇÃO À VISTA vs A PRAZO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#92400e', textTransform: 'uppercase' }}>
                  ⚡ FRETES À VISTA (4.0% DESC.)
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '1.3rem', color: '#b45309', fontWeight: '800' }}>
                    R$ {resumo.valorAVistaLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    {resumo.qtdAVista} minuta(s)
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>
                  📅 FRETES A PRAZO (SEM DESC. EXTRA)
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '1.3rem', color: '#1e293b', fontWeight: '800' }}>
                    R$ {resumo.valorAPrazoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', backgroundColor: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    {resumo.qtdAPrazo} minuta(s)
                  </span>
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
                    <th style={estilos.th}>RPA (2.7%)</th>
                    <th style={estilos.th}>Desc. À Vista</th>
                    <th style={estilos.th}>Líquido Final</th>
                    <th style={estilos.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {listaMinutas.map((item, idx) => (
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
                          backgroundColor: String(item.tipoPgto || item['TIPO DE PGTO'] || '').toUpperCase().includes('VISTA') ? '#fef3c7' : '#e2e8f0',
                          color: String(item.tipoPgto || item['TIPO DE PGTO'] || '').toUpperCase().includes('VISTA') ? '#92400e' : '#334155',
                        }}>
                          {item.tipoPgto || item['TIPO DE PGTO'] || 'A PRAZO'}
                        </span>
                      </td>
                      <td style={estilos.td}>R$ {(item.valorBruto || 0).toFixed(2)}</td>
                      <td style={{ ...estilos.td, color: '#dc2626' }}>- R$ {(item.valorRpa || 0).toFixed(2)}</td>
                      <td style={{ ...estilos.td, color: '#d97706' }}>- R$ {(item.descontoAVista || 0).toFixed(2)}</td>
                      <td style={{ ...estilos.td, fontWeight: '900', color: '#166534', fontSize: '0.9rem' }}>
                        R$ {(item.valorLiquidoFinal || 0).toFixed(2)}
                      </td>
                      <td style={{ ...estilos.td, fontWeight: '700', color: item.jaPagoNoBanco ? '#b91c1c' : item.isDuplicado ? '#b45309' : '#15803d' }}>
                        {item.mensagemAlerta || '✅ Pendente'}
                      </td>
                    </tr>
                  ))}
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