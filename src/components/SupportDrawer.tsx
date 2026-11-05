import React, { useState } from 'react';
import { X, MessageSquare, PhoneCall, Mail, Clock, Send, CheckCircle2 } from 'lucide-react';
import { maskPhone } from '../utils/formatters';

interface SupportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportDrawer: React.FC<SupportDrawerProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Dúvida sobre simulação');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => {
      setSent(false);
      onClose();
    }, 2500);
  };

  const handleWhatsAppRedirect = () => {
    const text = encodeURIComponent(
      'Olá! Gostaria de falar com um especialista sobre simulação de crédito na ValoreCrédito.'
    );
    window.open(`https://api.whatsapp.com/send?phone=5511999999999&text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Central de Atendimento ao Cliente</h3>
              <p className="text-[11px] text-slate-400">Atendimento humanizado especializado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {sent ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Mensagem Enviada!</h4>
              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                Um de nossos especialistas entrará em contato via WhatsApp em até 15 minutos úteis.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* WhatsApp Fast Channel */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <MessageSquare className="w-4 h-4 text-emerald-700" />
                    <span>Canal Direto no WhatsApp</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                    Online agora
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mb-3">
                  Prefere conversar agora? Tire dúvidas sobre saldo FGTS, margem consignada ou envie seus documentos.
                </p>
                <button
                  type="button"
                  onClick={handleWhatsAppRedirect}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Conversar no WhatsApp Oficial</span>
                </button>
              </div>

              {/* Direct Info */}
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold mb-1">
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
                    <span>0800 720 4050</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Ligação gratuita para todo Brasil</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold mb-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Seg a Sex: 8h às 19h</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Sábados das 9h às 14h</span>
                </div>
              </div>

              {/* Message form */}
              <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-900">Ou envie uma solicitação por aqui:</div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-900"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-900 font-mono"
                  />
                </div>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-900"
                >
                  <option value="Dúvida sobre simulação">Dúvida sobre simulação</option>
                  <option value="Antecipação Saque FGTS">Antecipação Saque FGTS</option>
                  <option value="Crédito Consignado INSS / Servidor">Crédito Consignado INSS / Servidor</option>
                  <option value="Empréstimo com Garantia">Empréstimo com Garantia</option>
                  <option value="Outro assunto">Outro assunto</option>
                </select>
                <textarea
                  rows={2}
                  placeholder="Como podemos te ajudar hoje?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-900"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Solicitação</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
