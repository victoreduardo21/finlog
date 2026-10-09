'use client';

/**
 * ============================================================================
 * TELA: CADASTRO E GESTÃO DE ROTAS E VALORES DE FRETE (COM EDIÇÃO)
 * Localização no projeto: web/app/rotas-valores/page.tsx
 * Tecnologias: Next.js (React / TypeScript), API Express, CSS Inline
 * Descrição: Suporta visualização, pesquisa, adição manual, importação Excel
 *            e EDIÇÃO completa dos valores das rotas existentes.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Navbar';

interface RotaItem {
  _id: string;
  cliente: string;
  vigenciaFrete?: string;
  idFrete?: string;
  origem: string;
  destino: string;
  regime?: string;
  tipoFatura?: string;
  valorFreteCarreteiro: number;
}

export default function RotasEValoresPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [rotas, setRotas] = useState<RotaItem[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  // Estados do Modal de Registo / Edição
  const [exibirModal, setExibirModal] = useState(false);
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);

  const [formRota, setFormRota] = useState({
    cliente: '',
    idFrete: '',
    origem: '',
    destino: '',
    regime: '',
    tipoFatura: 'CT-E',
    valorFreteCarreteiro: '',
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const formatarMoeda = (valor: number) => {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Carrega as rotas da API
  const carregarRotas = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${apiUrl}/rotas-valores?busca=${encodeURIComponent(termoBusca)}`);
      const data = await res.json();

      if (res.ok && data.dados) {
        setRotas(data.dados);
      }
    } catch (erro) {
      setMensagemStatus('❌ Falha ao carregar a lista de rotas.');
    } finally {
      setCarregando(false);
    }
  }, [apiUrl, termoBusca]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }
    setUsuario(JSON.parse(usuarioSalvo));
    carregarRotas();
  }, [router, carregarRotas]);

  // Abre o modal para criar uma nova rota
  const abrirModalNovo = () => {
    setIdEmEdicao(null);
    setFormRota({
      cliente: '',
      idFrete: '',
      origem: '',
      destino: '',
      regime: '',
      tipoFatura: 'CT-E',
      valorFreteCarreteiro: '',
    });
    setExibirModal(true);
  };

  // Abre o modal preenchido com os dados da rota para EDIÇÃO
  const abrirModalEdicao = (item: RotaItem) => {
    setIdEmEdicao(item._id);
    setFormRota({
      cliente: item.cliente || '',
      idFrete: item.idFrete || '',
      origem: item.origem || '',
      destino: item.destino || '',
      regime: item.regime || '',
      tipoFatura: item.tipoFatura || 'CT-E',
      valorFreteCarreteiro: String(item.valorFreteCarreteiro || 0),
    });
    setExibirModal(true);
  };

  // Grava a rota (Criação via POST ou Edição via PUT)
  const guardarRota = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);

    const ehEdicao = Boolean(idEmEdicao);
    const urlEndpoint = ehEdicao 
      ? `${apiUrl}/rotas-valores/${idEmEdicao}` 
      : `${apiUrl}/rotas-valores`;
    const metodo = ehEdicao ? 'PUT' : 'POST';

    try {
      const res = await fetch(urlEndpoint, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formRota),
      });

      const data = await res.json();

      if (!res.ok || !data.sucesso) {
        throw new Error(data.mensagem || 'Erro ao guardar rota.');
      }

      setMensagemStatus(`🎉 ${data.mensagem}`);
      setExibirModal(false);
      setIdEmEdicao(null);
      await carregarRotas();
    } catch (erro: any) {
      setMensagemStatus(`❌ Erro: ${erro.message}`);
    } finally {
      setCarregando(false);
    }
  };

  // Importação em lote por Excel
  const importarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCarregando(true);
    setMensagemStatus('⏳ A importar ficheiro Excel...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/rotas-valores/importar`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.sucesso) {
        throw new Error(data.mensagem || 'Falha na importação.');
      }

      setMensagemStatus(`🎉 ${data.mensagem}`);
      await carregarRotas();
    } catch (erro: any) {
      setMensagemStatus(`❌ Erro na importação: ${erro.message}`);
    } finally {
      setCarregando(false);
      e.target.value = '';
    }
  };

  // Elimina uma rota do banco de dados
  const eliminarRota = async (id: string) => {
    if (!window.confirm('Tem a certeza de que deseja eliminar esta rota?')) return;

    try {
      const res = await fetch(`${apiUrl}/rotas-valores/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.sucesso) {
        setMensagemStatus('✅ Rota eliminada com sucesso!');
        await carregarRotas();
      }
    } catch (erro) {
      setMensagemStatus('❌ Erro ao eliminar rota.');
    }
  };

  if (!usuario) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      <Sidebar usuario={usuario} />

      <main style={{ marginLeft: '260px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Rotas e Valores de Frete
            </h1>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              Consulte, gira e edite os valores de frete do carreteiro por rota
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <label style={{ backgroundColor: '#16a34a', color: '#ffffff', padding: '0.65rem 1.25rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>
              📁 Importar Tabela Excel
              <input type="file" accept=".xlsx, .xls" onChange={importarExcel} style={{ display: 'none' }} />
            </label>

            <button
              onClick={abrirModalNovo}
              style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ➕ Nova Rota
            </button>
          </div>
        </header>

        {mensagemStatus && (
          <div style={{ padding: '0.85rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1rem', backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : '#f0fdf4', color: mensagemStatus.includes('❌') ? '#991b1b' : '#166534', border: '1px solid', borderColor: mensagemStatus.includes('❌') ? '#fecaca' : '#bbf7d0' }}>
            {mensagemStatus}
          </div>
        )}

        {/* BARRA DE PESQUISA */}
        <section style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="🔍 Pesquisar por cliente, origem, destino ou ID..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a' }}
          />
          <button
            onClick={carregarRotas}
            style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer' }}
          >
            Pesquisar
          </button>
        </section>

        {/* TABELA DE ROTAS COM BOTÕES DE EDITAR E ELIMINAR */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                <th style={estilos.th}>Cliente</th>
                <th style={estilos.th}>ID Frete</th>
                <th style={estilos.th}>Origem → Destino</th>
                <th style={estilos.th}>Regime</th>
                <th style={estilos.th}>Fatura</th>
                <th style={estilos.th}>Frete Carreteiro</th>
                <th style={estilos.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rotas.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    {carregando ? '⏳ A carregar rotas...' : 'Nenhuma rota encontrada.'}
                  </td>
                </tr>
              ) : (
                rotas.map((r) => (
                  <tr key={r._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ ...estilos.td, fontWeight: '700', color: '#0f172a' }}>{r.cliente}</td>
                    <td style={estilos.td}>{r.idFrete || '-'}</td>
                    <td style={estilos.td}>
                      <strong>{r.origem}</strong> → <strong>{r.destino}</strong>
                    </td>
                    <td style={estilos.td}>{r.regime || '-'}</td>
                    <td style={estilos.td}>{r.tipoFatura || '-'}</td>
                    <td style={{ ...estilos.td, fontWeight: '800', color: '#16a34a' }}>
                      {formatarMoeda(r.valorFreteCarreteiro)}
                    </td>
                    <td style={{ ...estilos.td, display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => abrirModalEdicao(r)}
                        style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '0.35rem 0.65rem', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => eliminarRota(r._id)}
                        style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.35rem 0.65rem', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        🗑️ Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* MODAL DE REGISTO / EDIÇÃO */}
        {exibirModal && (
          <div style={estilos.modalOverlay}>
            <div style={estilos.modalContainer}>
              <h2 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.25rem' }}>
                {idEmEdicao ? '✏️ Editar Rota e Valor' : '➕ Registar Nova Rota'}
              </h2>
              
              <form onSubmit={guardarRota} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={estilos.label}>Cliente *</label>
                  <input required type="text" placeholder="ex: BRADO" value={formRota.cliente} onChange={(e) => setFormRota({ ...formRota, cliente: e.target.value })} style={estilos.input} />
                </div>

                <div>
                  <label style={estilos.label}>ID Frete</label>
                  <input type="text" placeholder="ex: 1.1.1" value={formRota.idFrete} onChange={(e) => setFormRota({ ...formRota, idFrete: e.target.value })} style={estilos.input} />
                </div>

                <div>
                  <label style={estilos.label}>Origem *</label>
                  <input required type="text" placeholder="ex: CUBATÃO" value={formRota.origem} onChange={(e) => setFormRota({ ...formRota, origem: e.target.value })} style={estilos.input} />
                </div>

                <div>
                  <label style={estilos.label}>Destino *</label>
                  <input required type="text" placeholder="ex: SANTOS" value={formRota.destino} onChange={(e) => setFormRota({ ...formRota, destino: e.target.value })} style={estilos.input} />
                </div>

                <div>
                  <label style={estilos.label}>Regime</label>
                  <input type="text" placeholder="ex: EXP/IMP/CAB" value={formRota.regime} onChange={(e) => setFormRota({ ...formRota, regime: e.target.value })} style={estilos.input} />
                </div>

                <div>
                  <label style={estilos.label}>Tipo de Fatura</label>
                  <select value={formRota.tipoFatura} onChange={(e) => setFormRota({ ...formRota, tipoFatura: e.target.value })} style={estilos.input}>
                    <option value="CT-E">CT-E</option>
                    <option value="NF-E">NF-E</option>
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={estilos.label}>Valor do Frete Carreteiro (R$) *</label>
                  <input required type="number" step="0.01" placeholder="0.00" value={formRota.valorFreteCarreteiro} onChange={(e) => setFormRota({ ...formRota, valorFreteCarreteiro: e.target.value })} style={estilos.input} />
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => { setExibirModal(false); setIdEmEdicao(null); }} style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: '600' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={carregando} style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', cursor: 'pointer', fontWeight: '700' }}>
                    {carregando ? '⏳ A guardar...' : idEmEdicao ? '💾 Atualizar Rota' : '💾 Guardar Rota'}
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

const estilos: { [key: string]: React.CSSProperties } = {
  th: { padding: '0.75rem 1rem', fontWeight: '600', backgroundColor: '#f1f5f9' },
  td: { padding: '0.75rem 1rem', color: '#1e293b' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContainer: { backgroundColor: '#ffffff', padding: '1.75rem', borderRadius: '12px', width: '100%', maxWidth: '550px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
};