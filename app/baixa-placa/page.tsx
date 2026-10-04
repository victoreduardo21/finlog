'use client';

/**
 * ============================================================================
 * TELA: BAIXA POR PLACA COM BOTÃO DEDICADO "SALVAR DESCONTO"
 * Localização: web/app/baixa-placa/page.tsx
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './../components/Navbar';

interface MinutaItem {
  _id: string;
  ref: string;
  conteiner: string;
  terminalOrigem: string;
  terminalDestino: string;
  dataOp: string;
  tipoPgto: string;
  frete: number;
  valorBruto?: number;
  valorRpa?: number;
  descontoAdicionalAplicado?: number;
  valorLiquidoFinal?: number;
  statusPagamento: 'PENDENTE' | 'PAGO';
}

interface PlacaAgrupada {
  placa: string;
  totalValorBruto: number;
  totalValorLiquido: number;
  qtdMinutas: number;
  minutas: MinutaItem[];
}

export default function BaixaPorPlacaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);
  const [listaPlacas, setListaPlacas] = useState<PlacaAgrupada[]>([]);
  const [placaSelecionada, setPlacaSelecionada] = useState<PlacaAgrupada | null>(null);
  
  const [dataPagamento, setDataPagamento] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [descontoAdicional, setDescontoAdicional] = useState<number>(0);

  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  const carregarDadosAgrupados = useCallback(async () => {
    setCarregando(true);
    setMensagemStatus('⏳ A carregar veículos e minutas pendentes...');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resposta = await fetch(`${apiUrl}/importacao/agrupado-por-placa`);
      const resultado = await resposta.json();

      if (resposta.ok && resultado.dados) {
        setListaPlacas(resultado.dados);
        if (resultado.dados.length === 0) {
          setMensagemStatus('🎉 Nenhuma placa pendente de pagamento!');
        } else {
          setMensagemStatus(`✅ Encontradas ${resultado.totalPlacas} placa(s) pendente(s).`);
        }
      } else {
        setMensagemStatus('⚠️ Nenhuma minuta encontrada.');
      }
    } catch (erro: any) {
      setMensagemStatus('❌ Falha ao conectar ao servidor backend.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }
    setUsuario(JSON.parse(usuarioSalvo));
    carregarDadosAgrupados();
  }, [router, carregarDadosAgrupados]);

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Cálculos dinâmicos
  const subtotalBruto = placaSelecionada
    ? placaSelecionada.minutas.reduce((acc, m) => acc + (m.valorBruto || m.frete || 0), 0)
    : 0;

  const totalRpa = subtotalBruto * 0.027;
  const subtotalLiquidoRpa = subtotalBruto - totalRpa;
  const valorFinalPago = Math.max(0, subtotalLiquidoRpa - descontoAdicional);

  // Função para salvar exclusivamente o desconto no banco de dados
  const salvarApenasDesconto = async () => {
    if (!placaSelecionada) return;

    setCarregando(true);
    setMensagemStatus(`⏳ A salvar desconto para a placa ${placaSelecionada.placa}...`);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resposta = await fetch(`${apiUrl}/importacao/salvar-desconto-placa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: placaSelecionada.placa,
          descontoAdicional,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.mensagem || 'Falha ao salvar desconto.');
      }

      setMensagemStatus(`🎉 ${resultado.mensagem}`);
      await carregarDadosAgrupados();
    } catch (erro: any) {
      setMensagemStatus(`❌ Erro ao salvar desconto: ${erro.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // Função para executar a baixa final
  const executarBaixa = async (placaAlvo: string) => {
    if (!placaAlvo) return;

    const confirmacao = window.confirm(
      `Deseja dar baixa na placa ${placaAlvo} na data ${dataPagamento} no valor final de ${formatarMoeda(valorFinalPago)}?`
    );
    if (!confirmacao) return;

    setCarregando(true);
    setMensagemStatus(`⏳ A processar baixa da placa ${placaAlvo}...`);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resposta = await fetch(`${apiUrl}/importacao/baixar-por-placa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: placaAlvo,
          dataPagamento,
          descontoAdicional,
          subtotalBruto,
          totalRpa,
          valorFinalPago,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.mensagem || 'Falha ao salvar no banco de dados.');
      }

      setMensagemStatus(`🎉 ${resultado.mensagem}`);
      setPlacaSelecionada(null);
      setDescontoAdicional(0);
      await carregarDadosAgrupados();
    } catch (erro: any) {
      setMensagemStatus(`❌ Erro: ${erro.message}`);
    } finally {
      setCarregando(false);
    }
  };

  if (!usuario) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      <Sidebar usuario={usuario} />

      <main style={{ marginLeft: '260px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Baixa de Minutas por Placa
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Alique descontos por veículo, salve o valor e confirme a baixa
          </p>
        </header>

        {mensagemStatus && (
          <div style={{ 
            padding: '0.85rem', 
            borderRadius: '8px', 
            fontSize: '0.9rem', 
            marginBottom: '1rem',
            backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : mensagemStatus.includes('🎉') ? '#f0fdf4' : '#fffbeb',
            color: mensagemStatus.includes('❌') ? '#991b1b' : mensagemStatus.includes('🎉') ? '#166534' : '#b45309',
            border: '1px solid',
            borderColor: mensagemStatus.includes('❌') ? '#fecaca' : mensagemStatus.includes('🎉') ? '#bbf7d0' : '#fde68a',
          }}>
            {mensagemStatus}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginTop: '1rem' }}>
          
          {/* PAINEL ESQUERDO: LISTA DE PLACAS */}
          <section style={estilos.cardBox}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.1rem' }}>
              🚛 Veículos / Placas ({listaPlacas.length})
            </h3>
            
            <div style={{ overflowY: 'auto', maxHeight: '600px' }}>
              {listaPlacas.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
                  Nenhuma placa pendente de pagamento.
                </p>
              ) : (
                listaPlacas.map((item) => {
                  const isSelected = placaSelecionada?.placa === item.placa;
                  const vBruto = item.totalValorBruto || 0;
                  const vLiquidoRpa = vBruto * (1 - 0.027);

                  return (
                    <div
                      key={item.placa}
                      onClick={() => {
                        setPlacaSelecionada(item);
                        // Lê desconto pré-salvo se houver
                        const descExistente = item.minutas.reduce((acc, m) => acc + (m.descontoAdicionalAplicado || 0), 0);
                        setDescontoAdicional(descExistente);
                      }}
                      style={{
                        ...estilos.itemPlaca,
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{item.placa}</strong>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          {item.qtdMinutas} viagem(ns) pendente(s)
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: '#16a34a', fontSize: '1rem' }}>
                          {formatarMoeda(vLiquidoRpa - (item.minutas.reduce((acc, m) => acc + (m.descontoAdicionalAplicado || 0), 0)))}
                        </strong>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Líquido Final</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* PAINEL DIREITO: FORMULÁRIO E BOTÃO SALVAR DESCONTO */}
          <section style={estilos.cardBox}>
            {placaSelecionada ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a' }}>
                      Placa: <span style={{ color: '#2563eb' }}>{placaSelecionada.placa}</span>
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      {placaSelecionada.minutas.length} minuta(s) selecionada(s)
                    </p>
                  </div>

                  <button
                    onClick={() => executarBaixa(placaSelecionada.placa)}
                    disabled={carregando}
                    style={estilos.botaoBaixar}
                  >
                    {carregando ? '⏳ A processar...' : '✅ Dar Baixa nas Minutas'}
                  </button>
                </div>

                {/* PAINEL DE DATA E DESCONTO COM BOTÃO DEDICADO "SALVAR DESCONTO" */}
                <div style={estilos.painelAjustes}>
                  <div>
                    <label style={estilos.labelAjuste}>📅 Data do Pagamento *</label>
                    <input
                      type="date"
                      required
                      value={dataPagamento}
                      onChange={(e) => setDataPagamento(e.target.value)}
                      style={estilos.inputAjuste}
                    />
                  </div>

                  <div>
                    <label style={estilos.labelAjuste}>🏷️ Desconto Adicional da Placa (R$)</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={descontoAdicional || ''}
                        onChange={(e) => setDescontoAdicional(parseFloat(e.target.value) || 0)}
                        style={estilos.inputAjuste}
                      />
                      <button
                        type="button"
                        onClick={salvarApenasDesconto}
                        disabled={carregando}
                        style={estilos.botaoSalvarDesconto}
                      >
                        💾 Salvar Desconto
                      </button>
                    </div>
                  </div>
                </div>

                {/* CARDS DE RESUMO RECALCULADOS */}
                <div style={estilos.gridResumoPlaca}>
                  <div style={estilos.cardResumoItem}>
                    <span style={estilos.rotuloResumoItem}>Total Bruto</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{formatarMoeda(subtotalBruto)}</strong>
                  </div>

                  <div style={estilos.cardResumoItem}>
                    <span style={estilos.rotuloResumoItem}>Desconto RPA (2,7%)</span>
                    <strong style={{ fontSize: '1.1rem', color: '#dc2626' }}>- {formatarMoeda(totalRpa)}</strong>
                  </div>

                  <div style={estilos.cardResumoItem}>
                    <span style={estilos.rotuloResumoItem}>Desconto Adicional</span>
                    <strong style={{ fontSize: '1.1rem', color: '#d97706' }}>- {formatarMoeda(descontoAdicional)}</strong>
                  </div>

                  <div style={{ ...estilos.cardResumoItem, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <span style={estilos.rotuloResumoItem}>VALOR FINAL A PAGAR</span>
                    <strong style={{ fontSize: '1.25rem', color: '#16a34a' }}>{formatarMoeda(valorFinalPago)}</strong>
                  </div>
                </div>

                {/* TABELA DE MINUTAS */}
                <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
                  <table style={estilos.tabela}>
                    <thead>
                      <tr>
                        <th style={estilos.th}>REF / Container</th>
                        <th style={estilos.th}>Origem → Destino</th>
                        <th style={estilos.th}>Tipo PGTO</th>
                        <th style={estilos.th}>Valor Bruto</th>
                        <th style={estilos.th}>RPA (2,7%)</th>
                        <th style={estilos.th}>Valor Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {placaSelecionada.minutas.map((minuta, index) => {
                        const vBruto = minuta.valorBruto || minuta.frete || 0;
                        const vRpa = vBruto * 0.027;
                        const vLiquido = vBruto - vRpa;

                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={estilos.td}>
                              <strong>{minuta.ref || '-'}</strong>
                              <br />
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{minuta.conteiner}</span>
                            </td>
                            <td style={estilos.td}>{minuta.terminalOrigem} → {minuta.terminalDestino}</td>
                            <td style={estilos.td}>{minuta.tipoPgto}</td>
                            <td style={{ ...estilos.td, fontWeight: 'bold', color: '#0f172a' }}>
                              {formatarMoeda(vBruto)}
                            </td>
                            <td style={{ ...estilos.td, color: '#dc2626' }}>
                              - {formatarMoeda(vRpa)}
                            </td>
                            <td style={{ ...estilos.td, fontWeight: 'bold', color: '#16a34a' }}>
                              {formatarMoeda(vLiquido)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <span style={{ fontSize: '3rem' }}>👈</span>
                <p style={{ marginTop: '1rem', fontSize: '1rem' }}>
                  Selecione uma placa na lista ao lado para aplicar o desconto e efetuar a baixa.
                </p>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}

const estilos: { [key: string]: React.CSSProperties } = {
  cardBox: { backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' },
  itemPlaca: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' },
  botaoBaixar: { backgroundColor: '#16a34a', color: '#ffffff', padding: '0.75rem 1.25rem', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' },
  painelAjustes: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' },
  labelAjuste: { display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: '700', color: '#0f172a' },
  inputAjuste: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '0.9rem', fontWeight: '600', outline: 'none', boxSizing: 'border-box' },
  botaoSalvarDesconto: { backgroundColor: '#2563eb', color: '#ffffff', padding: '0.6rem 1rem', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' },
  gridResumoPlaca: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' },
  cardResumoItem: { padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  rotuloResumoItem: { fontSize: '0.7rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' },
  tabela: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' },
  th: { padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600' },
  td: { padding: '0.75rem 1rem', color: '#1e293b' },
};