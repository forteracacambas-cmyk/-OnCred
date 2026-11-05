import React from 'react';
import { Quote } from 'lucide-react';
import { formatBRL } from '../utils/formatters';

export const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: 'Mariana Vasconcelos',
      role: 'Analista de Logística',
      location: 'São Paulo - SP',
      modality: 'Antecipação FGTS',
      amount: 4850,
      outcome: 'Precisava de dinheiro urgente para consertar meu carro que uso para trabalhar. Fiz a simulação na ValoreCrédito e, em 12 minutos após a biometria, o Pix de R$ 4.850 caiu certinho na minha conta Nubank sem mexer no meu salário mensal.',
    },
    {
      name: 'Antônio Carlos Moreira',
      role: 'Aposentado do INSS',
      location: 'Belo Horizonte - MG',
      modality: 'Crédito Consignado',
      amount: 18000,
      outcome: 'Estava pagando taxas absurdas no cartão de crédito do banco tradicional. O consultor da ValoreCrédito me ajudou a unificar tudo no consignado com taxa de 1,29%. Minha parcela caiu mais da metade e recuperei a tranquilidade.',
    },
    {
      name: 'Renata & Gilberto Silveira',
      role: 'Empresários (Padaria Artesanal)',
      location: 'Curitiba - PR',
      modality: 'Capital de Giro PJ',
      amount: 35000,
      outcome: 'Precisávamos comprar um novo forno industrial para atender a demanda de fim de ano. Os grandes bancos pediam meses de burocracia. Na ValoreCrédito tivemos aprovação em 24 horas e com carência de 60 dias para a primeira parcela.',
    },
  ];

  return (
    <section className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-14">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
            Histórias Reais de Quem Confiou
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
            Mais de 38 mil brasileiros com objetivos realizados
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Veja a experiência de quem encontrou crédito transparente e sem pegadinhas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((item, idx) => (
            <div
              key={idx}
              className="p-7 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between shadow-sm"
            >
              <div>
                <Quote className="w-8 h-8 text-emerald-700/30 mb-4" />
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-6">
                  "{item.outcome}"
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-900">{item.name}</span>
                  <span className="font-mono text-emerald-700 font-bold">{formatBRL(item.amount, false)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span>{item.role}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.location}</span>
                </div>
                <div className="text-[11px] text-emerald-800 font-medium mt-1">
                  {item.modality}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
