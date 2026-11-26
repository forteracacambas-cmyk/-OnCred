import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type SyncMode = "independent" | "general_same" | "general_reverse";

type Team = {
  id: string;
  slug: string;
  name: string;
  batch_size: number;
  active: number;
  sync_mode?: SyncMode;
  created_at?: number;
};

type Snapshot = {
  batchSize: number;
  teams: Team[];
  agents: Agent[];
};

type QueuePreview = {
  activeCount: number;
  batchSize: number;
  maxToday: number;
  receivingNow: {
    id: string;
    name: string;
    phone: string;
    todayCount: number;
    usedInBatch: number;
    batchSize: number;
    remainingToSwitch: number | null;
    equalizing: boolean;
    missingToEqualize: number;
  } | null;
  nextUp: {
    id: string;
    name: string;
    todayCount: number;
    equalizing: boolean;
    missingToEqualize: number;
  } | null;
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

function suggestDuplicateTeamInfo(sourceTeam: Team | null, existingTeams: Team[]) {
  const takenSlugs = new Set(existingTeams.map((t) => t.slug.toLowerCase()));
  const takenNames = new Set(existingTeams.map((t) => t.name.trim().toLowerCase()));

  if (!sourceTeam) {
    let n = 2;
    while (
      takenSlugs.has(`equipe${n}`) ||
      takenNames.has(`equipe ${n}`) ||
      RESERVED_TEAM_SLUGS.has(`equipe${n}`)
    ) {
      n++;
    }
    return { name: `Equipe ${n}`, slug: `equipe${n}` };
  }

  const slugMatch = sourceTeam.slug.match(/^(.*?)(\d+)$/);
  const nameMatch = sourceTeam.name.trim().match(/^(.*?)(\d+)$/);
  let n = slugMatch ? Number(slugMatch[2]) + 1 : 2;
  while (true) {
    const candidateSlug = (
      slugMatch ? `${slugMatch[1]}${n}` : `${sourceTeam.slug.slice(0, 44)}-${n}`
    )
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 49);
    const candidateName = (
      nameMatch ? `${nameMatch[1]}${n}` : `${sourceTeam.name.trim()} ${n}`
    ).slice(0, 80);
    if (
      candidateSlug &&
      !takenSlugs.has(candidateSlug) &&
      !RESERVED_TEAM_SLUGS.has(candidateSlug) &&
      !takenNames.has(candidateName.toLowerCase())
    ) {
      return { name: candidateName, slug: candidateSlug };
    }
    n++;
  }
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
      sync_mode: t.sync_mode || "independent",
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
    [authed, setAuthed] = useState(false),
    [authChecked, setAuthChecked] = useState(false),
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
    [verifiedTeams, setVerifiedTeams] = useState<Record<string, { online: boolean; agentCount: number }>>({}),
    [autoRefresh, setAutoRefresh] = useState(true),
    [refreshingStats, setRefreshingStats] = useState(false),
    [lastStatsAt, setLastStatsAt] = useState<number | null>(null);

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
    [teamBatch, setTeamBatch] = useState(1),
    [teamSyncMode, setTeamSyncMode] = useState<SyncMode>("independent");

  // Drag-and-drop state
  const [draggingAgentId, setDraggingAgentId] = useState<string | null>(null),
    [dragOverTarget, setDragOverTarget] = useState<string | null>(null),
    [dragOverCard, setDragOverCard] = useState<{ id: string; placement: "before" | "after" } | null>(null);

  const refreshInFlightRef = useRef(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://zmscd.online";

  const isDirty = useMemo(() => {
    return (
      serializeSnapshot(batch, teams, agents) !==
      serializeSnapshot(savedSnapshot.batchSize, savedSnapshot.teams, savedSnapshot.agents)
    );
  }, [batch, teams, agents, savedSnapshot]);

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const savedTeamMap = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of savedSnapshot.teams) map.set(t.id, t);
    return map;
  }, [savedSnapshot.teams]);

  const phoneScopeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of agents) {
      counts.set(a.phone, (counts.get(a.phone) || 0) + 1);
    }
    return counts;
  }, [agents]);

  const copyLink = (url: string, id: string) => {
    try {
      navigator.clipboard.writeText(url);
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2500);
    } catch {
      // fallback
    }
  };

  const request = useCallback(async (path: string, method = "GET", data?: unknown) => {
    try {
      return await api("admin/" + path, method, data, tokenRef.current || undefined);
    } catch (e: any) {
      if (e.status === 401) {
        setToken("");
        setAuthed(false);
        setStats(null);
        setAgents([]);
        setTeams([]);
      }
      throw e;
    }
  }, []);

  const sortAgentsByPosition = (list: Agent[]) =>
    [...list].sort((a, b) => (a.position - b.position) || a.id.localeCompare(b.id));

  const applyServerSnapshot = (config: { batchSize: number; agents: Agent[]; teams: Team[] }) => {
    const loadedAgents = sortAgentsByPosition(config.agents || []);
    const loadedTeams = (config.teams || []).map((t) => ({
      ...t,
      sync_mode: (t.sync_mode || "independent") as SyncMode,
    }));
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
    setLastStatsAt(Date.now());
    verifyTeamsOnServer(config.teams || []).catch(() => {});
  };

  const refreshLiveStats = useCallback(
    async (manual = false) => {
      if (!authed || refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      setRefreshingStats(true);
      try {
        if (manual && !isDirtyRef.current) {
          const [config, totals] = await Promise.all([
            request("config"),
            request("stats?period=" + period),
          ]);
          if (!isDirtyRef.current) {
            applyServerSnapshot(config);
          }
          setStats(totals);
          setLastStatsAt(Date.now());
          verifyTeamsOnServer(config.teams || []).catch(() => {});
          setNotice("Contadores e fila atualizados em tempo real.");
        } else {
          const totals = await request("stats?period=" + period);
          setStats(totals);
          setLastStatsAt(Date.now());
          if (manual) {
            setNotice("Contadores ao vivo atualizados (seu rascunho não salvo foi preservado).");
          }
        }
      } catch (e: any) {
        if (manual) setError(e.message);
      } finally {
        refreshInFlightRef.current = false;
        setRefreshingStats(false);
      }
    },
    [authed, period, request],
  );

  useEffect(() => {
    document.title = "Painel de atendentes | ZM SCD";
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute("content", "noindex,nofollow");
  }, []);

  useEffect(() => {
    let alive = true;
    api("admin/config", "GET")
      .then(async (config) => {
        if (!alive) return;
        applyServerSnapshot(config);
        setAuthed(true);
        const totals = await api("admin/stats?period=" + period, "GET");
        if (!alive) return;
        setStats(totals);
        setLastStatsAt(Date.now());
        verifyTeamsOnServer(config.teams || []).catch(() => {});
      })
      .catch((e: any) => {
        if (!alive) return;
        if (e?.status && e.status !== 401) {
          setError(e.message || "Erro ao verificar sessão.");
        }
        setAuthed(false);
      })
      .finally(() => {
        if (alive) setAuthChecked(true);
      });
    return () => {
      alive = false;
    };
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
    if (!authed) return;
    let alive = true;
    request("stats?period=" + period)
      .then((s) => {
        if (alive) {
          setStats(s);
          setLastStatsAt(Date.now());
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
  }, [authed, period, request]);

  useEffect(() => {
    if (!authed || !autoRefresh) return;
    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refreshLiveStats(false);
    }, 5000);
    const onVis = () => {
      if (!document.hidden) refreshLiveStats(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [authed, autoRefresh, refreshLiveStats]);

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
    setTeamSyncMode("independent");
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
      const targetTeam = agentTeamId || null;
      const duplicate = agents.find(
        (a) =>
          a.phone === normalizedPhone &&
          (a.team_id || null) === targetTeam &&
          (!editing || a.id !== editing.id),
      );
      if (duplicate) {
        const scopeLabel = targetTeam
          ? teams.find((t) => t.id === targetTeam)?.name || "mesma equipe"
          : "Site Principal";
        throw new Error(
          `Esse telefone já está cadastrado em "${scopeLabel}" (${duplicate.name}). Você pode usar o mesmo número em outra equipe ou duplicar a coluna.`,
        );
      }
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

      const migrateTeamAgentsToGeneral = (tid: string) => {
        setAgents((prev) => {
          const generalPhones = new Set(prev.filter((a) => !a.team_id).map((a) => a.phone));
          const result: Agent[] = [];
          for (const a of prev) {
            if (a.team_id !== tid) {
              result.push(a);
              continue;
            }
            if (generalPhones.has(a.phone)) continue;
            generalPhones.add(a.phone);
            result.push({ ...a, team_id: null });
          }
          return sortAgentsByPosition(result);
        });
      };

      if (editingTeam) {
        if (teamSyncMode !== "independent") {
          migrateTeamAgentsToGeneral(editingTeam.id);
        }
        setTeams((prev) =>
          prev.map((t) =>
            t.id === editingTeam.id
              ? { ...t, name: cleanName, slug: slugToUse, batch_size: cleanBatch, sync_mode: teamSyncMode }
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
            sync_mode: teamSyncMode,
            created_at: Date.now(),
          },
        ]);
        setNotice(
          teamSyncMode === "independent"
            ? `Equipe "${cleanName}" criada (/${slugToUse})! Arraste pelo menos 1 número para ela e clique em "Salvar alterações" para ficar online.`
            : `Equipe "${cleanName}" criada (/${slugToUse}) espelhando o Site Principal! Clique em "Salvar alterações" para ficar online.`,
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

    if (targetTeamId) {
      const destTeam = teams.find((t) => t.id === targetTeamId);
      if (destTeam && (destTeam.sync_mode === "general_same" || destTeam.sync_mode === "general_reverse")) {
        setError(
          `A equipe "${destTeam.name}" espelha o Site Principal automaticamente — arraste, pause ou adicione no Site Principal e ela acompanha.`,
        );
        return;
      }
    }

    const sourceTeamId = moving.team_id || null;
    const isSameColumn = sourceTeamId === targetTeamId;

    if (!isSameColumn) {
      const phoneConflict = agents.find(
        (a) =>
          (a.team_id || null) === targetTeamId &&
          a.phone === moving.phone &&
          a.id !== agentId,
      );
      if (phoneConflict) {
        const destName = targetTeamId
          ? teams.find((t) => t.id === targetTeamId)?.name || "essa equipe"
          : "Site Principal (Geral)";
        setError(
          `O número ${formatDisplayPhone(moving.phone)} já está em "${destName}". Para usar o mesmo WhatsApp nos dois links, mantenha uma cópia em cada coluna.`,
        );
        return;
      }
    }

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

  const copyAgentToTeam = (agentId: string, targetTeamId: string | null) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    const existsInTarget = agents.some(
      (a) => (a.team_id || null) === targetTeamId && a.phone === agent.phone,
    );
    const destName = targetTeamId
      ? teams.find((t) => t.id === targetTeamId)?.name || "equipe"
      : "Site Principal (Geral)";
    if (existsInTarget) {
      setError(`O número ${formatDisplayPhone(agent.phone)} já está em "${destName}".`);
      return;
    }
    const maxPos = agents.reduce((m, a) => Math.max(m, a.position || 0), 0);
    const cloned: Agent = {
      id: "temp-agent-" + crypto.randomUUID(),
      name: agent.name,
      phone: agent.phone,
      position: maxPos + 1,
      active: agent.active,
      deleted: 0,
      team_id: targetTeamId,
    };
    setError("");
    setAgents((prev) => sortAgentsByPosition([...prev, cloned]));
    setNotice(
      `${agent.name} copiado para ${destName}! Você pode mudar a ordem dele lá e clicar em "Salvar alterações" para publicar online.`,
    );
  };

  const duplicateColumnAsTeam = (sourceTeamId: string | null, syncMode: SyncMode = "independent") => {
    const sourceTeam = sourceTeamId ? teams.find((t) => t.id === sourceTeamId) || null : null;
    const { name: nextName, slug: nextSlug } = suggestDuplicateTeamInfo(sourceTeam, teams);
    const isMirrored = syncMode === "general_same" || syncMode === "general_reverse";
    const sourceAgents = isMirrored
      ? []
      : sortAgentsByPosition(agents.filter((a) => (a.team_id || null) === sourceTeamId));
    const newTeamId = "temp-team-" + crypto.randomUUID();
    const newTeam: Team = {
      id: newTeamId,
      name: nextName,
      slug: nextSlug,
      batch_size: sourceTeam ? sourceTeam.batch_size : Math.max(1, Math.min(1000, Math.round(Number(batch) || 1))),
      active: 1,
      sync_mode: syncMode,
      created_at: Date.now(),
    };
    let nextPos = agents.reduce((m, a) => Math.max(m, a.position || 0), 0);
    const clonedAgents: Agent[] = sourceAgents.map((src) => ({
      id: "temp-agent-" + crypto.randomUUID(),
      name: src.name,
      phone: src.phone,
      position: ++nextPos,
      active: src.active,
      deleted: 0,
      team_id: newTeamId,
    }));

    setError("");
    setTeams((prev) => [...prev, newTeam]);
    if (clonedAgents.length > 0) {
      setAgents((prev) => sortAgentsByPosition([...prev, ...clonedAgents]));
    }
    setNotice(
      isMirrored
        ? `Link espelhado "${newTeam.name}" (/${newTeam.slug}) criado! Tudo que entrar, sair ou pausar no Site Principal acompanha automaticamente aqui${syncMode === "general_reverse" ? " de trás pra frente" : ""}. Clique em "Salvar alterações" para publicar.`
        : `Link "${newTeam.name}" (/${newTeam.slug}) duplicado com ${clonedAgents.length} número(s)! Organize a ordem com arrastar ou ↑ ↓, ajuste a URL em "Editar" se quiser e clique em "Salvar alterações".`,
    );
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
        `Remover ${agent.name} desta equipe/distribuição? O histórico anterior será preservado após salvar.`,
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
        `Excluir a equipe "${t.name}"? Números exclusivos dela voltarão para o Site Principal; cópias que já existem no Site Principal serão apenas removidas desta equipe.`,
      )
    )
      return;
    setError("");
    setTeams((prev) => prev.filter((item) => item.id !== t.id));
    setAgents((prev) => {
      const generalPhones = new Set(
        prev.filter((a) => !a.team_id).map((a) => a.phone),
      );
      const result: Agent[] = [];
      for (const a of prev) {
        if (a.team_id !== t.id) {
          result.push(a);
          continue;
        }
        if (generalPhones.has(a.phone)) {
          continue;
        }
        generalPhones.add(a.phone);
        result.push({ ...a, team_id: null });
      }
      return result;
    });
    if (editingTeam?.id === t.id) resetTeamForm();
    setNotice(`Equipe "${t.name}" removida no rascunho. Clique em "Salvar alterações" para aplicar online.`);
  };

  const updateTeamBatchStage = (teamId: string, nextVal: number) => {
    const cleanVal = Math.max(1, Math.min(1000, Math.round(Number(nextVal) || 1)));
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, batch_size: cleanVal } : t)),
    );
  };

  const updateTeamSyncModeStage = (teamId: string, nextMode: SyncMode) => {
    const target = teams.find((t) => t.id === teamId);
    if (!target || (target.sync_mode || "independent") === nextMode) return;
    setError("");
    if (nextMode !== "independent") {
      setAgents((prev) => {
        const generalPhones = new Set(prev.filter((a) => !a.team_id).map((a) => a.phone));
        const result: Agent[] = [];
        for (const a of prev) {
          if (a.team_id !== teamId) {
            result.push(a);
            continue;
          }
          if (generalPhones.has(a.phone)) continue;
          generalPhones.add(a.phone);
          result.push({ ...a, team_id: null });
        }
        return sortAgentsByPosition(result);
      });
    }
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, sync_mode: nextMode } : t)),
    );
    setNotice(
      nextMode === "independent"
        ? `Equipe "${target.name}" mudou para lista própria. Arraste números para ela e clique em "Salvar alterações".`
        : `Equipe "${target.name}" agora espelha o Site Principal (${nextMode === "general_reverse" ? "de trás pra frente" : "mesma ordem"})! Novos números e pausas no Site Principal serão refletidos automaticamente. Clique em "Salvar alterações" para aplicar online.`,
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
          sync_mode: t.sync_mode || "independent",
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
      applyServerSnapshot({
        batchSize: saved.batchSize,
        agents: saved.agents,
        teams: saved.teams,
      });
      const [totals] = await Promise.all([request("stats?period=" + period)]);
      setStats(totals);
      setLastStatsAt(Date.now());
      await verifyTeamsOnServer(saved.teams || []);

      const hasGeneralActive = (saved.agents || []).some((a: Agent) => a.active && !a.team_id);
      const emptyTeams = (saved.teams || []).filter((t: Team) => {
        if (!t.active) return false;
        const isMirrored = t.sync_mode === "general_same" || t.sync_mode === "general_reverse";
        return isMirrored
          ? !hasGeneralActive
          : !(saved.agents || []).some((a: Agent) => a.active && a.team_id === t.id);
      });
      if (emptyTeams.length > 0) {
        setNotice(
          `Alterações salvas e publicadas online! Atenção: a equipe "${emptyTeams.map((t: Team) => t.name).join('", "')}" ainda está sem atendentes ativos — adicione ou ative pelo menos 1 número e salve novamente.`,
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

  const formattedLastSync = useMemo(() => {
    if (!lastStatsAt) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(lastStatsAt);
  }, [lastStatsAt]);

  const renderLiveControls = () => (
    <div className="panel-live-controls">
      <button
        type="button"
        className="refresh-live-btn"
        disabled={refreshingStats || busy}
        onClick={() => refreshLiveStats(true)}
        title="Atualizar contadores e quem está na vez agora"
      >
        {refreshingStats ? "Atualizando…" : "↻ Atualizar agora"}
      </button>
      <label className="live-toggle-label">
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
        />
        <span>Tempo real (5s)</span>
      </label>
      {formattedLastSync && (
        <span className="live-updated-at">Atualizado às {formattedLastSync}</span>
      )}
    </div>
  );

  const renderColumnQueueStatus = (
    queueInfo: QueuePreview | undefined,
    isColumnUnsaved: boolean,
  ) => {
    if (!queueInfo || !queueInfo.receivingNow) return null;
    const nowInfo = queueInfo.receivingNow;
    const nextInfo = queueInfo.nextUp;
    return (
      <div className={`team-queue-live ${nowInfo.equalizing ? "is-equalizing" : ""}`}>
        <div className="team-queue-row">
          <span className={`queue-pill ${nowInfo.equalizing ? "equalizing" : "now"}`}>
            {nowInfo.equalizing ? "⚡ Equalizando" : "● Chegando agora"}
          </span>
          <strong className="queue-agent-name">{nowInfo.name}</strong>
          <span className="queue-today-chip">Hoje: {nowInfo.todayCount}</span>
        </div>
        <div className="team-queue-subrow">
          <span>
            {nowInfo.equalizing
              ? `Faltam ${nowInfo.missingToEqualize} para igualar em ${queueInfo.maxToday} (lote ${nowInfo.usedInBatch}/${nowInfo.batchSize})`
              : nowInfo.batchSize > 1
              ? `Lote ${nowInfo.usedInBatch}/${nowInfo.batchSize} · faltam ${nowInfo.remainingToSwitch ?? nowInfo.batchSize} p/ trocar`
              : "Rodízio 1 por vez"}
          </span>
          <span className="queue-next-label">
            {nextInfo ? (
              <>
                Próximo: <strong>{nextInfo.name}</strong> (Hoje: {nextInfo.todayCount})
              </>
            ) : (
              "Único ativo na fila"
            )}
          </span>
        </div>
        {(isColumnUnsaved || isDirty) && (
          <div className="queue-unsaved-hint">
            Prévia ao vivo do que está publicado online — salve se editou a ordem.
          </div>
        )}
      </div>
    );
  };

  const renderAgentCard = (
    a: Agent,
    indexInColumn: number,
    columnLength: number,
    queueInfo?: QueuePreview,
  ) => {
    const counts = stats?.agents?.find((v: any) => v.id === a.id);
    const todayTotal = counts?.today_deliveries ?? counts?.deliveries ?? 0;
    const isReceivingNow = queueInfo?.receivingNow?.id === a.id;
    const isNextUp = !isReceivingNow && queueInfo?.nextUp?.id === a.id;
    const isDragging = draggingAgentId === a.id;
    const isNewUnsaved = a.id.startsWith("temp-");
    const shareCount = phoneScopeCounts.get(a.phone) || 1;
    const copyTargets = [
      ...((a.team_id || null) !== null &&
      !agents.some((x) => !x.team_id && x.phone === a.phone)
        ? [{ id: "__general__", label: "Site Principal (/)" }]
        : []),
      ...teams
        .filter(
          (t) =>
            (!t.sync_mode || t.sync_mode === "independent") &&
            t.id !== (a.team_id || null) &&
            !agents.some((x) => x.team_id === t.id && x.phone === a.phone),
        )
        .map((t) => ({ id: t.id, label: `${t.name} (/${t.slug})` })),
    ];
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
        className={`team-agent-card ${isDragging ? "dragging" : ""} ${dropIndicator} ${isReceivingNow ? "is-receiving-now" : isNextUp ? "is-next-up" : ""}`}
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
                {isReceivingNow && queueInfo?.receivingNow && (
                  <span className={`queue-badge ${queueInfo.receivingNow.equalizing ? "equalizing" : "now"}`}>
                    {queueInfo.receivingNow.equalizing
                      ? `⚡ Equalizando (faltam ${queueInfo.receivingNow.missingToEqualize})`
                      : queueInfo.batchSize > 1
                      ? `● Chegando (${queueInfo.receivingNow.usedInBatch}/${queueInfo.batchSize})`
                      : "● Chegando agora"}
                  </span>
                )}
                {isNextUp && (
                  <span className="queue-badge next">
                    → Próximo
                  </span>
                )}
                {shareCount > 1 && (
                  <span
                    className="shared-phone-badge"
                    title={`Este WhatsApp está ativo em ${shareCount} links diferentes com ordens independentes`}
                  >
                    Em {shareCount} links
                  </span>
                )}
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
          <span>
            Hoje: <strong>{todayTotal}</strong> · {counts?.new_clients ?? 0} atend. · {counts?.deliveries ?? 0} encam.
          </span>
          <span>Link: <code>/atendimento{a.position}</code></span>
        </div>

        <div className="team-agent-controls">
          <select
            aria-label={`Mover ${a.name} para equipe`}
            value={a.team_id || ""}
            onChange={(e) => moveAgentToTeam(a.id, e.target.value || null)}
          >
            <option value="">Site Principal (/)</option>
            {teams
              .filter((t) => !t.sync_mode || t.sync_mode === "independent" || t.id === a.team_id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  Equipe: {t.name} (/{t.slug})
                </option>
              ))}
          </select>
          {copyTargets.length > 0 && (
            <select
              className="copy-team-select"
              aria-label={`Copiar ${a.name} para outra equipe`}
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                copyAgentToTeam(a.id, val === "__general__" ? null : val);
              }}
              title="Mantém este número aqui e cria uma cópia em outra equipe para organizar separado"
            >
              <option value="" disabled>
                + Copiar p/ equipe…
              </option>
              {copyTargets.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  Copiar para {ct.label}
                </option>
              ))}
            </select>
          )}
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
  const generalQueue: QueuePreview | undefined = stats?.queues?.general;

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
          {authed && (
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
                    setAuthed(false);
                    setStats(null);
                    setAgents([]);
                    setTeams([]);
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

        {!authChecked ? (
          <div className="panel-card panel-login">
            <h2>Verificando acesso…</h2>
            <p>Conferindo se já existe sessão salva neste navegador.</p>
          </div>
        ) : !authed ? (
          <form
            className="panel-card panel-login"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const data = await api("login", "POST", { password });
                setPassword("");
                tokenRef.current = data.token || "";
                setToken(data.token || "");
                setAuthed(true);
                const [config, totals] = await Promise.all([
                  api("admin/config", "GET", undefined, data.token || undefined),
                  api("admin/stats?period=" + period, "GET", undefined, data.token || undefined),
                ]);
                applyServerSnapshot(config);
                setStats(totals);
                setLastStatsAt(Date.now());
                verifyTeamsOnServer(config.teams || []).catch(() => {});
              });
            }}
          >
            <h2>Acesso restrito</h2>
            <p>
              Informe a senha para entrar. Sua sessão ficará salva neste navegador
              até você clicar em Sair.
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
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                {renderLiveControls()}
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
                  <h2>Organizador de Equipes e Setores (Arrastar, Reordenar e Duplicar)</h2>
                  <p>
                    Crie equipes com URLs próprias, use os mesmos números em mais de um link (clicando em <strong>Duplicar</strong> ou <strong>+ Copiar p/ equipe</strong>), arraste ou use <strong>↑ ↓</strong> para definir quem é <strong>1º, 2º, 3º…</strong> em cada URL e clique em <strong>Salvar alterações</strong>. <strong>Equalização automática (leitura do dia):</strong> mesmo em rodízio de 10 em 10, se você ativar ou adicionar um número com menos fichas hoje do que os outros, o sistema completa a diferença primeiro até igualar e depois retoma a ordem normal.
                  </p>
                </div>
                {renderLiveControls()}
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
                <label style={{ maxWidth: "140px" }}>
                  Cliques por atendente
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={teamBatch}
                    onChange={(e) => setTeamBatch(Number(e.target.value))}
                  />
                </label>
                <label>
                  Origem dos números
                  <select
                    value={teamSyncMode}
                    onChange={(e) => setTeamSyncMode(e.target.value as SyncMode)}
                  >
                    <option value="independent">Lista própria (manual)</option>
                    <option value="general_reverse">Espelhar Site Principal (de trás pra frente)</option>
                    <option value="general_same">Espelhar Site Principal (mesma ordem)</option>
                  </select>
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
                      <div className="team-toolbar-actions" style={{ alignItems: "center" }}>
                        <input
                          type="number"
                          aria-label="Cliques por atendente no Site Principal"
                          min={1}
                          max={1000}
                          value={batch}
                          onChange={(e) => setBatch(Number(e.target.value))}
                          style={{ width: "74px", padding: "4px 6px", fontSize: "11px" }}
                        />
                        <button
                          type="button"
                          className="duplicate-team-btn"
                          onClick={() => duplicateColumnAsTeam(null, "independent")}
                          title="Cria uma nova URL de equipe com cópias independentes destes números"
                        >
                          Duplicar link
                        </button>
                        <button
                          type="button"
                          className="mirror-team-btn"
                          onClick={() => duplicateColumnAsTeam(null, "general_reverse")}
                          title="Cria uma equipe espelhada de trás pra frente que acompanha automaticamente novos números e pausas do Site Principal"
                        >
                          Espelhar invertido
                        </button>
                      </div>
                    </div>

                    {renderColumnQueueStatus(generalQueue, false)}
                  </div>

                  <div className="team-agents-list">
                    {generalAgents.length === 0 ? (
                      <div className="team-empty-drop">
                        Arraste números para cá para fazê-los girar no Site Principal ({origin}/)
                      </div>
                    ) : (
                      generalAgents.map((a, idx) =>
                        renderAgentCard(a, idx, generalAgents.length, generalQueue),
                      )
                    )}
                  </div>
                </div>

                {/* Colunas Dinâmicas: Equipes Criadas */}
                {teams.map((t) => {
                  const syncMode: SyncMode = t.sync_mode || "independent";
                  const isMirrored = syncMode === "general_same" || syncMode === "general_reverse";
                  const rawTeamAgents = sortedAgents.filter((a) => a.team_id === t.id);
                  const displayAgents =
                    syncMode === "general_reverse"
                      ? [...generalAgents].reverse()
                      : syncMode === "general_same"
                      ? generalAgents
                      : rawTeamAgents;
                  const teamActiveCount = isMirrored
                    ? generalActiveCount
                    : rawTeamAgents.filter((a) => a.active).length;

                  const savedT = savedTeamMap.get(t.id);
                  const isTeamSavedOnServer = !!savedT && savedT.slug === t.slug;
                  const prevSyncMode: SyncMode = savedT?.sync_mode || "independent";
                  const prevTeamKey = sortAgentsByPosition(
                    savedSnapshot.agents.filter((sa) =>
                      prevSyncMode === "independent" ? sa.team_id === t.id : !sa.team_id,
                    ),
                  )
                    .map((sa) => `${sa.id}:${sa.active}:${sa.position}`)
                    .join("|");
                  const currTeamKey = sortAgentsByPosition(
                    isMirrored ? generalAgents : rawTeamAgents,
                  )
                    .map((a) => `${a.id}:${a.active}:${a.position}`)
                    .join("|");
                  const isTeamUnsaved =
                    !savedT ||
                    savedT.slug !== t.slug ||
                    savedT.name !== t.name ||
                    savedT.batch_size !== t.batch_size ||
                    savedT.active !== t.active ||
                    prevSyncMode !== syncMode ||
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
                      className={`team-column ${!t.active ? "is-paused" : ""} ${isMirrored ? "is-mirrored" : ""} ${dragOverTarget === t.id ? "drag-over" : ""}`}
                      onDragOver={(e) => {
                        if (!isMirrored) handleDragOverColumn(e, t.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverTarget === t.id) setDragOverTarget(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (isMirrored) {
                          setDraggingAgentId(null);
                          setDragOverTarget(null);
                          setDragOverCard(null);
                          setError(
                            `A equipe "${t.name}" espelha o Site Principal automaticamente — arraste ou adicione no Site Principal e ela acompanha.`,
                          );
                          return;
                        }
                        handleDropOnColumn(e, t.id);
                      }}
                    >
                      <div className="team-column-header">
                        <div className="team-column-title-row">
                          <h3>
                            {t.name}
                            <span className="team-count-badge">{displayAgents.length}</span>
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

                        <div className="team-sync-bar">
                          <select
                            aria-label={`Modo dos números na ${t.name}`}
                            value={syncMode}
                            onChange={(e) => updateTeamSyncModeStage(t.id, e.target.value as SyncMode)}
                          >
                            <option value="independent">Lista própria (manual)</option>
                            <option value="general_reverse">Espelho do Site Principal (de trás pra frente)</option>
                            <option value="general_same">Espelho do Site Principal (mesma ordem)</option>
                          </select>
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
                              className="duplicate-team-btn"
                              onClick={() => duplicateColumnAsTeam(isMirrored ? null : t.id, "independent")}
                              title="Cria outra URL de equipe com cópias destes mesmos números"
                            >
                              Duplicar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTeam(t);
                                setTeamName(t.name);
                                setTeamSlug(t.slug);
                                setTeamSlugTouched(true);
                                setTeamBatch(t.batch_size);
                                setTeamSyncMode(syncMode);
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

                        {renderColumnQueueStatus(
                          stats?.queues?.teams?.[t.id] as QueuePreview | undefined,
                          isTeamUnsaved,
                        )}
                      </div>

                      <div className="team-agents-list">
                        {isMirrored && (
                          <div className="team-mirror-banner">
                            {syncMode === "general_reverse"
                              ? "Sincronizado de trás pra frente com o Site Principal. Adições, edições e pausas lá refletem aqui automaticamente."
                              : "Sincronizado na mesma ordem do Site Principal. Adições, edições e pausas lá refletem aqui automaticamente."}
                          </div>
                        )}
                        {displayAgents.length === 0 ? (
                          <div className="team-empty-drop">
                            {isMirrored
                              ? "Nenhum número no Site Principal ainda — adicione no Site Principal para aparecer aqui."
                              : `Arraste pelo menos 1 número para cá para ativar ${origin}/${t.slug}`}
                          </div>
                        ) : isMirrored ? (
                          displayAgents.map((a, idx) => {
                            const teamQueue = stats?.queues?.teams?.[t.id] as QueuePreview | undefined;
                            const counts = stats?.agents?.find((v: any) => v.id === a.id);
                            const todayTotal = counts?.today_deliveries ?? counts?.deliveries ?? 0;
                            const isReceivingNow = teamQueue?.receivingNow?.id === a.id;
                            const isNextUp = !isReceivingNow && teamQueue?.nextUp?.id === a.id;
                            return (
                              <div
                                key={`${t.id}-${a.id}`}
                                className={`team-agent-card is-mirrored-card ${isReceivingNow ? "is-receiving-now" : isNextUp ? "is-next-up" : ""}`}
                              >
                                <div className="team-agent-top">
                                  <div className="team-agent-info">
                                    <span
                                      className={`agent-order-badge ${idx === 0 ? "is-first" : ""}`}
                                      title={`${idx + 1}º na fila espelhada`}
                                    >
                                      {idx + 1}º
                                    </span>
                                    <div>
                                      <div className="team-agent-name">
                                        {a.name}
                                        {isReceivingNow && teamQueue?.receivingNow && (
                                          <span className={`queue-badge ${teamQueue.receivingNow.equalizing ? "equalizing" : "now"}`}>
                                            {teamQueue.receivingNow.equalizing
                                              ? `⚡ Equalizando (faltam ${teamQueue.receivingNow.missingToEqualize})`
                                              : teamQueue.batchSize > 1
                                              ? `● Chegando (${teamQueue.receivingNow.usedInBatch}/${teamQueue.batchSize})`
                                              : "● Chegando agora"}
                                          </span>
                                        )}
                                        {isNextUp && (
                                          <span className="queue-badge next">
                                            → Próximo
                                          </span>
                                        )}
                                        <span className="mirror-sync-badge">
                                          {syncMode === "general_reverse" ? "Espelho invertido" : "Espelho"}
                                        </span>
                                      </div>
                                      <div className="team-agent-phone">{formatDisplayPhone(a.phone)}</div>
                                    </div>
                                  </div>
                                  <span
                                    className={a.active ? "active" : "paused"}
                                    style={{ fontSize: "11px", fontWeight: 700 }}
                                  >
                                    {a.active ? "Ativo" : "Pausado"}
                                  </span>
                                </div>
                                <div className="team-agent-meta">
                                  <span>
                                    Hoje: <strong>{todayTotal}</strong> · {counts?.new_clients ?? 0} atend. · {counts?.deliveries ?? 0} encam.
                                  </span>
                                  <span>Link direto: <code>/atendimento{a.position}</code></span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          displayAgents.map((a, idx) =>
                            renderAgentCard(
                              a,
                              idx,
                              displayAgents.length,
                              stats?.queues?.teams?.[t.id] as QueuePreview | undefined,
                            ),
                          )
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
                    {teams
                      .filter((t) => !t.sync_mode || t.sync_mode === "independent")
                      .map((t) => (
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
                  disabled={busy || refreshingStats}
                  onClick={() => refreshLiveStats(true)}
                >
                  {refreshingStats ? "Atualizando…" : "↻ Atualizar contadores"}
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
                        const shareCount = phoneScopeCounts.get(a.phone) || 1;
                        return (
                          <tr key={a.id}>
                            <td>
                              <strong>{scopeRank}º</strong>
                              <small>ID #{a.position}</small>
                            </td>
                            <td>
                              <strong>{a.name}</strong>
                              <small>{formatDisplayPhone(a.phone)}</small>
                              {shareCount > 1 && (
                                <small style={{ color: "#38bdf8" }}>
                                  Em {shareCount} links
                                </small>
                              )}
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
