'use client';

/**
 * ============================================================================
 * COMPONENTE: BARRA DE NAVEGAÇÃO LATERAL (SIDEBAR) COM LOGO DRB
 * Localização no projeto: web/components/Navbar.tsx
 * Tecnologias: Next.js (App Router), React, CSS-in-JS Inline
 * Descrição: Exibe a imagem de logo drb.jpeg da pasta public, a identificação
 *            DRB Logística e o rodapé da GTS Global Tech Software.
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

  // Lista dos links de navegação da aplicação
  const itensMenu = [
    { nome: 'Importar Planilha', rota: '/importacao' },
    { nome: 'Baixa por Placa', rota: '/baixa-placa' },
    { nome: 'Relatório de Pagos', rota: '/relatorios' },
    { nome: 'Cadastro de Clientes', rota: '/clientes' },
    { nome: 'Cadastro de Caminhoneiros', rota: '/caminhoneiros' },
    { nome: 'Rotas e Valores', rota: '/rotas' },
    { nome: 'Usuários', rota: '/usuarios' },
    { nome: 'Configurações', rota: '/configuracoes' },
  ];

  // Função para encerrar a sessão do utilizador
  const handleLogout = () => {
    if (window.confirm('Deseja realmente sair do sistema?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      router.push('/');
    }
  };

  return (
    <aside style={estilos.containerSidebar}>
      
      {/* CABEÇALHO COM LOGO DRB E NOME DA EMPRESA */}
      <div style={estilos.cabecalho}>
        <div style={estilos.areaLogo}>
          {/* Carrega o ficheiro drb.jpeg localizado na pasta web/public/drb.jpeg */}
          <img
            src="/drb.jpeg"
            alt="Logo DRB Logística"
            style={estilos.imagemLogo}
          />
        </div>

        <p style={estilos.subtituloLogo}>PAINEL OPERACIONAL</p>
        <p style={estilos.subtituloEmpresa}>DRB Logística</p>
      </div>

      {/* NAVEGAÇÃO LATERAL */}
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

      {/* RODAPÉ COM BOTAO DE SAÍDA E CRÉDITOS GTS */}
      <div style={estilos.rodape}>
        <button onClick={handleLogout} style={estilos.botaoSair}>
          🚪 Sair do Sistema
        </button>

        <div style={estilos.creditosGts}>
          <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>
            Desenvolvido por
          </span>
          <strong style={{ fontSize: '0.7rem', color: '#38bdf8', letterSpacing: '0.3px' }}>
            GTS Global Tech Software
          </strong>
        </div>
      </div>

    </aside>
  );
}

// ESTILOS DE ESTRUTURA E APRESENTAÇÃO
const estilos: { [key: string]: React.CSSProperties } = {
  containerSidebar: {
    width: '240px',
    height: '100vh',
    backgroundColor: '#0f172a',
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  areaLogo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.35rem',
  },
  imagemLogo: {
    maxHeight: '45px',
    maxWidth: '160px',
    objectFit: 'contain',
    borderRadius: '8px',
  },
  subtituloLogo: {
    margin: '0.2rem 0 0 0',
    fontSize: '0.65rem',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  subtituloEmpresa: {
    margin: '0.15rem 0 0 0',
    fontSize: '0.8rem',
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: '0.5px',
  },
  navegacao: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    overflowY: 'hidden',
  },
  linkItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.45rem 0.75rem',
    borderRadius: '6px',
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '0.82rem',
    fontWeight: '500',
    transition: 'all 0.15s ease-in-out',
  },
  linkItemAtivo: {
    backgroundColor: '#2563eb',
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
    textAlign: 'center',
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
  creditosGts: {
    marginTop: '0.75rem',
    paddingTop: '0.5rem',
    borderTop: '1px dashed #1e293b',
  },
};