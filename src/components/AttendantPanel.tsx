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
  team_id?: string | null;
};

type Team = {
  id: string;
  slug: string;
  name: string;
  batch_size: number;
  active: number;
  created_at?: number;
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

function suggestTeamSlug(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  // "Equipe 1" -> "equipe1"
  if (/^equipe\s+\d+$/i.test(clean)) {
    return clean.replace(/\s+/g, "");
  }
  return clean
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function AttendantPanel() {
  const [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);

  const [agents, setAgents] = useState<Agent[]>([]),
    [teams, setTeams] = useState<Team[]>([]),
    [batch, setBatch] = useState(1),
    [period, setPeriod] = useState("today"),
    [stats, setStats] = useState<any>(null),
    [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Agent form state
  const [editing, setEditing] = useState<Agent | null>(null),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [agentTeamId, setAgentTeamId] = useState<string>("");

  // Team form state
  const [editingTeam, setEditingTeam] = useState<Team | null>(null),
    [teamName, setTeamName] = useState(""),
    [teamSlug, setTeamSlug] = useState(""),
    [teamSlugTouched, setTeamSlugTouched] = useState(false),
    [teamBatch, setTeamBatch] = useState(1);

  // Drag-and-drop state
  const [draggingAgentId, setDraggingAgentId] = useState<string | null>(null),
    [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // "general" or team.id

  const origin = typeof window !== "undefined" ? window.location.origin : "https://zmscd.online";

  const copyLink = (url: string, id: string) => {
    try {
      navigator.clipboard.writeText(url);
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2500);
    } catch {
      // fallback
    }
  };

  const request = async (path: string, method = "GET", data?: unknown) => {
    try {
      return await api("admin/" + path, method, data, token);
    } catch (e: any) {
      if (e.status === 401) {
        setToken("");
        setStats(null);
        setAgents([]);
        setTeams([]);
      }
      throw e;
    }
  };

  const refresh = async () => {
    const [config, totals] = await Promise.all([
      request("config"),
      request("stats?period=" + period),
    ]);
    const loadedAgents = config.agents || [];
    const loadedTeams = config.teams || [];
    setAgents(loadedAgents);
    setTeams(loadedTeams);
    setBatch(config.batchSize);
    setStats(totals);
    try {
      localStorage.setItem("oncred_local_agents", JSON.stringify(loadedAgents));
      localStorage.setItem("oncred_local_teams", JSON.stringify(loadedTeams));
    } catch {}
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
      setTeams([]);
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
    setAgentTeamId("");
  };

  const resetTeamForm = () => {
    setEditingTeam(null);
    setTeamName("");
    setTeamSlug("");
    setTeamSlugTouched(false);
    setTeamBatch(1);
  };

  const saveAgent = () =>
    run(async () => {
      const targetTeam = agentTeamId || null;
      if (editing)
        await request("agents/" + editing.id, "PUT", {
          ...editing,
          name,
          phone,
          active: !!editing.active,
          team_id: targetTeam,
        });
      else await request("agents", "POST", { name, phone, team_id: targetTeam });
      reset();
      await refresh();
      setNotice("Atendente salvo. A distribuição já usa os novos dados.");
    });

  const saveTeam = () =>
    run(async () => {
      const slugToUse = (teamSlug || suggestTeamSlug(teamName)).trim();
      if (editingTeam) {
        await request("teams/" + editingTeam.id, "PUT", {
          name: teamName,
          slug: slugToUse,
          batchSize: teamBatch,
          active: !!editingTeam.active,
        });
        setNotice(`Equipe "${teamName}" atualizada! URL: ${origin}/${slugToUse}`);
      } else {
        await request("teams", "POST", {
          name: teamName,
          slug: slugToUse,
          batchSize: teamBatch,
        });
        setNotice(`Equipe "${teamName}" criada! Anuncie usando ${origin}/${slugToUse}`);
      }
      resetTeamForm();
      await refresh();
    });

  const moveAgentToTeam = (agentId: string, targetTeamId: string | null) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent || (agent.team_id || null) === targetTeamId) return;

    // Atualização otimista imediata na tela ao arrastar
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, team_id: targetTeamId } : a)),
    );

    run(async () => {
      await request("agents/move", "POST", {
        agentId,
        teamId: targetTeamId,
      });
      await refresh();
      const targetName = targetTeamId
        ? teams.find((t) => t.id === targetTeamId)?.name || "equipe"
        : "Site Principal (Geral)";
      setNotice(`${agent.name} movido para ${targetName}.`);
    });
  };

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

  const handleDragStart = (e: React.DragEvent, agentId: string) => {
    setDraggingAgentId(agentId);
    e.dataTransfer.setData("text/plain", agentId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingAgentId(null);
    setDragOverTarget(null);
  };

  const handleDragOverColumn = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTarget !== targetKey) {
      setDragOverTarget(targetKey);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent, targetTeamId: string | null) => {
    e.preventDefault();
    const droppedAgentId = e.dataTransfer.getData("text/plain") || draggingAgentId;
    setDraggingAgentId(null);
    setDragOverTarget(null);
    if (droppedAgentId) {
      moveAgentToTeam(droppedAgentId, targetTeamId);
    }
  };

  const renderAgentCard = (a: Agent) => {
    const counts = stats?.agents?.find((v: any) => v.id === a.id);
    const isDragging = draggingAgentId === a.id;
    return (
      <div
        key={a.id}
        draggable={!busy}
        onDragStart={(e) => handleDragStart(e, a.id)}
        onDragEnd={handleDragEnd}
        className={`team-agent-card ${isDragging ? "dragging" : ""}`}
        title="Arraste para mover este número para outra equipe ou para o Site Principal"
      >
        <div className="team-agent-top">
          <div className="team-agent-info">
            <span className="drag-grip" aria-hidden="true">⋮⋮</span>
            <div>
              <div className="team-agent-name">{a.name}</div>
              <div className="team-agent-phone">{formatDisplayPhone(a.phone)}</div>
            </div>
          </div>
          <span className={a.active ? "active" : "paused"} style={{ fontSize: "11px", fontWeight: 700 }}>
            {a.active ? "Ativo" : "Pausado"}
          </span>
        </div>

        <div className="team-agent-meta">
          <span>Link individual: <code>/atendimento{a.position}</code></span>
          <span>
            {counts?.new_clients ?? 0} atend. · {counts?.deliveries ?? 0} encam.
          </span>
        </div>

        <div className="team-agent-controls">
          <select
            aria-label={`Mover ${a.name} para equipe`}
            value={a.team_id || ""}
            disabled={busy}
            onChange={(e) => moveAgentToTeam(a.id, e.target.value || null)}
          >
            <option value="">Site Principal (/)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                Equipe: {t.name} (/{t.slug})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(a);
              setName(a.name);
              setPhone(a.phone);
              setAgentTeamId(a.team_id || "");
            }}
          >
            Editar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await request("agents/" + a.id, "PUT", {
                  ...a,
                  active: !a.active,
                  team_id: a.team_id || null,
                });
                await refresh();
              })
            }
          >
            {a.active ? "Pausar" : "Ativar"}
          </button>
        </div>
      </div>
    );
  };

  const generalAgents = agents.filter((a) => !a.team_id);

  return (
    <main className="attendant-panel">
      <div className="panel-wrap">
        <header className="panel-heading">
          <div>
            <div className="panel-brand">
              ZM <span>SCD</span>
            </div>
            <h1>Painel de atendentes e equipes</h1>
            <p>Organize números por setor, arraste entre equipes e distribua encaminhamentos para o WhatsApp</p>
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
                    resetTeamForm();
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

            {/* GUIA DE URLS E CAMPANHAS (GERAL / EQUIPES / INDIVIDUAIS / PIXEL) */}
            <section className="campaign-guide">
              <div className="panel-section-header">
                <div>
                  <h2 style={{ color: "#38bdf8", fontSize: "17px", fontWeight: 700 }}>
                    Estrutura de URLs para Campanhas e Setores
                  </h2>
                  <p>
                    Separe seus setores com rodízio independente e medição unificada em /contato:
                  </p>
                </div>
              </div>

              <div className="campaign-guide-grid">
                <div className="campaign-guide-item">
                  <h3>1. Site Principal (URL Padrão)</h3>
                  <p>
                    Gira apenas entre os números que estão na coluna <strong>Site Principal (/)</strong>.
                  </p>
                  <div className="campaign-guide-code">{origin}/</div>
                  <div style={{ marginTop: "10px" }}>
                    <button
                      type="button"
                      className={`campaign-btn ${copiedLink === 'main' ? 'copied' : ''}`}
                      onClick={() => copyLink(origin + "/", "main")}
                    >
                      {copiedLink === 'main' ? "✓ Link Geral Copiado!" : "Copiar Link Geral"}
                    </button>
                  </div>
                </div>

                <div className="campaign-guide-item">
                  <h3>2. URLs de Equipes (/equipe1, /equipe2…)</h3>
                  <p>
                    Cada equipe criada tem sua própria URL de campanha. O cliente gira <strong>somente</strong> entre os atendentes arrastados para aquela equipe.
                  </p>
                  <div className="campaign-guide-code">
                    {teams.length > 0
                      ? teams.slice(0, 3).map((t) => `${origin}/${t.slug}`).join(" · ")
                      : `${origin}/equipe1, ${origin}/equipe2...`}
                  </div>
                </div>

                <div className="campaign-guide-item">
                  <h3>3. Links Individuais (/atendimentoN)</h3>
                  <p>
                    Direciona 100% para um único número específico sem rodar com outros.
                  </p>
                  <div className="campaign-guide-code">{origin}/atendimento1, {origin}/atendimento2…</div>
                </div>

                <div className="campaign-guide-item">
                  <h3>4. Conversão e Pixel (/contato)</h3>
                  <p>
                    Tanto a URL principal quanto as URLs de equipes e atendentes passam por <strong>/contato</strong> para registrar a conversão do Pixel antes de abrir o WhatsApp.
                  </p>
                  <div className="campaign-guide-code">{origin}/contato</div>
                </div>
              </div>
            </section>

            {/* ORGANIZE EQUIPES & ARRASTAR NÚMEROS */}
            <section className="panel-card">
              <div className="panel-section-header">
                <div>
                  <h2>Organizador de Equipes e Setores (Arrastar e Soltar)</h2>
                  <p>
                    Crie equipes com URLs próprias e arraste os cartões de atendentes entre o <strong>Site Principal</strong> e as <strong>Equipes</strong>.
                  </p>
                </div>
              </div>

              {/* Criar / Editar Equipe */}
              <form
                className="panel-row"
                style={{
                  background: "#0b1424",
                  border: "1px solid #24344d",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "12px",
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  saveTeam();
                }}
              >
                <label>
                  {editingTeam ? "Editar nome da equipe" : "Nova equipe / setor"}
                  <input
                    placeholder="Ex: Equipe 1, Consignado, Setor PJ"
                    value={teamName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTeamName(val);
                      if (!teamSlugTouched && !editingTeam) {
                        setTeamSlug(suggestTeamSlug(val));
                      }
                    }}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  URL da equipe ({origin}/{teamSlug || "equipe1"})
                  <input
                    placeholder="equipe1"
                    value={teamSlug}
                    onChange={(e) => {
                      setTeamSlugTouched(true);
                      setTeamSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, ""),
                      );
                    }}
                    required
                    maxLength={49}
                  />
                </label>
                <label style={{ maxWidth: "150px" }}>
                  Cliques por atendente
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={teamBatch}
                    onChange={(e) => setTeamBatch(Number(e.target.value))}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {editingTeam ? "Salvar equipe" : "Criar equipe"}
                </button>
                {editingTeam && (
                  <button type="button" onClick={resetTeamForm}>
                    Cancelar
                  </button>
                )}
              </form>

              {/* Quadro Kanban / Colunas de Arrastar e Soltar */}
              <div className="teams-board">
                {/* Coluna Fixa: Site Principal (/) */}
                <div
                  className={`team-column is-general ${dragOverTarget === "general" ? "drag-over" : ""}`}
                  onDragOver={(e) => handleDragOverColumn(e, "general")}
                  onDragLeave={() => {
                    if (dragOverTarget === "general") setDragOverTarget(null);
                  }}
                  onDrop={(e) => handleDropOnColumn(e, null)}
                >
                  <div className="team-column-header">
                    <div className="team-column-title-row">
                      <h3>
                        Site Principal (Geral)
                        <span className="team-count-badge">{generalAgents.length}</span>
                      </h3>
                      <span className="active" style={{ fontSize: "11px", fontWeight: 700 }}>
                        Ativa
                      </span>
                    </div>

                    <div className="team-url-bar">
                      <span className="team-url-text">{origin}/</span>
                      <div className="team-toolbar-actions">
                        <button
                          type="button"
                          className={`campaign-btn ${copiedLink === "board-main" ? "copied" : ""}`}
                          onClick={() => copyLink(origin + "/", "board-main")}
                        >
                          {copiedLink === "board-main" ? "✓ Copiado" : "Copiar"}
                        </button>
                        <a
                          href="/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="campaign-btn"
                          style={{ textDecoration: "none" }}
                        >
                          Abrir ↗
                        </a>
                      </div>
                    </div>

                    <form
                      className="team-toolbar"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                          await request("config", "PUT", { batchSize: batch });
                          setNotice("Lote do Site Principal salvo.");
                        });
                      }}
                    >
                      <span>Lote: {batch} clique(s) por atendente</span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input
                          type="number"
                          aria-label="Cliques por atendente no Site Principal"
                          min={1}
                          max={1000}
                          value={batch}
                          onChange={(e) => setBatch(Number(e.target.value))}
                          style={{ width: "68px", padding: "4px 6px", fontSize: "11px" }}
                        />
                        <button type="submit" disabled={busy} style={{ padding: "4px 8px", fontSize: "11px" }}>
                          Salvar lote
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="team-agents-list">
                    {generalAgents.length === 0 ? (
                      <div className="team-empty-drop">
                        Arraste números para cá para fazê-los girar no Site Principal ({origin}/)
                      </div>
                    ) : (
                      generalAgents.map(renderAgentCard)
                    )}
                  </div>
                </div>

                {/* Colunas Dinâmicas: Equipes Criadas */}
                {teams.map((t) => {
                  const teamAgents = agents.filter((a) => a.team_id === t.id);
                  const teamUrl = `${origin}/${t.slug}`;
                  const isCopied = copiedLink === `team-${t.id}`;
                  return (
                    <div
                      key={t.id}
                      className={`team-column ${!t.active ? "is-paused" : ""} ${dragOverTarget === t.id ? "drag-over" : ""}`}
                      onDragOver={(e) => handleDragOverColumn(e, t.id)}
                      onDragLeave={() => {
                        if (dragOverTarget === t.id) setDragOverTarget(null);
                      }}
                      onDrop={(e) => handleDropOnColumn(e, t.id)}
                    >
                      <div className="team-column-header">
                        <div className="team-column-title-row">
                          <h3>
                            {t.name}
                            <span className="team-count-badge">{teamAgents.length}</span>
                          </h3>
                          <span className={t.active ? "active" : "paused"} style={{ fontSize: "11px", fontWeight: 700 }}>
                            {t.active ? "Ativa" : "Pausada"}
                          </span>
                        </div>

                        <div className="team-url-bar">
                          <span className="team-url-text">{teamUrl}</span>
                          <div className="team-toolbar-actions">
                            <button
                              type="button"
                              className={`campaign-btn ${isCopied ? "copied" : ""}`}
                              onClick={() => copyLink(teamUrl, `team-${t.id}`)}
                            >
                              {isCopied ? "✓ Copiado" : "Copiar"}
                            </button>
                            <a
                              href={`/${t.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="campaign-btn"
                              style={{ textDecoration: "none" }}
                            >
                              Abrir ↗
                            </a>
                          </div>
                        </div>

                        <div className="team-toolbar">
                          <span>Lote: {t.batch_size} clique(s)</span>
                          <div className="team-toolbar-actions">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setEditingTeam(t);
                                setTeamName(t.name);
                                setTeamSlug(t.slug);
                                setTeamSlugTouched(true);
                                setTeamBatch(t.batch_size);
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await request("teams/" + t.id, "PUT", {
                                    name: t.name,
                                    slug: t.slug,
                                    batchSize: t.batch_size,
                                    active: !t.active,
                                  });
                                  await refresh();
                                })
                              }
                            >
                              {t.active ? "Pausar" : "Ativar"}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Excluir a equipe "${t.name}"? Os atendentes dela voltarão para o Site Principal.`,
                                  )
                                ) {
                                  run(async () => {
                                    await request("teams/" + t.id, "DELETE");
                                    if (editingTeam?.id === t.id) resetTeamForm();
                                    await refresh();
                                    setNotice(`Equipe "${t.name}" excluída. Os atendentes retornaram ao Site Principal.`);
                                  });
                                }
                              }}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="team-agents-list">
                        {teamAgents.length === 0 ? (
                          <div className="team-empty-drop">
                            Arraste números para cá para atender exclusivamente em /{t.slug}
                          </div>
                        ) : (
                          teamAgents.map(renderAgentCard)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* CADASTRAR / EDITAR ATENDENTE */}
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
                <label>
                  Equipe / Setor
                  <select
                    value={agentTeamId}
                    onChange={(e) => setAgentTeamId(e.target.value)}
                  >
                    <option value="">Site Principal (Rodízio Geral /)</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (/{t.slug})
                      </option>
                    ))}
                  </select>
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

            {/* TABELA GERAL DE ATENDENTES E LINKS INDIVIDUAIS */}
            <section className="panel-card">
              <div className="panel-row">
                <h2>Todos os atendentes e links individuais</h2>
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
                        <th>Equipe atual</th>
                        <th>Página Exclusiva (Link Individual)</th>
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
                        const teamObj = a.team_id
                          ? teams.find((t) => t.id === a.team_id)
                          : null;
                        const campaignUrl = `${origin}/atendimento${a.position}`;
                        const isCopied = copiedLink === a.id;
                        return (
                          <tr key={a.id}>
                            <td>{a.position}</td>
                            <td>
                              <strong>{a.name}</strong>
                              <small>{formatDisplayPhone(a.phone)}</small>
                            </td>
                            <td>
                              <span className={`team-badge ${teamObj ? "" : "general"}`}>
                                {teamObj ? `${teamObj.name} (/${teamObj.slug})` : "Site Principal (/)"}
                              </span>
                            </td>
                            <td>
                              <div className="campaign-box">
                                <span className="campaign-url">{campaignUrl}</span>
                                <div className="campaign-actions">
                                  <button
                                    type="button"
                                    className={`campaign-btn ${isCopied ? "copied" : ""}`}
                                    onClick={() => copyLink(campaignUrl, a.id)}
                                    title="Copiar URL para anunciar em campanhas"
                                  >
                                    {isCopied ? "✓ Copiado!" : "Copiar Link"}
                                  </button>
                                  <a
                                    href={`/atendimento${a.position}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="campaign-btn"
                                    style={{ textDecoration: "none" }}
                                  >
                                    Visualizar ↗
                                  </a>
                                </div>
                                <span className="campaign-tag">
                                  100% exclusivo para {a.name} (passa por /contato)
                                </span>
                              </div>
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
                                    setAgentTeamId(a.team_id || "");
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
                                        team_id: a.team_id || null,
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
                Cada novo clique em Solicitar Análise entra na fila do respectivo setor. Recarregar
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
