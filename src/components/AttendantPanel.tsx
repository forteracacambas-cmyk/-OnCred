import React, { useEffect, useState } from "react";
import { api } from "../utils/atendimento";
import "./panel.css";
type Agent = {
  id: string;
  name: string;
  phone: string;
  position: number;
  active: number;
  deleted: number;
};
const periods = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["7", "7 dias"],
  ["15", "15 dias"],
  ["30", "30 dias"],
  ["total", "Total"],
];
function formatDisplayPhone(p: string) {
  const digits = String(p || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return p ? `+${digits}` : "";
}
export default function AttendantPanel() {
  const [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]),
    [batch, setBatch] = useState(1),
    [period, setPeriod] = useState("today"),
    [stats, setStats] = useState<any>(null);
  const [editing, setEditing] = useState<Agent | null>(null),
    [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  const request = async (path: string, method = "GET", data?: unknown) => {
    try {
      return await api("admin/" + path, method, data, token);
    } catch (e: any) {
      if (e.status === 401) {
        setToken("");
        setStats(null);
        setAgents([]);
      }
      throw e;
    }
  };
  const refresh = async () => {
    const [config, totals] = await Promise.all([
      request("config"),
      request("stats?period=" + period),
    ]);
    setAgents(config.agents);
    setBatch(config.batchSize);
    setStats(totals);
  };
  useEffect(() => {
    document.title = "Painel de atendentes | ZM SCD";
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute("content", "noindex,nofollow");
  }, []);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    request("stats?period=" + period)
      .then((s) => {
        if (alive) setStats(s);
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
  }, [token, period]);
  useEffect(() => {
    if (!token) return;
    refresh().catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      setToken("");
      setStats(null);
      setAgents([]);
      setError("Sessão encerrada. Entre novamente.");
    }, 30 * 60000);
    return () => clearTimeout(timer);
  }, [token]);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    setEditing(null);
    setName("");
    setPhone("");
  };
  const saveAgent = () =>
    run(async () => {
      if (editing)
        await request("agents/" + editing.id, "PUT", {
          ...editing,
          name,
          phone,
          active: !!editing.active,
        });
      else await request("agents", "POST", { name, phone });
      reset();
      await refresh();
      setNotice("Atendente salvo. A distribuição já usa os novos dados.");
    });
  const clearHistory = () => {
    if (
      !confirm(
        "Tem certeza que deseja limpar todo o histórico? Todos os atendimentos, encaminhamentos e contadores do painel serão zerados permanentemente.",
      )
    )
      return;
    run(async () => {
      await request("clear-history", "POST", {});
      await refresh();
      setNotice("Histórico limpo com sucesso! Nenhum registro restante no painel.");
    });
  };
  return (
    <main className="attendant-panel">
      <div className="panel-wrap">
        <header className="panel-heading">
          <div>
            <div className="panel-brand">
              ZM <span>SCD</span>
            </div>
            <h1>Painel de atendentes</h1>
            <p>Distribuição de encaminhamentos para o WhatsApp</p>
          </div>
          {token && (
            <div className="panel-header-actions">
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={clearHistory}
                title="Zera todos os atendimentos e registros do painel"
              >
                Limpar histórico
              </button>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await request("logout", "POST", {});
                    setToken("");
                    setStats(null);
                    reset();
                  })
                }
              >
                Sair
              </button>
            </div>
          )}
        </header>
        {error && (
          <div role="alert" className="panel-alert">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="panel-success">
            {notice}
          </div>
        )}
        {!token ? (
          <form
            className="panel-card panel-login"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const data = await api("login", "POST", { password });
                setPassword("");
                setToken(data.token);
              });
            }}
          >
            <h2>Acesso restrito</h2>
            <p>
              Informe a senha para entrar. Ela será solicitada novamente ao
              abrir ou recarregar esta página.
            </p>
            <label>
              Senha
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={128}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
        ) : (
          <>
            <div className="panel-section-header">
              <div>
                <h2>Métricas e registros</h2>
                <p>
                  Atendimentos e encaminhamentos registrados por período
                </p>
              </div>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={clearHistory}
                title="Zerar todos os registros e contadores"
              >
                Limpar histórico
              </button>
            </div>
            <div className="panel-metrics">
              {periods.map(([key, label]) => (
                <button
                  className={
                    "panel-card metric " + (period === key ? "selected" : "")
                  }
                  key={key}
                  onClick={() => setPeriod(key)}
                >
                  <span>{label}</span>
                  <strong>{stats?.totals?.[key] ?? "—"}</strong>
                  <small>atendimentos registrados</small>
                </button>
              ))}
            </div>
            <p className="panel-note">
              Horário de Brasília (São Paulo). Os períodos de 7, 15 e 30 dias
              incluem hoje. Os números indicam encaminhamentos; não confirmam
              envio de mensagem.
            </p>
            <section className="panel-card">
              <h2>Distribuição por lote</h2>
              <p>
                Envie a quantidade definida para um atendente antes de passar ao
                próximo. Use 1 para alternar a cada novo clique.
              </p>
              <form
                className="panel-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await request("config", "PUT", { batchSize: batch });
                    setNotice("Lote salvo e aplicado.");
                  });
                }}
              >
                <label>
                  Cliques por atendente
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={batch}
                    onChange={(e) => setBatch(Number(e.target.value))}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Salvar lote
                </button>
              </form>
            </section>
            <section className="panel-card">
              <h2>{editing ? "Editar atendente" : "Cadastrar atendente"}</h2>
              <form
                className="panel-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveAgent();
                }}
              >
                <label>
                  Nome
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  Telefone com DDD / WhatsApp
                  <input
                    inputMode="tel"
                    placeholder="Ex: 553190915057 ou (11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    maxLength={30}
                  />
                  <small className="panel-field-hint">
                    Aceita com ou sem 55, DDD 11 a 99, 8 ou 9 dígitos (ex: 553190915057, 3190915057, 11999999999).
                  </small>
                </label>
                <button className="primary" disabled={busy}>
                  {editing ? "Salvar alterações" : "Adicionar atendente"}
                </button>
                {editing && (
                  <button type="button" onClick={reset}>
                    Cancelar
                  </button>
                )}
              </form>
            </section>
            <section className="panel-card">
              <div className="panel-row">
                <h2>Atendentes</h2>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await refresh();
                      setNotice("Contadores atualizados.");
                    })
                  }
                >
                  Atualizar contadores
                </button>
              </div>
              {!agents.length ? (
                <p>
                  Nenhum atendente cadastrado. Adicione um número para iniciar a
                  distribuição.
                </p>
              ) : (
                <div className="panel-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Ordem</th>
                        <th>Nome / telefone</th>
                        <th>Status</th>
                        <th>Atendimentos iniciados</th>
                        <th>Encaminhamentos</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((a) => {
                        const counts = stats?.agents?.find(
                          (v: any) => v.id === a.id,
                        );
                        return (
                          <tr key={a.id}>
                            <td>{a.position}</td>
                            <td>
                              <strong>{a.name}</strong>
                              <small>{formatDisplayPhone(a.phone)}</small>
                            </td>
                            <td>
                              <span className={a.active ? "active" : "paused"}>
                                {a.active ? "Ativo" : "Pausado"}
                              </span>
                            </td>
                            <td>{counts?.new_clients ?? 0}</td>
                            <td>{counts?.deliveries ?? 0}</td>
                            <td>
                              <div className="panel-actions">
                                <button
                                  disabled={busy}
                                  onClick={() => {
                                    setEditing(a);
                                    setName(a.name);
                                    setPhone(a.phone);
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    run(async () => {
                                      await request("agents/" + a.id, "PUT", {
                                        ...a,
                                        active: !a.active,
                                      });
                                      await refresh();
                                    })
                                  }
                                >
                                  {a.active ? "Pausar" : "Ativar"}
                                </button>
                                <button
                                  className="danger"
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Excluir " +
                                          a.name +
                                          " da distribuição? O histórico será preservado.",
                                      )
                                    )
                                      run(async () => {
                                        await request(
                                          "agents/" + a.id,
                                          "DELETE",
                                        );
                                        if (editing?.id === a.id) reset();
                                        await refresh();
                                      });
                                  }}
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="panel-note">
                Cada novo clique em Solicitar Análise entra na fila. Recarregar
                a mesma página de atendimento não avança a fila novamente. Os
                totais anteriores foram preservados.
              </p>
            </section>
            {!!stats?.agents?.some((a: any) => a.deleted) && (
              <section className="panel-card">
                <h2>Histórico de atendentes excluídos</h2>
                {stats.agents
                  .filter((a: any) => a.deleted)
                  .map((a: any) => (
                    <p key={a.id}>
                      {a.name}: {a.new_clients} atendimentos iniciados · {a.deliveries}{" "}
                      encaminhamentos no período.
                    </p>
                  ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
