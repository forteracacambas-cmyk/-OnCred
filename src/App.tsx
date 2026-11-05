import React, { useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { CreditSimulator } from './components/CreditSimulator';
import { CreditLinesGrid } from './components/CreditLinesGrid';
import { RatesComparison } from './components/RatesComparison';
import { StepByStep } from './components/StepByStep';
import { SecurityNotice } from './components/SecurityNotice';
import { Testimonials } from './components/Testimonials';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';
import { ProposalModal } from './components/ProposalModal';
import { SupportDrawer } from './components/SupportDrawer';
import { CreditModality, CreditType, SimulationResult } from './types/credit';
import { CREDIT_MODALITIES } from './data/modalities';
import { calculatePMT, estimateIOF } from './utils/formatters';
import { MessageCircle, ArrowUp } from 'lucide-react';

export default function App() {
  const [isProposalOpen, setIsProposalOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Active modality and simulation state
  const [activeModality, setActiveModality] = useState<CreditModality>(CREDIT_MODALITIES[0]);
  const [activeSimulation, setActiveSimulation] = useState<SimulationResult>(() => {
    const mod = CREDIT_MODALITIES[0];
    const pmt = calculatePMT(mod.defaultAmount, mod.monthlyInterestRate, mod.defaultMonths);
    const total = pmt * mod.defaultMonths;
    return {
      amount: mod.defaultAmount,
      months: mod.defaultMonths,
      monthlyRate: mod.monthlyInterestRate,
      monthlyPayment: pmt,
      totalPayment: total,
      totalInterest: total - mod.defaultAmount,
      annualCet: mod.annualCet,
      estimatedIof: estimateIOF(mod.defaultAmount, mod.defaultMonths),
      creditCardComparisonTotal: calculatePMT(mod.defaultAmount, 14.2, 12) * 12,
      estimatedSavings: 1800,
    };
  });

  const scrollToSimulator = () => {
    const el = document.getElementById('simulador');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToModalities = () => {
    const el = document.getElementById('modalidades');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectModalityFromGrid = (type: CreditType) => {
    const mod = CREDIT_MODALITIES.find((m) => m.id === type) || CREDIT_MODALITIES[0];
    setActiveModality(mod);
    const pmt = calculatePMT(mod.defaultAmount, mod.monthlyInterestRate, mod.defaultMonths);
    const total = pmt * mod.defaultMonths;
    setActiveSimulation({
      amount: mod.defaultAmount,
      months: mod.defaultMonths,
      monthlyRate: mod.monthlyInterestRate,
      monthlyPayment: pmt,
      totalPayment: total,
      totalInterest: total - mod.defaultAmount,
      annualCet: mod.annualCet,
      estimatedIof: estimateIOF(mod.defaultAmount, mod.defaultMonths),
      creditCardComparisonTotal: calculatePMT(mod.defaultAmount, 14.2, 12) * 12,
      estimatedSavings: 1800,
    });
    scrollToSimulator();
  };

  const handleStartProposal = (mod: CreditModality, sim: SimulationResult) => {
    setActiveModality(mod);
    setActiveSimulation(sim);
    setIsProposalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* 3-Zone Top Bar */}
      <Header
        onOpenSimulator={scrollToSimulator}
        onOpenSupport={() => setIsSupportOpen(true)}
      />

      {/* Main Page Sections */}
      <main className="flex-grow">
        <Hero
          onStartSimulation={scrollToSimulator}
          onExploreModalities={scrollToModalities}
        />

        <CreditSimulator
          onStartProposal={handleStartProposal}
        />

        <CreditLinesGrid
          onSelectModality={handleSelectModalityFromGrid}
        />

        <RatesComparison
          onOpenSimulator={scrollToSimulator}
        />

        <StepByStep
          onStartSimulation={scrollToSimulator}
        />

        <SecurityNotice />

        <Testimonials />

        <FAQ />
      </main>

      {/* Regulatory Footer */}
      <Footer />

      {/* Modals & Drawers */}
      <ProposalModal
        isOpen={isProposalOpen}
        onClose={() => setIsProposalOpen(false)}
        modality={activeModality}
        simulation={activeSimulation}
      />

      <SupportDrawer
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Floating Fast Support Button */}
      <button
        onClick={() => setIsSupportOpen(true)}
        className="fixed bottom-6 right-6 z-30 p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-95 flex items-center justify-center group"
        aria-label="Falar com especialista"
        title="Falar com especialista pelo WhatsApp"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out text-xs font-bold pl-0 group-hover:pl-2">
          Atendimento Rápido
        </span>
      </button>
    </div>
  );
}
