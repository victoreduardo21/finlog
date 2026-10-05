'use client';

/**
 * ============================================================================
 * TELA: CADASTRO DE UTILIZADORES / ADMINISTRADORES (ROTA DA API CORRIGIDA)
 * Localização no VS Code: empresa/app/usuarios/page.tsx
 * Descrição: Permite que administradores registem novos utilizadores na rota
 *            correta do backend (/auth/registro), tratando respostas em HTML.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './../components/Navbar';

export default function CadastroUsuarioPage() {
  const router = useRouter();

  // Estados de autenticação e permissão
  const [usuarioLogado, setUsuarioLogado] = useState<{ nome: string; perfil: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [verificandoPermissao, setVerificandoPermissao] = useState<boolean>(true);

  // Estados do formulário de cadastro
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState<'ADMIN' | 'OPERADOR'>('OPERADOR');

  // Estados de feedback visual
  const [carregando, setCarregando] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState('');

  // 1. Efeito para verificar se o utilizador logado tem permissão ADMIN
  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }

    try {
      const objUsuario = JSON.parse(usuarioSalvo);
      setUsuarioLogado(objUsuario);

      // Verifica se o perfil do utilizador é ADMIN
      const perfilFormatado = String(objUsuario.perfil || '').toUpperCase();
      
      if (perfilFormatado === 'ADMIN' || perfilFormatado === 'ADMINISTRADOR') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        setMensagemStatus('⚠️ Acesso restrito! Apenas Administradores podem aceder a esta página.');
        setTimeout(() => {
          router.push('/importacao');
        }, 3000);
      }
    } catch (e) {
      console.error('Erro ao ler permissões da sessão local.');
      router.push('/');
    } finally {
      setVerificandoPermissao(false);
    }
  }, [router]);

  // 2. Submissão do formulário com tratamento seguro contra erros de HTML
  const handleCadastrarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setMensagemStatus('⚠️ Preencha todos os campos obrigatórios (Nome, E-mail e Palavra-passe).');
      return;
    }

    setCarregando(true);
    setMensagemStatus('⏳ A cadastrar novo utilizador no sistema...');

    // Porta do backend em Node.js (3001)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      // Faz o fetch para a rota /auth/registro do backend
      const resposta = await fetch(`${apiUrl}/auth/registro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha: senha.trim(),
          perfil,
        }),
      });

      // Lê a resposta do servidor em texto para evitar a quebra do JSON.parse
      const textoResposta = await resposta.text();

      // Verifica se o servidor retornou HTML em vez de JSON
      if (textoResposta.trim().startsWith('<')) {
        console.error('❌ Resposta HTML recebida da API:', textoResposta);
        throw new Error('A rota do servidor (/auth/registro) não foi encontrada ou o servidor na porta 3001 está offline.');
      }

      // Converte o texto para JSON com segurança
      const resultado = JSON.parse(textoResposta);

      if (resposta.ok && (resultado.sucesso || resultado.usuario)) {
        setMensagemStatus(`✅ Utilizador ${nome} registado com sucesso como ${perfil}!`);
        setNome('');
        setEmail('');
        setSenha('');
        setPerfil('OPERADOR');
      } else {
        setMensagemStatus(`❌ ${resultado.mensagem || 'Erro ao cadastrar utilizador.'}`);
      }
    } catch (erro: any) {
      console.error('Erro de conexão com a API:', erro);
      setMensagemStatus(`❌ ${erro.message || 'Falha ao conectar ao servidor backend na porta 3001.'}`);
    } finally {
      setCarregando(false);
    }
  };

  // Enquanto verifica o perfil no localStorage
  if (verificandoPermissao) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#0f172a', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
        <p>A verificar permissões de acesso...</p>
      </div>
    );
  }

  // Se NÃO for Administrador, exibe a tela de bloqueio
  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
        <Sidebar usuario={usuarioLogado || { nome: 'Utilizador', perfil: 'OPERADOR' }} />
        <main style={{ marginLeft: '260px', flex: 1, padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '2.5rem', borderRadius: '12px', border: '1px solid #fecaca', maxWidth: '480px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '3rem' }}>🚫</span>
            <h2 style={{ color: '#991b1b', margin: '1rem 0 0.5rem 0', fontWeight: '800' }}>Acesso Restrito</h2>
            <p style={{ color: '#334155', fontSize: '0.95rem', marginBottom: '1.5rem', fontWeight: '500' }}>
              A sua conta não tem privilégios de Administrador. Apenas administradores podem cadastrar novos utilizadores.
            </p>
            <span style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 'bold' }}>
              A redirecionar para o painel principal...
            </span>
          </div>
        </main>
      </div>
    );
  }

  // Tela principal do formulário para ADMINISTRADORES
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', color: '#0f172a' }}>
      <Sidebar usuario={usuarioLogado || { nome: 'Admin', perfil: 'ADMIN' }} />

      <main style={{ marginLeft: '260px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            👤 Gestão e Cadastro de Utilizadores
          </h1>
          <p style={{ color: '#475569', margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: '500' }}>
            Painel exclusivo para Administradores concederem acesso ao Sistema Financeiro
          </p>
        </header>

        {/* FORMULÁRIO DE CADASTRO */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '2rem', maxWidth: '650px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            ➕ Novo Registo de Utilizador
          </h2>

          <form onSubmit={handleCadastrarUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* NOME COMPLETO */}
            <div>
              <label style={estilos.label}>Nome Completo *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Carlos Silva"
                required
                style={estilos.input}
              />
            </div>

            {/* ENDEREÇO DE E-MAIL */}
            <div>
              <label style={estilos.label}>Endereço de E-mail *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: carlos.silva@empresa.com"
                required
                style={estilos.input}
              />
            </div>

            {/* PALAVRA-PASSE / SENHA */}
            <div>
              <label style={estilos.label}>Palavra-passe (Senha) *</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite uma palavra-passe segura"
                required
                style={estilos.input}
              />
            </div>

            {/* NÍVEL DE ACESSO */}
            <div>
              <label style={estilos.label}>Nível de Acesso (Perfil) *</label>
              <select
                value={perfil}
                onChange={(e) => setPerfil(e.target.value as 'ADMIN' | 'OPERADOR')}
                style={estilos.select}
              >
                <option value="OPERADOR" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>OPERADOR (Acesso padrão às operações)</option>
                <option value="ADMIN" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>ADMINISTRADOR (Acesso total + cadastro de utilizadores)</option>
              </select>
            </div>

            {/* BOTÃO SUBMIT */}
            <button
              type="submit"
              disabled={carregando}
              style={estilos.botaoSubmit}
            >
              {carregando ? '⏳ A gravar utilizador...' : '✅ Confirmar e Cadastrar Utilizador'}
            </button>
          </form>

          {/* MENSAGEM DE STATUS */}
          {mensagemStatus && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '0.85rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: '700',
                textAlign: 'center',
                border: '1px solid',
                backgroundColor: mensagemStatus.includes('❌') ? '#fef2f2' : mensagemStatus.includes('✅') ? '#f0fdf4' : '#eff6ff',
                color: mensagemStatus.includes('❌') ? '#991b1b' : mensagemStatus.includes('✅') ? '#166534' : '#1e40af',
                borderColor: mensagemStatus.includes('❌') ? '#fecaca' : mensagemStatus.includes('✅') ? '#bbf7d0' : '#bfdbfe',
              }}
            >
              {mensagemStatus}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Estilos inline com fontes e fundos bem definidos
const estilos: { [key: string]: React.CSSProperties } = {
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: '0.4rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #94a3b8',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.95rem',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #94a3b8',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.95rem',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box',
  },
  botaoSubmit: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '0.85rem',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '800',
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
};
