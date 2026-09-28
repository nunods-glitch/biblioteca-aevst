import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  UserPlus, 
  BarChart3, 
  RefreshCw, 
  LogOut, 
  ChevronLeft, 
  Search, 
  Save, 
  Upload,
  Download,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Monitor,
  Edit2,
  FileSpreadsheet,
  FileText,
  Lock,
  X,
  ChevronRight,
  Table,
  Check,
  ListChecks,
  CheckSquare,
  TrendingUp,
  Activity,
  Globe,
  Copy,
  ExternalLink,
  Code2,
  Trash2
} from "lucide-react";
import OccupancyDashboard from "./OccupancyDashboard";
import { 
  generateFormalMonthlyPDF, 
  buildMonthlyConsolidation, 
  formatMonthLabel, 
  formatShortMonthLabel 
} from "./pdfReport";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";
import { Student, UsageLog, Space } from "./types";
import * as XLSX from "xlsx";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("ErrorBoundary capturou um erro não fatal:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-md w-full text-center">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Aplicação Recuperada</h2>
            <p className="text-sm text-slate-500 mb-6">
              Ocorreu uma intervenção no navegador (ou script externo). Pode reiniciar a aplicação com segurança.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-sm"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type Screen = "menu" | "occupancy" | "registration" | "analysis" | "update" | "space_update";

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("menu");
  const [preselectedArea, setPreselectedArea] = useState<string>("");

  const renderScreen = () => {
    switch (currentScreen) {
      case "menu":
        return <Menu onNavigate={setCurrentScreen} />;
      case "occupancy":
        return (
          <OccupancyDashboard 
            onBack={() => setCurrentScreen("menu")} 
            onNavigateToRegistration={(area) => {
              setPreselectedArea(area || "");
              setCurrentScreen("registration");
            }} 
          />
        );
      case "registration":
        return (
          <Registration 
            onBack={() => {
              setPreselectedArea("");
              setCurrentScreen("menu");
            }} 
            initialArea={preselectedArea}
            onNavigateToOccupancy={() => setCurrentScreen("occupancy")}
          />
        );
      case "analysis":
        return <Analysis onBack={() => setCurrentScreen("menu")} />;
      case "update":
        return <DataUpdate onBack={() => setCurrentScreen("menu")} />;
      case "space_update":
        return <SpaceUpdate onBack={() => setCurrentScreen("menu")} />;
      default:
        return <Menu onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="container mx-auto px-4 py-8 max-w-5xl"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Menu({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [showExitModal, setShowExitModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadPassword, setDownloadPassword] = useState("");
  const [downloadError, setDownloadError] = useState("");

  // Online publishing modal state (planet icon)
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [onlinePassword, setOnlinePassword] = useState("");
  const [onlineError, setOnlineError] = useState("");
  const [onlineAuthorized, setOnlineAuthorized] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedGit, setCopiedGit] = useState(false);

  const [occupancySummary, setOccupancySummary] = useState<{
    activeCount: number;
    occupiedSpacesCount: number;
    totalSpaces: number;
    areaBreakdown: { area: string; count: number }[];
  } | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/occupancy");
        if (res.ok) {
          const d = await res.json();
          const activeLogs: UsageLog[] = d.activeLogs || [];
          const spaces: Space[] = d.spaces || [];
          const uniqueAreas = Array.from(
            new Set([...spaces.map((s: Space) => s.area), ...activeLogs.map((l: UsageLog) => l.area)])
          );
          const breakdown = uniqueAreas.map(areaName => ({
            area: areaName,
            count: activeLogs.filter(
              l => l.area?.trim().toLowerCase() === areaName.trim().toLowerCase()
            ).length
          }));
          setOccupancySummary({
            activeCount: activeLogs.length,
            occupiedSpacesCount: breakdown.filter(b => b.count > 0).length,
            totalSpaces: uniqueAreas.length,
            areaBreakdown: breakdown
          });
        }
      } catch (e) {
        console.error("Error fetching menu occupancy summary:", e);
      }
    };

    fetchSummary();
    const timer = setInterval(fetchSummary, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleClose = () => {
    try {
      window.close();
    } catch (e) {
      // Ignored if blocked by browser
    }
  };

  const handleConfirmDownload = (e: React.FormEvent) => {
    e.preventDefault();
    if (downloadPassword === "escola") {
      setDownloadError("");
      setShowDownloadModal(false);
      setDownloadPassword("");
      // Trigger download with password
      window.location.href = "/api/download-zip?password=escola";
    } else {
      setDownloadError("Palavra-passe incorreta. Tente novamente.");
    }
  };

  const handleConfirmOnlineAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (onlinePassword === "escola") {
      setOnlineError("");
      setOnlineAuthorized(true);
    } else {
      setOnlineError("Palavra-passe incorreta. Tente novamente.");
    }
  };

  const handleCopyLink = () => {
    const url = "https://ais-pre-retrom2rrwah2a5h22kcwp-158570181569.europe-west1.run.app";
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyGitCommands = () => {
    const cmds = `git init
git add .
git commit -m "Publicação inicial Biblioteca AEVST"
git branch -M main
git remote add origin https://github.com/SEU_UTILIZADOR/biblioteca-aevst.git
git push -u origin main`;
    navigator.clipboard.writeText(cmds);
    setCopiedGit(true);
    setTimeout(() => setCopiedGit(false), 2500);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] relative">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-800 mb-2">Biblioteca AEVST</h1>
        <p className="text-slate-500">Gestão e Monitorização de Espaços</p>
      </div>

      {/* Live Occupancy Banner */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onNavigate("occupancy")}
        className="w-full max-w-2xl mb-6 p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl shadow-lg border border-indigo-800/40 cursor-pointer relative overflow-hidden group transition-all"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                EM DIRETO
              </span>
              <span className="text-xs text-indigo-200/80 font-medium">Ocupação Atual dos Espaços</span>
            </div>

            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl md:text-3xl font-extrabold text-white">
                {occupancySummary ? occupancySummary.activeCount : "..."}
              </span>
              <span className="text-sm text-indigo-100 font-medium">
                {occupancySummary?.activeCount === 1
                  ? "aluno a utilizar os espaços neste momento"
                  : "alunos a utilizar os espaços neste momento"}
              </span>
            </div>

            {occupancySummary && occupancySummary.areaBreakdown.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {occupancySummary.areaBreakdown.slice(0, 4).map(b => (
                  <span
                    key={b.area}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] bg-white/10 text-slate-200 border border-white/10"
                  >
                    <span>{b.area}:</span>
                    <strong className={b.count > 0 ? "text-emerald-300 font-bold" : "text-slate-400 font-normal"}>
                      {b.count}
                    </strong>
                  </span>
                ))}
                {occupancySummary.areaBreakdown.length > 4 && (
                  <span className="text-[11px] text-slate-400">+{occupancySummary.areaBreakdown.length - 4}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="text-xs font-bold text-indigo-200 group-hover:text-white transition-colors">
              Abrir Painel
            </span>
            <div className="w-8 h-8 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-white transition-all group-hover:translate-x-0.5">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl">
        <MenuButton 
          icon={<LayoutDashboard className="w-6 h-6" />} 
          label="Painel de Ocupação" 
          sublabel="Estado em tempo real"
          badge="Tempo Real"
          onClick={() => onNavigate("occupancy")}
          color="bg-purple-600"
        />
        <MenuButton 
          icon={<UserPlus className="w-6 h-6" />} 
          label="Registo de Utilização" 
          sublabel="Entrada e saída de alunos"
          onClick={() => onNavigate("registration")}
          color="bg-indigo-600"
        />
        <MenuButton 
          icon={<BarChart3 className="w-6 h-6" />} 
          label="Análise de Utilização" 
          sublabel="Estatísticas e gráficos"
          onClick={() => onNavigate("analysis")}
          color="bg-emerald-600"
        />
        <MenuButton 
          icon={<RefreshCw className="w-6 h-6" />} 
          label="Atualização de Dados" 
          sublabel="Alunos (Excel) e Registos (CSV)"
          onClick={() => onNavigate("update")}
          color="bg-amber-600"
        />
        <MenuButton 
          icon={<MapPin className="w-6 h-6" />} 
          label="Atualização de Espaços" 
          sublabel="Configurar áreas e atividades"
          onClick={() => onNavigate("space_update")}
          color="bg-cyan-600"
        />
        <MenuButton 
          icon={<LogOut className="w-6 h-6" />} 
          label="Encerrar Aplicação" 
          sublabel="Terminar sessão em segurança"
          onClick={() => setShowExitModal(true)}
          color="bg-rose-600"
        />
      </div>

      {/* Botões no canto inferior direito: Planeta (Publicação Online) e Computador (Instalação Local Windows 11) */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        {/* Botão Planeta: Publicação Online & GitHub */}
        <button
          onClick={() => {
            setOnlinePassword("");
            setOnlineError("");
            setOnlineAuthorized(false);
            setShowOnlineModal(true);
          }}
          title="Publicação Online (GitHub & Acesso na Nuvem) - Requer palavra-passe"
          aria-label="Publicação Online"
          className="w-10 h-10 rounded-full bg-white/95 hover:bg-white text-indigo-600 hover:text-indigo-800 border border-slate-200/90 shadow-sm hover:shadow-md flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:scale-105 active:scale-95"
        >
          <Globe className="w-5 h-5" />
        </button>

        {/* Botão Computador: Instalação Local (Windows 11) */}
        <button
          onClick={() => {
            setDownloadPassword("");
            setDownloadError("");
            setShowDownloadModal(true);
          }}
          title="Instalação Local (Windows 11)"
          aria-label="Instalação Local"
          className="w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-900 border border-slate-200 shadow-sm hover:shadow-md flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:scale-105 active:scale-95"
        >
          <Monitor className="w-5 h-5" />
        </button>
      </div>

      {/* Modal de Publicação Online & GitHub (requer palavra-passe "escola") */}
      <AnimatePresence>
        {showOnlineModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`bg-white rounded-3xl p-6 md:p-8 shadow-2xl relative transition-all ${
                onlineAuthorized ? "max-w-2xl w-full max-h-[90vh] overflow-y-auto" : "max-w-sm w-full"
              }`}
            >
              <button
                onClick={() => {
                  setShowOnlineModal(false);
                  setOnlinePassword("");
                  setOnlineError("");
                  setOnlineAuthorized(false);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {!onlineAuthorized ? (
                /* Etapa 1: Validação de Palavra-passe "escola" */
                <div>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                    <Globe className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-800 mb-1">Publicação Online</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Introduza a palavra-passe <span className="font-semibold text-slate-700">"escola"</span> para aceder ao guia de publicação online e configuração no GitHub.
                  </p>

                  <form onSubmit={handleConfirmOnlineAuth} className="space-y-4">
                    <div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          autoFocus
                          value={onlinePassword}
                          onChange={(e) => {
                            setOnlinePassword(e.target.value);
                            if (onlineError) setOnlineError("");
                          }}
                          placeholder="Palavra-passe de administrador..."
                          className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      {onlineError && (
                        <p className="text-xs text-rose-600 font-medium mt-1.5">{onlineError}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowOnlineModal(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Globe className="w-4 h-4" /> Aceder ao Guia
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Etapa 2: Centro de Publicação Online Desbloqueado */
                <div className="space-y-6 text-left">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                          Hospedagem Gratuita & Nuvem
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-800">Publicar Aplicação Online</h3>
                      <p className="text-xs text-slate-500">
                        Como disponibilizar a Biblioteca AEVST na Web gratuitamente para toda a escola
                      </p>
                    </div>
                  </div>

                  {/* 1. LINK ONLINE JÁ ATIVO */}
                  <div className="p-5 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl text-white shadow-md space-y-3 border border-indigo-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                          Link Online Já Ativo & Disponível
                        </span>
                      </div>
                      <span className="text-[11px] text-indigo-200 bg-white/10 px-2 py-0.5 rounded-md font-mono">
                        HTTPS Ativo
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">
                      Esta aplicação já se encontra online e acessível publicamente através do endereço seguro na nuvem:
                    </p>

                    <div className="p-3 bg-black/40 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <code className="text-xs text-indigo-200 font-mono select-all break-all">
                        https://ais-pre-retrom2rrwah2a5h22kcwp-158570181569.europe-west1.run.app
                      </code>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? "Copiado!" : "Copiar Link"}</span>
                        </button>
                        <a
                          href="https://ais-pre-retrom2rrwah2a5h22kcwp-158570181569.europe-west1.run.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white rounded-lg text-xs font-semibold transition-all shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir</span>
                        </a>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      💡 <strong>Acesso Direto:</strong> Pode partilhar este link diretamente com professores e alunos para acederem à biblioteca através de qualquer computador, tablet ou telemóvel sem necessidade de instalar software.
                    </p>
                  </div>

                  {/* 2. GUIA DE PUBLICAÇÃO NO GITHUB + RENDER (GRATUITO) */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-indigo-600" />
                        <span>Publicar Repositório no GitHub & Hospedar Gratuitamente</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        O GitHub aloja o código-fonte. Por possuir servidor Node.js e base de dados SQLite, a hospedagem gratuita pode ser feita em plataformas que suportam backend, como o <strong>Render.com</strong>, <strong>Railway</strong> ou <strong>Fly.io</strong>.
                      </p>
                    </div>

                    {/* Botão de Download do Repositório ZIP */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">
                          Passo 1: Descarregar o Projeto Configurado
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Inclui <code>.gitignore</code>, <code>README.md</code> com instruções, <code>render.yaml</code> e ficheiros do servidor.
                        </span>
                      </div>
                      <a
                        href="/api/download-zip?password=escola"
                        download="biblioteca-aevst.zip"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
                      >
                        <Download className="w-4 h-4" /> Descarregar ZIP para GitHub
                      </a>
                    </div>

                    {/* Passo 2: Criar no GitHub */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">
                          Passo 2: Criar Repositório no GitHub
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyGitCommands}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          {copiedGit ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedGit ? "Comandos Copiados!" : "Copiar Comandos Git"}</span>
                        </button>
                      </div>
                      <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1">
                        <li>Crie uma conta gratuita em <a href="https://github.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-semibold">github.com</a> e crie um novo repositório (ex: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">biblioteca-aevst</code>).</li>
                        <li>Envie os ficheiros extraídos do ZIP para o repositório (via terminal ou arrastando diretamente no navegador).</li>
                      </ol>
                    </div>

                    {/* Passo 3: Ativar no Render.com */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                      <span className="font-bold text-xs text-slate-800 block">
                        Passo 3: Ligar ao Render.com (100% Gratuito)
                      </span>
                      <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5">
                        <li>Aceda a <a href="https://render.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-semibold">render.com</a> e inicie sessão com o seu GitHub.</li>
                        <li>Clique em <strong>"New +"</strong> &rarr; <strong>"Web Service"</strong> e selecione o repositório GitHub da biblioteca.</li>
                        <li>O ficheiro <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono text-[11px]">render.yaml</code> já configura automaticamente:
                          <ul className="list-disc list-inside pl-4 pt-1 text-[11px] text-slate-500 font-mono">
                            <li>Build Command: <code>npm install && npm run build</code></li>
                            <li>Start Command: <code>npm start</code></li>
                          </ul>
                        </li>
                        <li>Clique em <strong>"Deploy"</strong>. Em cerca de 2 minutos a sua aplicação terá um endereço online com HTTPS permanente (ex.: <code className="text-indigo-700 font-mono font-semibold">https://biblioteca-aevst.onrender.com</code>).</li>
                      </ol>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Palavra-passe de administração confirmada: <code className="text-slate-600 font-mono">escola</code>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOnlineModal(false)}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Palavra-passe para Descarregar */}
      <AnimatePresence>
        {showDownloadModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <button
                onClick={() => setShowDownloadModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                <Lock className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-1">Descarregar Aplicação</h3>
              <p className="text-xs text-slate-500 mb-4">
                Introduza a palavra-passe para descarregar o pacote de instalação para Windows 11.
              </p>

              <form onSubmit={handleConfirmDownload} className="space-y-4">
                <div>
                  <input
                    type="password"
                    autoFocus
                    value={downloadPassword}
                    onChange={(e) => {
                      setDownloadPassword(e.target.value);
                      if (downloadError) setDownloadError("");
                    }}
                    placeholder="Palavra-passe..."
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {downloadError && (
                    <p className="text-xs text-rose-600 font-medium mt-1.5">{downloadError}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDownloadModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Descarregar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Encerrar a Aplicação</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Todos os dados e registos estão salvaguardados em segurança na base de dados.
                <br /><br />
                Para terminar:
                <br />
                • Feche este separador ou janela no browser.
                <br />
                • Se estiver a correr localmente no terminal, prima <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">Ctrl + C</kbd>.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
                >
                  Continuar
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-all shadow-sm"
                >
                  Fechar Janela
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuButton({ 
  icon, 
  label, 
  sublabel,
  badge,
  onClick, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  sublabel?: string;
  badge?: string;
  onClick: () => void; 
  color: string;
}) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-between p-5 sm:p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group text-left w-full cursor-pointer"
    >
      <div className="flex items-center min-w-0">
        <div className={`${color} p-3.5 sm:p-4 rounded-xl text-white mr-4 group-hover:scale-110 transition-transform shrink-0 shadow-xs`}>
          {icon}
        </div>
        <div className="min-w-0">
          <span className="text-base sm:text-lg font-semibold text-slate-800 block group-hover:text-indigo-600 transition-colors truncate">
            {label}
          </span>
          {sublabel && (
            <span className="text-xs text-slate-400 block mt-0.5 truncate">{sublabel}</span>
          )}
        </div>
      </div>
      {badge && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/70 shrink-0 ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
          {badge}
        </span>
      )}
    </button>
  );
}

function Registration({ 
  onBack,
  initialArea = "",
  onNavigateToOccupancy
}: { 
  onBack: () => void;
  initialArea?: string;
  onNavigateToOccupancy?: () => void;
}) {
  const [processNumber, setProcessNumber] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [area, setArea] = useState(initialArea);
  const [activity, setActivity] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (initialArea) {
      setArea(initialArea);
    }
  }, [initialArea]);

  // Logs list state
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [searchProcess, setSearchProcess] = useState("");
  const [filterOnlyActive, setFilterOnlyActive] = useState(false);
  const [checkingOutId, setCheckingOutId] = useState<number | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Bulk checkout & delete state
  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);
  const [bulkCheckingOut, setBulkCheckingOut] = useState(false);
  const [bulkExitTime, setBulkExitTime] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkPasswordError, setBulkPasswordError] = useState("");

  // Bulk delete state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeletePassword, setBulkDeletePassword] = useState("");
  const [bulkDeletePasswordError, setBulkDeletePasswordError] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Edit modal state
  const [editingLog, setEditingLog] = useState<UsageLog | null>(null);
  const [editArea, setEditArea] = useState("");
  const [editActivity, setEditActivity] = useState("");
  const [editExitTime, setEditExitTime] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    fetchSpaces();
    fetchLogs();
  }, []);

  const fetchSpaces = async () => {
    try {
      const res = await fetch("/api/spaces");
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const areas = Array.from(new Set(spaces.map(s => s.area)));
  const activities = spaces.filter(s => s.area === area).map(s => s.activity);
  const editActivities = spaces.filter(s => s.area === editArea).map(s => s.activity);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogsCount = logs.filter(l => l.date === todayStr).length;
  const activeLogsCount = logs.filter(l => !l.exit_time || l.exit_time.trim() === '').length;

  const filteredLogs = logs.filter(log => {
    if (filterOnlyActive && log.exit_time && log.exit_time.trim() !== '') {
      return false;
    }
    if (!searchProcess.trim()) return true;
    const q = searchProcess.trim().toLowerCase();
    const rawProcess = String(log.process_number || "").toLowerCase();
    const paddedProcess = String(log.process_number || "").padStart(5, '0').toLowerCase();
    const studentName = (log.name || "").toLowerCase();

    return rawProcess.includes(q) || paddedProcess.includes(q) || studentName.includes(q);
  });

  const visibleActiveLogs = useMemo(() => {
    return filteredLogs.filter(l => !l.exit_time || l.exit_time.trim() === '');
  }, [filteredLogs]);

  const allActiveLogs = useMemo(() => {
    return logs.filter(l => !l.exit_time || l.exit_time.trim() === '');
  }, [logs]);

  // Selected active logs (without exit time)
  const selectedActiveLogs = useMemo(() => {
    return logs.filter(l => selectedLogIds.includes(l.id) && (!l.exit_time || l.exit_time.trim() === ''));
  }, [logs, selectedLogIds]);

  useEffect(() => {
    const validIds = new Set(logs.map(l => l.id));
    setSelectedLogIds(prev => prev.filter(id => validIds.has(id)));
  }, [logs]);

  const handleToggleSelect = (id: number) => {
    setSelectedLogIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredLogs.map(l => l.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedLogIds.includes(id));
    if (allSelected) {
      setSelectedLogIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedLogIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSelectAllVisibleActive = () => {
    const visibleActiveIds = visibleActiveLogs.map(l => l.id);
    const allSelected = visibleActiveIds.length > 0 && visibleActiveIds.every(id => selectedLogIds.includes(id));
    if (allSelected) {
      setSelectedLogIds(prev => prev.filter(id => !visibleActiveIds.includes(id)));
    } else {
      setSelectedLogIds(prev => Array.from(new Set([...prev, ...visibleActiveIds])));
    }
  };

  const handleSelectAllActive = () => {
    setSelectedLogIds(allActiveLogs.map(l => l.id));
  };

  const handleClearSelection = () => {
    setSelectedLogIds([]);
  };

  const handleOpenBulkModal = () => {
    if (selectedActiveLogs.length === 0) return;
    setBulkPassword("");
    setBulkPasswordError("");
    if (!bulkExitTime) {
      setBulkExitTime(new Date().toTimeString().slice(0, 5));
    }
    setShowBulkModal(true);
  };

  const handleConfirmBulkCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const activeIdsToCheckout = selectedActiveLogs.map(l => l.id);
    if (activeIdsToCheckout.length === 0) return;

    if (bulkPassword !== "escola") {
      setBulkPasswordError("Palavra-passe incorreta. Introduza a palavra-passe \"escola\" para autorizar esta ação.");
      return;
    }

    const now = new Date();
    const timeToApply = bulkExitTime || now.toTimeString().slice(0, 5);

    setBulkCheckingOut(true);
    setBulkPasswordError("");

    try {
      const res = await fetch("/api/usage/bulk-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: activeIdsToCheckout,
          exit_time: timeToApply,
          password: bulkPassword
        })
      });

      if (res.ok) {
        const result = await res.json();
        setCheckoutMsg({
          type: 'success',
          text: `Saída em massa registada com sucesso! ${result.count} ${result.count === 1 ? 'aluno atualizado' : 'alunos atualizados'} com saída às ${timeToApply}.`
        });
        setTimeout(() => setCheckoutMsg(null), 5000);
        setSelectedLogIds(prev => prev.filter(id => !activeIdsToCheckout.includes(id)));
        setBulkExitTime("");
        setBulkPassword("");
        setShowBulkModal(false);
        fetchLogs();
      } else {
        const err = await res.json();
        setBulkPasswordError(err.error || "Erro ao registar saídas em massa.");
      }
    } catch (err) {
      console.error(err);
      setBulkPasswordError("Erro de comunicação ao registar saídas em massa.");
    } finally {
      setBulkCheckingOut(false);
    }
  };

  const handleOpenBulkDeleteModal = () => {
    if (selectedLogIds.length === 0) return;
    setBulkDeletePassword("");
    setBulkDeletePasswordError("");
    setShowBulkDeleteModal(true);
  };

  const handleConfirmBulkDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedLogIds.length === 0) return;

    if (bulkDeletePassword !== "escola") {
      setBulkDeletePasswordError("Palavra-passe incorreta. Introduza a palavra-passe \"escola\" para autorizar a eliminação.");
      return;
    }

    setBulkDeleting(true);
    setBulkDeletePasswordError("");

    try {
      const res = await fetch("/api/usage/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedLogIds,
          password: bulkDeletePassword
        })
      });

      if (res.ok) {
        const result = await res.json();
        setCheckoutMsg({
          type: 'success',
          text: `Foram eliminados com sucesso ${result.count} ${result.count === 1 ? 'registo' : 'registos'} de utilização.`
        });
        setTimeout(() => setCheckoutMsg(null), 5000);
        setSelectedLogIds([]);
        setBulkDeletePassword("");
        setShowBulkDeleteModal(false);
        fetchLogs();
      } else {
        const err = await res.json();
        setBulkDeletePasswordError(err.error || "Erro ao eliminar registos.");
      }
    } catch (err) {
      console.error(err);
      setBulkDeletePasswordError("Erro de comunicação ao eliminar registos.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleProcessChange = (val: string) => {
    const numeric = val.replace(/\D/g, "");
    setProcessNumber(numeric);
  };

  const handleProcessBlur = () => {
    if (processNumber.length === 4) {
      setProcessNumber("0" + processNumber);
    }
  };

  // Preenche automaticamente o 1º dígito com zero quando tiver 4 dígitos após pequena pausa
  useEffect(() => {
    if (processNumber.length === 4) {
      const timer = setTimeout(() => {
        setProcessNumber(prev => prev.length === 4 ? "0" + prev : prev);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [processNumber]);

  useEffect(() => {
    if (processNumber.length === 5) {
      fetchStudent();
    } else {
      setStudent(null);
    }
  }, [processNumber]);

  const fetchStudent = async () => {
    try {
      const res = await fetch(`/api/students/${processNumber}`);
      if (res.ok) {
        const data = await res.json();
        setStudent(data);
      } else {
        setStudent(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegister = async () => {
    if (!student || !area || !activity || !entryTime) {
      setMessage({ type: 'error', text: 'Por favor, selecione o aluno, a área, a atividade e a hora de entrada.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          process_number: student.process_number,
          area,
          activity,
          entry_time: entryTime,
          exit_time: exitTime || "",
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Registo efetuado com sucesso!' });
        // Clear fields
        setProcessNumber("");
        setStudent(null);
        setArea("");
        setActivity("");
        setEntryTime("");
        setExitTime("");
        fetchLogs();
      } else {
        setMessage({ type: 'error', text: 'Erro ao efetuar registo.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro de ligação ao servidor.' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleOpenEdit = (log: UsageLog) => {
    setEditingLog(log);
    setEditArea(log.area);
    setEditActivity(log.activity);
    const now = new Date();
    // Se o registo ainda não tem hora de saída, sugerir a hora atual automaticamente para facilitar
    setEditExitTime(log.exit_time || now.toTimeString().slice(0, 5));
    setEditError("");
  };

  const handleQuickExit = async (e: React.MouseEvent, log: UsageLog) => {
    e.stopPropagation();
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    setCheckingOutId(log.id);
    try {
      const res = await fetch(`/api/usage/${log.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exit_time: currentTime })
      });
      if (res.ok) {
        setCheckoutMsg({
          type: 'success',
          text: `Hora de saída (${currentTime}) registada com sucesso para ${log.name || `Processo ${String(log.process_number).padStart(5, '0')}`}!`
        });
        setTimeout(() => setCheckoutMsg(null), 4000);
        fetchLogs();
      } else {
        setCheckoutMsg({ type: 'error', text: 'Erro ao registar hora de saída.' });
        setTimeout(() => setCheckoutMsg(null), 3000);
      }
    } catch (err) {
      setCheckoutMsg({ type: 'error', text: 'Erro de comunicação ao registar saída.' });
      setTimeout(() => setCheckoutMsg(null), 3000);
    } finally {
      setCheckingOutId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    if (!editArea) {
      setEditError("Por favor selecione uma área.");
      return;
    }

    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/usage/${editingLog.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: editArea,
          activity: editActivity || editingLog.activity,
          exit_time: editExitTime
        })
      });

      if (res.ok) {
        setEditingLog(null);
        fetchLogs();
      } else {
        setEditError("Erro ao guardar alterações.");
      }
    } catch (err) {
      setEditError("Erro de ligação ao servidor.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          {onNavigateToOccupancy && (
            <button
              onClick={onNavigateToOccupancy}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 text-xs font-bold transition-all shadow-2xs"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Ver Ocupação em Direto</span>
            </button>
          )}
          <h2 className="text-2xl font-bold text-slate-800">Registo de Utilização</h2>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Student Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-600">N.º de Processo</label>
                <span className="text-xs text-slate-400">4 ou 5 dígitos</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  maxLength={5}
                  value={processNumber}
                  onChange={(e) => handleProcessChange(e.target.value)}
                  onBlur={handleProcessBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && processNumber.length === 4) {
                      setProcessNumber("0" + processNumber);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="Ex: 1234 (preenche 01234)"
                />
              </div>
            </div>

            {student ? (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3"
              >
                <div className="flex items-center text-indigo-700 font-bold">
                  <Users className="w-5 h-5 mr-2" /> {student.name}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-indigo-600">
                  <div><span className="font-semibold">N.º Processo:</span> {student.process_number}</div>
                  <div><span className="font-semibold">Género:</span> {student.gender}</div>
                  <div><span className="font-semibold">N.º Turma:</span> {student.class_number || "-"}</div>
                  <div><span className="font-semibold">Ano / Turma:</span> {student.grade ? `${student.grade}º` : "-"} {student.class || ""}</div>
                </div>
              </motion.div>
            ) : processNumber.length === 5 ? (
              <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm border border-rose-100">
                <p className="font-semibold mb-1">Utilizador não encontrado (Processo: {processNumber}).</p>
                <p className="text-xs text-rose-500">
                  Pode importar os alunos no menu <strong>Atualização de Dados</strong> ou testar com os alunos de exemplo: <strong>12345</strong>, <strong>10001</strong> ou <strong>10002</strong>.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 text-slate-500 rounded-xl text-xs border border-slate-100">
                Introduza o número de processo. Se introduzir <strong>4 dígitos</strong>, será adicionado automaticamente o <strong>0</strong> à esquerda ao mudar de campo.
              </div>
            )}
          </div>

          {/* Right Column: Usage Details */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Área a Frequentar</label>
              <select 
                value={area}
                onChange={(e) => { setArea(e.target.value); setActivity(""); }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Selecione uma área...</option>
                {areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {area && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                <label className="block text-sm font-semibold text-slate-600 mb-2">Atividade</label>
                <select 
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Selecione uma atividade...</option>
                  {activities.map(act => <option key={act} value={act}>{act}</option>)}
                </select>
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-600">Hora Entrada</label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setEntryTime(now.toTimeString().slice(0, 5));
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Agora
                  </button>
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="time" 
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-sm font-semibold text-slate-600">Hora Saída</label>
                    <span className="text-[11px] text-slate-400 font-normal">(Opcional)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {exitTime && (
                      <button
                        type="button"
                        onClick={() => setExitTime("")}
                        className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                      >
                        Limpar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setExitTime(now.toTimeString().slice(0, 5));
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      Agora
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="time" 
                    value={exitTime}
                    onChange={(e) => setExitTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center">
          <button 
            onClick={handleRegister}
            disabled={loading || !student}
            className={`w-full max-w-sm py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center ${
              loading || !student ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200'
            }`}
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Efectuar Registo
          </button>

          <AnimatePresence>
            {message && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-4 text-sm font-medium ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tabela de Registos Efetuados com Edição e Lupa de Procura */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-bold text-slate-800">Registos de Utilização Efetuados</h3>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Hoje: {todayLogsCount} {todayLogsCount === 1 ? 'registo' : 'registos'}</span>
              </div>
              {activeLogsCount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                  <span>{activeLogsCount} {activeLogsCount === 1 ? 'sem saída' : 'sem saída'}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Procure pelo número de processo para localizar o seu registo e registar a hora de saída.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              Total Histórico: <span className="font-bold text-slate-700">{logs.length}</span>
            </div>
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              title="Atualizar listagem"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mensagem de confirmação de saída rápida */}
        <AnimatePresence>
          {checkoutMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
                checkoutMsg.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{checkoutMsg.text}</span>
              </div>
              <button 
                onClick={() => setCheckoutMsg(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Barra de Procura por Número de Processo (Lupa de Procura) */}
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600 pointer-events-none" />
            <input
              type="text"
              value={searchProcess}
              onChange={(e) => setSearchProcess(e.target.value)}
              placeholder="Procurar por número de processo para registar hora de saída... (ex: 12345)"
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-2xs font-medium"
            />
            {searchProcess && (
              <button
                type="button"
                onClick={() => setSearchProcess("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFilterOnlyActive(!filterOnlyActive)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                filterOnlyActive
                  ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Apenas sem saída ({activeLogsCount})</span>
            </button>

            {activeLogsCount > 0 && (
              <button
                type="button"
                onClick={handleSelectAllActive}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all flex items-center gap-1.5"
                title="Selecionar todos os alunos atualmente sem saída para registo em massa"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>Selecionar Todos ({activeLogsCount})</span>
              </button>
            )}

            {(searchProcess || filterOnlyActive) && (
              <button
                type="button"
                onClick={() => {
                  setSearchProcess("");
                  setFilterOnlyActive(false);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1.5 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Barra de Ação de Saída em Massa & Eliminação de Registos */}
        <AnimatePresence>
          {selectedLogIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold shrink-0">
                  <ListChecks className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {selectedLogIds.length} {selectedLogIds.length === 1 ? 'registo selecionado' : 'registos selecionados'}
                    </span>
                    {selectedActiveLogs.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        {selectedActiveLogs.length} sem saída
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Selecione a ação pretendida: registar saída em massa ou eliminar registos da base de dados.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 justify-end">
                {/* Opções de Saída em Massa (se houver registos sem saída entre os selecionados) */}
                {selectedActiveLogs.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-300 font-medium">Hora:</span>
                      <input
                        type="time"
                        value={bulkExitTime || new Date().toTimeString().slice(0, 5)}
                        onChange={(e) => setBulkExitTime(e.target.value)}
                        className="bg-transparent text-white font-mono text-xs font-bold outline-none cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setBulkExitTime(new Date().toTimeString().slice(0, 5))}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase ml-1"
                        title="Definir para a hora atual"
                      >
                        Agora
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenBulkModal}
                      disabled={bulkCheckingOut}
                      title="Requer palavra-passe 'escola' para autorizar a saída em massa"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Registar Saída ({selectedActiveLogs.length})</span>
                    </button>
                  </>
                )}

                {/* Botão de Eliminar Registos Selecionados */}
                <button
                  type="button"
                  onClick={handleOpenBulkDeleteModal}
                  disabled={bulkDeleting}
                  title="Eliminar permanentemente os registos selecionados (requer palavra-passe 'escola')"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <Lock className="w-3 h-3 text-rose-200" />
                  <span>Eliminar ({selectedLogIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-2.5 py-2 transition-colors"
                >
                  Desmarcar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Indicador de resultados da filtragem */}
        {searchProcess && (
          <div className="flex items-center justify-between text-xs px-1 text-slate-600">
            <span>
              A pesquisar pelo processo <strong className="text-indigo-700">"{searchProcess}"</strong>: {filteredLogs.length} {filteredLogs.length === 1 ? 'registo encontrado' : 'registos encontrados'}
            </span>
          </div>
        )}

        {/* Container dimensionado para ~10 registos visíveis com scroll vertical para os restantes */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Ainda não existem registos de utilização efetuados.
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">
                  Nenhum registo encontrado para o processo "{searchProcess}".
                </p>
                <p className="text-xs text-slate-400">
                  Verifique se introduziu os dígitos corretos ou limpe a procura para consultar toda a lista.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchProcess("");
                    setFilterOnlyActive(false);
                  }}
                  className="mt-2 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Limpar Procura
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-xs">
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedLogIds.includes(l.id))}
                        onChange={handleSelectAllVisible}
                        title={filteredLogs.length === 0 ? "Nenhum registo visível" : "Selecionar/desmarcar todos os registos visíveis"}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </th>
                    <th className="py-3 px-3">Data</th>
                    <th className="py-3 px-3">Processo</th>
                    <th className="py-3 px-3">Aluno</th>
                    <th className="py-3 px-3">Turma</th>
                    <th className="py-3 px-3">Área a Frequentar</th>
                    <th className="py-3 px-3">Atividade</th>
                    <th className="py-3 px-3">Entrada</th>
                    <th className="py-3 px-3">Saída</th>
                    <th className="py-3 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLogs.map((log) => {
                    const isWithoutExit = !log.exit_time || log.exit_time.trim() === "";
                    const isSelected = selectedLogIds.includes(log.id);
                    return (
                      <tr 
                        key={log.id}
                        onClick={() => handleOpenEdit(log)}
                        className={`hover:bg-indigo-50/70 cursor-pointer transition-colors group ${
                          isSelected 
                            ? 'bg-indigo-50/90 ring-1 ring-inset ring-indigo-200' 
                            : isWithoutExit ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td 
                          className="py-3 px-3 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(log.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                            title={`Selecionar registo #${String(log.process_number).padStart(5, '0')} (${log.name || 'Aluno'})`}
                          />
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">{log.date}</td>
                        <td className="py-3 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                          <span className="bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
                            {String(log.process_number).padStart(5, '0')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{log.name || "Aluno desconhecido"}</td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {log.grade ? `${log.grade}º ${log.class || ''}` : "-"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 group-hover:bg-indigo-100 group-hover:text-indigo-800 transition-colors">
                            {log.area}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{log.activity}</td>
                        <td className="py-3 px-3 text-slate-600 font-mono">{log.entry_time}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isWithoutExit ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Sem saída
                            </span>
                          ) : (
                            <span className="font-mono font-semibold text-indigo-600">{log.exit_time}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isWithoutExit && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickExit(e, log)}
                                disabled={checkingOutId === log.id}
                                title="Registar saída agora com a hora atual"
                                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl transition-all shadow-2xs hover:scale-102 active:scale-98"
                              >
                                {checkingOutId === log.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <LogOut className="w-3.5 h-3.5" />
                                )}
                                <span>Registar Saída</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(log);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-indigo-700 bg-slate-100 group-hover:bg-indigo-50 px-2.5 py-1.5 rounded-xl transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> {isWithoutExit ? "Ajustar" : "Alterar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Alteração de Área / Hora de Saída */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            >
              <button
                onClick={() => setEditingLog(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  {!editingLog.exit_time ? <LogOut className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {!editingLog.exit_time ? "Registar Hora de Saída" : "Alterar Registo"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingLog.name} (Proc. {String(editingLog.process_number).padStart(5, '0')})
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Área a Frequentar
                  </label>
                  <select 
                    value={editArea}
                    onChange={(e) => {
                      setEditArea(e.target.value);
                      const matchingActs = spaces.filter(s => s.area === e.target.value);
                      if (matchingActs.length > 0) {
                        setEditActivity(matchingActs[0].activity);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {editArea && editActivities.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Atividade
                    </label>
                    <select 
                      value={editActivity}
                      onChange={(e) => setEditActivity(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {editActivities.map(act => <option key={act} value={act}>{act}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <label className="block text-xs font-semibold text-slate-600">
                        Hora de Saída
                      </label>
                      <span className="text-[10px] text-slate-400">(Opcional)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editExitTime && (
                        <button
                          type="button"
                          onClick={() => setEditExitTime("")}
                          className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                        >
                          Limpar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          setEditExitTime(now.toTimeString().slice(0, 5));
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Agora
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="time" 
                      value={editExitTime}
                      onChange={(e) => setEditExitTime(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {editError && (
                  <p className="text-xs text-rose-600 font-medium">{editError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const logId = editingLog.id;
                      setEditingLog(null);
                      setSelectedLogIds([logId]);
                      setBulkDeletePassword("");
                      setBulkDeletePasswordError("");
                      setShowBulkDeleteModal(true);
                    }}
                    className="p-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors shrink-0"
                    title="Eliminar este registo de utilização (requer palavra-passe 'escola')"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingLog(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={editSaving}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {editSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {!editingLog.exit_time ? "Confirmar Saída" : "Guardar Alterações"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação com Palavra-passe para Saída em Massa */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkPassword("");
                  setBulkPasswordError("");
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Autorização de Saída em Massa
                  </h3>
                  <p className="text-xs text-slate-500">
                    Protegido por palavra-passe de administração
                  </p>
                </div>
              </div>

              <form onSubmit={handleConfirmBulkCheckout} className="space-y-4">
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Alunos selecionados:</span>
                    <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {selectedLogIds.length} {selectedLogIds.length === 1 ? 'registo ativo' : 'registos ativos'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Hora de saída a registar:</span>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <input
                        type="time"
                        value={bulkExitTime || new Date().toTimeString().slice(0, 5)}
                        onChange={(e) => setBulkExitTime(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold font-mono text-indigo-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Palavra-passe de Administrador
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      autoFocus
                      required
                      placeholder="Introduza a palavra-passe..."
                      value={bulkPassword}
                      onChange={(e) => {
                        setBulkPassword(e.target.value);
                        if (bulkPasswordError) setBulkPasswordError("");
                      }}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Introduza a palavra-passe para validar e registar a saída em lote.
                  </p>
                </div>

                {bulkPasswordError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                    {bulkPasswordError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkModal(false);
                      setBulkPassword("");
                      setBulkPasswordError("");
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={bulkCheckingOut || !bulkPassword}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {bulkCheckingOut ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Confirmar Saída em Massa</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação com Palavra-passe para Eliminação em Massa */}
      <AnimatePresence>
        {showBulkDeleteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkDeletePassword("");
                  setBulkDeletePasswordError("");
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Eliminar Registos de Utilização
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ação protegida por palavra-passe de administração
                  </p>
                </div>
              </div>

              <form onSubmit={handleConfirmBulkDelete} className="space-y-4">
                <div className="bg-rose-50/80 rounded-2xl p-4 border border-rose-200/80 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-rose-900">
                        Pretende eliminar {selectedLogIds.length} {selectedLogIds.length === 1 ? 'registo selecionado' : 'registos selecionados'}?
                      </p>
                      <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                        Esta ação é <strong>irreversível</strong> e removerá permanentemente os registos selecionados da base de dados e de todas as estatísticas.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Palavra-passe de Administrador
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      autoFocus
                      required
                      placeholder="Introduza a palavra-passe..."
                      value={bulkDeletePassword}
                      onChange={(e) => {
                        setBulkDeletePassword(e.target.value);
                        if (bulkDeletePasswordError) setBulkDeletePasswordError("");
                      }}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Introduza a palavra-passe <span className="font-semibold text-slate-600">"escola"</span> para autorizar a eliminação.
                  </p>
                </div>

                {bulkDeletePasswordError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                    {bulkDeletePasswordError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkDeleteModal(false);
                      setBulkDeletePassword("");
                      setBulkDeletePasswordError("");
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={bulkDeleting || !bulkDeletePassword}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {bulkDeleting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span>Eliminar Definitivamente</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Analysis({ onBack }: { onBack: () => void }) {
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<UsageLog[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [thirtyDaysLogs, setThirtyDaysLogs] = useState<UsageLog[]>([]);
  const [lineChartMetric, setLineChartMetric] = useState<"both" | "uses" | "students">("both");
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"consolidation" | "charts" | "records">("consolidation");

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const past30 = new Date();
      past30.setDate(now.getDate() - 29);
      const past30Str = past30.toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      const [logsRes, spacesRes, thirtyRes] = await Promise.all([
        fetch(`/api/analysis?startDate=${startDate}&endDate=${endDate}`),
        fetch("/api/spaces"),
        fetch(`/api/analysis?startDate=${past30Str}&endDate=${todayStr}`)
      ]);
      
      if (logsRes.ok) setData(await logsRes.json());
      if (spacesRes.ok) setSpaces(await spacesRes.json());
      if (thirtyRes.ok) setThirtyDaysLogs(await thirtyRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const applyPreset = (preset: '30days' | 'thisMonth' | '3months' | 'schoolYear' | 'all') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (preset === '30days') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setStartDate(`${year}-${month}-01`);
      setEndDate(todayStr);
    } else if (preset === '3months') {
      const past = new Date();
      past.setMonth(now.getMonth() - 2);
      past.setDate(1);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'schoolYear') {
      const currentYear = now.getFullYear();
      const schoolYearStart = now.getMonth() >= 8 ? currentYear : currentYear - 1;
      setStartDate(`${schoolYearStart}-09-01`);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate("2020-01-01");
      setEndDate(todayStr);
    }
  };

  const handleExportExcel = () => {
    if (data.length === 0) return;

    const rows = data.map((log) => ({
      "Data": log.date,
      "N.º Processo": String(log.process_number).padStart(5, '0'),
      "Nome do Aluno": log.name || "Desconhecido",
      "Género": log.gender || "-",
      "Ano": log.grade ? `${log.grade}º` : "-",
      "Turma": log.class || "-",
      "N.º Turma": log.class_number || "-",
      "Área a Frequentar": log.area,
      "Atividade": log.activity,
      "Hora Entrada": log.entry_time,
      "Hora Saída": log.exit_time || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registos");
    
    XLSX.writeFile(workbook, `registos_utilizacao_${startDate}_a_${endDate}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (data.length === 0) return;
    setGeneratingPdf(true);
    setExportNotice(null);
    try {
      // Small tick for UI render update
      await new Promise(resolve => setTimeout(resolve, 60));
      generateFormalMonthlyPDF(
        data,
        spaces,
        startDate,
        endDate,
        "Agrupamento de Escolas Vale de São Torcato",
        "Biblioteca Escolar AEVST"
      );
      setExportNotice("Relatório formal em PDF gerado e descarregado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Consolidation calculations for live rendering & consistency with PDF
  const consolidation = useMemo(() => {
    return buildMonthlyConsolidation(data, spaces);
  }, [data, spaces]);

  // Evolution of usage over the last 30 days
  const thirtyDaysTrend = useMemo(() => {
    const list: {
      date: string;
      displayDate: string;
      dayOfWeek: string;
      fullDateLabel: string;
      count: number;
      students: number;
      isWeekend: boolean;
      areas: string[];
    }[] = [];

    const now = new Date();
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const shortDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const fullMonths = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeekIdx = d.getDay();
      const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;
      
      const dayLogs = thirtyDaysLogs.filter(l => l.date === dateStr);
      const uniqueStudents = new Set(dayLogs.map(l => l.process_number)).size;
      const uniqueAreas = Array.from(new Set(dayLogs.map(l => l.area)));

      list.push({
        date: dateStr,
        displayDate: `${d.getDate()} ${monthNames[d.getMonth()]}`,
        dayOfWeek: shortDays[dayOfWeekIdx],
        fullDateLabel: `${dayNames[dayOfWeekIdx]}, ${d.getDate()} de ${fullMonths[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` de ${d.getFullYear()}` : ''}`,
        count: dayLogs.length,
        students: uniqueStudents,
        isWeekend,
        areas: uniqueAreas
      });
    }

    return list;
  }, [thirtyDaysLogs]);

  const thirtyDaysStats = useMemo(() => {
    const totalUses = thirtyDaysLogs.length;
    const activeDays = thirtyDaysTrend.filter(d => d.count > 0);
    const activeDaysCount = activeDays.length;
    
    // Average
    const avgDaily = activeDaysCount > 0 ? (totalUses / activeDaysCount).toFixed(1) : "0.0";
    const avg30Days = (totalUses / 30).toFixed(1);

    // Peak day
    let peakDay = thirtyDaysTrend[0];
    for (const d of thirtyDaysTrend) {
      if (d.count > (peakDay?.count || 0)) {
        peakDay = d;
      }
    }

    // Trend comparison: First 15 days vs Last 15 days
    const firstHalf = thirtyDaysTrend.slice(0, 15).reduce((acc, d) => acc + d.count, 0);
    const secondHalf = thirtyDaysTrend.slice(15).reduce((acc, d) => acc + d.count, 0);
    const diff = secondHalf - firstHalf;
    let percentChange = 0;
    if (firstHalf > 0) {
      percentChange = Math.round((diff / firstHalf) * 100);
    } else if (secondHalf > 0) {
      percentChange = 100;
    }

    // Total unique students in 30 days
    const totalUniqueStudents = new Set(thirtyDaysLogs.map(l => l.process_number)).size;

    return {
      totalUses,
      totalUniqueStudents,
      activeDaysCount,
      avgDaily,
      avg30Days,
      peakDay,
      firstHalf,
      secondHalf,
      diff,
      percentChange
    };
  }, [thirtyDaysLogs, thirtyDaysTrend]);

  const uniqueAreas = Array.from(new Set(spaces.map(s => s.area)));
  const areaStats = uniqueAreas.map(area => ({
    name: area,
    value: data.filter(d => d.area === area).length
  }));

  const genderStats = [
    { name: 'Masculino', value: data.filter(d => d.gender === 'Masculino' || d.gender === 'M').length },
    { name: 'Feminino', value: data.filter(d => d.gender === 'Feminino' || d.gender === 'F').length }
  ];

  const classStats = Array.from(new Set(data.map(d => `${d.grade}º ${d.class}`))).map((label: string) => ({
    name: label,
    value: data.filter(d => `${d.grade}º ${d.class}` === label).length
  })).sort((a, b) => a.name.localeCompare(b.name));

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={onBack} 
          className="flex items-center text-slate-500 hover:text-slate-800 transition-colors w-fit group"
        >
          <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-0.5 transition-transform" /> 
          <span>Voltar ao Menu</span>
        </button>
        <div className="text-right sm:text-left">
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Análise de Utilização</h2>
          <p className="text-xs text-slate-500">Relatórios estatísticos e consolidação mensal de ocupação</p>
        </div>
      </div>

      {/* Notice Banner */}
      {exportNotice && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-sm shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-emerald-900 leading-tight">Relatório Formal Emitido</p>
              <p className="text-xs text-emerald-700">{exportNotice}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setExportNotice(null)}
            className="text-emerald-500 hover:text-emerald-800 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Date Filtering and Actions Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date Range Inputs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center">
              <CalendarIcon className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-slate-400 text-xs font-medium">até</span>
            <div className="flex items-center">
              <CalendarIcon className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-3.5 py-2 rounded-xl">
              {data.length} {data.length === 1 ? 'registo' : 'registos'}
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Botão de Exportar Relatório em PDF (Direção) */}
            <button
              onClick={handleExportPDF}
              disabled={data.length === 0 || generatingPdf}
              title="Gera um relatório formal em PDF com os totais mensais por espaço e turma para a direção da biblioteca"
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs ${
                data.length === 0 || generatingPdf
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white hover:shadow-indigo-100'
              }`}
            >
              {generatingPdf ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <FileText className="w-4 h-4 text-white" />
              )}
              <span>Exportar Relatório PDF (Direção)</span>
            </button>

            {/* Botão de Exportar Tabela Excel */}
            <button
              onClick={handleExportExcel}
              disabled={data.length === 0}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-xs ${
                data.length === 0 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-98'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Quick Date Range Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-400 font-medium mr-1.5">Períodos rápidos:</span>
          <button
            type="button"
            onClick={() => applyPreset('30days')}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Últimos 30 Dias
          </button>
          <button
            type="button"
            onClick={() => applyPreset('thisMonth')}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Este Mês
          </button>
          <button
            type="button"
            onClick={() => applyPreset('3months')}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Últimos 3 Meses
          </button>
          <button
            type="button"
            onClick={() => applyPreset('schoolYear')}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Ano Letivo
          </button>
          <button
            type="button"
            onClick={() => applyPreset('all')}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Todo o Histórico
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveView("consolidation")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeView === "consolidation"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Consolidação Mensal (Espaços & Turmas)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeView === "consolidation" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
          }`}>
            Direção
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView("charts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeView === "charts"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Evolução & Gráficos</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeView === "charts" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
          }`}>
            30 Dias
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView("records")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeView === "records"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white"
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Tabela de Registos ({data.length})</span>
        </button>
      </div>

      {/* VIEW 1: CONSOLIDAÇÃO MENSAL (DOCUMENTO FORMAL PARA A DIREÇÃO) */}
      {activeView === "consolidation" && (
        <div className="space-y-6">
          {/* Executive Overview Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total de Utilizações
              </span>
              <span className="text-2xl font-extrabold text-slate-800">{consolidation.totalLogs}</span>
              <span className="text-xs text-slate-500 block mt-1">no período analisado</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Alunos Distintos
              </span>
              <span className="text-2xl font-extrabold text-indigo-600">{consolidation.distinctStudents}</span>
              <span className="text-xs text-slate-500 block mt-1">utilizadores únicos</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Turmas Envolvidas
              </span>
              <span className="text-2xl font-extrabold text-purple-600">{consolidation.distinctClasses}</span>
              <span className="text-xs text-slate-500 block mt-1">turmas participantes</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Meses no Relatório
              </span>
              <span className="text-2xl font-extrabold text-emerald-600">{consolidation.months.length}</span>
              <span className="text-xs text-slate-500 block mt-1 truncate">
                {formatShortMonthLabel(consolidation.months[0])} a {formatShortMonthLabel(consolidation.months[consolidation.months.length - 1])}
              </span>
            </div>
          </div>

          {/* Banner with Direct PDF Export Button for Library Direction */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md border border-indigo-900/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  DOCUMENTO OFICIAL
                </span>
                <span className="text-xs text-indigo-200">Para Direção & Conselho Pedagógico</span>
              </div>
              <h3 className="text-base font-bold text-white">Relatório Formal de Gestão e Ocupação de Espaços</h3>
              <p className="text-xs text-slate-300 max-w-xl">
                Contém a matriz consolidada de totais mensais por espaço e turma, análise de atividades e campos formais de assinatura para homologação da Direção do Agrupamento.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={data.length === 0 || generatingPdf}
              className={`shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all shadow-md ${
                data.length === 0 || generatingPdf
                  ? 'bg-white/10 text-white/50 cursor-not-allowed'
                  : 'bg-indigo-500 hover:bg-indigo-600 active:scale-98 text-white'
              }`}
            >
              {generatingPdf ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Descarregar Relatório PDF Completo</span>
            </button>
          </div>

          {/* Table 1: Monthly Consolidation by Space */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-800">1. Totais Mensais de Ocupação por Espaço</h3>
                <p className="text-xs text-slate-500">Distribuição mensal de utilizações nos espaços monitorizados da Biblioteca</p>
              </div>
              {consolidation.topSpace && (
                <div className="text-xs bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-xl font-medium w-fit">
                  Espaço Líder: <strong>{consolidation.topSpace.area}</strong> ({consolidation.topSpace.count} visitas • {consolidation.topSpace.percentage}%)
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 rounded-l-xl">Espaço / Área</th>
                    {consolidation.months.map(m => (
                      <th key={m} className="py-3 px-3 text-center">{formatShortMonthLabel(m)}</th>
                    ))}
                    <th className="py-3 px-4 text-center font-bold text-indigo-700">Total Período</th>
                    <th className="py-3 px-4 text-right rounded-r-xl">% Relativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consolidation.spacesData.map((s) => (
                    <tr key={s.area} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{s.area}</td>
                      {consolidation.months.map(m => (
                        <td key={m} className="py-3 px-3 text-center font-mono text-slate-600">
                          {s.monthlyCounts[m] > 0 ? (
                            <span className="font-semibold text-slate-800">{s.monthlyCounts[m]}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/40">
                        {s.total}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {s.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100/70 font-bold text-slate-800">
                    <td className="py-3 px-4">TOTAL GERAL DE OCUPAÇÃO</td>
                    {consolidation.months.map(m => {
                      const totalM = consolidation.spacesData.reduce((acc, s) => acc + (s.monthlyCounts[m] || 0), 0);
                      return (
                        <td key={m} className="py-3 px-3 text-center font-mono">{totalM}</td>
                      );
                    })}
                    <td className="py-3 px-4 text-center font-mono text-indigo-800 bg-indigo-100/60">
                      {consolidation.spacesData.reduce((acc, s) => acc + s.total, 0)}
                    </td>
                    <td className="py-3 px-4 text-right">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Table 2: Monthly Consolidation by Class */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-800">2. Totais Mensais de Ocupação por Turma</h3>
                <p className="text-xs text-slate-500">Participação consolidada mensal por turma e ano de escolaridade</p>
              </div>
              {consolidation.topClass && (
                <div className="text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl font-medium w-fit">
                  Turma Mais Frequente: <strong>{consolidation.topClass.className}</strong> ({consolidation.topClass.count} presenças • {consolidation.topClass.percentage}%)
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 rounded-l-xl">Ano / Turma</th>
                    {consolidation.months.map(m => (
                      <th key={m} className="py-3 px-3 text-center">{formatShortMonthLabel(m)}</th>
                    ))}
                    <th className="py-3 px-4 text-center font-bold text-indigo-700">Total Período</th>
                    <th className="py-3 px-4 text-right rounded-r-xl">% Relativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consolidation.classesData.map((c) => (
                    <tr key={c.className} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          {c.className}
                        </span>
                      </td>
                      {consolidation.months.map(m => (
                        <td key={m} className="py-3 px-3 text-center font-mono text-slate-600">
                          {c.monthlyCounts[m] > 0 ? (
                            <span className="font-semibold text-slate-800">{c.monthlyCounts[m]}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/40">
                        {c.total}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {c.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100/70 font-bold text-slate-800">
                    <td className="py-3 px-4">TOTAL GERAL POR TURMAS</td>
                    {consolidation.months.map(m => {
                      const totalM = consolidation.classesData.reduce((acc, c) => acc + (c.monthlyCounts[m] || 0), 0);
                      return (
                        <td key={m} className="py-3 px-3 text-center font-mono">{totalM}</td>
                      );
                    })}
                    <td className="py-3 px-4 text-center font-mono text-indigo-800 bg-indigo-100/60">
                      {consolidation.classesData.reduce((acc, c) => acc + c.total, 0)}
                    </td>
                    <td className="py-3 px-4 text-right">100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Breakdown by Grade and Top Activities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Grade */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
              <h4 className="text-sm font-bold text-slate-800">Distribuição por Ano de Escolaridade</h4>
              <div className="space-y-2">
                {consolidation.gradesData.map(g => (
                  <div key={g.gradeLabel} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50">
                    <span className="font-medium text-slate-700">{g.gradeLabel}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-800">{g.total} utilizações</span>
                      <span className="text-slate-400 font-medium">({g.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Activities */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
              <h4 className="text-sm font-bold text-slate-800">Principais Atividades Requisitadas</h4>
              <div className="space-y-2">
                {consolidation.activitiesData.slice(0, 5).map(act => (
                  <div key={`${act.area}-${act.activity}`} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50">
                    <div>
                      <span className="font-semibold text-slate-800">{act.activity}</span>
                      <span className="text-[11px] text-slate-400 block">{act.area}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600">{act.total}</span>
                      <span className="text-slate-400">({act.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: GRÁFICOS & DISTRIBUIÇÃO */}
      {activeView === "charts" && (
        <div className="space-y-8">
          {/* GRÁFICO DE LINHAS: EVOLUÇÃO DAS UTILIZAÇÕES (ÚLTIMOS 30 DIAS) */}
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Evolução do Número de Utilizações (Últimos 30 Dias)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Apresenta a evolução diária contínua e as tendências de frequência na biblioteca escolar.
                </p>
              </div>

              {/* Metric filter pills */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium w-fit">
                <button
                  type="button"
                  onClick={() => setLineChartMetric("both")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    lineChartMetric === "both"
                      ? "bg-white text-indigo-700 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Ambas as Métricas
                </button>
                <button
                  type="button"
                  onClick={() => setLineChartMetric("uses")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    lineChartMetric === "uses"
                      ? "bg-white text-indigo-700 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Só Utilizações
                </button>
                <button
                  type="button"
                  onClick={() => setLineChartMetric("students")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    lineChartMetric === "students"
                      ? "bg-white text-emerald-700 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Só Alunos Únicos
                </button>
              </div>
            </div>

            {/* Quick Trend Indicator Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Total 30 Days */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total em 30 Dias
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-slate-800">{thirtyDaysStats.totalUses}</span>
                  <span className="text-xs font-semibold text-slate-500">utilizações</span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">
                  {thirtyDaysStats.totalUniqueStudents} alunos distintos
                </span>
              </div>

              {/* Active School Days Average */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Média por Dia Ativo
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-indigo-600">{thirtyDaysStats.avgDaily}</span>
                  <span className="text-xs font-semibold text-slate-500">utiliz./dia</span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">
                  em {thirtyDaysStats.activeDaysCount} dias com atividade
                </span>
              </div>

              {/* Peak Attendance */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Pico de Afluência
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-amber-600">{thirtyDaysStats.peakDay?.count || 0}</span>
                  <span className="text-xs font-semibold text-slate-500">máximo</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium block mt-1 truncate">
                  {thirtyDaysStats.peakDay?.count && thirtyDaysStats.peakDay.count > 0 
                    ? `em ${thirtyDaysStats.peakDay.displayDate} (${thirtyDaysStats.peakDay.dayOfWeek})` 
                    : "Sem afluência"}
                </span>
              </div>

              {/* Frequency Trend comparison */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Tendência de Frequência
                </span>
                <div className="flex items-baseline gap-1.5">
                  {thirtyDaysStats.diff > 0 ? (
                    <span className="text-2xl font-extrabold text-emerald-600">+{thirtyDaysStats.percentChange}%</span>
                  ) : thirtyDaysStats.diff < 0 ? (
                    <span className="text-2xl font-extrabold text-rose-600">{thirtyDaysStats.percentChange}%</span>
                  ) : (
                    <span className="text-2xl font-extrabold text-slate-600">Estável</span>
                  )}
                  <span 
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{
                      backgroundColor: thirtyDaysStats.diff > 0 ? '#dcfce7' : thirtyDaysStats.diff < 0 ? '#fee2e2' : '#f1f5f9',
                      color: thirtyDaysStats.diff > 0 ? '#15803d' : thirtyDaysStats.diff < 0 ? '#b91c1c' : '#475569'
                    }}
                  >
                    {thirtyDaysStats.diff > 0 ? 'Crescimento' : thirtyDaysStats.diff < 0 ? 'Redução' : 'Equilíbrio'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">
                  2ª quinzena ({thirtyDaysStats.secondHalf}) vs 1ª ({thirtyDaysStats.firstHalf})
                </span>
              </div>
            </div>

            {/* The Line Chart Container */}
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={thirtyDaysTrend} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    interval={2}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-xs text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/60 text-xs min-w-[210px] space-y-2">
                            <div className="border-b border-slate-700/60 pb-1.5 flex items-center justify-between">
                              <span className="font-bold text-slate-100">{item.fullDateLabel}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${item.isWeekend ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
                                {item.dayOfWeek}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-300 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                                  Utilizações:
                                </span>
                                <span className="font-bold font-mono text-indigo-300 text-sm">{item.count}</span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-slate-300 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                  Alunos distintos:
                                </span>
                                <span className="font-bold font-mono text-emerald-300 text-sm">{item.students}</span>
                              </div>
                            </div>

                            {item.count === 0 ? (
                              <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800">
                                {item.isWeekend ? "Fim de semana (biblioteca encerrada)" : "Sem registos neste dia"}
                              </div>
                            ) : item.areas && item.areas.length > 0 ? (
                              <div className="pt-1.5 border-t border-slate-800">
                                <span className="text-[10px] text-slate-400 block mb-1">Áreas frequentadas:</span>
                                <div className="flex flex-wrap gap-1">
                                  {item.areas.map((a: string) => (
                                    <span key={a} className="text-[10px] bg-white/10 text-slate-200 px-1.5 py-0.5 rounded">
                                      {a}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {(lineChartMetric === "both" || lineChartMetric === "uses") && (
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      name="Total de Utilizações" 
                      stroke="#4f46e5" 
                      strokeWidth={3} 
                      dot={{ r: 3, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 6, fill: '#4f46e5', stroke: '#c7d2fe', strokeWidth: 3 }}
                    />
                  )}
                  {(lineChartMetric === "both" || lineChartMetric === "students") && (
                    <Line 
                      type="monotone" 
                      dataKey="students" 
                      name="Alunos Distintos" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      dot={{ r: 2.5, fill: '#10b981', strokeWidth: 1.5, stroke: '#ffffff' }}
                      activeDot={{ r: 5, fill: '#10b981', stroke: '#a7f3d0', strokeWidth: 2.5 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend & Contextual Note */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-4">
                {(lineChartMetric === "both" || lineChartMetric === "uses") && (
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-1 bg-indigo-600 rounded-full"></span>
                    <span className="font-semibold text-slate-700">Utilizações Diárias</span>
                  </div>
                )}
                {(lineChartMetric === "both" || lineChartMetric === "students") && (
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-1 border-b-2 border-dashed border-emerald-500"></span>
                    <span className="font-semibold text-slate-700">Alunos Únicos</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                Dias de fim de semana e feriados com 0 utilizações refletem encerramento programado.
              </span>
            </div>
          </div>

          {/* Demais Distribuições (Área, Género e Turmas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Area Distribution */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-[400px]">
              <h3 className="text-lg font-bold text-slate-700 mb-6">Registos por Área</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gender Distribution */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-[400px]">
              <h3 className="text-lg font-bold text-slate-700 mb-6">Registos por Género</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {genderStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Class Distribution */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-[400px] lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-700 mb-6">Registos por Turma e Ano</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="#4f46e5" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: TABELA DE REGISTOS */}
      {activeView === "records" && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Tabela de Registos de Utilização</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Registos filtrados no período de {startDate} a {endDate}.
              </p>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={data.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                data.length === 0 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <Download className="w-3.5 h-3.5" /> Exportar (.xlsx)
            </button>
          </div>

          <div className="overflow-x-auto">
            {data.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Não foram encontrados registos para o intervalo de datas selecionado.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="pb-3 px-3">Data</th>
                    <th className="pb-3 px-3">Processo</th>
                    <th className="pb-3 px-3">Aluno</th>
                    <th className="pb-3 px-3">Turma</th>
                    <th className="pb-3 px-3">Área</th>
                    <th className="pb-3 px-3">Atividade</th>
                    <th className="pb-3 px-3">Entrada</th>
                    <th className="pb-3 px-3">Saída</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{log.date}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono">{String(log.process_number).padStart(5, '0')}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{log.name || "Desconhecido"}</td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {log.grade ? `${log.grade}º ${log.class || ''}` : "-"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {log.area}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{log.activity}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono">{log.entry_time}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{log.exit_time || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DataUpdate({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"csv" | "excel">("csv");

  // Excel Students state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  // CSV Historical Usage state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: boolean; count?: number; skipped?: number; total?: number; error?: string } | null>(null);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-students", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setResult({ success: true, count: data.count });
        setFile(null);
      } else {
        const err = await res.json();
        setResult({ success: false, error: err.error });
      }
    } catch (err) {
      setResult({ success: false, error: "Erro de ligação ao servidor." });
    } finally {
      setUploading(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;

    setCsvUploading(true);
    setCsvResult(null);

    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const res = await fetch("/api/upload-usage-csv", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setCsvResult({
          success: true,
          count: data.count,
          skipped: data.skipped,
          total: data.total
        });
        setCsvFile(null);
      } else {
        const err = await res.json();
        setCsvResult({ success: false, error: err.error });
      }
    } catch (err) {
      setCsvResult({ success: false, error: "Erro de ligação ao servidor ao carregar CSV." });
    } finally {
      setCsvUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors group">
          <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-0.5 transition-transform" /> Voltar ao Menu
        </button>
        <div className="text-right">
          <h2 className="text-2xl font-extrabold text-slate-800">Atualização de Dados</h2>
          <p className="text-xs text-slate-500">Importação de ficheiros e sincronização da base de dados</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="bg-slate-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => {
            setActiveTab("csv");
            setCsvResult(null);
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "csv"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Registos Históricos de Utilização (CSV)</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            CSV
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("excel");
            setResult(null);
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "excel"
              ? "bg-white text-amber-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Base de Alunos (Excel)</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
            XLSX
          </span>
        </button>
      </div>

      {/* TAB 1: CSV HISTORICAL USAGE IMPORT */}
      {activeTab === "csv" && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div className="text-left">
              <h3 className="text-base font-bold text-slate-800">Importação de Registos Históricos (CSV)</h3>
              <p className="text-xs text-slate-500">
                Adicione registos passados de frequência e atividades da biblioteca através de ficheiros CSV.
              </p>
            </div>
            <a
              href="/api/template/usage-csv"
              download="modelo_registos_historicos.csv"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition-colors shrink-0 w-fit"
            >
              <Download className="w-3.5 h-3.5" />
              Descarregar Modelo CSV
            </a>
          </div>

          <div className="p-8 md:p-10 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/70 flex flex-col items-center group hover:border-indigo-400 transition-colors">
            <div className="w-14 h-14 bg-indigo-100 p-3.5 rounded-2xl text-indigo-600 mb-4 group-hover:scale-105 transition-transform flex items-center justify-center">
              <Upload className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-700 mb-1">Selecionar Ficheiro CSV</h4>
            <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto leading-relaxed">
              O ficheiro pode utilizar vírgula (<code className="font-mono text-slate-700">,</code>) ou ponto e vírgula (<code className="font-mono text-slate-700">;</code>) e conter os campos:<br/>
              <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-1">
                Data, Processo, Área, Atividade, Hora Entrada, Hora Saída
              </span>
            </p>

            <input 
              type="file" 
              accept=".csv, text/csv, .txt"
              onChange={(e) => {
                setCsvFile(e.target.files?.[0] || null);
                setCsvResult(null);
              }}
              className="hidden" 
              id="csv-usage-upload"
            />
            <label 
              htmlFor="csv-usage-upload"
              className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-all hover:border-indigo-300"
            >
              {csvFile ? `Ficheiro: ${csvFile.name} (${Math.round(csvFile.size / 1024)} KB)` : "Escolher Ficheiro CSV..."}
            </label>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 text-left border border-slate-100 text-xs text-slate-600 space-y-1.5">
            <p className="font-bold text-slate-700">Informações sobre o processamento automático:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
              <li>Reconhece datas no formato <code className="font-mono">AAAA-MM-DD</code> ou <code className="font-mono">DD/MM/AAAA</code>.</li>
              <li>Detecta automaticamente o separador de colunas (<code className="font-mono">;</code> ou <code className="font-mono">,</code>) e codificação UTF-8 com ou sem BOM.</li>
              <li>Evita duplicados: registos idênticos (mesmo processo, data e hora de entrada) são ignorados com segurança.</li>
              <li>Os registos importados ficam imediatamente disponíveis nas estatísticas e no <strong>Relatório Formal em PDF</strong>.</li>
            </ul>
          </div>

          <button 
            type="button"
            onClick={handleCsvUpload}
            disabled={!csvFile || csvUploading}
            className={`w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-sm transition-all flex items-center justify-center gap-2 ${
              !csvFile || csvUploading 
                ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 shadow-indigo-100'
            }`}
          >
            {csvUploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                A importar registos históricos...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Importar Registos Históricos (CSV)
              </>
            )}
          </button>

          <AnimatePresence>
            {csvResult && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl text-xs font-semibold text-left flex items-start gap-3 ${
                  csvResult.success 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {csvResult.success ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-900 text-sm">Importação Concluída com Sucesso!</p>
                      <p className="mt-0.5 text-emerald-700">
                        Foram inseridos <strong>{csvResult.count}</strong> novos registos históricos de utilização.
                        {csvResult.skipped && csvResult.skipped > 0 ? (
                          <span> ({csvResult.skipped} registos duplicados ou sem processo válido foram ignorados).</span>
                        ) : null}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-900 text-sm">Erro na Importação</p>
                      <p className="mt-0.5 text-rose-700">{csvResult.error}</p>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* TAB 2: EXCEL STUDENTS IMPORT */}
      {activeTab === "excel" && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div className="text-left">
              <h3 className="text-base font-bold text-slate-800">Importação de Base de Alunos (Excel)</h3>
              <p className="text-xs text-slate-500">
                Atualize a listagem geral de alunos da escola com números de processo, turmas e anos letivos.
              </p>
            </div>
            <a
              href="/api/template/students"
              download="modelo_alunos.xlsx"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3.5 py-2 rounded-xl transition-colors shrink-0 w-fit"
            >
              <Download className="w-3.5 h-3.5" />
              Descarregar Modelo Excel
            </a>
          </div>

          <div className="p-8 md:p-10 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/70 flex flex-col items-center group hover:border-amber-400 transition-colors">
            <div className="w-14 h-14 bg-amber-100 p-3.5 rounded-2xl text-amber-600 mb-4 group-hover:scale-105 transition-transform flex items-center justify-center">
              <Upload className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-700 mb-1">Carregar Ficheiro Excel (.xlsx)</h4>
            <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto leading-relaxed">
              O ficheiro deve conter as colunas: <br/>
              <span className="font-mono text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md inline-block mt-1">
                Processo, Nome, Genero, Numero, Ano, Turma
              </span>
            </p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setResult(null);
              }}
              className="hidden" 
              id="excel-upload"
            />
            <label 
              htmlFor="excel-upload"
              className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-all hover:border-amber-300"
            >
              {file ? `Ficheiro: ${file.name}` : "Escolher Ficheiro Excel..."}
            </label>
          </div>

          <button 
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-sm transition-all flex items-center justify-center gap-2 ${
              !file || uploading ? 'bg-slate-300 cursor-not-allowed text-slate-500' : 'bg-amber-600 hover:bg-amber-700 active:scale-98 shadow-amber-100'
            }`}
          >
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar Base de Dados de Alunos
          </button>

          <AnimatePresence>
            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl text-xs font-semibold text-left flex items-start gap-3 ${
                  result.success 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {result.success ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-900 text-sm">Atualização Concluída</p>
                      <p className="mt-0.5 text-emerald-700">Foram atualizados {result.count} registos de alunos.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-900 text-sm">Erro</p>
                      <p className="mt-0.5 text-rose-700">{result.error}</p>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function SpaceUpdate({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean, count?: number, error?: string } | null>(null);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-spaces", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setResult({ success: true, count: data.count });
        setFile(null);
      } else {
        const err = await res.json();
        setResult({ success: false, error: err.error });
      }
    } catch (err) {
      setResult({ success: false, error: "Erro de ligação ao servidor." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" /> Voltar
        </button>
        <h2 className="text-2xl font-bold text-slate-800">Atualização de Espaços</h2>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
        <div className="mb-6 flex justify-end">
          <a
            href="/api/template/spaces"
            download="modelo_espacos.xlsx"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Descarregar Modelo Excel
          </a>
        </div>

        <div className="mb-8 p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center group hover:border-cyan-400 transition-colors">
          <div className="bg-cyan-100 p-4 rounded-2xl text-cyan-600 mb-4 group-hover:scale-110 transition-transform">
            <MapPin className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Carregar Ficheiro Excel</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
            O ficheiro deve conter as colunas: <br/>
            <span className="font-mono text-cyan-600">Area, Atividade</span>
          </p>
          
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden" 
            id="space-upload"
          />
          <label 
            htmlFor="space-upload"
            className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
          >
            {file ? file.name : "Selecionar Ficheiro"}
          </label>
        </div>

        <button 
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center ${
            !file || uploading ? 'bg-slate-300 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700 hover:shadow-cyan-200'
          }`}
        >
          {uploading ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <RefreshCw className="w-5 h-5 mr-2" />}
          Atualizar Espaços e Atividades
        </button>

        <AnimatePresence>
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-6 p-4 rounded-xl text-sm font-medium ${result.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}
            >
              {result.success ? `Sucesso! Foram atualizados ${result.count} registos de espaços.` : `Erro: ${result.error}`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
