'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagemErro('');
    setCarregando(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const resposta = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, senha }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.mensagem || 'E-mail ou senha inválidos.');
      }

      if (dados.token) {
        localStorage.setItem('token', dados.token);
        localStorage.setItem('usuario', JSON.stringify(dados.usuario));
        router.push('/dashboard');
      }
    } catch (erro: any) {
      setMensagemErro(erro.message || 'Erro ao conectar com o servidor.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={estilos.pagina}>
      {/* --- Lado Esquerdo: Banner do Sistema --- */}
      <div style={estilos.painelEsquerdo}>
        <div style={estilos.conteudoBanner}>
          <div style={estilos.badge}>Módulo Financeiro Logístico v0.3</div>
          <h1 style={estilos.tituloBanner}>
            Controle total sobre fretes, pagamentos e conciliação.
          </h1>
          <p style={estilos.descricaoBanner}>
            Gestão de faturas, baixa por placa e verificação de duplicidades em tempo real.
          </p>
        </div>
      </div>

      {/* --- Lado Direito: Formulário de Login --- */}
      <div style={estilos.painelDireito}>
        <div style={estilos.containerFormulario}>
          <div style={estilos.cabecalhoFormulario}>
            <div style={estilos.logoIcone}>⚡</div>
            <h2 style={estilos.tituloFormulario}>Acesse sua conta</h2>
            <p style={estilos.subtituloFormulario}>Informe suas credenciais para acessar</p>
          </div>

          {mensagemErro && (
            <div style={estilos.alertaErro}>
              <span>⚠️</span> {mensagemErro}
            </div>
          )}

          <form onSubmit={handleLogin} style={estilos.formulario}>
            <div style={estilos.grupoInput}>
              <label style={estilos.label} htmlFor="email">E-mail corporativo</label>
              <input
                id="email"
                type="email"
                placeholder="seu.nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={estilos.input}
              />
            </div>

            <div style={estilos.grupoInput}>
              <label style={estilos.label} htmlFor="senha">Senha de acesso</label>
              <input
                id="senha"
                type="password"
                placeholder="••••••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                style={estilos.input}
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              style={{
                ...estilos.botaoSubmit,
                opacity: carregando ? 0.75 : 1,
                cursor: carregando ? 'wait' : 'pointer',
              }}
            >
              {carregando ? 'Autenticando...' : 'Entrar na Plataforma →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- Estilos Corrigidos para Maior Legibilidade e Alto Contraste ---
const estilos: { [key: string]: React.CSSProperties } = {
  pagina: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw',
    fontFamily: "'Inter', -apple-system, sans-serif",
    backgroundColor: '#0f172a',
  },
  painelEsquerdo: {
    flex: '1.2',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    color: '#ffffff',
  },
  conteudoBanner: { maxWidth: '560px' },
  badge: {
    display: 'inline-block',
    padding: '0.4rem 0.9rem',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#93c5fd',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
  },
  tituloBanner: { fontSize: '2.2rem', fontWeight: '800', lineHeight: '1.2', marginBottom: '1.2rem' },
  descricaoBanner: { fontSize: '1rem', color: '#94a3b8', lineHeight: '1.6' },
  painelDireito: {
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    backgroundColor: '#ffffff',
  },
  containerFormulario: { width: '100%', maxWidth: '380px' },
  cabecalhoFormulario: { marginBottom: '2rem' },
  logoIcone: {
    width: '42px',
    height: '42px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.3rem',
    marginBottom: '1rem',
  },
  tituloFormulario: { margin: 0, fontSize: '1.6rem', fontWeight: '700', color: '#0f172a' },
  subtituloFormulario: { margin: '0.4rem 0 0 0', fontSize: '0.875rem', color: '#64748b' },
  alertaErro: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    padding: '0.75rem',
    borderRadius: '8px',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  formulario: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  grupoInput: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontSize: '0.85rem', fontWeight: '600', color: '#334155' },

  // --- AQUI ESTÁ A CORREÇÃO DO INPUT ---
  input: {
    width: '100%',
    padding: '0.75rem 0.9rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff', // Fundo branco estrito
    color: '#0f172a',            // Texto escuro (azul bem escuro/quase preto)
    fontSize: '0.95rem',
    fontWeight: '500',
    outline: 'none',
    boxSizing: 'border-box',
  },

  botaoSubmit: {
    width: '100%',
    padding: '0.85rem',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: '600',
    marginTop: '0.5rem',
  },
};