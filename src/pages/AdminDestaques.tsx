import { useState, useEffect, useMemo, useRef } from "react";
import * as LucideIcons from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Pega TODOS os nomes de ícones válidos do Lucide
const allIconNames = Object.keys(LucideIcons).filter(key => /^[A-Z]/.test(key) && key !== 'LucideProps' && key !== 'Icon');

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Image;
  return <IconComponent className={className} />;
};

// --- MOTOR DE TIPOGRAFIA DINÂMICA ---
const getDynamicTitleSize = (text: string, isMobile: boolean) => {
  const len = text.length;
  if (isMobile) {
    if (len < 20) return "text-xl";
    if (len < 40) return "text-lg";
    return "text-base leading-tight";
  } else {
    if (len < 20) return "text-3xl md:text-4xl";
    if (len < 40) return "text-2xl md:text-3xl";
    return "text-xl md:text-2xl leading-tight";
  }
};

const getDynamicDescSize = (text: string, isMobile: boolean) => {
  const len = text.length;
  if (isMobile) {
    if (len < 60) return "text-xs";
    if (len < 100) return "text-[11px] leading-snug";
    return "text-[10px] leading-tight";
  } else {
    if (len < 60) return "text-sm md:text-base";
    if (len < 120) return "text-xs md:text-sm leading-relaxed";
    return "text-[11px] md:text-xs leading-snug";
  }
};

export default function AdminDestaques() {
  const [highlights, setHighlights] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- MOTOR DA OFICINA ---
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [iconName, setIconName] = useState("Sparkles");
  
  // Customizações
  const [themeId, setThemeId] = useState("cyberpunk");
  const [patternId, setPatternId] = useState("grid");
  const [alignment, setAlignment] = useState("text-left items-start text-start");
  const [enableGlow, setEnableGlow] = useState(true);
  
  // Controles de UI
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");

  // Motor 3D (Parallax)
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)' });

  const filteredIcons = useMemo(() => {
    return allIconNames
      .filter(name => name.toLowerCase().includes(iconSearch.toLowerCase()))
      .slice(0, 60);
  }, [iconSearch]);

  // --- BIBLIOTECA DE PEÇAS ---
  const THEMES = [
    { id: 'cyberpunk', name: 'Cyberpunk', bg: 'bg-gradient-to-br from-yellow-500/20 to-pink-600/20', border: 'border-yellow-500/50', glow: 'shadow-[0_0_50px_rgba(234,179,8,0.3)]', hex: 'bg-gradient-to-br from-yellow-400 to-pink-500', ambient: 'bg-yellow-500/10' },
    { id: 'neon', name: 'Neon Void', bg: 'bg-gradient-to-br from-fuchsia-600/20 to-purple-700/20', border: 'border-fuchsia-500/50', glow: 'shadow-[0_0_50px_rgba(192,38,211,0.3)]', hex: 'bg-gradient-to-br from-fuchsia-500 to-purple-600', ambient: 'bg-fuchsia-500/10' },
    { id: 'hacker', name: 'Terminal', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', glow: 'shadow-[0_0_50px_rgba(16,185,129,0.2)]', hex: 'bg-emerald-500', ambient: 'bg-emerald-500/10' },
    { id: 'royal', name: 'Royal Gold', bg: 'bg-gradient-to-br from-amber-500/20 to-orange-600/20', border: 'border-amber-500/50', glow: 'shadow-[0_0_50px_rgba(245,158,11,0.3)]', hex: 'bg-gradient-to-br from-amber-400 to-orange-500', ambient: 'bg-amber-500/10' },
    { id: 'alert', name: 'Danger', bg: 'bg-gradient-to-br from-red-600/20 to-rose-800/20', border: 'border-red-500/50', glow: 'shadow-[0_0_50px_rgba(239,68,68,0.3)]', hex: 'bg-gradient-to-br from-red-500 to-rose-700', ambient: 'bg-red-500/10' },
    { id: 'ocean', name: 'Deep Sea', bg: 'bg-gradient-to-br from-cyan-500/20 to-blue-700/20', border: 'border-cyan-500/50', glow: 'shadow-[0_0_50px_rgba(6,182,212,0.3)]', hex: 'bg-gradient-to-br from-cyan-400 to-blue-600', ambient: 'bg-cyan-500/10' },
  ];

  const PATTERNS = [
    { id: 'none', name: 'Liso', class: '' },
    { id: 'grid', name: 'Grid', class: 'bg-[linear-gradient(to_right,#ffffff0f_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0f_1px,transparent_1px)] bg-[size:24px_24px]' },
    { id: 'dots', name: 'Dots', class: 'bg-[radial-gradient(#ffffff20_1px,transparent_1px)] bg-[size:20px_20px]' },
    { id: 'scanlines', name: 'Scan', class: 'bg-[linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:100%_6px]' },
  ];

  const ALIGNMENTS = [
    { id: 'text-left items-start text-start', icon: 'AlignLeft', label: 'Esquerda' },
    { id: 'text-center items-center text-center', icon: 'AlignCenter', label: 'Centro' },
    { id: 'text-right items-end text-end', icon: 'AlignRight', label: 'Direita' },
  ];

  const activeTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const activePattern = PATTERNS.find(p => p.id === patternId) || PATTERNS[0];

  const finalBgClass = cn(activeTheme.bg, activePattern.class, alignment, enableGlow ? activeTheme.glow : 'shadow-none');
  const finalBorderClass = activeTheme.border;

  // --- EFEITO 3D PARALLAX ---
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -6; 
    const rotateY = ((x - centerX) / centerX) * 6;
    
    setTiltStyle({ transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)` });
  };

  const handleMouseLeave = () => {
    setTiltStyle({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)' });
  };

  const generateRandomPreset = () => {
    const randomPresets = [
      { t: "Alerta Crítico: Reposição Imediata", d: "Atenção equipe de logística: 15 produtos atingiram a margem de segurança. Iniciar protocolo de reposição urgente.", i: "AlertTriangle", c: "alert", p: "scanlines", a: "text-center items-center text-center" },
      { t: "Auditoria 100% Concluída", d: "A verificação quinzenal do Setor A foi finalizada com sucesso absoluto. Excelente trabalho de toda a equipe envolvida!", i: "ShieldCheck", c: "emerald", p: "dots", a: "text-left items-start text-start" },
      { t: "Atualização", d: "O sistema será reiniciado às 03:00.", i: "Zap", c: "cyberpunk", p: "grid", a: "text-right items-end text-end" },
      { t: "Meta Histórica Atingida!", d: "Superamos o recorde de separações de pedidos diários pelo terceiro mês consecutivo. Vocês são imbatíveis.", i: "Trophy", c: "royal", p: "none", a: "text-center items-center text-center" },
    ];
    const pick = randomPresets[Math.floor(Math.random() * randomPresets.length)];
    setTitle(pick.t); setDesc(pick.d); setIconName(pick.i); setThemeId(pick.c); setPatternId(pick.p); setAlignment(pick.a);
  };

  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        const response = await api.get('/dashboard/highlights');
        if (response.data) setHighlights(response.data);
      } catch (error) {}
    };
    fetchHighlights();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const newHighlight = { title, desc, icon: iconName, bg: finalBgClass, border: finalBorderClass };
    try {
      const response = await api.post('/dashboard/highlights', newHighlight);
      setHighlights([response.data, ...highlights]);
      setTitle(""); setDesc("");
    } catch (error) {} finally { setIsLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Desinstalar esta peça da garagem?")) return;
    try {
      await api.delete(`/dashboard/highlights/${id}`);
      setHighlights(highlights.filter((item) => item.id !== id));
    } catch (error) {}
  };

  return (
    <div className="w-full min-h-screen bg-[#020617] text-white p-4 md:p-6 lg:p-10 font-sans overflow-x-hidden selection:bg-blue-500/30">
      
      {/* MODAL DE ÍCONES */}
      {isIconModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-[0_0_100px_rgba(37,99,235,0.2)] overflow-hidden ring-1 ring-white/10">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg"><LucideIcons.PackageSearch className="w-5 h-5 text-blue-400" /></div>
                Catálogo de Hologramas
              </h3>
              <button onClick={() => setIsIconModalOpen(false)} className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors">
                <LucideIcons.X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 border-b border-white/10 bg-gradient-to-b from-black/40 to-[#020617]">
              <div className="relative">
                <LucideIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
                <input 
                  type="text" placeholder="Inicie a varredura (ex: Zap, Target, Box)..." value={iconSearch} onChange={(e) => setIconSearch(e.target.value)} autoFocus
                  className="w-full bg-black/50 border border-white/20 rounded-2xl pl-14 pr-4 py-4 text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-lg transition-all shadow-inner"
                />
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4 bg-[#0f172a]/50">
              {filteredIcons.map(name => (
                <button 
                  key={name} onClick={() => { setIconName(name); setIsIconModalOpen(false); }}
                  className="flex flex-col items-center gap-3 p-4 rounded-xl border border-transparent hover:border-blue-500/50 hover:bg-blue-500/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all group"
                >
                  <DynamicIcon name={name} className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-transform group-hover:scale-125 duration-300 drop-shadow-lg" />
                  <span className="text-[10px] text-slate-500 truncate w-full text-center group-hover:text-white font-medium">{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-700">
        
        {/* CABEÇALHO HUD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-black/40 backdrop-blur-2xl border border-white/10 p-5 md:p-6 rounded-[2rem] shadow-2xl gap-4">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="h-12 w-12 md:h-14 md:w-14 shrink-0 rounded-[1.2rem] bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] border border-blue-400/30">
              <LucideIcons.Figma className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400">Control Desk</h1>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">Link Ativo</span>
                </div>
              </div>
              <p className="text-slate-400 text-xs md:text-sm font-medium">Renderização de destaques globais em tempo real.</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button onClick={generateRandomPreset} variant="outline" className="h-10 md:h-12 flex-1 md:flex-none bg-white/5 hover:bg-white/10 text-white border-white/10 rounded-xl transition-all shadow-lg">
              <LucideIcons.Dices className="w-4 h-4 md:w-5 md:h-5 mr-2 text-yellow-400" /> <span className="hidden sm:inline">Presets</span>
            </Button>
            <Link to="/" className="flex-1 md:flex-none">
              <Button className="h-10 md:h-12 w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold border-0 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                <LucideIcons.Rocket className="w-4 h-4 mr-2" /> Lançar
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* --- PAINEL DE CONTROLE (Fixo sem Rolagem) --- */}
          {/* Removido o max-h e o overflow. Agora é h-fit (altura exata do conteúdo). */}
          <Card className="xl:col-span-4 bg-[#0f172a]/80 backdrop-blur-xl border-white/10 shadow-2xl rounded-[2.5rem] sticky top-6 overflow-hidden h-fit">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-400 to-purple-600 z-10"></div>
            
            <CardContent className="p-5 md:p-6 relative">
              <form onSubmit={handleSave} className="space-y-6">
                
                {/* 1. Conteúdo */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 border-b border-white/5 pb-2 flex items-center gap-2">
                    <LucideIcons.TextCursorInput className="w-3.5 h-3.5" /> Matriz de Texto
                  </h3>
                  <div className="space-y-1.5 group">
                    <label className="text-[11px] font-bold text-slate-400 group-focus-within:text-blue-400 transition-colors">Adesivo (Título)</label>
                    <input 
                      required type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Auditoria Iniciada"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <div className="space-y-1.5 group">
                    <label className="text-[11px] font-bold text-slate-400 group-focus-within:text-blue-400 transition-colors">Detalhes (Descrição)</label>
                    <textarea 
                      required value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Acesse a aba de relatórios..." rows={2}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all resize-none placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* 2. Visual e Formato */}
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 border-b border-white/5 pb-2 flex items-center gap-2">
                    <LucideIcons.Palette className="w-3.5 h-3.5" /> Parametrização Visual
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400">Holograma (Ícone)</label>
                      <div 
                        onClick={() => setIsIconModalOpen(true)}
                        className="w-full h-11 bg-black/50 border border-white/10 hover:border-blue-500/50 rounded-xl px-3 flex items-center justify-between cursor-pointer transition-all group hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <DynamicIcon name={iconName} className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="text-[11px] font-bold text-white truncate">{iconName}</span>
                        </div>
                        <LucideIcons.Search className="w-3 h-3 text-slate-500 shrink-0 group-hover:text-blue-400" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400">Alinhamento</label>
                      <div className="flex bg-black/50 border border-white/10 rounded-xl h-11 p-1">
                        {ALIGNMENTS.map(a => (
                          <button
                            key={a.id} type="button" onClick={() => setAlignment(a.id)} title={a.label}
                            className={cn("flex-1 flex items-center justify-center rounded-lg transition-all", alignment === a.id ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-white")}
                          >
                            <DynamicIcon name={a.icon} className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Cores */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400">Espectro de Cor</label>
                    <div className="flex flex-wrap gap-2">
                      {THEMES.map((c) => (
                        <button
                          key={c.id} type="button" onClick={() => setThemeId(c.id)} title={c.name}
                          className={cn(
                            "relative h-10 w-10 rounded-full border-[2px] transition-all duration-300 flex items-center justify-center outline-none hover:scale-110",
                            c.hex,
                            themeId === c.id ? `border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.6)] z-10` : "border-transparent opacity-50 hover:opacity-100"
                          )}
                        >
                          {themeId === c.id && <LucideIcons.Check className="w-4 h-4 text-white drop-shadow-md animate-in zoom-in duration-300" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Decalques */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400">Renderização de Fundo</label>
                    <div className="grid grid-cols-4 gap-2">
                      {PATTERNS.map((p) => (
                        <button
                          key={p.id} type="button" onClick={() => setPatternId(p.id)}
                          className={cn(
                            "py-2 px-1 rounded-lg text-[10px] font-bold transition-all border uppercase tracking-wider",
                            patternId === p.id ? "bg-white/10 border-white/30 text-white shadow-inner" : "bg-black/40 border-transparent text-slate-500 hover:bg-white/5"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Neon Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 shadow-inner">
                    <div>
                      <h4 className="text-[13px] font-bold text-white flex items-center gap-1.5"><LucideIcons.Lightbulb className="w-3.5 h-3.5 text-yellow-400"/> Emissão de Neon</h4>
                    </div>
                    <button 
                      type="button" onClick={() => setEnableGlow(!enableGlow)}
                      className={cn("w-12 h-6 rounded-full transition-all duration-500 relative flex items-center px-1 border border-white/10", enableGlow ? activeTheme.hex : "bg-slate-800")}
                    >
                      <div className={cn("w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-md", enableGlow ? "translate-x-6" : "translate-x-0")}></div>
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" disabled={isLoading}
                  className={cn(
                    "w-full h-14 rounded-xl text-white font-black uppercase tracking-widest transition-all duration-500 active:scale-95 group relative overflow-hidden shadow-2xl text-base mt-2",
                    activeTheme.hex
                  )}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <span className="relative flex items-center justify-center gap-3">
                    {isLoading ? "Processando..." : <>Injetar no Banco <LucideIcons.DatabaseZap className="w-5 h-5 group-hover:scale-125 transition-transform" /></>}
                  </span>
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* --- O PALCO DE PREVIEW (Direita) --- */}
          <div className="xl:col-span-8 flex flex-col gap-6 lg:gap-8">
            
            {/* O SIMULADOR 3D */}
            <div className="bg-[#0f172a]/60 border border-white/10 rounded-[2.5rem] p-4 md:p-8 relative overflow-hidden shadow-2xl ring-1 ring-white/5">
              
              <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[800px] blur-[120px] pointer-events-none transition-colors duration-1000", activeTheme.ambient)}></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 relative z-20 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                    <LucideIcons.Eye className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-sm md:text-base font-black uppercase tracking-widest text-white">Motor 3D de Renderização</h2>
                    <p className="text-[10px] text-slate-400 font-mono">Tipografia Auto-escalável ATIVADA</p>
                  </div>
                </div>
                
                <div className="flex items-center bg-black/60 p-1.5 rounded-xl border border-white/10 backdrop-blur-md w-full sm:w-auto shrink-0">
                  <button onClick={() => setPreviewDevice("desktop")} className={cn("flex-1 sm:flex-none px-4 md:px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2", previewDevice === "desktop" ? "bg-white/15 text-white shadow-sm" : "text-slate-500 hover:text-white")}>
                    <LucideIcons.Monitor className="w-4 h-4" /> Monitor
                  </button>
                  <button onClick={() => setPreviewDevice("mobile")} className={cn("flex-1 sm:flex-none px-4 md:px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2", previewDevice === "mobile" ? "bg-white/15 text-white shadow-sm" : "text-slate-500 hover:text-white")}>
                    <LucideIcons.Smartphone className="w-4 h-4" /> Celular
                  </button>
                </div>
              </div>

              {/* MOCKUP DA TELA REAL (Altura Dinâmica h-fit) */}
              <div className="relative z-10 w-full flex justify-center [perspective:1000px]">
                <div 
                  className={cn(
                    "bg-[#020617] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] relative flex flex-col h-fit",
                    previewDevice === "desktop" ? "w-full max-w-4xl rounded-[2rem] p-6 md:p-8 min-h-[400px]" : "w-[320px] md:w-[360px] rounded-[3rem] p-6 min-h-[600px] ring-[12px] ring-[#0f172a]"
                  )}
                >
                  <div className="flex justify-between items-center mb-6 opacity-30 grayscale pointer-events-none shrink-0">
                     <div className="flex gap-4 items-center">
                       {previewDevice === "mobile" && <LucideIcons.Menu className="w-6 h-6 text-white" />}
                       <div>
                         <div className="h-4 w-28 md:w-40 bg-white rounded-md mb-2"></div>
                         <div className="h-2 w-40 md:w-56 bg-white/50 rounded-md"></div>
                       </div>
                     </div>
                     <div className="flex gap-3">
                       {previewDevice === "desktop" && <div className="h-10 w-10 md:h-12 md:w-12 bg-white/20 rounded-2xl"></div>}
                       <div className="h-10 w-10 md:h-12 md:w-12 bg-white rounded-full"></div>
                     </div>
                  </div>

                  <div className={cn("grid gap-3 md:gap-4 mb-8 opacity-20 grayscale pointer-events-none shrink-0", previewDevice === "desktop" ? "grid-cols-4" : "grid-cols-2")}>
                    <div className="h-20 md:h-24 bg-white/10 rounded-2xl border border-white/5"></div>
                    <div className="h-20 md:h-24 bg-white/10 rounded-2xl border border-white/5"></div>
                    {previewDevice === "desktop" && (
                      <>
                        <div className="h-24 bg-white/10 rounded-2xl border border-white/5"></div>
                        <div className="h-24 bg-white/10 rounded-2xl border border-white/5"></div>
                      </>
                    )}
                  </div>

                  {/* --- O BANNER PREVIEW --- */}
                  <div className="relative group/banner [transform-style:preserve-3d] w-full mt-auto mb-auto h-fit">
                    <div 
                      ref={cardRef}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      style={tiltStyle}
                      className={cn(
                        "relative w-full overflow-hidden border-2 flex flex-col justify-center transition-all duration-200 ease-out cursor-crosshair min-h-[160px] h-fit",
                        previewDevice === "desktop" ? "p-6 md:p-8 rounded-[2rem]" : "p-6 rounded-[1.8rem]",
                        finalBgClass, finalBorderClass
                      )}
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-150%] group-hover/banner:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none z-20"></div>
                        
                        <div 
                          className={cn(
                            "absolute opacity-[0.1] pointer-events-none transition-all duration-700 ease-out transform group-hover/banner:scale-125 [transform:translateZ(30px)]",
                            alignment.includes('text-right') ? "left-[-20px] md:left-4" : "right-[-20px] md:right-4",
                            "top-1/2 -translate-y-1/2"
                          )}
                        >
                            <DynamicIcon name={iconName} className="h-40 w-40 md:h-56 md:w-56 text-white" />
                        </div>
                        
                        <div className={cn(
                          "relative z-10 flex flex-col min-w-0 [transform:translateZ(40px)] w-full break-words whitespace-normal h-fit", 
                          alignment,
                          alignment.includes('text-right') ? (previewDevice === "desktop" ? "pl-24" : "pl-12") : (previewDevice === "desktop" ? "pr-24" : "pr-12")
                        )}>
                            <div className="bg-black/30 w-fit p-2.5 rounded-xl mb-4 backdrop-blur-md border border-white/10 shadow-inner">
                                <DynamicIcon name={iconName} className="h-5 w-5 md:h-6 md:w-6 text-white drop-shadow-lg" />
                            </div>
                            
                            <h3 className={cn(
                              "font-black text-white mb-2.5 drop-shadow-xl w-full break-words whitespace-normal transition-all duration-300",
                              getDynamicTitleSize(title || "A", previewDevice === "mobile")
                            )}>
                              {title || "Escreva um Título..."}
                            </h3>
                            
                            <p className={cn(
                              "text-white/90 font-medium drop-shadow-lg w-full break-words whitespace-normal transition-all duration-300",
                              getDynamicDescSize(desc || "A", previewDevice === "mobile")
                            )}>
                              {desc || "A descrição da peça visualizada aparecerá exatamente aqui."}
                            </p>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* A FROTA (Banners Instalados) */}
            <div className="bg-[#0f172a]/60 border border-white/10 rounded-[2.5rem] p-6 md:p-8 relative shadow-xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <LucideIcons.Server className="w-5 h-5 text-emerald-400" /> Banners Online
              </h2>
              
              {highlights.length === 0 ? (
                <div className="min-h-[128px] flex flex-col items-center justify-center text-center border-2 border-dashed border-white/10 rounded-3xl bg-black/20 text-slate-500 gap-3 py-6">
                  <LucideIcons.Radar className="w-8 h-8 opacity-40 animate-spin-slow" />
                  <p className="text-sm font-medium px-4">Nenhum sinal detectado. Inicie a transmissão de um banner.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {highlights.map((item) => {
                    const itemAlignment = item.bg?.split(' ').find((c: string) => c.startsWith('text-')) || "text-left items-start text-start";
                    return (
                      <div 
                        key={item.id} 
                        className={cn(
                          "relative w-full min-h-[144px] overflow-hidden rounded-3xl border flex flex-col justify-center p-6 group transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl h-fit",
                          item.bg, item.border
                        )}
                      >
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="absolute top-4 right-4 z-20 bg-black/60 hover:bg-red-600 text-slate-300 hover:text-white p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 active:scale-90 border border-white/10 backdrop-blur-md shadow-lg"
                          title="Excluir Transmissão"
                        >
                          <LucideIcons.Trash2 className="w-5 h-5" />
                        </button>

                        <div className={cn(
                          "absolute opacity-[0.08] pointer-events-none",
                          item.bg?.includes('text-right') ? "left-[-10px]" : "right-[-10px]",
                          "top-1/2 -translate-y-1/2"
                        )}>
                            <DynamicIcon name={item.icon || "Image"} className="h-28 w-28 text-white" />
                        </div>
                        
                        <div className={cn(
                          "relative z-10 flex flex-col justify-center h-full min-w-0 w-full break-words whitespace-normal", 
                          item.bg?.includes('text-right') ? "pl-14" : "pr-14", 
                          itemAlignment
                        )}>
                            <div className="bg-black/30 w-fit p-2 rounded-xl mb-3 border border-white/10">
                                <DynamicIcon name={item.icon || "Image"} className="h-4 w-4 text-white" />
                            </div>
                            <h3 className={cn(
                              "font-bold text-white mb-1.5 w-full break-words transition-all",
                              getDynamicTitleSize(item.title || "", true)
                            )}>
                              {item.title}
                            </h3>
                            <p className={cn(
                              "text-white/80 font-medium w-full break-words transition-all",
                              getDynamicDescSize(item.desc || "", true)
                            )}>
                              {item.desc}
                            </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
