import React, { useEffect, useMemo, useState } from "react";
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

type Snapshot = {
  batchSize: number;
  teams: Team[];
  agents: Agent[];
};

const periods = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["7", "7 dias"],
  ["15", "15 dias"],
  ["30", "30 dias"],
  ["total", "Total"],
];

const RESERVED_TEAM_SLUGS = new Set([
  "painel",
  "contato",
  "simulacao",
  "simular",
  "api",
  "atendente",
  "atendimento",
  "politica-de-privacidade",
  "termos-de-uso",
  "assets",
  "doc",
  "favicon",
  "robots",
  "sitemap",
]);

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
  if (/^equipe\s+\d+$/i.test(clean)) {
    return clean.replace(/\s+/g, "");
  }
  return clean
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeTeamSlugClient(input: string): string {
  const s = String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (
    !s ||
    !/^[a-z0-9][a-z0-9_-]{0,48}$/.test(s) ||
    RESERVED_TEAM_SLUGS.has(s) ||
    /^atend(?:imento|ente)\d+$/i.test(s)
  ) {
    throw new Error(
      "URL da equipe inválida ou reservada. Use letras minúsculas, números, '-' ou '_' (ex: equipe2, vendas).",
    );
  }
  return s;
}

function normalizePhoneClient(input: string): string {
  let n = String(input || "").replace(/\D/g, "").replace(/^0+/, "");
  if (n.length === 10 || n.length === 11) {
    n = "55" + n;
  }
  if (!/^55[1-9][0-9]\d{8,9}$/.test(n)) {
    throw new Error("Informe um telefone brasileiro válido com DDD.");
  }
  return n;
}

function serializeSnapshot(batchSize: number, teams: Team[], agents: Agent[]) {
  return JSON.stringify({
    batchSize: Number(batchSize) || 1,
    teams: teams.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      batch_size: Number(t.batch_size) || 1,
      active: t.active ? 1 : 0,
    })),
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      phone: a.phone,
      position: a.position,
      active: a.active ? 1 : 0,
      team_id: a.team_id || null,
    })),
  });
}

export default function AttendantPanel() {
  const [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);

  const [savedSnapshot, setSavedSnapshot] = useState<Snapshot>({
    batchSize: 1,
    teams: [],
    agents: [],
  });

  const [agents, setAgents] = useState<Agent[]>([]),
    [teams, setTeams] = useState<Team[]>([]),
    [batch, setBatch] = useState(1),
    [period, setPeriod] = useState("today"),
    [stats, setStats] = useState<any>(null),
    [copiedLink, setCopiedLink] = useState<string | null>(null),
    [verifiedTeams, setVerifiedTeams] = useState<Record<string, { online: boolean; agentCount: number }>>({});

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
    [dragOverTarget, setDragOverTarget] = useState<string | null>(null),
    [dragOverCard, setDragOverCard] = useState<{ id: string; placement: "before" | "after" } | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://zmscd.online";

  const isDirty = useMemo(() => {
    return (
      serializeSnapshot(batch, teams, agents) !==
      serializeSnapshot(savedSnapshot.batchSize, savedSnapshot.teams, savedSnapshot.agents)
    );
  }, [batch, teams, agents, savedSnapshot]);

  const savedTeamMap = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of savedSnapshot.teams) map.set(t.id, t);
    return map;
  }, [savedSnapshot.teams]);

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

  const sortAgentsByPosition = (list: Agent[]) =>
    [...list].sort((a, b) => (a.position - b.position) || a.id.localeCompare(b.id));

  const applyServerSnapshot = (config: { batchSize: number; agents: Agent[]; teams: Team[] }) => {
    const loadedAgents = sortAgentsByPosition(config.agents || []);
    const loadedTeams = config.teams || [];
    const loadedBatch = Number(config.batchSize) || 1;
    setSavedSnapshot({
      batchSize: loadedBatch,
      teams: loadedTeams,
      agents: loadedAgents,
    });
    setAgents(loadedAgents);
    setTeams(loadedTeams);
    setBatch(loadedBatch);
    try {
      localStorage.setItem("oncred_local_agents", JSON.stringify(loadedAgents));
      localStorage.setItem("oncred_local_teams", JSON.stringify(loadedTeams));
    } catch {}
  };

  const verifyTeamsOnServer = async (loadedTeams: Team[]) => {
    if (!loadedTeams.length) {
      setVerifiedTeams({});
      return;
    }
    const entries = await Promise.all(
      loadedTeams.map(async (t) => {
        try {
          const res = await fetch(`/api/team?slug=${encodeURIComponent(t.slug)}&_t=${Date.now()}`, {
            cache: "no-store",
          });
          if (!res.ok) return [t.id, { online: false, agentCount: 0 }] as const;
          const info = await res.json();
          return [t.id, { online: !!info.online, agentCount: Number(info.agentCount || 0) }] as const;
        } catch {
          return [t.id, { online: false, agentCount: 0 }] as const;
        }
      }),
    );
    setVerifiedTeams(Object.fromEntries(entries));
  };

  const refresh = async () => {
    const [config, totals] = await Promise.all([
      request("config"),
      request("stats?period=" + period),
    ]);
    applyServerSnapshot(config);
    setStats(totals);
    verifyTeamsOnServer(config.teams || []).catch(() => {});
  };

  useEffect(() => {
    document.title = "Painel de atendentes | ZM SCD";
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute("content", "noindex,nofollow");
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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

  // --- Ações em Rascunho (exigem clicar em "Salvar alterações" para ir online) ---

  const stageSaveAgent = () => {
    setError("");
    setNotice("");
    try {
      const cleanName = String(name || "").trim();
      if (!cleanName || cleanName.length > 80) {
        throw new Error("Informe um nome de até 80 caracteres.");
      }
      const normalizedPhone = normalizePhoneClient(phone);
      const duplicate = agents.find(
        (a) => a.phone === normalizedPhone && (!editing || a.id !== editing.id),
      );
      if (duplicate) {
        throw new Error(`Esse telefone já está cadastrado no atendente "${duplicate.name}".`);
      }

      const targetTeam = agentTeamId || null;
      if (editing) {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === editing.id
              ? { ...a, name: cleanName, phone: normalizedPhone, team_id: targetTeam }
              : a,
          ),
        );
        setNotice(`Atendente "${cleanName}" atualizado no rascunho. Clique em "Salvar alterações" para publicar online.`);
      } else {
        const nextPos = agents.reduce((m, a) => Math.max(m, a.position || 0), 0) + 1;
        const tempId = "temp-agent-" + crypto.randomUUID();
        setAgents((prev) => [
          ...prev,
          {
            id: tempId,
            name: cleanName,
            phone: normalizedPhone,
            position: nextPos,
            active: 1,
            deleted: 0,
            team_id: targetTeam,
          },
        ]);
        setNotice(`Atendente "${cleanName}" adicionado! Clique em "Salvar alterações" para publicar online.`);
      }
      reset();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const stageSaveTeam = () => {
    setError("");
    setNotice("");
    try {
      const cleanName = String(teamName || "").trim();
      if (!cleanName || cleanName.length > 80) {
        throw new Error("Informe um nome de equipe de até 80 caracteres.");
      }
      const slugToUse = normalizeTeamSlugClient(teamSlug || suggestTeamSlug(cleanName));
      const cleanBatch = Math.max(1, Math.min(1000, Math.round(Number(teamBatch) || 1)));
      const duplicate = teams.find(
        (t) =>
          t.slug.toLowerCase() === slugToUse.toLowerCase() &&
          (!editingTeam || t.id !== editingTeam.id),
      );
      if (duplicate) {
        throw new Error(`Já existe uma equipe usando a URL /${slugToUse}.`);
      }

      if (editingTeam) {
        setTeams((prev) =>
          prev.map((t) =>
            t.id === editingTeam.id
              ? { ...t, name: cleanName, slug: slugToUse, batch_size: cleanBatch }
              : t,
          ),
        );
        setNotice(`Equipe "${cleanName}" atualizada no rascunho. Clique em "Salvar alterações" para publicar online.`);
      } else {
        const tempTeamId = "temp-team-" + crypto.randomUUID();
        setTeams((prev) => [
          ...prev,
          {
            id: tempTeamId,
            name: cleanName,
            slug: slugToUse,
            batch_size: cleanBatch,
            active: 1,
            created_at: Date.now(),
          },
        ]);
        setNotice(
          `Equipe "${cleanName}" criada (/${slugToUse})! Arraste pelo menos 1 número para ela e clique em "Salvar alterações" para ficar online.`,
        );
      }
      resetTeamForm();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const moveOrReorderAgent = (
    agentId: string,
    targetTeamId: string | null,
    targetAgentId?: string,
    placement: "before" | "after" = "before",
  ) => {
    if (targetAgentId === agentId) return;
    const moving = agents.find((a) => a.id === agentId);
    if (!moving) return;

    const sourceTeamId = moving.team_id || null;
    const isSameColumn = sourceTeamId === targetTeamId;

    // Sem alvo de card na mesma coluna e já sendo o último: nada muda
    const currentDestSorted = sortAgentsByPosition(
      agents.filter((a) => (a.team_id || null) === targetTeamId),
    );
    if (isSameColumn && !targetAgentId && currentDestSorted[currentDestSorted.length - 1]?.id === agentId) {
      return;
    }

    const destWithoutMoving = currentDestSorted.filter((a) => a.id !== agentId);
    let insertIdx = destWithoutMoving.length;
    if (targetAgentId) {
      const idx = destWithoutMoving.findIndex((a) => a.id === targetAgentId);
      if (idx !== -1) {
        insertIdx = placement === "after" ? idx + 1 : idx;
      }
    }

    const updatedDest = [...destWithoutMoving];
    const movedEntry: Agent = { ...moving, team_id: targetTeamId };
    updatedDest.splice(insertIdx, 0, movedEntry);

    let nextPositions = new Map<string, number>();
    if (isSameColumn) {
      const slots = currentDestSorted.map((a) => a.position).sort((x, y) => x - y);
      updatedDest.forEach((a, i) => {
        nextPositions.set(a.id, slots[i] ?? i + 1);
      });
    } else if (!targetAgentId) {
      // Mover para o fim de outra coluna preserva posições dos demais e evita colisão
      const maxPos = agents.reduce((m, a) => Math.max(m, a.position || 0), 0);
      nextPositions.set(agentId, maxPos + 1);
    } else {
      // Inserir em posição específica de outra coluna usa exatamente o pool de posições dessa coluna + o item movido
      const combinedSlots = [...currentDestSorted.map((a) => a.position), moving.position].sort(
        (x, y) => x - y,
      );
      updatedDest.forEach((a, i) => {
        nextPositions.set(a.id, combinedSlots[i] ?? i + 1);
      });
    }

    const nextAgents = sortAgentsByPosition(
      agents.map((a) => {
        if (a.id === agentId) {
          return {
            ...a,
            team_id: targetTeamId,
            position: nextPositions.get(a.id) ?? a.position,
          };
        }
        if (nextPositions.has(a.id)) {
          return { ...a, position: nextPositions.get(a.id)! };
        }
        return a;
      }),
    );

    setError("");
    setAgents(nextAgents);

    const targetName = targetTeamId
      ? teams.find((t) => t.id === targetTeamId)?.name || "equipe"
      : "Site Principal (Geral)";
    const newRank = updatedDest.findIndex((a) => a.id === agentId) + 1;
    if (isSameColumn) {
      setNotice(
        `Ordem em ${targetName} atualizada (${moving.name} agora é ${newRank}º). Clique em "Salvar alterações" para aplicar online.`,
      );
    } else {
      setNotice(
        `${moving.name} movido para ${targetName} (${newRank}º). Clique em "Salvar alterações" para publicar online.`,
      );
    }
  };

  const nudgeAgentOrder = (agentId: string, direction: -1 | 1) => {
    const target = agents.find((a) => a.id === agentId);
    if (!target) return;
    const teamScope = target.team_id || null;
    const colAgents = sortAgentsByPosition(
      agents.filter((a) => (a.team_id || null) === teamScope),
    );
    const idx = colAgents.findIndex((a) => a.id === agentId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= colAgents.length) return;

    const currentAgent = colAgents[idx];
    const neighbor = colAgents[swapIdx];

    const nextAgents = sortAgentsByPosition(
      agents.map((a) => {
        if (a.id === currentAgent.id) return { ...a, position: neighbor.position };
        if (a.id === neighbor.id) return { ...a, position: currentAgent.position };
        return a;
      }),
    );

    setError("");
    setAgents(nextAgents);
    const scopeName = teamScope
      ? teams.find((t) => t.id === teamScope)?.name || "equipe"
      : "Site Principal (Geral)";
    setNotice(
      `Ordem em ${scopeName} atualizada (${target.name} agora é ${swapIdx + 1}º). Clique em "Salvar alterações" para publicar online.`,
    );
  };

  const moveAgentToTeam = (agentId: string, targetTeamId: string | null) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent || (agent.team_id || null) === targetTeamId) return;
    moveOrReorderAgent(agentId, targetTeamId);
  };

  const toggleAgentActive = (agent: Agent) => {
    setError("");
    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, active: a.active ? 0 : 1 } : a)),
    );
    setNotice(
      `Status de ${agent.name} alterado no rascunho. Clique em "Salvar alterações" para publicar online.`,
    );
  };

  const deleteAgentStage = (agent: Agent) => {
    if (
      !confirm(
        `Remover ${agent.name} da distribuição? O histórico anterior será preservado após salvar.`,
      )
    )
      return;
    setError("");
    setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    if (editing?.id === agent.id) reset();
    setNotice(`${agent.name} marcado para remoção. Clique em "Salvar alterações" para confirmar online.`);
  };

  const toggleTeamActive = (t: Team) => {
    setError("");
    setTeams((prev) =>
      prev.map((item) => (item.id === t.id ? { ...item, active: item.active ? 0 : 1 } : item)),
    );
    setNotice(
      `Equipe "${t.name}" alterada no rascunho. Clique em "Salvar alterações" para publicar online.`,
    );
  };

  const deleteTeamStage = (t: Team) => {
    if (
      !confirm(
        `Excluir a equipe "${t.name}"? Os atendentes dela voltarão para o Site Principal.`,
      )
    )
      return;
    setError("");
    setTeams((prev) => prev.filter((item) => item.id !== t.id));
    setAgents((prev) =>
      prev.map((a) => (a.team_id === t.id ? { ...a, team_id: null } : a)),
    );
    if (editingTeam?.id === t.id) resetTeamForm();
    setNotice(`Equipe "${t.name}" removida no rascunho. Clique em "Salvar alterações" para aplicar online.`);
  };

  const updateTeamBatchStage = (teamId: string, nextVal: number) => {
    const cleanVal = Math.max(1, Math.min(1000, Math.round(Number(nextVal) || 1)));
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, batch_size: cleanVal } : t)),
    );
  };

  const discardChanges = () => {
    setError("");
    setBatch(savedSnapshot.batchSize);
    setTeams(savedSnapshot.teams);
    setAgents(savedSnapshot.agents);
    reset();
    resetTeamForm();
    setNotice("Alterações não salvas foram descartadas.");
  };

  const publishAllChanges = () =>
    run(async () => {
      const cleanBatch = Math.max(1, Math.min(1000, Math.round(Number(batch) || 1)));
      const saved = await request("save", "POST", {
        batchSize: cleanBatch,
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          batch_size: Math.max(1, Math.min(1000, Math.round(Number(t.batch_size) || 1))),
          active: !!t.active,
        })),
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          phone: a.phone,
          position: a.position,
          active: !!a.active,
          team_id: a.team_id || null,
        })),
      });
      const [totals] = await Promise.all([request("stats?period=" + period)]);
      applyServerSnapshot({
        batchSize: saved.batchSize,
        agents: saved.agents,
        teams: saved.teams,
      });
      setStats(totals);
      await verifyTeamsOnServer(saved.teams || []);

      const emptyTeams = (saved.teams || []).filter(
        (t: Team) =>
          t.active &&
          !(saved.agents || []).some((a: Agent) => a.active && a.team_id === t.id),
      );
      if (emptyTeams.length > 0) {
        setNotice(
          `Alterações salvas e publicadas online! Atenção: a equipe "${emptyTeams.map((t: Team) => t.name).join('", "')}" ainda está sem atendentes ativos — arraste pelo menos 1 número para ela e salve novamente.`,
        );
      } else {
        setNotice("Todas as alterações foram salvas e confirmadas ONLINE no servidor!");
      }
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

  const handleDragStart = (e: React.DragEvent, agentId: string) => {
    setDraggingAgentId(agentId);
    e.dataTransfer.setData("text/plain", agentId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingAgentId(null);
    setDragOverTarget(null);
    setDragOverCard(null);
  };

  const handleDragOverColumn = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCard) setDragOverCard(null);
    if (dragOverTarget !== targetKey) {
      setDragOverTarget(targetKey);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent, targetTeamId: string | null) => {
    e.preventDefault();
    const droppedAgentId = e.dataTransfer.getData("text/plain") || draggingAgentId;
    setDraggingAgentId(null);
    setDragOverTarget(null);
    setDragOverCard(null);
    if (droppedAgentId) {
      moveOrReorderAgent(droppedAgentId, targetTeamId);
    }
  };

  const handleDragOverCard = (e: React.DragEvent<HTMLDivElement>, targetAgentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingAgentId === targetAgentId) return;
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const placement: "before" | "after" = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    if (dragOverTarget) setDragOverTarget(null);
    if (!dragOverCard || dragOverCard.id !== targetAgentId || dragOverCard.placement !== placement) {
      setDragOverCard({ id: targetAgentId, placement });
    }
  };

  const handleDropOnCard = (
    e: React.DragEvent<HTMLDivElement>,
    targetTeamId: string | null,
    targetAgentId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedAgentId = e.dataTransfer.getData("text/plain") || draggingAgentId;
    const rect = e.currentTarget.getBoundingClientRect();
    const placement: "before" | "after" =
      dragOverCard?.id === targetAgentId
        ? dragOverCard.placement
        : e.clientY < rect.top + rect.height / 2
        ? "before"
        : "after";
    setDraggingAgentId(null);
    setDragOverTarget(null);
    setDragOverCard(null);
    if (droppedAgentId && droppedAgentId !== targetAgentId) {
      moveOrReorderAgent(droppedAgentId, targetTeamId, targetAgentId, placement);
    }
  };

  const renderSaveBar = (bottom = false) => (
    <div
      className={`panel-save-bar ${isDirty ? "is-dirty" : ""} ${bottom ? "panel-save-bar-bottom" : ""}`}
      role="region"
      aria-label="Publicação de alterações"
    >
      <div className="panel-save-status">
        <span className="panel-save-dot" aria-hidden="true" />
        <span>
          {isDirty
            ? "Você tem alterações pendentes — clique em \"Salvar alterações\" para ficar online."
            : error
            ? error
            : notice
            ? notice
            : "Tudo salvo e online no momento."}
        </span>
      </div>
      <div className="panel-save-actions">
        {isDirty && (
          <button type="button" disabled={busy} onClick={discardChanges}>
            Descartar
          </button>
        )}
        <button
          type="button"
          className={`save-online-btn ${isDirty ? "needs-save" : ""}`}
          disabled={busy}
          onClick={publishAllChanges}
        >
          {busy
            ? "Salvando e publicando…"
            : isDirty
            ? "Salvar alterações (Publicar online)"
            : "Salvar alterações"}
        </button>
      </div>
    </div>
  );

  const renderAgentCard = (a: Agent, indexInColumn: number, columnLength: number) => {
    const counts = stats?.agents?.find((v: any) => v.id === a.id);
    const isDragging = draggingAgentId === a.id;
    const isNewUnsaved = a.id.startsWith("temp-");
    const dropIndicator =
      dragOverCard?.id === a.id
        ? dragOverCard.placement === "before"
          ? "drop-before"
          : "drop-after"
        : "";
    return (
      <div
        key={a.id}
        draggable
        onDragStart={(e) => handleDragStart(e, a.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOverCard(e, a.id)}
        onDrop={(e) => handleDropOnCard(e, a.team_id || null, a.id)}
        className={`team-agent-card ${isDragging ? "dragging" : ""} ${dropIndicator}`}
        title="Arraste para cima/baixo para mudar a ordem ou arraste para outra equipe"
      >
        <div className="team-agent-top">
          <div className="team-agent-info">
            <span className="drag-grip" aria-hidden="true">⋮⋮</span>
            <span
              className={`agent-order-badge ${indexInColumn === 0 ? "is-first" : ""}`}
              title={`${indexInColumn + 1}º na ordem de atendimento desta coluna`}
            >
              {indexInColumn + 1}º
            </span>
            <div>
              <div className="team-agent-name">
                {a.name}
                {isNewUnsaved && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: "#fbbf24" }}>
                    (Novo — salve)
                  </span>
                )}
              </div>
              <div className="team-agent-phone">{formatDisplayPhone(a.phone)}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div className="team-order-buttons">
              <button
                type="button"
                className="order-step-btn"
                disabled={indexInColumn === 0}
                onClick={() => nudgeAgentOrder(a.id, -1)}
                title="Subir na ordem (atender antes)"
                aria-label={`Subir ${a.name} na ordem`}
              >
                ↑
              </button>
              <button
                type="button"
                className="order-step-btn"
                disabled={indexInColumn === columnLength - 1}
                onClick={() => nudgeAgentOrder(a.id, 1)}
                title="Descer na ordem (atender depois)"
                aria-label={`Descer ${a.name} na ordem`}
              >
                ↓
              </button>
            </div>
            <span className={a.active ? "active" : "paused"} style={{ fontSize: "11px", fontWeight: 700 }}>
              {a.active ? "Ativo" : "Pausado"}
            </span>
          </div>
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
            onClick={() => toggleAgentActive(a)}
          >
            {a.active ? "Pausar" : "Ativar"}
          </button>
        </div>
      </div>
    );
  };

  const sortedAgents = sortAgentsByPosition(agents);
  const generalAgents = sortedAgents.filter((a) => !a.team_id);
  const generalActiveCount = generalAgents.filter((a) => a.active).length;

  return (
    <main className="attendant-panel">
      <div className="panel-wrap">
        <header className="panel-heading">
          <div>
            <div className="panel-brand">
              ZM <span>SCD</span>
            </div>
            <h1>Painel de atendentes e equipes</h1>
            <p>Organize números por setor, arraste entre equipes e clique em Salvar alterações para publicar online</p>
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
            {renderSaveBar(false)}

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
                    Organize as equipes abaixo, arraste os números desejados e clique em <strong>Salvar alterações</strong> para publicar online:
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
                    Cada equipe criada tem sua própria URL de campanha. O cliente gira <strong>somente</strong> entre os atendentes ativos daquela equipe.
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
                  <h2>Organizador de Equipes e Setores (Arrastar e Reordenar)</h2>
                  <p>
                    Crie equipes com URLs próprias, arraste os números entre colunas ou mude a ordem de atendimento (<strong>1º, 2º, 3º…</strong> com arrastar ou <strong>↑ ↓</strong>) e clique em <strong>Salvar alterações</strong>.
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
                  stageSaveTeam();
                }}
              >
                <label>
                  {editingTeam ? "Editar nome da equipe" : "Nova equipe / setor"}
                  <input
                    placeholder="Ex: Equipe 2, Consignado, Setor PJ"
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
                  URL da equipe ({origin}/{teamSlug || "equipe2"})
                  <input
                    placeholder="equipe2"
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
                <button className="primary">
                  {editingTeam ? "Atualizar equipe" : "Criar equipe"}
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
                      <span className={`team-status-pill ${generalActiveCount > 0 ? "online" : "empty"}`}>
                        {generalActiveCount > 0
                          ? `Online (${generalActiveCount} ativo${generalActiveCount > 1 ? "s" : ""})`
                          : "Sem atendentes"}
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

                    <div className="team-toolbar">
                      <span>Lote: {batch} clique(s) por atendente</span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input
                          type="number"
                          aria-label="Cliques por atendente no Site Principal"
                          min={1}
                          max={1000}
                          value={batch}
                          onChange={(e) => setBatch(Number(e.target.value))}
                          style={{ width: "74px", padding: "4px 6px", fontSize: "11px" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="team-agents-list">
                    {generalAgents.length === 0 ? (
                      <div className="team-empty-drop">
                        Arraste números para cá para fazê-los girar no Site Principal ({origin}/)
                      </div>
                    ) : (
                      generalAgents.map((a, idx) => renderAgentCard(a, idx, generalAgents.length))
                    )}
                  </div>
                </div>

                {/* Colunas Dinâmicas: Equipes Criadas */}
                {teams.map((t) => {
                  const teamAgents = sortedAgents.filter((a) => a.team_id === t.id);
                  const teamActiveCount = teamAgents.filter((a) => a.active).length;
                  const savedT = savedTeamMap.get(t.id);
                  const isTeamSavedOnServer = !!savedT && savedT.slug === t.slug;
                  const prevTeamKey = sortAgentsByPosition(
                    savedSnapshot.agents.filter((sa) => sa.team_id === t.id),
                  )
                    .map((sa) => `${sa.id}:${sa.active}:${sa.position}`)
                    .join("|");
                  const currTeamKey = teamAgents
                    .map((a) => `${a.id}:${a.active}:${a.position}`)
                    .join("|");
                  const isTeamUnsaved =
                    !savedT ||
                    savedT.slug !== t.slug ||
                    savedT.name !== t.name ||
                    savedT.batch_size !== t.batch_size ||
                    savedT.active !== t.active ||
                    prevTeamKey !== currTeamKey;
                  const teamUrl = `${origin}/${t.slug}`;
                  const isCopied = copiedLink === `team-${t.id}`;

                  let statusLabel = "";
                  let statusClass = "online";
                  const serverStatus = verifiedTeams[t.id];
                  if (isTeamUnsaved) {
                    statusLabel = "Pendente — clique em Salvar";
                    statusClass = "pending";
                  } else if (!t.active) {
                    statusLabel = "Pausada";
                    statusClass = "paused";
                  } else if (teamActiveCount === 0) {
                    statusLabel = "Sem atendentes";
                    statusClass = "empty";
                  } else {
                    statusLabel = serverStatus?.online
                      ? `Online e confirmada (${teamActiveCount} ativo${teamActiveCount > 1 ? "s" : ""})`
                      : `Online (${teamActiveCount} ativo${teamActiveCount > 1 ? "s" : ""})`;
                    statusClass = "online";
                  }

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
                          <span className={`team-status-pill ${statusClass}`}>
                            {statusLabel}
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
                            {isTeamSavedOnServer ? (
                              <a
                                href={`/${t.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="campaign-btn"
                                style={{ textDecoration: "none" }}
                              >
                                Abrir ↗
                              </a>
                            ) : (
                              <button
                                type="button"
                                className="campaign-btn"
                                onClick={() =>
                                  setError(
                                    `Clique primeiro em "Salvar alterações" para publicar ${teamUrl} online.`,
                                  )
                                }
                              >
                                Salve p/ abrir
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="team-toolbar">
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>Lote:</span>
                            <input
                              type="number"
                              aria-label={`Cliques por atendente na ${t.name}`}
                              min={1}
                              max={1000}
                              value={t.batch_size}
                              onChange={(e) => updateTeamBatchStage(t.id, Number(e.target.value))}
                              style={{ width: "68px", padding: "4px 6px", fontSize: "11px" }}
                            />
                          </div>
                          <div className="team-toolbar-actions">
                            <button
                              type="button"
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
                              onClick={() => toggleTeamActive(t)}
                            >
                              {t.active ? "Pausar" : "Ativar"}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => deleteTeamStage(t)}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="team-agents-list">
                        {teamAgents.length === 0 ? (
                          <div className="team-empty-drop">
                            Arraste pelo menos 1 número para cá para ativar {origin}/{t.slug}
                          </div>
                        ) : (
                          teamAgents.map((a, idx) => renderAgentCard(a, idx, teamAgents.length))
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
                  stageSaveAgent();
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
                <button className="primary">
                  {editing ? "Aplicar no rascunho" : "Adicionar atendente"}
                </button>
                {editing && (
                  <button type="button" onClick={reset}>
                    Cancelar
                  </button>
                )}
              </form>
            </section>

            {renderSaveBar(true)}

            {/* TABELA GERAL DE ATENDENTES E LINKS INDIVIDUAIS */}
            <section className="panel-card">
              <div className="panel-row">
                <h2>Todos os atendentes e links individuais</h2>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const totals = await request("stats?period=" + period);
                      setStats(totals);
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
                      {sortedAgents.map((a) => {
                        const counts = stats?.agents?.find(
                          (v: any) => v.id === a.id,
                        );
                        const teamObj = a.team_id
                          ? teams.find((t) => t.id === a.team_id)
                          : null;
                        const scopeRank =
                          sortedAgents
                            .filter((x) => (x.team_id || null) === (a.team_id || null))
                            .findIndex((x) => x.id === a.id) + 1;
                        const campaignUrl = `${origin}/atendimento${a.position}`;
                        const isCopied = copiedLink === a.id;
                        return (
                          <tr key={a.id}>
                            <td>
                              <strong>{scopeRank}º</strong>
                              <small>ID #{a.position}</small>
                            </td>
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
                                  type="button"
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
                                  onClick={() => toggleAgentActive(a)}
                                >
                                  {a.active ? "Pausar" : "Ativar"}
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => deleteAgentStage(a)}
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
                Qualquer alteração feita acima (criar equipe, arrastar número, pausar ou editar) precisa clicar em <strong>Salvar alterações</strong> para entrar no ar.
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
