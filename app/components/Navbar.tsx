'use client';

/**
 * ============================================================================
 * COMPONENTE: BARRA DE NAVEGAÇÃO LATERAL COMPACTA (SIDEBAR)
 * Tecnologias: Next.js 13+ (App Router), React, CSS-in-JS Inline
 * ============================================================================
 */

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarProps {
  usuario?: {
    nome: string;
    perfil?: string;
  } | null;
}

export default function Sidebar({ usuario }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Lista dos 10 links de navegação solicitados
  const itensMenu = [
    { nome: 'Importar Planilha', rota: '/importacao' },
    { nome: 'Baixa por Placa', rota: '/baixa-placa' },
    { nome: 'Cadastro de Clientes', rota: '/clientes' },
    { nome: 'Cadastro de caminhoneiros', rota: '/caminhoneiros' },
    { nome: 'Rotas e Valores', rota: '/rotas' },
    { nome: 'Usuários', rota: '/usuarios' },
    { nome: 'Configurações', rota: '/configuracoes' },
  ];

  // Função para encerrar a sessão
  const handleLogout = () => {
    if (window.confirm('Deseja realmente sair do sistema?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      router.push('/');
    }
  };

  return (
    <aside style={estilos.containerSidebar}>
      {/* CABEÇALHO COMPACTO DA SIDEBAR */}
      <div style={estilos.cabecalho}>
        <h2 style={estilos.tituloLogo}>Logística Fin</h2>
        <p style={estilos.subtituloLogo}>Painel Operacional</p>
      </div>

      {/* NAVEGAÇÃO COMPACTA SEM SCROLLBAR */}
      <nav style={estilos.navegacao}>
        {itensMenu.map((item) => {
          const estaAtivo = pathname === item.rota;

          return (
            <Link
              key={item.rota}
              href={item.rota}
              style={{
                ...estilos.linkItem,
                ...(estaAtivo ? estilos.linkItemAtivo : {}),
              }}
            >
              <span style={{
                ...estilos.indicador,
                backgroundColor: estaAtivo ? '#ffffff' : '#64748b'
              }}></span>
              <span style={estilos.textoItem}>{item.nome}</span>
            </Link>
          );
        })}
      </nav>

      {/* BOTÃO DE SAIR NO RODA PÉ */}
      <div style={estilos.rodape}>
        <button onClick={handleLogout} style={estilos.botaoSair}>
          🚪 Sair do Sistema
        </button>
      </div>
    </aside>
  );
}

// ESTILOS COMPACTOS E OTIMIZADOS
const estilos: { [key: string]: React.CSSProperties } = {
  containerSidebar: {
    width: '240px',
    height: '100vh',
    backgroundColor: '#0f172a', // Azul escuro Slate 900
    color: '#f8fafc',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem 0.75rem',
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)',
    zIndex: 100,
    boxSizing: 'border-box',
  },
  cabecalho: {
    marginBottom: '0.75rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #1e293b',
    textAlign: 'center',
  },
  tituloLogo: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#38bdf8', // Azul claro cyan
  },
  subtituloLogo: {
    margin: '0.1rem 0 0 0',
    fontSize: '0.7rem',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  navegacao: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem', // Espaçamento reduzido entre os botões
    overflowY: 'hidden', // Elimina a barra de rolagem (scrollbar)
  },
  linkItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.45rem 0.75rem', // Padding reduzido para tornar compacto
    borderRadius: '6px',
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '0.82rem', // Fonte ligeiramente menor e mais elegante
    fontWeight: '500',
    transition: 'all 0.15s ease-in-out',
  },
  linkItemAtivo: {
    backgroundColor: '#2563eb', // Azul em destaque
    color: '#ffffff',
    fontWeight: '600',
  },
  indicador: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    marginRight: '0.6rem',
    flexShrink: 0,
  },
  textoItem: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rodape: {
    paddingTop: '0.75rem',
    borderTop: '1px solid #1e293b',
    marginTop: 'auto',
  },
  botaoSair: {
    width: '100%',
    padding: '0.55rem',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
  },
};