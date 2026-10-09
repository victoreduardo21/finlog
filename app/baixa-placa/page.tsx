'use client';

/**
 * ============================================================================
 * TELA: BAIXA POR PLACA (INTEGRAÇÃO COM ENDPOINT /caminhoneiros)
 * Localização no projeto: web/app/baixa-placa/page.tsx
 * Tecnologias: Next.js (React / TypeScript), Express API, MongoDB Atlas
 * Descrição: Pesquisa dinamicamente o motorista vinculado no endpoint
 *            '/caminhoneiros?placa=XYZ' e exibe Nome, PIX, CPF e contacto.
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
  valorFrete?: number;
  valorPedagio?: number;
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

interface MotoristaModel {
  _id?: string;
  nome?: string;
  nomeCompleto?: string;
  cpf?: string;
  telefone?: string;
  whatsapp?: string;
  contato?: string;
  chavePix?: string;
  pix?: string;
  placa?: string;
  placas?: string[];
  [key: string]: any;
}

export default function BaixaPorPlacaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);
  
  // Lista original e placa selecionada
  const [listaPlacas, setListaPlacas] = useState<PlacaAgrupada[]>([]);
  const [placaSelecionada, setPlacaSelecionada] = useState<PlacaAgrupada | null>(null);
  
  // Campo de Pesquisa por Placa
  const [termoPesquisa, setTermoPesquisa] = useState<string>('');

  // Dados do Motorista Vinculado à Placa
  const [motoristaVinculado, setMotoristaVinculado] = useState<MotoristaModel | null>(null);
  const [carregandoMotorista, setCarregandoMotorista] = useState<boolean>(false);
  
  const [dataPagamento, setDataPagamento] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [descontoAdicionalInput, setDescontoAdicionalInput] = useState<string>('0.00');

  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Helper para formatação de moeda BRL
  const formatarMoeda = (valor: number) => {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Busca veículos e minutas pendentes do servidor
  const carregarDadosAgrupados = useCallback(async () => {
    setCarregando(true);
    setMensagemStatus('⏳ A carregar veículos e minutas pendentes...');

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
  }, [apiUrl]);

  // Busca os dados do motorista no endpoint /caminhoneiros
  const buscarMotoristaPorPlaca = useCallback(async (placa: string) => {
    if (!placa) return;
    setCarregandoMotorista(true);
    setMotoristaVinculado(null);

    try {
      // AJUSTE: Rota alinhada com o backend (/caminhoneiros)
      const resposta = await fetch(`${apiUrl}/caminhoneiros?placa=${encodeURIComponent(placa)}`);
      const resultado = await resposta.json();

      if (resposta.ok && (resultado.dado || resultado.dados || resultado.motorista)) {
        const dadosMotorista = resultado.dado || resultado.motorista || (Array.isArray(resultado.dados) ? resultado.dados[0] : null);
        setMotoristaVinculado(dadosMotorista);
      }
    } catch (erro) {
      console.warn('Motorista não encontrado para a placa:', placa);
    } finally {
      setCarregandoMotorista(false);
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
    carregarDadosAgrupados();
  }, [router, carregarDadosAgrupados]);

  // Filtro dinâmico de placas por termo pesquisado
  const placasFiltradas = listaPlacas.filter((p) =>
    p.placa.toUpperCase().includes(termoPesquisa.toUpperCase().trim())
  );

  // =========================================================================
  // CÁLCULO DE VALORES COM ABATIMENTO DE DESCONTO
  // =========================================================================
  const qtdMinutasTotal = placaSelecionada?.minutas.length || 0;
  const descontoAdicionalNum = Number(descontoAdicionalInput) || 0;
  const descontoPorMinuta = qtdMinutasTotal > 0 ? descontoAdicionalNum / qtdMinutasTotal : 0;

  // Processamento individual das minutas
  const minutasProcessadas = placaSelecionada ? placaSelecionada.minutas.map((minuta) => {
    const vBrutoOriginal = Number(minuta.valorFrete || minuta.frete || minuta.valorBruto || 0);
    const vPedagio = Number(minuta.valorPedagio || 0);

    // 1. Subtrai o desconto proporcional do Valor Bruto do Frete
    const vBrutoAjustado = Math.max(0, vBrutoOriginal - descontoPorMinuta);

    // 2. RPA de 2,7% recalculado estritamente sobre o novo Valor Bruto
    const vRpaAjustado = vBrutoAjustado * 0.027;

    // 3. Valor Líquido Final da Minuta
    const vLiquidoAjustado = (vBrutoAjustado - vRpaAjustado) + vPedagio;

    return {
      ...minuta,
      vBrutoOriginal,
      vBrutoAjustado,
      vRpaAjustado,
      vLiquidoAjustado,
    };
  }) : [];

  // Totais consolidados para exibição nos cartões de resumo
  const subtotalBrutoComDesconto = minutasProcessadas.reduce((acc, item) => acc + item.vBrutoAjustado, 0);
  const totalRpaCalculado = minutasProcessadas.reduce((acc, item) => acc + item.vRpaAjustado, 0);
  const valorFinalPagoCalculado = minutasProcessadas.reduce((acc, item) => acc + item.vLiquidoAjustado, 0);

  // Seleciona uma placa na lista lateral
  const selecionarPlaca = (item: PlacaAgrupada) => {
    setPlacaSelecionada(item);
    const descSalvo = item.minutas.reduce((acc, m) => acc + (m.descontoAdicionalAplicado || 0), 0);
    setDescontoAdicionalInput(Number(descSalvo || 0).toFixed(2));
    buscarMotoristaPorPlaca(item.placa);
  };

  // Envia o desconto atualizado para ser salvo no MongoDB
  const salvarApenasDesconto = async () => {
    if (!placaSelecionada) return;

    setCarregando(true);
    setMensagemStatus(`⏳ A salvar desconto para a placa ${placaSelecionada.placa}...`);

    try {
      const resposta = await fetch(`${apiUrl}/importacao/salvar-desconto-placa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: placaSelecionada.placa,
          descontoAdicional: descontoAdicionalNum,
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

  // Grava a baixa definitiva das minutas da placa selecionada
  const executarBaixa = async (placaAlvo: string) => {
    if (!placaAlvo) return;

    const confirmacao = window.confirm(
      `Deseja dar baixa na placa ${placaAlvo} na data ${dataPagamento} no valor final de ${formatarMoeda(valorFinalPagoCalculado)}?`
    );
    if (!confirmacao) return;

    setCarregando(true);
    setMensagemStatus(`⏳ A processar baixa da placa ${placaAlvo}...`);

    try {
      const resposta = await fetch(`${apiUrl}/importacao/baixar-por-placa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: placaAlvo,
          dataPagamento,
          descontoAdicional: descontoAdicionalNum,
          subtotalBruto: subtotalBrutoComDesconto,
          totalRpa: totalRpaCalculado,
          valorFinalPago: valorFinalPagoCalculado,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.mensagem || 'Falha ao salvar no banco de dados.');
      }

      setMensagemStatus(`🎉 ${resultado.mensagem}`);
      setPlacaSelecionada(null);
      setMotoristaVinculado(null);
      setDescontoAdicionalInput('0.00');
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
            Filtre por placa, verifique o motorista vinculado e confirme a baixa
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
          
          {/* PAINEL ESQUERDO: LISTA E CAMPO DE PESQUISA POR PLACA */}
          <section style={estilos.cardBox}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', fontSize: '1.1rem' }}>
              🚛 Veículos / Placas ({placasFiltradas.length})
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="🔍 Pesquisar por placa..."
                value={termoPesquisa}
                onChange={(e) => setTermoPesquisa(e.target.value)}
                style={estilos.inputPesquisa}
              />
            </div>
            
            <div style={{ overflowY: 'auto', maxHeight: '550px' }}>
              {placasFiltradas.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
                  {termoPesquisa ? 'Nenhuma placa encontrada.' : 'Nenhuma placa pendente de pagamento.'}
                </p>
              ) : (
                placasFiltradas.map((item) => {
                  const isSelected = placaSelecionada?.placa === item.placa;
                  const vBruto = item.totalValorBruto || 0;
                  const rpaList = vBruto * 0.027;
                  const vLiquidoFinal = vBruto - rpaList;

                  return (
                    <div
                      key={item.placa}
                      onClick={() => selecionarPlaca(item)}
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
                          {formatarMoeda(vLiquidoFinal)}
                        </strong>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Líquido Final</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* PAINEL DIREITO: DETALHES, MOTORISTA VINCULADO E TABELA */}
          <section style={estilos.cardBox}>
            {placaSelecionada ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
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

                {/* DADOS DO MOTORISTA VINCULADO */}
                <div style={estilos.cardMotorista}>
                  {carregandoMotorista ? (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>⏳ A buscar dados do motorista...</span>
                  ) : motoristaVinculado ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <div>
                        <span style={{ color: '#64748b', fontWeight: '600' }}>👤 Motorista: </span>
                        <strong style={{ color: '#0f172a' }}>
                          {motoristaVinculado.nome || motoristaVinculado.nomeCompleto || 'Não informado'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', fontWeight: '600' }}>🔑 Chave PIX: </span>
                        <strong style={{ color: '#16a34a', backgroundColor: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {motoristaVinculado.pix || motoristaVinculado.chavePix || 'Não cadastrado'}
                        </strong>
                      </div>
                      {motoristaVinculado.cpf && (
                        <div>
                          <span style={{ color: '#64748b', fontWeight: '600' }}>🪪 CPF/CNPJ: </span>
                          <span style={{ color: '#334155', fontWeight: '700' }}>{motoristaVinculado.cpf}</span>
                        </div>
                      )}
                      {(motoristaVinculado.whatsapp || motoristaVinculado.contato || motoristaVinculado.telefone) && (
                        <div>
                          <span style={{ color: '#64748b', fontWeight: '600' }}>📞 Contato: </span>
                          <span style={{ color: '#334155', fontWeight: '700' }}>
                            {motoristaVinculado.whatsapp || motoristaVinculado.contato || motoristaVinculado.telefone}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: '600' }}>
                      ⚠️ Nenhum motorista cadastrado no sistema para a placa {placaSelecionada.placa}.
                    </span>
                  )}
                </div>

                {/* PAINEL DE DATA E DESCONTO */}
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
                        value={descontoAdicionalInput}
                        onChange={(e) => setDescontoAdicionalInput(e.target.value)}
                        onBlur={() => {
                          const valNum = Number(descontoAdicionalInput) || 0;
                          setDescontoAdicionalInput(valNum.toFixed(2));
                        }}
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

                {/* CARDS DE RESUMO FINANCEIRO */}
                <div style={estilos.gridResumoPlaca}>
                  <div style={estilos.cardResumoItem}>
                    <span style={estilos.rotuloResumoItem}>Total Bruto (Com Desconto)</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{formatarMoeda(subtotalBrutoComDesconto)}</strong>
                  </div>

                  <div style={estilos.cardResumoItem}>
                    <span style={estilos.rotuloResumoItem}>Desconto RPA (2,7%)</span>
                    <strong style={{ fontSize: '1.1rem', color: '#dc2626' }}>- {formatarMoeda(totalRpaCalculado)}</strong>
                  </div>

                  <div style={estilos.cardResumoItem}>
                    <span style={estilos.rotuloResumoItem}>Desconto Aplicado</span>
                    <strong style={{ fontSize: '1.1rem', color: '#d97706' }}>- {formatarMoeda(descontoAdicionalNum)}</strong>
                  </div>

                  <div style={{ ...estilos.cardResumoItem, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <span style={estilos.rotuloResumoItem}>VALOR FINAL A PAGAR</span>
                    <strong style={{ fontSize: '1.25rem', color: '#16a34a' }}>{formatarMoeda(valorFinalPagoCalculado)}</strong>
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
                        <th style={estilos.th}>Valor Bruto (Ajustado)</th>
                        <th style={estilos.th}>RPA (2,7%)</th>
                        <th style={estilos.th}>Valor Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {minutasProcessadas.map((minuta, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={estilos.td}>
                            <strong>{minuta.ref || '-'}</strong>
                            <br />
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{minuta.conteiner}</span>
                          </td>
                          <td style={estilos.td}>{minuta.terminalOrigem} → {minuta.terminalDestino}</td>
                          <td style={estilos.td}>{minuta.tipoPgto}</td>
                          <td style={{ ...estilos.td, fontWeight: 'bold', color: '#0f172a' }}>
                            {formatarMoeda(minuta.vBrutoAjustado)}
                          </td>
                          <td style={{ ...estilos.td, color: '#dc2626' }}>
                            - {formatarMoeda(minuta.vRpaAjustado)}
                          </td>
                          <td style={{ ...estilos.td, fontWeight: 'bold', color: '#16a34a' }}>
                            {formatarMoeda(minuta.vLiquidoAjustado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <span style={{ fontSize: '3rem' }}>👈</span>
                <p style={{ marginTop: '1rem', fontSize: '1rem' }}>
                  Selecione uma placa na lista ao lado para ver o motorista e efetuar a baixa.
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
  inputPesquisa: { 
    width: '100%', 
    padding: '0.6rem 0.75rem', 
    borderRadius: '8px', 
    border: '1px solid #cbd5e1', 
    fontSize: '0.875rem', 
    outline: 'none', 
    boxSizing: 'border-box',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    fontWeight: '600'
  },
  cardMotorista: { backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1rem' },
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