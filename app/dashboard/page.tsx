'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './../components/Navbar';


export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; perfil: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (!token || !usuarioSalvo) {
      router.push('/');
      return;
    }

    setUsuario(JSON.parse(usuarioSalvo));
  }, [router]);

  if (!usuario) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#64748b' }}>
        <p>A carregar painel...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex' }}>
      {/* 1. Barra Lateral Fixa */}
      <Sidebar usuario={usuario} />

      {/* 2. Área de Conteúdo (Deslocada 260px para a direita por causa da Sidebar) */}
      <main style={{ marginLeft: '260px', flex: 1, padding: '2rem 3rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Visão Geral das Operações
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Acompanhamento diário de pagamentos e recebimentos
          </p>
        </header>

        {/* Grade de Indicadores (KPIs do Dia) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div style={estiloCard}>
            <span style={estiloTituloCard}>A Pagar Hoje (Fretes)</span>
            <p style={estiloValorCard}>R$ 14.250,00</p>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>12 pagamentos pendentes</span>
          </div>

          <div style={estiloCard}>
            <span style={estiloTituloCard}>A Receber Hoje</span>
            <p style={estiloValorCard}>R$ 22.800,00</p>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>4 faturas previstas</span>
          </div>

          <div style={estiloCard}>
            <span style={estiloTituloCard}>Saldo Previsto do Dia</span>
            <p style={{ ...estiloValorCard, color: '#16a34a' }}>+ R$ 8.550,00</p>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Entradas - Saídas</span>
          </div>
        </div>
      </main>
    </div>
  );
}

const estiloCard = { backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' };
const estiloTituloCard = { fontSize: '0.85rem', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '0.5rem' };
const estiloValorCard = { margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' };