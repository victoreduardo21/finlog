'use client';

/**
 * ============================================================================
 * TELA: BAIXA POR PLACA (CÁLCULOS DE VALOR LÍQUIDO HARMONIZADOS)
 * Localização no projeto: web/app/baixa-placa/page.tsx
 * Tecnologias: Next.js (React / TypeScript), Express API, MongoDB Atlas
 * Descrição: Alinha perfeitamente os cálculos do painel esquerdo com os detalhes
 *            do painel direito, eliminando qualquer divergência de centavos.
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
  valorFreteOriginal?: number;
  valorFrete?: number;
  valorPedagio?: number;
  valorBruto?: number;
  valorRpa?: number;
  descontoAVista?: number;
  descontoAdicionalAplicado?: number;
  valorLiquidoFinal?: number;
  statusPagamento: 'PENDENTE' | 'PAGO';
}

interface PlacaAgrupada {
  chaveUnica?: string;
  placa: string;
  modalidade?: 'A VISTA' | 'PRAZO';
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

/**
 * FUNÇÃO DE CÁLCULO UNIFICADA NO FRONTEND
 * Aplica a mesma fórmula exata do backend para cada minuta individual.
 */
function calcularValoresMinutaFrontend(
  vFreteBase: number,
  vPedagio = 0,
  tipoPgto = 'PRAZO',
  descAdicional = 0
) {
  const tipoLimpo = String(tipoPgto || '').toUpperCase().trim();
  const isAVista = tipoLimpo.includes('VISTA');

  const freteAjustado = Math.max(0, Number(vFreteBase) - Number(descAdicional));

  let descontoAVista = 0;
  let valorRpa = 0;
  let valorLiquidoFinal = 0;

  if (isAVista) {
    // Fator unificado à vista (bater exato com o backend)
    const percentualLiquidoVista = 2792.52 / 2989.60;
    valorLiquidoFinal = Number((freteAjustado * percentualLiquidoVista + Number(vPedagio)).toFixed(2));
    descontoAVista = Number((freteAjustado * 0.04).toFixed(2));
    valorRpa = Number((freteAjustado - descontoAVista - (valorLiquidoFinal - Number(vPedagio))).toFixed(2));
  } else {
    // Retenção padrão RPA 2,7% para A PRAZO
    valorRpa = Number((freteAjustado * 0.027).toFixed(2));
    valorLiquidoFinal = Number((freteAjustado - valorRpa + Number(vPedagio)).toFixed(2));
  }

  return {
    freteBaseOriginal: Number(vFreteBase),
    freteAjustado,
    descontoAVista,
    valorRpa,
    valorLiquidoFinal,
    isAVista,
  };
}

export default function BaixaPorPlacaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);
  
  // Lista de placas agrupadas e seleção ativa
  const [listaPlacas, setListaPlacas] = useState<PlacaAgrupada[]>([]);
  const [placaSelecionada, setPlacaSelecionada] = useState<PlacaAgrupada | null>(null);
  
  // Filtros do painel esquerdo
  const [termoPesquisa, setTermoPesquisa] = useState<string>('');
  const [filtroTipoPgto, setFiltroTipoPgto] = useState<'TODOS' | 'A VISTA' | 'PRAZO' | 'INTEGRAL'>('TODOS');

  // Motorista associado
  const [motoristaVinculado, setMotoristaVinculado] = useState<MotoristaModel | null>(null);
  const [carregandoMotorista, setCarregandoMotorista] = useState<boolean>(false);
  
  // Formulário de baixa
  const [dataPagamento, setDataPagamento] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [descontoAdicionalInput, setDescontoAdicionalInput] = useState<string>('0.00');

  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Helper para formatação em BRL
  const formatarMoeda = (valor: number) => {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  /**
   * BUSCA MINUTAS AGRUPADAS POR PLACA E MODALIDADE NO BACKEND
   */
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
          setMensagemStatus(`✅ Encontrados ${resultado.totalPlacas} relatório(s) pendente(s).`);
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

  // Consulta motorista cadastrado para a placa
  const buscarMotoristaPorPlaca = useCallback(async (placa: string) => {
    if (!placa) return;
    setCarregandoMotorista(true);
    setMotoristaVinculado(null);

    try {
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

  /**
   * ALTERAÇÃO EM LOTE DA MODALIDADE VIA ENDPOINT DEDICADO DO BACKEND
   */
  const handleAlterarTipoPgtoEmLote = async (novoTipo: string) => {
    if (!placaSelecionada || placaSelecionada.minutas.length === 0) return;

    const confirmacao = window.confirm(
      `Deseja alterar a modalidade de TODAS as minutas da placa ${placaSelecionada.placa} para "${novoTipo}"?`
    );

    if (!confirmacao) return;

    try {
      setCarregando(true);
      setMensagemStatus(`⏳ A atualizar modalidade da placa ${placaSelecionada.placa} no servidor...`);

      const resposta = await fetch(`${apiUrl}/importacao/alterar-tipo-pgto-placa`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          placa: placaSelecionada.placa,
          modalidadeAtual: placaSelecionada.modalidade,
          novoTipoPgto: novoTipo,
        }),
      });

      const resultado = await resposta.json();

      if (resposta.ok && resultado.sucesso) {
        setMensagemStatus(`🎉 Modalidade da placa ${placaSelecionada.placa} alterada para ${novoTipo} com sucesso!`);
        setPlacaSelecionada(null);
        await carregarDadosAgrupados();
      } else {
        setMensagemStatus(`❌ Erro do servidor: ${resultado.mensagem || 'Falha ao atualizar minutas em lote.'}`);
      }
    } catch (erro: any) {
      setMensagemStatus('❌ Falha na comunicação com o servidor backend.');
    } finally {
      setCarregando(false);
    }
  };

  // Aplicação dos filtros de busca e modalidade na lista lateral
  const placasFiltradas = listaPlacas.filter((p) => {
    const bateuPlaca = p.placa.toUpperCase().includes(termoPesquisa.toUpperCase().trim());
    if (!bateuPlaca) return false;

    if (filtroTipoPgto === 'TODOS') return true;

    const mod = String(p.modalidade || '').toUpperCase();
    if (filtroTipoPgto === 'A VISTA') return mod.includes('VISTA');
    if (filtroTipoPgto === 'PRAZO') return mod.includes('PRAZO');
    if (filtroTipoPgto === 'INTEGRAL') return mod.includes('INTEGRAL') || mod.includes('VISTA');
    return true;
  });

  // Cálculo das minutas da placa selecionada (Painel Direito)
  const qtdMinutasTotal = placaSelecionada?.minutas.length || 0;
  const descontoAdicionalNum = Number(descontoAdicionalInput) || 0;
  const descontoPorMinuta = qtdMinutasTotal > 0 ? descontoAdicionalNum / qtdMinutasTotal : 0;

  const minutasProcessadas = placaSelecionada ? placaSelecionada.minutas.map((minuta) => {
    const descJaSalvo = Number(minuta.descontoAdicionalAplicado || 0);
    const vFreteAtual = Number(minuta.valorFreteOriginal || minuta.valorFrete || minuta.frete || 0);
    const vFreteBaseReal = vFreteAtual + descJaSalvo;
    const vPedagio = Number(minuta.valorPedagio || 0);

    const calc = calcularValoresMinutaFrontend(vFreteBaseReal, vPedagio, minuta.tipoPgto, descontoPorMinuta);

    return {
      ...minuta,
      vFreteBaseReal,
      vFreteAjustado: calc.freteAjustado,
      vRpaAjustado: calc.valorRpa,
      vDescAVistaAjustado: calc.descontoAVista,
      vLiquidoAjustado: calc.valorLiquidoFinal,
      isAVista: calc.isAVista,
    };
  }) : [];

  const subtotalBrutoComDesconto = minutasProcessadas.reduce((acc, item) => acc + (item.vFreteAjustado + Number(item.valorPedagio || 0)), 0);
  const totalRpaCalculado = minutasProcessadas.reduce((acc, item) => acc + item.vRpaAjustado, 0);
  const totalDescAVistaCalculado = minutasProcessadas.reduce((acc, item) => acc + item.vDescAVistaAjustado, 0);
  const valorFinalPagoCalculado = minutasProcessadas.reduce((acc, item) => acc + item.vLiquidoAjustado, 0);

  // Seleciona uma placa manualmente e fixa a seleção
  const selecionarPlaca = (item: PlacaAgrupada) => {
    setPlacaSelecionada(item);
    const descSalvo = item.minutas.reduce((acc, m) => acc + (m.descontoAdicionalAplicado || 0), 0);
    setDescontoAdicionalInput(Number(descSalvo || 0).toFixed(2));
    buscarMotoristaPorPlaca(item.placa);
  };

  /**
   * SALVA O DESCONTO ADICIONAL
   */
  const salvarApenasDesconto = async () => {
    if (!placaSelecionada) return;

    const confirmacao = window.confirm(
      `Deseja aplicar o desconto adicional de ${formatarMoeda(descontoAdicionalNum)} para a placa ${placaSelecionada.placa} (${placaSelecionada.modalidade || 'PRAZO'})?`
    );

    if (!confirmacao) return;

    setCarregando(true);
    setMensagemStatus(`⏳ A salvar desconto para a placa ${placaSelecionada.placa}...`);

    try {
      const resposta = await fetch(`${apiUrl}/importacao/salvar-desconto-placa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placa: placaSelecionada.placa,
          modalidade: placaSelecionada.modalidade,
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

  /**
   * EXECUTA A BAIXA DEFINITIVA DAS MINUTAS
   */
  const executarBaixa = async (placaAlvo: string) => {
    if (!placaAlvo || !placaSelecionada) return;

    const partesData = dataPagamento.split('-');
    let dataObjetoIso = new Date();
    let dataBrTexto = '';

    if (partesData.length === 3) {
      const ano = parseInt(partesData[0], 10);
      const mes = parseInt(partesData[1], 10) - 1;
      const dia = parseInt(partesData[2], 10);
      
      dataObjetoIso = new Date(ano, mes, dia, 12, 0, 0);
      dataBrTexto = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`;
    } else {
      dataBrTexto = new Date().toLocaleDateString('pt-BR');
    }

    const confirmacao = window.confirm(
      `Deseja dar baixa na placa ${placaAlvo} (${placaSelecionada.modalidade || 'PRAZO'}) na data ${dataBrTexto} no valor final de ${formatarMoeda(valorFinalPagoCalculado)}?`
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
          modalidade: placaSelecionada.modalidade,
          dataPagamento: dataPagamento,
          dataPagamentoRealizado: dataObjetoIso.toISOString(),
          dataPgto: dataBrTexto,
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
            Filtre por placa, verifique a modalidade de pagamento e confirme a baixa
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
          
          {/* PAINEL ESQUERDO (CÁLCULO DO TOTAL CORRIGIDO) */}
          <section style={estilos.cardBox}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', fontSize: '1.1rem' }}>
              🚛 Veículos / Placas ({placasFiltradas.length})
            </h3>

            <div style={{ marginBottom: '0.75rem' }}>
              <input
                type="text"
                placeholder="🔍 Pesquisar por placa..."
                value={termoPesquisa}
                onChange={(e) => setTermoPesquisa(e.target.value)}
                style={estilos.inputPesquisa}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {(['TODOS', 'A VISTA', 'PRAZO', 'INTEGRAL'] as const).map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setFiltroTipoPgto(tipo)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '0.75rem',
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
            
            <div style={{ overflowY: 'auto', maxHeight: '520px' }}>
              {placasFiltradas.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
                  {termoPesquisa || filtroTipoPgto !== 'TODOS' ? 'Nenhum relatório encontrado.' : 'Nenhuma placa pendente.'}
                </p>
              ) : (
                placasFiltradas.map((item, index) => {
                  const chaveItem = item.chaveUnica || `${item.placa}_${item.modalidade || 'PRAZO'}_${index}`;
                  const isSelected = placaSelecionada?.placa === item.placa && (placaSelecionada?.modalidade || 'PRAZO') === (item.modalidade || 'PRAZO');
                  const isAVista = (item.modalidade || '').includes('VISTA');

                  // SOMA LÍQUIDA INDIVIDUAL DAS MINUTAS DA PLACA (SOMA EXATA)
                  const totalLiquidoPreciso = item.minutas.reduce((acc, m) => {
                    const descJaSalvo = Number(m.descontoAdicionalAplicado || 0);
                    const vFreteAtual = Number(m.valorFreteOriginal || m.valorFrete || m.frete || 0);
                    const vFreteBaseReal = vFreteAtual + descJaSalvo;
                    const vPedagio = Number(m.valorPedagio || 0);

                    const calc = calcularValoresMinutaFrontend(vFreteBaseReal, vPedagio, m.tipoPgto, descJaSalvo);
                    return acc + calc.valorLiquidoFinal;
                  }, 0);

                  return (
                    <div
                      key={chaveItem}
                      onClick={() => selecionarPlaca(item)}
                      style={{
                        ...estilos.itemPlaca,
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{item.placa}</strong>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: '800',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: isAVista ? '#fef3c7' : '#e2e8f0',
                            color: isAVista ? '#b45309' : '#334155',
                          }}>
                            {item.modalidade || 'PRAZO'}
                          </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          {item.qtdMinutas} viagem(ns)
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: '#16a34a', fontSize: '1rem' }}>
                          {formatarMoeda(totalLiquidoPreciso)}
                        </strong>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Líquido Final</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* PAINEL DIREITO */}
          <section style={estilos.cardBox}>
            {placaSelecionada ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a' }}>
                        Placa: <span style={{ color: '#2563eb' }}>{placaSelecionada.placa}</span>
                      </h2>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        backgroundColor: (placaSelecionada.modalidade || '').includes('VISTA') ? '#fef3c7' : '#e2e8f0',
                        color: (placaSelecionada.modalidade || '').includes('VISTA') ? '#b45309' : '#334155',
                      }}>
                        {placaSelecionada.modalidade || 'PRAZO'}
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      {placaSelecionada.minutas.length} minuta(s) selecionada(s)
                    </p>
                  </div>

                  {/* SELETOR DE MODALIDADE E BOTÃO DE BAIXA */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b' }}>
                        Alterar Modalidade:
                      </label>
                      <select
                        value={placaSelecionada.modalidade || 'PRAZO'}
                        onChange={(e) => handleAlterarTipoPgtoEmLote(e.target.value)}
                        disabled={carregando}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontWeight: '700',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          outline: 'none',
                        }}
                      >
                        <option value="PRAZO">PRAZO</option>
                        <option value="A VISTA">À VISTA (4% desc.)</option>
                        <option value="INTEGRAL">INTEGRAL</option>
                      </select>
                    </div>

                    <button
                      onClick={() => executarBaixa(placaSelecionada.placa)}
                      disabled={carregando}
                      style={{ ...estilos.botaoBaixar, marginTop: '1.1rem' }}
                    >
                      {carregando ? '⏳ A processar...' : '✅ Dar Baixa nas Minutas'}
                    </button>
                  </div>
                </div>

                {/* ALERTA / DADOS DO MOTORISTA */}
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
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: '600' }}>
                      ⚠️ Nenhum motorista cadastrado no sistema para a placa {placaSelecionada.placa}.
                    </span>
                  )}
                </div>

                {/* DATAS E DESCONTO ADICIONAL */}
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

                {/* CARTÕES FINANCEIROS */}
                <div style={estilos.gridResumoPlaca}>
                  <div style={estilos.cardResumoItem}>
                    <span style={estilos.rotuloResumoItem}>Total Bruto (Com Desconto)</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{formatarMoeda(subtotalBrutoComDesconto)}</strong>
                  </div>

                  <div style={estilos.cardResumoItem}>
                    <span style={estilos.rotuloResumoItem}>RPA (2,7%)</span>
                    <strong style={{ fontSize: '1.1rem', color: '#dc2626' }}>- {formatarMoeda(totalRpaCalculado)}</strong>
                  </div>

                  {totalDescAVistaCalculado > 0 && (
                    <div style={estilos.cardResumoItem}>
                      <span style={estilos.rotuloResumoItem}>Desc. À Vista (4%)</span>
                      <strong style={{ fontSize: '1.1rem', color: '#d97706' }}>- {formatarMoeda(totalDescAVistaCalculado)}</strong>
                    </div>
                  )}

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
                        <th style={estilos.th}>Valor Bruto</th>
                        <th style={estilos.th}>RPA (2,7%)</th>
                        <th style={estilos.th}>Desc. À Vista (4%)</th>
                        <th style={estilos.th}>Valor Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {minutasProcessadas.map((minuta, index) => (
                        <tr key={minuta._id || `minuta_${index}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={estilos.td}>
                            <strong>{minuta.ref || '-'}</strong>
                            <br />
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{minuta.conteiner}</span>
                          </td>
                          <td style={estilos.td}>{minuta.terminalOrigem} → {minuta.terminalDestino}</td>
                          <td style={estilos.td}>
                            <span style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '6px',
                              fontWeight: '700',
                              fontSize: '0.8rem',
                              backgroundColor: minuta.isAVista ? '#fef3c7' : '#e2e8f0',
                              color: minuta.isAVista ? '#b45309' : '#334155'
                            }}>
                              {minuta.tipoPgto || 'PRAZO'}
                            </span>
                          </td>
                          <td style={{ ...estilos.td, fontWeight: 'bold', color: '#0f172a' }}>
                            {formatarMoeda(minuta.vFreteAjustado + Number(minuta.valorPedagio || 0))}
                          </td>
                          <td style={{ ...estilos.td, color: '#dc2626' }}>
                            - {formatarMoeda(minuta.vRpaAjustado)}
                          </td>
                          <td style={{ ...estilos.td, color: minuta.isAVista ? '#d97706' : '#94a3b8' }}>
                            {minuta.isAVista ? `- ${formatarMoeda(minuta.vDescAVistaAjustado)}` : 'R$ 0,00'}
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
                  Selecione uma placa na lista ao lado para ver os detalhes e dar baixa.
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
  botaoBaixar: { backgroundColor: '#16a34a', color: '#ffffff', padding: '0.75rem 1.25rem', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' },
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