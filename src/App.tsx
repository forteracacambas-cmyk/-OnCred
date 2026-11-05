/**
 * OnCred - SOLICITAÇÃO DE CRÉDITO
 * Landing Page de Alta Conversão em Conformidade Regulatória (Bacen / LGPD / TikTok Ads)
 * Razão Social: OnCred Sociedade de Crédito Direto S.A.
 * CNPJ: 44.650.156/0001-93
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { MeasurementConsent } from './components/MeasurementConsent';
const AttendantPanel = lazy(() => import('./components/AttendantPanel'));
const AttendantRedirect = lazy(() => import('./components/AttendantRedirect'));
export default function App() {
  if (/^\/painel(?:\/|$)/.test(location.pathname)) return <Suspense fallback={<p>Carregando painel…</p>}><AttendantPanel /></Suspense>;
  if (/^\/atendente\/?$/.test(location.pathname)) return <Suspense fallback={<p>Conectando ao atendimento…</p>}><AttendantRedirect /></Suspense>;
  return <Landing />;
}
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

function Landing() {
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
    <div id="topo" className="min-h-screen flex flex-col bg-slate-900 text-slate-800">

      {/* Top Bar Header */}
      <Header
        onScrollToSimulator={scrollToSimulator}
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* Hero Section with Immediate Values Simulator */}
        <SimulatorHero
          onOpenPrivacy={() => setIsPrivacyOpen(true)}
        />

        {/* 3-Step Clear Process */}
        <HowItWorks />

        {/* Transparent Operation & Lead Generation Model */}
        <OperationModel />

        {/* Regulatory Credit Conditions & Representative Example */}
        <FinancialConditions />

        {/* Genuine Fintech Benefits */}
        <Benefits />

        {/* About OnCred (Authorized by BCB) */}
        <AboutSants />

        {/* Frequently Asked Questions */}
        <FAQ />
      </main>

      {/* Complete Legal & Institutional Footer */}
      <Footer
        onOpenPrivacy={() => setIsPrivacyOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      <MeasurementConsent />
      {/* Full Modal Views */}
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
