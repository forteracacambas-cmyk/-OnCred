/**
 * ZM SCD - SOLICITAÇÃO DE CRÉDITO INTELIGENTE
 * Landing Page de Alta Conversão em Conformidade Regulatória (Bacen / LGPD / TikTok Ads)
 * Razão Social: ZM SOCIEDADE DE CREDITO DIRETO SA
 * CNPJ: 49.947.715/0001-45
 * Domínio: zmscd.online | Telefone: +55 (11) 3042-0181
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { MeasurementConsent } from './components/MeasurementConsent';
import { Header } from './components/Header';
import { SimulatorHero } from './components/SimulatorHero';
import { HowItWorks } from './components/HowItWorks';
import { OperationModel } from './components/OperationModel';
import { FinancialConditions } from './components/FinancialConditions';
import { Benefits } from './components/Benefits';
import { AboutSants } from './components/AboutSants';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { TermsOfUseModal } from './components/TermsOfUseModal';

const AttendantPanel = lazy(() => import('./components/AttendantPanel'));
const AttendantRedirect = lazy(() => import('./components/AttendantRedirect'));

export default function App() {
  const path = location.pathname.toLowerCase().replace(/\/$/, "");

  // 1. Painel Administrativo de Atendentes
  if (/^\/painel(?:\/|$)/.test(path)) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><p className="font-mono text-sm">Carregando painel de atendimento…</p></div>}>
        <AttendantPanel />
      </Suspense>
    );
  }

  // 2. Página de Redirecionamento e Disparo de Pixel (/contato e retrocompatível /atendente)
  if (path === "/contato" || path === "/atendente") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><p className="font-mono text-sm">Conectando ao canal de atendimento…</p></div>}>
        <AttendantRedirect />
      </Suspense>
    );
  }

  // 3. Páginas Dedicadas de Atendente (/atendimento1, /atendimento2, /atendente1, /atendente2, etc.)
  const agentMatch = path.match(/^\/(?:atendimento|atendente)([1-9]\d*|[a-z0-9_-]+)$/i);
  const queryParam = new URLSearchParams(location.search).get("atendente") || new URLSearchParams(location.search).get("agente");
  // Nunca aceitar UUID de atendimento como identificador de atendente fixo
  const validQueryAgent = queryParam && !/^[0-9a-f-]{36}$/i.test(queryParam.trim()) ? queryParam.trim() : undefined;
  const fixedAgent = agentMatch ? agentMatch[0].replace(/^\//, '') : validQueryAgent;

  return <Landing fixedAgent={fixedAgent} />;
}

function Landing({ fixedAgent }: { fixedAgent?: string }) {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Detectar rota no pathname ou hash para abrir páginas legais automaticamente
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      if (path.includes('politica-de-privacidade') || hash.includes('politica-de-privacidade')) {
        setIsPrivacyOpen(true);
      } else if (path.includes('termos-de-uso') || hash.includes('termos-de-uso')) {
        setIsTermsOpen(true);
      }
    };

    handleLocation();
    window.addEventListener('popstate', handleLocation);
    window.addEventListener('hashchange', handleLocation);

    return () => {
      window.removeEventListener('popstate', handleLocation);
      window.removeEventListener('hashchange', handleLocation);
    };
  }, []);

  const scrollToSimulator = () => {
    const el = document.getElementById('simulador');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="topo" className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Bar Header */}
      <Header
        onScrollToSimulator={scrollToSimulator}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* Hero Section with Interactive Credit Simulator */}
        <SimulatorHero
          onOpenPrivacy={() => setIsPrivacyOpen(true)}
          fixedAgent={fixedAgent}
        />

        {/* 3-Step Clear Process */}
        <HowItWorks />

        {/* Transparent Operation Model */}
        <OperationModel />

        {/* Regulatory Credit Conditions & Representative Example */}
        <FinancialConditions />

        {/* Genuine Fintech Benefits */}
        <Benefits />

        {/* About ZM SCD (Authorized by BCB) */}
        <AboutSants />

        {/* Frequently Asked Questions */}
        <FAQ />
      </main>

      {/* Complete Legal & Institutional Footer */}
      <Footer
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      {/* Automatic Measurement Consent (Activated silently on entry as requested) */}
      <MeasurementConsent />

      {/* Legal Modals */}
      <PrivacyPolicyModal
        isOpen={isPrivacyOpen}
        onClose={() => {
          setIsPrivacyOpen(false);
          if (window.location.hash.includes('politica-de-privacidade')) {
            history.pushState(null, '', window.location.pathname);
          }
        }}
      />

      <TermsOfUseModal
        isOpen={isTermsOpen}
        onClose={() => {
          setIsTermsOpen(false);
          if (window.location.hash.includes('termos-de-uso')) {
            history.pushState(null, '', window.location.pathname);
          }
        }}
      />
    </div>
  );
}
