import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  RefreshCw,
  Users,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Plus,
  Monitor,
  BookOpen,
  Gamepad2,
  GraduationCap,
  MapPin,
  TrendingUp,
  Activity,
  ArrowRight,
  Filter,
  UserCheck
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from "recharts";
import { UsageLog, Space, OccupancyResponse } from "./types";

interface OccupancyDashboardProps {
  onBack: () => void;
  onNavigateToRegistration: (preselectedArea?: string) => void;
}

export function getAreaConfig(areaName: string) {
  const lower = (areaName || "").toLowerCase();
  if (lower.includes("multim") || lower.includes("vídeo") || lower.includes("video") || lower.includes("inform")) {
    return {
      icon: Monitor,
      color: "text-violet-600",
      bg: "bg-violet-50",
      border: "border-violet-200",
      badgeBg: "bg-violet-100 text-violet-800",
      badgeBorder: "border-violet-200",
      barColor: "#8b5cf6",
      accent: "violet"
    };
  }
  if (lower.includes("leit") || lower.includes("livr")) {
    return {
      icon: BookOpen,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      badgeBg: "bg-emerald-100 text-emerald-800",
      badgeBorder: "border-emerald-200",
      barColor: "#10b981",
      accent: "emerald"
    };
  }
  if (lower.includes("jog") || lower.includes("lúd") || lower.includes("lud")) {
    return {
      icon: Gamepad2,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      badgeBg: "bg-amber-100 text-amber-800",
      badgeBorder: "border-amber-200",
      barColor: "#f59e0b",
      accent: "amber"
    };
  }
  if (lower.includes("estud") || lower.includes("trabalh") || lower.includes("pesquis")) {
    return {
      icon: GraduationCap,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      badgeBg: "bg-blue-100 text-blue-800",
      badgeBorder: "border-blue-200",
      barColor: "#3b82f6",
      accent: "blue"
    };
  }
  return {
    icon: MapPin,
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    badgeBg: "bg-rose-100 text-rose-800",
    badgeBorder: "border-rose-200",
    barColor: "#f43f5e",
    accent: "rose"
  };
}

function calculateElapsed(entryTime: string): string {
  if (!entryTime) return "";
  const parts = entryTime.split(":");
  if (parts.length < 2) return "";
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const now = new Date();
  const entryDate = new Date();
  entryDate.setHours(h, m, 0, 0);

  const diffMs = now.getTime() - entryDate.getTime();
  if (diffMs < 0) return "Agora";
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Há menos de 1 min";
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `Há ${hours}h ${mins}m`;
}

export default function OccupancyDashboard({ onBack, onNavigateToRegistration }: OccupancyDashboardProps) {
  const [data, setData] = useState<OccupancyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "occupied" | "free">("all");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showExitLogs, setShowExitLogs] = useState(false);

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString("pt-PT"));
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const fetchOccupancy = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/occupancy");
      if (res.ok) {
        const json: OccupancyResponse = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Error fetching occupancy data:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // Initial fetch and 10s auto-refresh
  useEffect(() => {
    fetchOccupancy();
    const interval = setInterval(() => {
      fetchOccupancy(false);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Quick checkout handler
  const handleCheckout = async (log: UsageLog) => {
    setCheckoutLoadingId(log.id);
    try {
      const now = new Date();
      const exitTime = now.toTimeString().slice(0, 5);
      const res = await fetch(`/api/usage/${log.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exit_time: exitTime })
      });

      if (res.ok) {
        setToastMessage({
          type: "success",
          text: `Saída de ${log.name || "Aluno"} registada com sucesso às ${exitTime}!`
        });
        await fetchOccupancy(false);
      } else {
        setToastMessage({
          type: "error",
          text: "Erro ao registar saída do aluno."
        });
      }
    } catch (err) {
      setToastMessage({
        type: "error",
        text: "Erro de ligação ao servidor."
      });
    } finally {
      setCheckoutLoadingId(null);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Process data by area
  const spaces = data?.spaces || [];
  const activeLogs = data?.activeLogs || [];
  const allTodayLogs = data?.allTodayLogs || [];

  // Get unique areas from configured spaces (plus any area present in active logs)
  const uniqueAreas = useMemo(() => {
    const areaSet = new Set<string>();
    spaces.forEach(s => areaSet.add(s.area));
    activeLogs.forEach(l => areaSet.add(l.area));
    return Array.from(areaSet);
  }, [spaces, activeLogs]);

  // Group active logs by area
  const areaOccupancyList = useMemo(() => {
    return uniqueAreas.map(areaName => {
      const studentsInArea = activeLogs.filter(
        l => l.area?.trim().toLowerCase() === areaName.trim().toLowerCase()
      );
      const configuredActivities = spaces
        .filter(s => s.area?.trim().toLowerCase() === areaName.trim().toLowerCase())
        .map(s => s.activity);

      // Count students per activity in this area
      const activityCounts: Record<string, number> = {};
      studentsInArea.forEach(s => {
        const act = s.activity || "Geral";
        activityCounts[act] = (activityCounts[act] || 0) + 1;
      });

      return {
        area: areaName,
        count: studentsInArea.length,
        students: studentsInArea,
        configuredActivities,
        activityCounts,
        config: getAreaConfig(areaName)
      };
    });
  }, [uniqueAreas, activeLogs, spaces]);

  // KPIs
  const totalActiveStudents = activeLogs.length;
  const totalAreas = uniqueAreas.length;
  const occupiedAreasCount = areaOccupancyList.filter(a => a.count > 0).length;
  const todayTotalCount = data?.todayTotalCount || allTodayLogs.length;

  const busiestArea = useMemo(() => {
    if (areaOccupancyList.length === 0) return null;
    const sorted = [...areaOccupancyList].sort((a, b) => b.count - a.count);
    return sorted[0].count > 0 ? sorted[0] : null;
  }, [areaOccupancyList]);

  // Completed visits today (students with exit_time)
  const completedVisitsToday = useMemo(() => {
    return allTodayLogs.filter(l => Boolean(l.exit_time && l.exit_time.trim().length > 0));
  }, [allTodayLogs]);

  // Filtered areas for display
  const filteredAreas = useMemo(() => {
    return areaOccupancyList.filter(areaItem => {
      // Status filter
      if (statusFilter === "occupied" && areaItem.count === 0) return false;
      if (statusFilter === "free" && areaItem.count > 0) return false;

      // Search query filter (matches area name, or any student name/process inside the area)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesArea = areaItem.area.toLowerCase().includes(q);
        const matchesStudent = areaItem.students.some(
          s =>
            (s.name && s.name.toLowerCase().includes(q)) ||
            String(s.process_number).includes(q) ||
            (s.activity && s.activity.toLowerCase().includes(q)) ||
            (s.class && s.class.toLowerCase().includes(q))
        );
        return matchesArea || matchesStudent;
      }

      return true;
    });
  }, [areaOccupancyList, statusFilter, searchQuery]);

  // Chart data
  const chartData = useMemo(() => {
    return areaOccupancyList.map(item => ({
      name: item.area,
      alunos: item.count,
      color: item.config.barColor
    }));
  }, [areaOccupancyList]);

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold text-white ${
              toastMessage.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-xs"
            title="Voltar ao Menu"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Painel de Ocupação em Tempo Real
              </h1>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>EM DIRETO</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Monitorização da lotação atual de estudantes por cada espaço da biblioteca
            </p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          {currentTimeStr && (
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-white rounded-2xl border border-slate-200 text-slate-700 text-xs font-mono shadow-xs">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-semibold">{currentTimeStr}</span>
            </div>
          )}

          <button
            onClick={() => fetchOccupancy(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl text-xs font-semibold shadow-xs transition-all"
            title="Atualizar agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${refreshing ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => onNavigateToRegistration()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-sm hover:shadow-indigo-200 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Registar Entrada</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Students */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Alunos Presentes Agora
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalActiveStudents}</span>
            <span className="text-xs text-slate-500 font-medium">
              {totalActiveStudents === 1 ? "aluno na biblioteca" : "alunos na biblioteca"}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>A frequentar espaços ativos</span>
          </div>
        </motion.div>

        {/* Occupied Spaces */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Espaços em Utilização
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{occupiedAreasCount}</span>
            <span className="text-xs text-slate-500 font-medium">de {totalAreas} áreas</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            {totalAreas - occupiedAreasCount} {totalAreas - occupiedAreasCount === 1 ? "área livre" : "áreas livres"} no momento
          </div>
        </motion.div>

        {/* Busiest Area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Área Mais Frequantada
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            {busiestArea ? (
              <>
                <div className="text-lg font-bold text-slate-900 truncate" title={busiestArea.area}>
                  {busiestArea.area}
                </div>
                <div className="text-xs text-amber-700 font-semibold mt-1">
                  {busiestArea.count} {busiestArea.count === 1 ? "estudante presente" : "estudantes presentes"}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-slate-400">Nenhuma ativa</div>
                <div className="text-xs text-slate-400 mt-1">Sem alunos registados</div>
              </>
            )}
          </div>
        </motion.div>

        {/* Today Total Visits */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Entradas Hoje
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{todayTotalCount}</span>
            <span className="text-xs text-slate-500 font-medium">registos hoje</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            {completedVisitsToday.length} saídas já concluídas
          </div>
        </motion.div>
      </div>

      {/* Visual Chart & Real-time Distribution Summary */}
      {chartData.length > 0 && totalActiveStudents > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Distribuição Atual de Alunos por Espaço</h3>
              <p className="text-xs text-slate-500">Comparativo visual da frequência em tempo real</p>
            </div>
            <div className="text-xs text-slate-400">
              Atualizado: {lastUpdated.toLocaleTimeString("pt-PT")}
            </div>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                  }}
                  formatter={(val: any) => [`${val} alunos`, "Ocupação Atual"]}
                />
                <Bar dataKey="alunos" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Pesquisar aluno ou espaço..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === "all"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            Todos os Espaços ({areaOccupancyList.length})
          </button>
          <button
            onClick={() => setStatusFilter("occupied")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === "occupied"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            Com Alunos ({occupiedAreasCount})
          </button>
          <button
            onClick={() => setStatusFilter("free")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === "free"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            Livres ({totalAreas - occupiedAreasCount})
          </button>
        </div>
      </div>

      {/* Main Spaces Occupancy Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredAreas.length === 0 ? (
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400">
            <Filter className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-600">Nenhum espaço encontrado com os filtros atuais.</p>
            <p className="text-xs text-slate-400 mt-1">Experimente limpar a pesquisa ou selecionar "Todos os Espaços".</p>
          </div>
        ) : (
          filteredAreas.map(item => {
            const AreaIcon = item.config.icon;
            const isOccupied = item.count > 0;

            return (
              <motion.div
                key={item.area}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Space Card Header */}
                  <div className="p-6 border-b border-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.config.bg} ${item.config.color} shrink-0`}
                        >
                          <AreaIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                            {item.area}
                          </h2>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {item.configuredActivities.length}{" "}
                            {item.configuredActivities.length === 1 ? "atividade configurada" : "atividades configuradas"}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isOccupied ? (
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${item.config.badgeBg} border ${item.config.badgeBorder}`}
                        >
                          <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                          <span>
                            {item.count} {item.count === 1 ? "Aluno" : "Alunos"}
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200/60">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Livre</span>
                        </div>
                      )}
                    </div>

                    {/* Occupancy visual progress load bar */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-400 font-medium">Frequência em tempo real</span>
                        <span className="font-bold text-slate-700">
                          {item.count === 0 ? "0 alunos" : `${item.count} ativos`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(item.count * 25, 100)}%`,
                            backgroundColor: isOccupied ? item.config.barColor : "#cbd5e1"
                          }}
                        />
                      </div>
                    </div>

                    {/* Active activities breakdown chips */}
                    {Object.keys(item.activityCounts).length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 mr-1">Atividades:</span>
                        {Object.entries(item.activityCounts).map(([act, cnt]) => (
                          <span
                            key={act}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700"
                          >
                            <span>{act}</span>
                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">
                              {cnt}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Students in this space list */}
                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Estudantes neste Espaço ({item.count})
                      </span>
                    </div>

                    {item.students.length === 0 ? (
                      <div className="py-7 text-center rounded-2xl bg-slate-50/60 border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 font-medium">Nenhum aluno neste espaço no momento.</p>
                        <button
                          onClick={() => onNavigateToRegistration(item.area)}
                          className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Registar entrada aqui
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {item.students.map(log => {
                          const elapsed = calculateElapsed(log.entry_time);
                          const isCheckingOut = checkoutLoadingId === log.id;

                          return (
                            <div
                              key={log.id}
                              className="p-3.5 rounded-2xl bg-slate-50/80 hover:bg-slate-50 border border-slate-100 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                            >
                              <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                    log.gender === "Feminino"
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-indigo-100 text-indigo-700"
                                  }`}
                                >
                                  {log.name ? log.name.charAt(0).toUpperCase() : "A"}
                                </div>
                                <div>
                                  <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    <span>{log.name || "Aluno Desconhecido"}</span>
                                    <span className="text-[11px] font-mono font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                      {String(log.process_number).padStart(5, "0")}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                                    {log.grade && (
                                      <span className="font-semibold text-slate-600">
                                        {log.grade}º {log.class || ""}
                                        {log.class_number ? ` • N.º ${log.class_number}` : ""}
                                      </span>
                                    )}
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-600">{log.activity}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="font-mono text-indigo-600 font-medium">
                                      {log.entry_time}
                                    </span>
                                    {elapsed && (
                                      <span className="text-[10px] text-slate-400 font-normal">({elapsed})</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action: Quick Checkout button */}
                              <button
                                onClick={() => handleCheckout(log)}
                                disabled={isCheckingOut}
                                title="Registar saída deste estudante agora"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-semibold shadow-2xs transition-all shrink-0"
                              >
                                {isCheckingOut ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                                ) : (
                                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                                )}
                                <span>Registar Saída</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {item.count > 0 ? "Utilização ativa no momento" : "Disponível para ocupação"}
                  </span>
                  <button
                    onClick={() => onNavigateToRegistration(item.area)}
                    className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <span>+ Registar Entrada</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Completed Visits Today Toggleable Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Histórico de Saídas Concluídas Hoje ({completedVisitsToday.length})
              </h3>
              <p className="text-xs text-slate-500">
                Alunos que frequentaram a biblioteca hoje e já registaram a hora de saída
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowExitLogs(!showExitLogs)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl transition-all"
          >
            {showExitLogs ? "Ocultar" : "Consultar Saídas"}
          </button>
        </div>

        {showExitLogs && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            {completedVisitsToday.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Ainda não foram registadas saídas concluídas no dia de hoje.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                      <th className="pb-2.5 px-3">Processo</th>
                      <th className="pb-2.5 px-3">Aluno</th>
                      <th className="pb-2.5 px-3">Turma</th>
                      <th className="pb-2.5 px-3">Espaço</th>
                      <th className="pb-2.5 px-3">Atividade</th>
                      <th className="pb-2.5 px-3">Entrada</th>
                      <th className="pb-2.5 px-3">Saída</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completedVisitsToday.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {String(log.process_number).padStart(5, "0")}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{log.name || "Aluno"}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {log.grade ? `${log.grade}º ${log.class || ""}` : "-"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">{log.area}</td>
                        <td className="py-2.5 px-3 text-slate-600">{log.activity}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{log.entry_time}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">{log.exit_time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
