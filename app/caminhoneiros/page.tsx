'use client';

/**
 * ============================================================================
 * TELA INTERNA: GESTÃO DE CAMINHONEIROS (COM EDIÇÃO, EXCLUSÃO E MODAL)
 * Localização: web/app/caminhoneiros/page.tsx
 * Tecnologias: Next.js (App Router), React, CSS-in-JS Inline
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/components/Navbar';

interface Caminhoneiro {
  _id: string;
  ref?: string;
  nome: string;
  cpf?: string;
  whatsapp?: string;
  contato?: string;
  pis?: string;
  dataNascimento?: string;
  pix?: string;
  placa?: string;
  placas?: string[];
}

export default function CaminhoneirosInternoPage() {
  const router = useRouter();

  // Estados principais
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);
  const [listaMotoristas, setListaMotoristas] = useState<Caminhoneiro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  // Estados da Janela Modal Pop-up (Edição / Novo Cadastro)
  const [exibirModal, setExibirModal] = useState(false);
  const [idEdicao, setIdEdicao] = useState<string | null>(null);

  // Estados dos campos do formulário
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [contato, setContato] = useState('');
  const [pis, setPis] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [pix, setPix] = useState('');
  const [placasTexto, setPlacasTexto] = useState('');

  // ENDEREÇO DA API BACKEND (EXPRESS PORTA 3001)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Busca a lista de motoristas cadastrados no MongoDB
  const carregarCaminhoneiros = useCallback(async () => {
    setCarregando(true);
    setMensagemStatus('');

    try {
      const resposta = await fetch(`${API_URL}/caminhoneiros`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!resposta.ok) {
        throw new Error(`Erro na resposta do servidor HTTP ${resposta.status}`);
      }

      const resultado = await resposta.json();

      if (resultado && resultado.dados) {
        setListaMotoristas(resultado.dados);
      } else {
        setListaMotoristas([]);
      }
    } catch (erro: any) {
      console.error('❌ Erro de conexão:', erro);
      setMensagemStatus('❌ Não foi possível carregar os motoristas do backend.');
      setListaMotoristas([]);
    } finally {
      setCarregando(false);
    }
  }, [API_URL]);

  // Verifica a sessão do utilizador
  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }

    setUsuario(JSON.parse(usuarioSalvo));
    carregarCaminhoneiros();
  }, [router, carregarCaminhoneiros]);

  // Limpa o formulário do modal
  const limparFormulario = () => {
    setIdEdicao(null);
    setNome('');
    setCpf('');
    setContato('');
    setPis('');
    setDataNascimento('');
    setPix('');
    setPlacasTexto('');
  };

  // Abre a janela modal preenchida com os dados do motorista para EDIÇÃO
  const abrirEdicao = (item: Caminhoneiro) => {
    setIdEdicao(item._id);
    setNome(item.nome || '');
    setCpf(item.cpf || '');
    setContato(item.contato || item.whatsapp || '');
    setPis(item.pis || '');
    setDataNascimento(item.dataNascimento || '');
    setPix(item.pix || '');

    // Formata o vetor de placas para exibir no campo de texto separado por vírgula
    if (item.placas && item.placas.length > 0) {
      setPlacasTexto(item.placas.join(', '));
    } else if (item.placa) {
      setPlacasTexto(item.placa);
    } else {
      setPlacasTexto('');
    }

    setExibirModal(true);
  };

  // 2. Salva ou Atualiza o cadastro no Backend (POST / PUT)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome) {
      setMensagemStatus('⚠️ Preencha o nome do motorista.');
      return;
    }

    setCarregando(true);

    // Separa as placas digitadas por vírgula num array
    const listaPlacas = placasTexto
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter((p) => p !== '');

    const payload = {
      nome,
      cpf,
      contato,
      whatsapp: contato,
      pis,
      dataNascimento,
      pix,
      placa: listaPlacas[0] || '',
      placas: listaPlacas,
    };

    try {
      const url = idEdicao ? `${API_URL}/caminhoneiros/${idEdicao}` : `${API_URL}/caminhoneiros/registro`;
      const method = idEdicao ? 'PUT' : 'POST';

      const resposta = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.mensagem || 'Erro ao salvar os dados.');
      }

      setMensagemStatus(`🎉 ${resultado.mensagem || 'Cadastro salvo com sucesso!'}`);
      limparFormulario();
      setExibirModal(false);
      await carregarCaminhoneiros();
    } catch (erro: any) {
      setMensagemStatus(`❌ ${erro.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // 3. Elimina o registo de um motorista no Backend (DELETE)
  const handleExcluir = async (id: string, nomeMotorista: string) => {
    if (!window.confirm(`Deseja realmente remover o caminhoneiro "${nomeMotorista}"?`)) {
      return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch(`${API_URL}/caminhoneiros/${id}`, {
        method: 'DELETE',
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.mensagem || 'Erro ao excluir o registo.');
      }

      setMensagemStatus(`✅ ${resultado.mensagem || 'Motorista removido com sucesso!'}`);
      await carregarCaminhoneiros();
    } catch (erro: any) {
      setMensagemStatus(`❌ ${erro.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // Filtra motoristas por Nome, CPF ou Placas
  const listaFiltrada = listaMotoristas.filter((item) => {
    const busca = termoBusca.toLowerCase();
    const nomeB = item.nome?.toLowerCase() || '';
    const cpfB = item.cpf || '';
    const placasB = (item.placas?.join(' ') || item.placa || '').toLowerCase();

    return nomeB.includes(busca) || cpfB.includes(busca) || placasB.includes(busca);
  });

  if (!usuario) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      <Sidebar usuario={usuario} />

      <main style={{ marginLeft: '240px', flex: 1, padding: '2rem 3rem' }}>
        
        {/* CABEÇALHO */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Cadastro de Caminhoneiros
            </h1>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              Gestão de motoristas cadastrados no portal e importados no sistema
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={carregarCaminhoneiros} style={estilos.botaoAtualizar}>
              🔄 Atualizar Lista
            </button>
            <button
              onClick={() => {
                limparFormulario();
                setExibirModal(true);
              }}
              style={estilos.botaoNovo}
            >
              ➕ Novo Caminhoneiro
            </button>
          </div>
        </header>

        {/* ALERTA DE MENSAGEM */}
        {mensagemStatus && (
          <div style={{
            padding: '0.85rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : '#f0fdf4',
            color: mensagemStatus.includes('❌') ? '#991b1b' : '#166534',
            border: '1px solid',
            borderColor: mensagemStatus.includes('❌') ? '#fecaca' : '#bbf7d0',
          }}>
            {mensagemStatus}
          </div>
        )}

        {/* TABELA DE RESULTADOS */}
        <section style={estilos.cardBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.1rem' }}>
              🚛 Motoristas Encontrados ({listaFiltrada.length})
            </h3>

            <input
              type="text"
              placeholder="🔍 Buscar por Nome, CPF ou Placa..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              style={estilos.inputBusca}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={estilos.tabela}>
              <thead>
                <tr>
                  <th style={estilos.th}>Nome do Motorista</th>
                  <th style={estilos.th}>CPF</th>
                  <th style={estilos.th}>Contato / WhatsApp</th>
                  <th style={estilos.th}>Chave PIX / Banco</th>
                  <th style={estilos.th}>Placas Vinculadas</th>
                  <th style={estilos.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...estilos.td, textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                      {carregando ? '⏳ A carregar motoristas...' : 'Nenhum caminhoneiro cadastrado.'}
                    </td>
                  </tr>
                ) : (
                  listaFiltrada.map((item) => {
                    const placasExibicao = item.placas && item.placas.length > 0
                      ? item.placas
                      : item.placa ? [item.placa] : [];

                    return (
                      <tr key={item._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={estilos.td}><strong>{item.nome}</strong></td>
                        <td style={estilos.td}>{item.cpf || '-'}</td>
                        <td style={estilos.td}>{item.contato || item.whatsapp || '-'}</td>
                        <td style={estilos.td}>{item.pix || '-'}</td>
                        <td style={estilos.td}>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {placasExibicao.length > 0 ? (
                              placasExibicao.map((p, idx) => (
                                <span key={idx} style={estilos.badgePlaca}>
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Sem placa</span>
                            )}
                          </div>
                        </td>
                        <td style={estilos.td}>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => abrirEdicao(item)} style={estilos.botaoEditar} title="Editar Cadastro">
                              ✏️ Editar
                            </button>
                            <button onClick={() => handleExcluir(item._id, item.nome)} style={estilos.botaoExcluir} title="Remover Registo">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* JANELA MODAL POP-UP DE CRIAÇÃO / EDIÇÃO */}
        {exibirModal && (
          <div style={estilos.overlayModal}>
            <div style={estilos.caixaModal}>
              
              <div style={estilos.cabecalhoModal}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                  {idEdicao ? '✏️ Editar Dados do Caminhoneiro' : '➕ Novo Cadastro de Caminhoneiro'}
                </h3>
                <button onClick={() => setExibirModal(false)} style={estilos.botaoFecharModal}>✖</button>
              </div>

              <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem' }}>
                <div style={estilos.gridForm}>
                  
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={estilos.label}>Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Digite o nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>CPF *</label>
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>Contato / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={contato}
                      onChange={(e) => setContato(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>PIS</label>
                    <input
                      type="text"
                      placeholder="000.00000.00-0"
                      value={pis}
                      onChange={(e) => setPis(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>Data de Nascimento</label>
                    <input
                      type="text"
                      placeholder="DD/MM/AAAA"
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={estilos.label}>Chave PIX / Dados Bancários</label>
                    <input
                      type="text"
                      placeholder="Digite a chave PIX ou dados da conta"
                      value={pix}
                      onChange={(e) => setPix(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={estilos.label}>Placas dos Caminhões (Separe por vírgula)</label>
                    <input
                      type="text"
                      placeholder="Informe as placas separadas por vírgula"
                      value={placasTexto}
                      onChange={(e) => setPlacasTexto(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                </div>

                <div style={estilos.botoesModal}>
                  <button type="button" onClick={() => setExibirModal(false)} style={estilos.botaoCancelarModal}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={carregando} style={estilos.botaoSalvarModal}>
                    {carregando ? '⏳ A guardar...' : '💾 Guardar Alterações'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ESTILOS VISUAIS INLINE
const estilos: { [key: string]: React.CSSProperties } = {
  cardBox: { backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '12px', border: '1px solid #e2e8f0' },
  botaoNovo: { backgroundColor: '#2563eb', color: '#ffffff', padding: '0.65rem 1.25rem', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' },
  botaoAtualizar: { backgroundColor: '#f1f5f9', color: '#475569', padding: '0.65rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' },
  inputBusca: { padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.85rem', width: '280px' },
  tabela: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' },
  th: { padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600' },
  td: { padding: '0.75rem 1rem', color: '#1e293b' },
  badgePlaca: { padding: '0.2rem 0.5rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem' },
  botaoEditar: { backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' },
  botaoExcluir: { backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' },
  overlayModal: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  caixaModal: { backgroundColor: '#ffffff', padding: '2rem', borderRadius: '16px', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' },
  cabecalhoModal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' },
  botaoFecharModal: { backgroundColor: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' },
  gridForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' },
  label: { display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem', fontWeight: '600', color: '#0f172a' },
  input: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '0.85rem', fontWeight: '500', outline: 'none', boxSizing: 'border-box' },
  botoesModal: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' },
  botaoCancelarModal: { backgroundColor: '#e2e8f0', color: '#475569', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  botaoSalvarModal: { backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' },
};