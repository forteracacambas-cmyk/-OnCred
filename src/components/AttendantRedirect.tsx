import { useEffect, useRef, useState } from "react";
import { assignAttendant, hasValidRecentHandoff, isValidHandoffId, loadPixel, trackAttendantEntry } from "../utils/atendimento";

export default function AttendantRedirect() {
  const [href, setHref] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [agentName, setAgentName] = useState("");
  const [isDirect, setIsDirect] = useState(false);
  const [noHandoff, setNoHandoff] = useState(false);
  const opening = useRef(false);

  useEffect(() => {
    document.title = "Conectando ao atendimento | ZM SCD";
    document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex,nofollow");
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", location.origin + "/contato");

    // 3) /contato aberto diretamente sem sessionStorage oncred_handoff recente e UUID atendimento válido
    // não deve alocar nem disparar Lead; mostre voltar ao simulador.
    const url = new URL(location.href);
    const uuidParam = url.searchParams.get("atendimento");
    const validHandoff = hasValidRecentHandoff();
    const validUUID = isValidHandoffId(uuidParam);

    if (!validHandoff || !validUUID) {
      setNoHandoff(true);
      return;
    }

    loadPixel();
    let alive = true;
    setError("");
    (async () => {
      try {
        const data = await assignAttendant();
        if (!alive) return;
        setHref(data.href);
        if (data.agentName) setAgentName(data.agentName);
        if (data.isDirect) setIsDirect(true);
        await trackAttendantEntry(data);
        if (alive && !opening.current) {
          opening.current = true;
          location.replace(data.href);
        }
      } catch (e: any) {
        if (alive) {
          if (e && e.status === 404) {
            setError("Atendente não encontrado. Faça uma nova simulação.");
          } else if (e && e.status === 409) {
            setError("Atendente temporariamente indisponível no momento.");
          } else {
            setError(e instanceof Error ? e.message : "Não foi possível conectar. Tente novamente.");
          }
        }
      }
    })();
    return () => { alive = false; };
  }, [attempt]);

  if (noHandoff) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-5 py-10">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-800 p-7 text-center shadow-2xl">
          <p className="text-sm font-semibold tracking-widest text-blue-300 mb-6">ZM SCD</p>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-3">Nenhuma simulação ativa</h1>
          <p className="text-slate-300 leading-relaxed mb-6">
            Para falar com um de nossos atendentes, realize primeiro a sua simulação de crédito personalizada.
          </p>
          <a
            href="/simulacao"
            className="block w-full rounded-xl bg-blue-600 px-5 py-4 font-bold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30"
          >
            Voltar ao simulador
          </a>
          <a href="https://zmscd.online/" className="block mt-4 text-xs underline text-slate-400 hover:text-slate-200">
            Canais institucionais da ZM SCD
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-800 p-7 text-center shadow-2xl">
        <p className="text-sm font-semibold tracking-widest text-blue-300 mb-6">ZM SCD</p>
        {!error && <div aria-hidden="true" className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-emerald-400" />}
        <h1 className="text-2xl font-bold mb-3">
          {error
            ? "Não conseguimos conectar agora"
            : href
            ? "Abrindo seu WhatsApp"
            : isDirect && agentName
            ? `Conectando com ${agentName}`
            : "Conectando ao atendimento"}
        </h1>
        <p role={error ? "alert" : "status"} aria-live="polite" className="text-slate-300 leading-relaxed mb-6">
          {error || (isDirect && agentName
            ? `Direcionando você para o WhatsApp exclusivo de ${agentName}. Sua simulação está pronta para envio.`
            : "Estamos direcionando você para um atendente disponível. Sua mensagem está pronta para continuar.")}
        </p>
        {/* Pixel de conversão ativado automaticamente nesta página (/contato) */}
        {href && <a href={href} className="block rounded-xl bg-emerald-500 px-5 py-4 text-slate-950 font-bold hover:bg-emerald-400">Abrir WhatsApp</a>}
        {href && <p className="text-xs text-slate-400 mt-3">Se o aplicativo não abrir automaticamente, toque no botão acima.</p>}
        {error && <button onClick={() => setAttempt(v => v + 1)} className="w-full rounded-xl bg-blue-600 px-5 py-4 font-bold hover:bg-blue-500">Tentar novamente</button>}
        {error && <a href="https://zmscd.online/" className="block mt-4 underline text-blue-200">Consultar os canais institucionais da ZM SCD</a>}
        <a href="/simulacao" className="inline-block mt-6 text-sm text-slate-300 underline">Voltar ao simulador</a>
      </section>
    </main>
  );
}
