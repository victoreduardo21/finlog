'use client';

/**
 * ============================================================================
 * TELA: CADASTRO E GESTÃO DE CLIENTES (COM CORREÇÃO DE COR DO TEXTO DOS INPUTS)
 * Tecnologias: Next.js (React), CSS-in-JS Inline, ViaCEP API
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './../components/Navbar';

interface Cliente {
  _id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  endereco?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  };
}

export default function ClientesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);
  const [listaClientes, setListaClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  // ESTADO PARA CONTROLAR A VISIBILIDADE DO MODAL (POP-UP)
  const [exibirModal, setExibirModal] = useState(false);

  // ESTADOS DO FORMULÁRIO DE CADASTRO
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  // Função para buscar clientes cadastrados no backend
  const carregarClientes = useCallback(async () => {
    setCarregando(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resposta = await fetch(`${apiUrl}/clientes`);
      const resultado = await resposta.json();

      if (resposta.ok && resultado.dados) {
        setListaClientes(resultado.dados);
      }
    } catch (erro) {
      setMensagemStatus('❌ Erro ao conectar ao servidor backend.');
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
    carregarClientes();
  }, [router, carregarClientes]);

  // Função para autocompletar o endereço pelo CEP usando a API do ViaCEP
  const buscarCep = async (cepInput: string) => {
    const cepLimpo = cepInput.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    try {
      setMensagemStatus('⏳ A buscar CEP...');
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();

      if (!data.erro) {
        setLogradouro(data.logradouro || '');
        setBairro(data.bairro || '');
        setCidade(data.localidade || '');
        setUf(data.uf || '');
        setMensagemStatus('✅ Endereço preenchido automaticamente!');
      } else {
        setMensagemStatus('⚠️ CEP não encontrado.');
      }
    } catch (err) {
      setMensagemStatus('❌ Erro ao buscar CEP.');
    }
  };

  // Limpa todos os campos do formulário
  const limparFormulario = () => {
    setRazaoSocial('');
    setNomeFantasia('');
    setCnpj('');
    setEmail('');
    setTelefone('');
    setCep('');
    setLogradouro('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setCidade('');
    setUf('');
  };

  // Submeter formulário e cadastrar cliente
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!razaoSocial || !cnpj) {
      setMensagemStatus('⚠️ Preencha os campos obrigatórios (Razão Social e CNPJ).');
      return;
    }

    setCarregando(true);
    setMensagemStatus('⏳ A cadastrar cliente no servidor...');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const payload = {
      razaoSocial,
      nomeFantasia,
      cnpj,
      email,
      telefone,
      endereco: { cep, logradouro, numero, complemento, bairro, cidade, uf },
    };

    try {
      const resposta = await fetch(`${apiUrl}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.mensagem || 'Erro ao cadastrar cliente.');
      }

      setMensagemStatus(`🎉 ${resultado.mensagem}`);
      
      limparFormulario();
      setExibirModal(false); // Fecha a janela modal pop-up
      await carregarClientes(); // Atualiza a tabela com o novo cliente
    } catch (erro: any) {
      setMensagemStatus(`❌ ${erro.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // Função para excluir cliente
  const handleExcluir = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja realmente excluir o cliente ${nome}?`)) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const res = await fetch(`${apiUrl}/clientes/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setMensagemStatus(`✅ ${data.mensagem}`);
        await carregarClientes();
      }
    } catch (err) {
      setMensagemStatus('❌ Erro ao excluir cliente.');
    }
  };

  if (!usuario) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      <Sidebar usuario={usuario} />

      <main style={{ marginLeft: '240px', flex: 1, padding: '2rem 3rem' }}>
        
        {/* CABEÇALHO COM TÍTULO E BOTÃO DE CADASTRAR NOVO CLIENTE */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Cadastro de Clientes
            </h1>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              Gerencie e cadastre as empresas e parceiros do seu sistema logístico
            </p>
          </div>

          {/* BOTÃO QUE ABRE O MODAL */}
          <button
            onClick={() => {
              limparFormulario();
              setExibirModal(true);
            }}
            style={estilos.botaoNovoCliente}
          >
            ➕ Cadastrar Novo Cliente
          </button>
        </header>

        {/* MENSAGEM DE STATUS / ALERTA */}
        {mensagemStatus && (
          <div style={{
            padding: '0.85rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : mensagemStatus.includes('🎉') || mensagemStatus.includes('✅') ? '#f0fdf4' : '#fffbeb',
            color: mensagemStatus.includes('❌') ? '#991b1b' : mensagemStatus.includes('🎉') || mensagemStatus.includes('✅') ? '#166534' : '#b45309',
            border: '1px solid',
            borderColor: mensagemStatus.includes('❌') ? '#fecaca' : mensagemStatus.includes('🎉') || mensagemStatus.includes('✅') ? '#bbf7d0' : '#fde68a',
          }}>
            {mensagemStatus}
          </div>
        )}

        {/* TABELA PRINCIPAL DE CLIENTES CADASTRADOS */}
        <section style={estilos.cardBox}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.1rem' }}>
            🏢 Empresas Cadastradas ({listaClientes.length})
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={estilos.tabela}>
              <thead>
                <tr>
                  <th style={estilos.th}>Razão Social / Nome Fantasia</th>
                  <th style={estilos.th}>CNPJ</th>
                  <th style={estilos.th}>Contacto</th>
                  <th style={estilos.th}>Cidade / UF</th>
                  <th style={estilos.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listaClientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...estilos.td, textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                      Nenhum cliente cadastrado até ao momento. Clica no botão acima para adicionar!
                    </td>
                  </tr>
                ) : (
                  listaClientes.map((cli) => (
                    <tr key={cli._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={estilos.td}>
                        <strong>{cli.razaoSocial}</strong>
                        {cli.nomeFantasia && (
                          <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b' }}>
                            {cli.nomeFantasia}
                          </span>
                        )}
                      </td>
                      <td style={estilos.td}>{cli.cnpj}</td>
                      <td style={estilos.td}>
                        {cli.email && <div>✉️ {cli.email}</div>}
                        {cli.telefone && <div>📞 {cli.telefone}</div>}
                      </td>
                      <td style={estilos.td}>
                        {cli.endereco?.cidade ? `${cli.endereco.cidade} / ${cli.endereco.uf}` : '-'}
                      </td>
                      <td style={estilos.td}>
                        <button
                          onClick={() => handleExcluir(cli._id, cli.razaoSocial)}
                          style={estilos.botaoExcluir}
                        >
                          🗑️ Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* JANELA MODAL POP-UP PARA CADASTRO DE CLIENTE */}
        {exibirModal && (
          <div style={estilos.overlayModal}>
            <div style={estilos.caixaModal}>
              
              {/* CABEÇALHO DO MODAL COM BOTÃO FECHAR */}
              <div style={estilos.cabecalhoModal}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                  📝 Cadastrar Novo Cliente
                </h3>
                <button
                  onClick={() => setExibirModal(false)}
                  style={estilos.botaoFecharModal}
                >
                  ✖
                </button>
              </div>

              {/* FORMULÁRIO DENTRO DO MODAL */}
              <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem' }}>
                <div style={estilos.gridForm}>
                  <div>
                    <label style={estilos.label}>Razão Social *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Logística Brasil Ltda"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>Nome Fantasia</label>
                    <input
                      type="text"
                      placeholder="Ex: Logística Brasil"
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>CNPJ *</label>
                    <input
                      type="text"
                      required
                      placeholder="00.000.000/0000-00"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>E-mail</label>
                    <input
                      type="email"
                      placeholder="contato@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>Telefone / WhatsApp</label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>CEP (Auto-Preenchimento)</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={cep}
                      onChange={(e) => {
                        setCep(e.target.value);
                        buscarCep(e.target.value);
                      }}
                      style={estilos.input}
                    />
                  </div>
                </div>

                <h4 style={{ margin: '1.25rem 0 0.75rem 0', color: '#0f172a', fontSize: '0.9rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  📍 Endereço Completo
                </h4>

                <div style={estilos.gridForm}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={estilos.label}>Logradouro (Rua/Avenida)</label>
                    <input
                      type="text"
                      placeholder="Rua das Flores"
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>Número</label>
                    <input
                      type="text"
                      placeholder="123"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>Complemento</label>
                    <input
                      type="text"
                      placeholder="Sala 402 / Galpão B"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>Bairro</label>
                    <input
                      type="text"
                      placeholder="Centro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>Cidade</label>
                    <input
                      type="text"
                      placeholder="São Paulo"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      style={estilos.input}
                    />
                  </div>

                  <div>
                    <label style={estilos.label}>UF (Estado)</label>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="SP"
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase())}
                      style={estilos.input}
                    />
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO DO MODAL */}
                <div style={estilos.botoesModal}>
                  <button
                    type="button"
                    onClick={() => setExibirModal(false)}
                    style={estilos.botaoCancelarModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={carregando}
                    style={estilos.botaoSalvarModal}
                  >
                    {carregando ? '⏳ A guardar...' : '💾 Cadastrar Cliente'}
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

// OBJETO DE ESTILOS INLINE COM A CORREÇÃO DE COR DO TEXTO DOS INPUTS
const estilos: { [key: string]: React.CSSProperties } = {
  cardBox: { backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '12px', border: '1px solid #e2e8f0' },
  botaoNovoCliente: { backgroundColor: '#2563eb', color: '#ffffff', padding: '0.75rem 1.25rem', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' },
  gridForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' },
  label: { display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem', fontWeight: '600', color: '#0f172a' },
  
  // ESTILO DO INPUT COM A CORREÇÃO VISUAL DA COR DO TEXTO
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff', // Fundo branco límpido
    color: '#0f172a',           // COR DO TEXTO ESCURA E VISÍVEL (Slate 900)
    fontSize: '0.85rem',
    fontWeight: '500',
    outline: 'none',
    boxSizing: 'border-box',
  },

  tabela: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' },
  th: { padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600' },
  td: { padding: '0.75rem 1rem', color: '#1e293b' },
  botaoExcluir: { backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' },
  
  // ESTILOS DA JANELA MODAL POP-UP
  overlayModal: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  caixaModal: { backgroundColor: '#ffffff', padding: '2rem', borderRadius: '16px', maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' },
  cabecalhoModal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' },
  botaoFecharModal: { backgroundColor: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' },
  botoesModal: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' },
  botaoCancelarModal: { backgroundColor: '#e2e8f0', color: '#475569', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  botaoSalvarModal: { backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' },
};