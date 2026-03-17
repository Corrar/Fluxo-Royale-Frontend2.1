import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Lock, User, Loader2, Eye, EyeOff, ShieldCheck, Zap, Sparkles, HelpCircle, 
  Search, Coffee, Music, PartyPopper, HelpCircle as QuestionIcon, Power, CheckCircle2, 
  AlertTriangle, Fingerprint, Activity, Keyboard, Flame, Wifi, BatteryCharging, Server
} from "lucide-react";

// --- 1. DEFINIÇÃO DE TIPOS ROBUSTA ---
const MASCOT_MOODS = [
  "idle", "sleeping", "shutdown", "booting", "waking", "tracking", "blind", 
  "peek", "success", "error", "warp", "excited", "cool", "bored", "party", 
  "confused", "scared", "dizzy", "capslock", "lost", "judging", "flow", 
  "god", "overheat", "security", "processing", "rage"
] as const;

type MascotMood = (typeof MASCOT_MOODS)[number];
type MascotProp = "none" | "magnifier" | "coffee" | "shield" | "glasses" | "warning";

// --- HELPERS VISUAIS ---
const getStrengthColor = (s: number) => {
  const colors = [
    "bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.4)]", 
    "bg-orange-500/80 shadow-[0_0_10px_rgba(249,115,22,0.4)]", 
    "bg-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.4)]", 
    "bg-blue-500/80 shadow-[0_0_10px_rgba(59,130,246,0.4)]", 
    "bg-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.6)]"
  ];
  return colors[s] || colors[0];
};
const getStrengthLabel = (s: number) => ["Crítica", "Fraca", "Média", "Forte", "Segura"][s] || "Crítica";

export default function Auth() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  
  // --- ESTADOS DO SISTEMA ---
  const [systemBooted, setSystemBooted] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [clickCount, setClickCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [ripples, setRipples] = useState<{x: number, y: number, id: number}[]>([]);

  // --- ESTADOS DO MASCOTE ---
  const [mascotMessage, setMascotMessage] = useState("Aguardando Credenciais...");
  const [displayedMessage, setDisplayedMessage] = useState("");
  const [mascotMood, setMascotMood] = useState<MascotMood>("idle");
  const [currentProp, setCurrentProp] = useState<MascotProp>("none");
  const [bootProgress, setBootProgress] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const [focusedField, setFocusedField] = useState<"id" | "password" | null>(null);
  
  // --- FÍSICA E INTERAÇÃO ---
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [headRotation, setHeadRotation] = useState({ x: 0, y: 0 });
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [eyeJitter, setEyeJitter] = useState({ x: 0, y: 0 });
  const [pupilSize, setPupilSize] = useState(1);
  const [typingCombo, setTypingCombo] = useState(0);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const [cardSpotlight, setCardSpotlight] = useState({ x: 0, y: 0, opacity: 0 });

  // --- REFS ---
  const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  const konamiIndex = useRef(0);
  const mouseVelocity = useRef(0);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const mascotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const comboTimer = useRef<NodeJS.Timeout | null>(null);
  const bootSequenceTimer = useRef<NodeJS.Timeout | null>(null);
  const typingSpeedTimer = useRef<NodeJS.Timeout | null>(null);

  // --- INPUTS ---
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => { 
    if (user && !isSubmittingRef.current) navigate("/inicio"); 
  }, [user, navigate]);

  // --- BOOT SEQUENCE (Intro Matrix) ---
  useEffect(() => {
    const lines = [
      "INITIALIZING FLUXO_CORE v2.1...",
      "LOADING PHYSICS ENGINE... OK",
      "CHECKING NEURAL LINK... ESTABLISHED",
      "SECURITY PROTOCOLS... ACTIVE",
      "WELCOME, USER."
    ];
    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < lines.length) {
        setBootLines(prev => [...prev, lines[currentLine]]);
        currentLine++;
      } else {
        clearInterval(interval);
        setTimeout(() => setSystemBooted(true), 600);
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // --- COMPORTAMENTO DOS OLHOS ---
  useEffect(() => {
    const interval = setInterval(() => {
        if (['idle', 'tracking', 'excited', 'flow'].includes(mascotMood)) {
            setEyeJitter({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 });
            setTimeout(() => setEyeJitter({ x: 0, y: 0 }), 150);
        }
    }, 3000);
    return () => clearInterval(interval);
  }, [mascotMood]);

  useEffect(() => {
      if (mascotMood === 'scared' || mascotMood === 'overheat') setPupilSize(0.5);
      else if (mascotMood === 'excited' || mascotMood === 'flow' || mascotMood === 'god') setPupilSize(1.3);
      else setPupilSize(1);
  }, [mascotMood]);

  // --- INTERAÇÃO DO MOUSE (Tilt 3D e Tracking) ---
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current && window.innerWidth > 768) { 
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        setCardSpotlight({ x, y, opacity: 1 });
        setCardTilt({ x: ((y - centerY) / centerY) * -4, y: ((x - centerX) / centerX) * 4 });
    }
  };
  const handleCardMouseLeave = () => { setCardSpotlight(prev => ({ ...prev, opacity: 0 })); setCardTilt({ x: 0, y: 0 }); }

  const handleGlobalClick = (e: MouseEvent) => {
      const id = Date.now();
      setRipples(prev => [...prev, { x: e.clientX, y: e.clientY, id }]);
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 1000);
  };
  useEffect(() => { window.addEventListener('click', handleGlobalClick); return () => window.removeEventListener('click', handleGlobalClick); }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement> | KeyboardEvent) => {
    if (!systemBooted) return;
    if (mascotMood === 'sleeping' || mascotMood === 'shutdown') wakeUpMascot();

    // Konami Code
    if (e.key === konamiCode[konamiIndex.current]) {
        konamiIndex.current++;
        if (konamiIndex.current === konamiCode.length) {
            setMascotMood('god'); setMascotMessage("MODO CRIADOR ATIVADO");
            konamiIndex.current = 0; setTimeout(() => setMascotMood('idle'), 8000);
        }
    } else { konamiIndex.current = 0; }

    // Typing Combo System
    setTypingCombo(prev => prev + 1);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => setTypingCombo(0), 1500);

    if (typingCombo > 15 && !['overheat', 'blind'].includes(mascotMood)) { setMascotMood('overheat'); setMascotMessage("OVERCLOCK!"); } 
    else if (typingCombo > 8 && !['flow', 'blind', 'peek', 'god', 'overheat'].includes(mascotMood)) { setMascotMood('flow'); setMascotMessage("FLUXO TOTAL"); }

    if (e.getModifierState("CapsLock")) {
        if (mascotMood !== 'capslock' && !['blind', 'peek'].includes(mascotMood)) { setMascotMood('capslock'); setCurrentProp('warning'); setMascotMessage("CAPS LOCK"); }
    } else if (mascotMood === 'capslock') { setMascotMood('idle'); setCurrentProp('none'); setMascotMessage("Normalizado."); }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown as any);
    return () => window.removeEventListener('keydown', handleKeyDown as any);
  }, [mascotMood, typingCombo, systemBooted]);

  // --- EFEITO DE DIGITAÇÃO (Typewriter) ---
  const triggerGlitch = () => { setIsGlitching(true); setTimeout(() => setIsGlitching(false), 200); };
  useEffect(() => { if(systemBooted) triggerGlitch(); }, [mascotMessage, mascotMood, systemBooted]);
  
  useEffect(() => {
    let i = 0; setDisplayedMessage(""); 
    const typeNextChar = () => {
      if (i < mascotMessage.length) {
        setDisplayedMessage(prev => mascotMessage.slice(0, i + 1));
        i++; setTimeout(typeNextChar, 10);
      }
    };
    typeNextChar();
  }, [mascotMessage]);

  // --- LÓGICA DE MASCOTE ---
  const wakeUpMascot = () => {
      if (mascotMood === 'shutdown') {
          if (!bootSequenceTimer.current) {
              setMascotMood('booting'); setMascotMessage("Reiniciando Sistemas..."); setBootProgress(0);
              const interval = setInterval(() => {
                  setBootProgress(prev => { if (prev >= 100) { clearInterval(interval); return 100; } return prev + 10; });
              }, 80);
              bootSequenceTimer.current = setTimeout(() => { setMascotMood('idle'); setMascotMessage("Sistemas Online."); bootSequenceTimer.current = null; }, 1500);
          }
      } else if (mascotMood === 'sleeping') {
          setMascotMood('scared'); setMascotMessage("OPA!"); setTimeout(() => { setMascotMood('idle'); setMascotMessage("Pronto para o serviço."); }, 1200);
      }
  };

  const triggerRandomIdleAction = useCallback(() => {
    if (loading || ['blind', 'peek', 'error', 'success', 'warp', 'cool', 'party', 'sleeping', 'confused', 'capslock', 'dizzy', 'shutdown', 'booting', 'lost', 'judging', 'flow', 'god', 'overheat', 'rage'].includes(mascotMood)) return;
    const actions = [
        { mood: 'bored' as MascotMood, prop: 'coffee' as MascotProp, msg: "Reabastecendo cafeína...", duration: 4000 },
        { mood: 'idle' as MascotMood, prop: 'none' as MascotProp, msg: "Escaneando ameaças...", duration: 3000 },
        { mood: 'idle' as MascotMood, prop: 'none' as MascotProp, msg: "🎵 Processando beats... 🎵", duration: 3000, music: true },
        { mood: 'sleeping' as MascotMood, prop: 'none' as MascotProp, msg: "Modo de Economia...", duration: 6000 },
    ];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    setMascotMood(randomAction.mood); setMascotMessage(randomAction.msg); setCurrentProp(randomAction.prop);
    setTimeout(() => { if (!loading && !['sleeping', 'shutdown', 'rage'].includes(mascotMood)) { setMascotMood('idle'); setMascotMessage("Aguardando."); setCurrentProp('none'); } }, randomAction.duration);
  }, [mascotMood, loading]);

  useEffect(() => {
    const interval = setInterval(() => { if (document.activeElement !== document.body) return; triggerRandomIdleAction(); }, 15000); 
    return () => clearInterval(interval);
  }, [triggerRandomIdleAction]);

  // --- SEGUIMENTO DO MOUSE PELO MASCOTE ---
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = Math.abs(clientX - lastMousePos.current.x);
      const deltaY = Math.abs(clientY - lastMousePos.current.y);
      mouseVelocity.current = deltaX + deltaY;
      lastMousePos.current = { x: clientX, y: clientY };

      if ((mascotMood === 'shutdown' || mascotMood === 'sleeping') && mouseVelocity.current > 50) { wakeUpMascot(); return; }
      
      if (mouseVelocity.current > 400 && !['dizzy', 'shutdown', 'sleeping', 'booting'].includes(mascotMood) && (mascotMood as string) !== 'rage') {
          setMascotMood('dizzy'); setMascotMessage("GIROSCÓPIO INSTÁVEL!");
          setTimeout(() => { if (mascotMood !== 'shutdown' && (mascotMood as string) !== 'rage') { setMascotMood('idle'); setMascotMessage("Estabilizado."); } }, 2000);
      }
      if (['booting', 'dizzy', 'sleeping', 'shutdown'].includes(mascotMood)) return;

      const xNormal = (clientX / window.innerWidth) * 2 - 1;
      const yNormal = (clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x: xNormal * 0.3, y: yNormal * 0.3 });

      if (mascotRef.current) {
        let targetX = clientX;
        let targetY = clientY;
        if (focusedField === 'id' || focusedField === 'password') {
            const rect = cardRef.current?.getBoundingClientRect();
            if (rect) { targetX = rect.left + rect.width / 2; targetY = rect.top + (focusedField === 'id' ? 100 : 180); }
        }
        const rect = mascotRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const eyesX = Math.min(Math.max((targetX - centerX) / 12, -9), 9);
        const eyesY = Math.min(Math.max((targetY - centerY) / 12, -9), 9);
        setEyePosition({ x: eyesX, y: eyesY });
        
        const rotY = Math.min(Math.max((clientX - centerX) / 35, -20), 20); 
        const rotX = Math.min(Math.max((centerY - clientY) / 35, -15), 15); 
        setHeadRotation({ x: rotX, y: rotY });
      }
    };
    window.addEventListener("mousemove", handleMove); window.addEventListener("touchmove", handleMove); 
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("touchmove", handleMove); };
  }, [mascotMood, focusedField]);

  const [isBlinking, setIsBlinking] = useState(false);
  useEffect(() => {
    const blinkLoop = () => {
        if (!['blind', 'sleeping', 'shutdown', 'booting', 'cool', 'dizzy', 'judging', 'flow', 'overheat'].includes(mascotMood)) {
            setIsBlinking(true); setTimeout(() => setIsBlinking(false), 120);
            if (Math.random() > 0.6) setTimeout(() => { setIsBlinking(true); setTimeout(() => setIsBlinking(false), 120); }, 200);
        }
        setTimeout(blinkLoop, Math.random() * 3000 + 2000);
    };
    const timer = setTimeout(blinkLoop, 3000);
    return () => clearTimeout(timer);
  }, [mascotMood]);

  // --- LÓGICA DE FORMULÁRIO ---
  const calculatePasswordStrength = (p: string) => {
    let s = 0; if (!p) return 0;
    if (p.length > 4) s++; if (p.length > 7) s++; if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setLoginId(val);
      if (typingSpeedTimer.current) clearTimeout(typingSpeedTimer.current);
      if (val.length > 2 && !['cool', 'error', 'shutdown', 'capslock', 'dizzy', 'flow', 'god', 'overheat', 'blind'].includes(mascotMood)) {
          setMascotMood("cool"); setCurrentProp("glasses"); setMascotMessage("Identificando...");
          typingSpeedTimer.current = setTimeout(() => {
              setMascotMood("tracking"); setCurrentProp("magnifier"); setMascotMessage("Validando formato...");
          }, 800);
      } else if (!['cool', 'shutdown', 'capslock', 'dizzy', 'flow', 'god', 'overheat'].includes(mascotMood)) {
          setMascotMood("tracking"); setCurrentProp("magnifier"); setMascotMessage("Lendo ID...");
      }
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLoginPassword(val);
    const strength = calculatePasswordStrength(val);
    setPasswordStrength(strength);
    if (showPassword) {
        if (strength <= 1) { setMascotMood('bored'); setMascotMessage("Senha muito simples..."); }
        else if (strength >= 4) { setMascotMood('excited'); setMascotMessage("Senha robusta!"); }
        else { setMascotMood('peek'); setMascotMessage("Analisando entropia..."); }
    } else {
        if (!['blind', 'warp', 'shutdown', 'god', 'overheat'].includes(mascotMood)) {
            setMascotMood("blind"); setCurrentProp("none"); setMascotMessage("Encriptação ativada.");
        }
    }
  };

  const handleMascotClick = () => {
    if (mascotMood === 'shutdown') { wakeUpMascot(); return; }
    
    if ((mascotMood as string) === 'rage') { 
        setMascotMood('idle'); setCurrentProp('none'); setMascotMessage("Sistemas normalizados."); setFailCount(0); return; 
    }

    setClickCount(prev => prev + 1);
    if (clickCount >= 4) {
        setMascotMood("party"); setCurrentProp("none"); setMascotMessage("MODO FESTA! 🎉");
        setClickCount(0); setTimeout(() => setMascotMood("idle"), 3000);
    } else if (mascotMood === 'sleeping') { wakeUpMascot(); } 
    else { setMascotMood("excited"); setMascotMessage("Olá!"); setTimeout(() => setMascotMood("idle"), 1500); }
  };

  const toggleShowPassword = () => {
    const nextState = !showPassword;
    setShowPassword(nextState);
    if (mascotMood !== 'shutdown') {
        if (nextState) { setMascotMood('peek'); setMascotMessage("Revelando caracteres..."); } 
        else { setMascotMood('blind'); setMascotMessage("Ocultando..."); }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mascotMood === 'shutdown') { wakeUpMascot(); return; }
    if ((mascotMood as string) === 'rage') { toast.error("SISTEMA EM LOCKDOWN. AGUARDE."); return; }
    if (mascotMood === 'overheat') { toast.error("AGUARDE RESFRIAMENTO DA CPU"); return; }

    if (loginId.length < 3) {
      setMascotMood("error"); setCurrentProp("none"); setMascotMessage("ID INVÁLIDO");
      toast.error("ID deve conter no mínimo 3 dígitos."); setTimeout(() => setMascotMood("idle"), 2500); return;
    }

    setLoading(true); setMascotMood("tracking"); setCurrentProp("shield"); setMascotMessage("Autenticando...");
    isSubmittingRef.current = true;

    const { error } = await signIn(loginId, loginPassword);

    if (error) {
      isSubmittingRef.current = false;
      setLoading(false);

      const nextFailCount = failCount + 1;
      setFailCount(nextFailCount);

      if (nextFailCount >= 3) {
        setMascotMood("rage"); setCurrentProp("warning"); setMascotMessage("VIOLAÇÃO DETECTADA!");
        toast.error("MÚLTIPLAS TENTATIVAS FALHAS!");
      } else {
        setMascotMood("error"); setCurrentProp("none"); setMascotMessage("ACESSO NEGADO");
        toast.error(error.message || "Credenciais inválidas.");
        setTimeout(() => { if ((mascotMood as string) !== 'rage') { setMascotMood("idle"); setCurrentProp("none"); } }, 3500);
      }
    } else {
      setFailCount(0);
      setMascotMood("warp"); setCurrentProp("none"); setMascotMessage("BEM-VINDO!");
      setIsExiting(true); setTimeout(() => navigate("/inicio"), 2200);
    }
  };

  // --- CLASSES CSS E ANIMAÇÕES ---
  const mascotContainerClasses = `
    flex flex-col items-center z-50 cursor-pointer
    transition-all duration-300 ease-out will-change-transform
    relative scale-75 md:scale-95 lg:scale-100
    mb-4 md:mb-0 md:ml-8
    order-1 md:order-2
    ${mascotMood === 'sleeping' ? 'grayscale-[0.6]' : ''}
    ${mascotMood === 'shutdown' ? 'grayscale opacity-70 scale-95' : ''}
    ${mascotMood === 'booting' ? 'animate-pulse' : ''}
    ${mascotMood === 'error' || mascotMood === 'scared' || mascotMood === 'capslock' || mascotMood === 'overheat' || mascotMood === 'rage' ? 'animate-error-shake' : ''}
    ${mascotMood === 'success' ? 'animate-victory-spin' : ''}
    ${mascotMood === 'party' ? 'animate-bounce' : ''}
    ${mascotMood === 'blind' ? 'animate-tremble' : ''}
    ${mascotMood === 'warp' ? 'animate-warp-launch' : ''}
    ${mascotMood === 'excited' ? 'scale-110' : ''}
    ${mascotMood === 'flow' ? 'animate-rgb-shake' : ''}
    ${mascotMood === 'god' ? 'animate-levitate' : ''}
    ${['idle', 'tracking', 'peek', 'excited', 'bored', 'cool', 'confused', 'lost', 'judging', 'flow', 'god', 'overheat'].includes(mascotMood) ? 'animate-float-organic' : ''}
  `;

  // Estilo do Corpo do Mascote
  const mascotBodyClasses = `
    relative w-full h-full bg-gradient-to-br rounded-[3rem] border-[3px] shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-500 z-20
    ${mascotMood === 'shutdown' ? 'from-gray-900 to-black border-gray-700 shadow-none' : 'from-[#1a1f2e] to-[#0a0a0a]'} 
    ${mascotMood === 'error' || mascotMood === 'capslock' || mascotMood === 'overheat' || mascotMood === 'rage' ? 'border-red-500/60 shadow-[0_0_50px_rgba(239,68,68,0.5)] bg-red-950/40' : ''}
    ${mascotMood === 'success' || mascotMood === 'warp' || mascotMood === 'party' ? 'border-emerald-400/60 shadow-[0_0_50px_rgba(52,211,153,0.5)] bg-emerald-950/40' : ''}
    ${mascotMood === 'flow' ? 'border-amber-400/60 shadow-[0_0_50px_rgba(251,191,36,0.6)] bg-amber-950/40' : ''}
    ${mascotMood === 'god' ? 'border-yellow-200/80 shadow-[0_0_80px_rgba(253,224,71,0.8)] bg-yellow-950/40' : ''}
    ${['idle', 'tracking', 'blind', 'peek', 'sleeping', 'cool', 'bored', 'excited', 'confused', 'booting', 'scared', 'dizzy', 'lost', 'judging'].includes(mascotMood) ? 'border-blue-500/40 shadow-[0_0_35px_rgba(59,130,246,0.3)]' : ''}
  `;

  const headTiltStyle = {
    transform: `rotateX(${headRotation.x}deg) rotateY(${headRotation.y}deg)`,
    transformStyle: 'preserve-3d' as const
  };

  const mascotWrapperStyle = {
    transform: window.innerWidth > 768 && !['warp', 'error', 'success'].includes(mascotMood) 
      ? `translate(${mousePos.x * -8}px, ${mousePos.y * -8}px)` : 'none'
  };

  const isHighEnergy = ['flow', 'god', 'overheat', 'warp'].includes(mascotMood);
  
  if (!systemBooted) {
    return (
      <div className="h-[100dvh] w-full bg-black text-green-500 font-mono text-xs md:text-sm p-8 flex flex-col justify-end overflow-hidden cursor-wait relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50 animate-input-scan" />
        {bootLines.map((line, i) => ( <div key={i} className="mb-1 opacity-90 tracking-wider text-green-400 font-bold">{line}</div> ))}
        <div className="animate-pulse text-green-400 font-black">_</div>
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(0,255,0,0.03),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]"></div>
      </div>
    )
  }

  return (
    <div className={`min-h-[100dvh] w-full flex flex-col md:flex-row items-center justify-center relative overflow-hidden font-sans selection:bg-blue-500/30 selection:text-blue-100 p-4 md:pl-16 lg:pl-24 overscroll-none`}>
      
      {/* RIPPLES (Efeito de clique) */}
      {ripples.map(r => (
          <div key={r.id} className="fixed w-2 h-2 rounded-full border border-blue-400/50 animate-ping pointer-events-none z-50" style={{ left: r.x, top: r.y, transform: 'translate(-50%, -50%)' }}></div>
      ))}

      {/* ATMOSFERA GLOBAL & SCANLINES */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.07] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,6px_100%]"></div>

      {/* STYLES PARA ANIMAÇÕES CSS PURO */}
      <style>{`
        @keyframes float-organic { 0% { transform: translate(0, 0) rotate(0deg); } 33% { transform: translate(3px, -8px) rotate(1deg); } 66% { transform: translate(-3px, -4px) rotate(-1deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
        @keyframes scanner-beam { 0% { transform: rotate(-25deg) translateX(-15px); opacity: 0; } 50% { opacity: 0.6; } 100% { transform: rotate(25deg) translateX(15px); opacity: 0; } }
        @keyframes thruster-main { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.15); } }
        @keyframes thruster-stabilizer-left { 0%, 100% { transform: scaleY(0.9) translateX(0); } 50% { transform: scaleY(1.05) translateX(-1px); } }
        @keyframes thruster-stabilizer-right { 0%, 100% { transform: scaleY(0.9) translateX(0); } 50% { transform: scaleY(1.05) translateX(1px); } }
        @keyframes thruster-core-pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
        @keyframes error-shake { 0% { transform: translateX(0); } 25% { transform: translateX(-5px) rotate(-5deg); } 75% { transform: translateX(5px) rotate(5deg); } }
        @keyframes victory-spin { 0% { transform: scale(1) rotate(0deg); } 100% { transform: scale(1) rotate(360deg); } }
        @keyframes tremble { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(1px); } }
        @keyframes warp-launch { 0% { transform: scale(1) translateY(0); } 40% { transform: scale(0.9) translateY(20px); } 100% { transform: scale(15) translateY(-2000px); opacity: 0; } }
        @keyframes ui-zoom-in { 0% { transform: scale(1) translateZ(0); opacity: 1; filter: blur(0); } 100% { transform: scale(3.5) translateZ(600px); opacity: 0; filter: blur(20px); } }
        @keyframes music-note { 0% { opacity: 0; transform: translateY(0) rotate(0deg); } 50% { opacity: 1; } 100% { opacity: 0; transform: translateY(-20px) rotate(20deg); } }
        @keyframes crt-off { 0% { transform: scale(1, 1); opacity: 1; } 50% { transform: scale(1, 0.05); opacity: 1; } 100% { transform: scale(0, 0); opacity: 0; } }
        @keyframes dizzy-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes data-flow { 0% { transform: translateY(0); } 100% { transform: translateY(-100px); } }
        @keyframes glitch-anim { 0% { transform: translate(0); } 20% { transform: translate(-2px, 2px); } 40% { transform: translate(-2px, -2px); } 60% { transform: translate(2px, 2px); } 80% { transform: translate(2px, -2px); } 100% { transform: translate(0); } }
        @keyframes input-scan { 0% { left: -100%; opacity: 0; } 50% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
        @keyframes rgb-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px) rotate(-1deg); } 75% { transform: translateX(2px) rotate(1deg); } }
        @keyframes levitate { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        @keyframes grid-move { 0% { background-position: 0 0; } 100% { background-position: 50px 50px; } }
        
        .chromatic { animation: aberration 0.1s infinite; }
        .animate-float-organic { animation: float-organic 4s ease-in-out infinite; }
        .scanner-effect { animation: scanner-beam 1.5s infinite linear; }
        .animate-music { animation: music-note 2s linear infinite; }
        .animate-error-shake { animation: error-shake 0.4s ease-in-out infinite; }
        .animate-victory-spin { animation: victory-spin 1s ease-out; }
        .animate-tremble { animation: tremble 0.1s infinite; }
        .animate-warp-launch { animation: warp-launch 2.2s cubic-bezier(0.7, 0, 0.84, 0) forwards !important; }
        .animate-crt-off { animation: crt-off 0.6s ease-in-out forwards; }
        .animate-dizzy { animation: dizzy-spin 1s linear infinite; }
        .animate-data { animation: data-flow 5s linear infinite; }
        .glitch-effect { animation: glitch-anim 0.3s cubic-bezier(.25, .46, .45, .94) both infinite; color: #ef4444; }
        .input-scan-line { animation: input-scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        .animate-rgb-shake { animation: rgb-shake 0.2s ease-in-out infinite; }
        .animate-levitate { animation: levitate 2s ease-in-out infinite; }
        .animate-grid { animation: grid-move 4s linear infinite; }
        
        /* --- THRUSTER FX --- */
        .animate-thruster-main { animation: thruster-main 0.1s infinite alternate ease-in-out; }
        .animate-thruster-stabilizer-left { animation: thruster-stabilizer-left 0.15s infinite alternate ease-in-out; }
        .animate-thruster-stabilizer-right { animation: thruster-stabilizer-right 0.15s infinite alternate ease-in-out; }
        .animate-thruster-core-pulse { animation: thruster-core-pulse 0.05s infinite alternate; }
      `}</style>

      {/* --- HUD TÁTICO --- */}
      {mascotMood !== 'shutdown' && (
          <div className="fixed inset-0 pointer-events-none z-10 opacity-30 mix-blend-screen hidden md:block">
              <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-blue-400 rounded-tl-lg"></div>
              <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-blue-400 rounded-tr-lg"></div>
              <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-blue-400 rounded-bl-lg"></div>
              <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-blue-400 rounded-br-lg"></div>
              <div className="absolute top-8 right-8 flex gap-4 text-blue-300 font-mono text-[10px]">
                  <div className="flex items-center gap-1"><Wifi className="h-3 w-3" /> NET: SECURE</div>
                  <div className="flex items-center gap-1"><BatteryCharging className="h-3 w-3" /> PWR: 100%</div>
                  <div className="flex items-center gap-1"><Server className="h-3 w-3" /> LAT: 5ms</div>
              </div>
              <div className="absolute bottom-10 left-12 font-mono text-[9px] text-blue-300 flex items-center gap-2">
                  <Activity className="h-3 w-3 animate-pulse" /> NEURAL LINK ESTABLISHED
              </div>
          </div>
      )}

      {/* --- FUNDO (GRID & IMAGE) --- */}
      <div className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden transition-colors duration-1000 ${mascotMood === 'success' || isExiting ? 'bg-emerald-950/20' : mascotMood === 'error' || mascotMood === 'rage' ? 'bg-red-950/20' : mascotMood === 'shutdown' ? 'bg-black' : 'bg-[#020204]'}`}>
        
        {/* Imagem de Fundo (Blur e Movimento) */}
        <div 
            className="absolute inset-0 transition-transform duration-300 ease-out overflow-hidden"
            style={{ transform: `translate(${mousePos.x * 3}px, ${mousePos.y * 3}px) scale(1.02)` }}
        >
            <div className={`absolute inset-0 bg-[url('https://royaleavicultura.com.br/wp-content/uploads/2025/09/Esteira-para-ovos-o-que-e-e-como-funciona.png')] bg-cover bg-[position:25%_center] transition-all duration-1000 ${mascotMood === 'shutdown' ? 'brightness-0 opacity-0' : 'brightness-50 opacity-40'}`}></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1e3f] from-45% via-[#0a1e3f]/90 to-transparent opacity-100"></div>
        </div>

        {/* Grid Animado (Chão Digital) */}
        {mascotMood !== 'shutdown' && (
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[linear-gradient(to_right,rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom animate-grid opacity-30 pointer-events-none"></div>
        )}
        
        {mascotMood !== 'shutdown' && (
            <>
                <div className={`absolute inset-0 bg-red-600/20 blur-[150px] transition-opacity duration-500 mix-blend-overlay ${mascotMood === 'error' || mascotMood === 'capslock' || mascotMood === 'overheat' || mascotMood === 'rage' ? 'opacity-100' : 'opacity-0'}`} />
                <div className={`absolute inset-0 bg-emerald-600/20 blur-[150px] transition-opacity duration-500 mix-blend-overlay ${mascotMood === 'success' || mascotMood === 'warp' || mascotMood === 'party' ? 'opacity-100' : 'opacity-0'}`} />
                {mascotMood === 'god' && <div className="absolute inset-0 bg-yellow-500/20 blur-[100px] animate-pulse mix-blend-overlay" />}
                
                {/* Partículas de Dados Flutuantes */}
                <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
                      <div className="absolute top-[-20%] left-[20%] text-[10px] text-blue-400 font-mono animate-[data-flow_4s_linear_infinite]">010101</div>
                      <div className="absolute top-[-30%] left-[80%] text-[10px] text-blue-400 font-mono animate-[data-flow_5s_linear_infinite]" style={{animationDelay:'1s'}}>101100</div>
                </div>
            </>
        )}
      </div>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      <div className={`flex flex-col md:flex-row items-center z-20 gap-6 md:gap-8 ${isExiting ? 'animate-ui-zoom' : ''} w-full max-w-[900px] justify-center md:justify-start`}>
        
        {/* --- CARD DE LOGIN (O "Terminal") --- */}
        <div className="w-full max-w-[360px] md:max-w-[400px] order-2 md:order-1" style={{ perspective: '1000px' }}>
            <div 
                ref={cardRef}
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
                style={{ 
                    transform: `rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`,
                    transition: 'transform 0.1s ease-out'
                }}
                className={`relative group overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 backdrop-blur-3xl shadow-2xl transition-colors duration-500 ${mascotMood === 'success' || mascotMood === 'warp' ? 'border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : mascotMood === 'error' || mascotMood === 'rage' ? 'border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : ''}`}
            >
                {/* Spotlight 2D (Efeito de brilho ao passar o mouse) */}
                <div 
                    className="pointer-events-none absolute -inset-px rounded-[2rem] opacity-0 transition-opacity duration-300"
                    style={{
                        background: `radial-gradient(600px circle at ${cardSpotlight.x}px ${cardSpotlight.y}px, rgba(59, 130, 246, 0.15), transparent 40%)`,
                        opacity: cardSpotlight.opacity
                    }}
                />

                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[1px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
                <div className="px-6 py-8 relative z-10">
                    <div className="mb-8 text-center relative">
                        <div className="flex justify-center mb-5">
                            <div className="relative group/logo cursor-pointer animate-float-logo" onClick={() => setMascotMood('party')}>
                                <div className={`absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse opacity-50 ${mascotMood === 'god' ? 'bg-yellow-500/50' : ''}`} />
                                <img src="/favicon.png" alt="Logo" className={`relative h-16 w-16 object-contain drop-shadow-[0_0_25px_rgba(59,130,246,0.5)] ${mascotMood === 'god' ? 'sepia contrast-150 brightness-150' : ''}`} />
                            </div>
                        </div>
                        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-50 to-blue-300 tracking-tight mb-2">Fluxo Royale</h1>
                        <p className="text-blue-200/50 text-xs font-medium tracking-widest uppercase flex items-center justify-center gap-2"><Zap className="h-3 w-3 text-yellow-400 fill-yellow-400" /> Acesso Seguro</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2 group/input">
                            <Label className="text-xs font-bold text-blue-300/70 uppercase tracking-widest ml-2">ID Numérico</Label>
                            <div className={`relative overflow-hidden rounded-2xl group-focus-within:ring-1 transition-all duration-300 ${mascotMood === 'flow' ? 'ring-amber-500/50' : 'ring-blue-500/30'}`}>
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300/50 group-focus-within/input:text-blue-400 transition-colors"><User className="h-5 w-5" /></div>
                                <Input type="text" inputMode="numeric" placeholder="Ex: 1050" value={loginId} onChange={handleIdChange} onFocus={() => { setFocusedField('id'); if(!['tracking', 'sleeping', 'error', 'warp', 'excited', 'cool', 'shutdown', 'flow', 'god', 'glitch', 'overheat'].includes(mascotMood)) { setMascotMood("tracking"); setCurrentProp("magnifier"); setMascotMessage("Lendo ID..."); }}} onBlur={() => { setFocusedField(null); if(mascotMood !== 'shutdown') { setMascotMood("idle"); setCurrentProp("none"); }}} className="pl-12 h-11 bg-white/5 border-white/5 text-white placeholder:text-white/20 rounded-2xl focus:border-blue-500/50 focus:ring-0 transition-all font-mono tracking-wider" required minLength={3} />
                                {focusedField === 'id' && <div className={`absolute inset-0 pointer-events-none input-scan-line w-1 h-full blur-[2px] ${mascotMood === 'flow' ? 'bg-amber-400/50' : 'bg-blue-400/50'}`}></div>}
                            </div>
                        </div>

                        <div className="space-y-2 group/input">
                            <Label className="text-xs font-bold text-blue-300/70 uppercase tracking-widest ml-2">Senha</Label>
                            <div className={`relative overflow-hidden rounded-2xl group-focus-within:ring-1 transition-all duration-300 ${mascotMood === 'flow' ? 'ring-amber-500/50' : 'ring-blue-500/30'}`}>
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300/50 group-focus-within/input:text-blue-400 transition-colors"><Lock className="h-5 w-5" /></div>
                                <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={loginPassword} onChange={handlePasswordChange} onKeyDown={handleKeyDown as any} onFocus={() => { setFocusedField('password'); if (showPassword) { setMascotMood("peek"); setMascotMessage("Conferindo..."); } else { setMascotMood("blind"); setMascotMessage("Modo privado ativado."); }}} onBlur={() => { setFocusedField(null); if(mascotMood !== 'shutdown') { setMascotMood("idle"); setCurrentProp("none"); }}} className="pl-12 pr-12 h-11 bg-white/5 border-white/5 text-white placeholder:text-white/20 rounded-2xl focus:border-blue-500/50 focus:ring-0 transition-all" required />
                                <button type="button" onClick={toggleShowPassword} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300/50 hover:text-blue-300 transition-colors p-1">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                                {focusedField === 'password' && !['blind'].includes(mascotMood) && <div className={`absolute inset-0 pointer-events-none input-scan-line w-1 h-full blur-[2px] ${mascotMood === 'flow' ? 'bg-amber-400/50' : 'bg-blue-400/50'}`}></div>}
                            </div>
                            <div className={`overflow-hidden transition-all duration-500 ease-out ${loginPassword.length > 0 ? "max-h-10 mt-3 opacity-100" : "max-h-0 opacity-0"}`}>
                                <div className="flex gap-1 h-1 mb-2 bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${getStrengthColor(passwordStrength).split(' ')[0]}`} style={{ width: `${(passwordStrength / 4) * 100}%` }} />
                                </div>
                                <div className="flex justify-end"><span className="text-[10px] uppercase font-bold tracking-wider text-white/60">{getStrengthLabel(passwordStrength)}</span></div>
                            </div>
                        </div>

                        <Button type="submit" className={`w-full h-11 text-sm font-bold rounded-2xl shadow-lg shadow-blue-900/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 border-none text-white animate-shimmer relative overflow-hidden group hover:bg-blue-500 ${mascotMood === 'flow' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600'}`} disabled={loading} onMouseEnter={() => { if(!['sleeping', 'error', 'warp', 'shutdown'].includes(mascotMood)) { setMascotMood('excited'); setMascotMessage("Pronto para acessar?"); }}} onMouseLeave={() => { if(mascotMood === 'excited') setMascotMood('idle'); }}>
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex items-center gap-2 relative z-10 group-hover:gap-4 transition-all"><Fingerprint className="h-4 w-4 opacity-50 group-hover:opacity-100" /> Acessar Plataforma</span>}
                        </Button>
                    </form>

                    <div className="mt-6 text-center border-t border-white/5 pt-4 flex justify-between items-center">
                        <p className="text-gray-500 text-[10px] flex items-center gap-1 cursor-help group/safe hover:text-emerald-400 transition-colors" onMouseEnter={() => { if(mascotMood !== 'shutdown') { setMascotMood('success'); setMascotMessage("Ambiente 100% Protegido."); setCurrentProp("shield"); }}} onMouseLeave={() => { if(mascotMood !== 'shutdown') { setMascotMood('idle'); setCurrentProp("none"); }}}>
                            <ShieldCheck className="h-3 w-3 text-emerald-500 group-hover/safe:scale-110 transition-transform" /> Ambiente Seguro
                        </p>
                        <button className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline" onMouseEnter={() => { if(mascotMood !== 'shutdown') { setMascotMood('confused'); setMascotMessage("Esqueceu? Posso ajudar?"); }}} onMouseLeave={() => { if(mascotMood !== 'shutdown') { setMascotMood('idle'); }}}>
                            <HelpCircle className="h-3 w-3" /> Esqueceu?
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* --- MASCOTE INTERATIVO (O "Robô") --- */}
        <div ref={mascotRef} style={mascotWrapperStyle} className={mascotContainerClasses} onClick={handleMascotClick}>
            {typingCombo > 0 && !['blind', 'sleeping'].includes(mascotMood) && (
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-40 h-20 perspective-500 opacity-60 animate-pulse pointer-events-none hidden md:block">
                    <Keyboard className={`w-full h-full transform rotate-x-60 ${mascotMood === 'flow' ? 'text-amber-400' : 'text-blue-400'}`} />
                </div>
            )}
            {mascotMessage.includes("Processing beats") && <div className="absolute -top-12 right-0 pointer-events-none z-30"><Music className="text-blue-300 h-6 w-6 animate-music" /></div>}
            {mascotMood === 'sleeping' && <div className="absolute -top-14 right-[-24px] pointer-events-none z-30"><span className="text-blue-100/70 font-black text-2xl animate-zzz">Z</span></div>}
            {(mascotMood === 'error' || mascotMood === 'capslock' || mascotMood === 'overheat' || mascotMood === 'rage') && <Sparkles className="absolute -top-8 -left-6 text-red-400 h-6 w-6 animate-pulse z-30" />}
            {mascotMood === 'overheat' && <Flame className="absolute -top-16 left-1/2 -translate-x-1/2 text-orange-500 h-10 w-10 animate-steam z-40" />}
            {mascotMood === 'party' && <PartyPopper className="absolute -top-10 left-0 text-yellow-400 h-8 w-8 animate-bounce z-30" />}
            {mascotMood === 'confused' && <QuestionIcon className="absolute -top-12 right-0 text-amber-300 h-8 w-8 animate-bounce z-30" />}
            {(mascotMood === 'scared' || mascotMood === 'lost') && <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-white font-bold text-xl animate-bounce">!</div>}
            {mascotMood === 'dizzy' && <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-white font-bold text-lg animate-pulse">💫</div>}
            {mascotMood === 'success' && <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-emerald-400 font-bold text-lg animate-bounce"><CheckCircle2 className="w-8 h-8" /></div>}
            {mascotMood === 'flow' && <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-amber-300 font-black text-lg animate-pulse tracking-widest">FLOW</div>}

            {mascotMood !== 'shutdown' && (
                <div className={`mb-5 relative group transition-all duration-300 ${mascotMood === 'sleeping' ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}>
                    <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-xl opacity-30 blur ${mascotMood === 'error' || mascotMood === 'capslock' || mascotMood === 'overheat' || mascotMood === 'rage' ? 'from-red-500 to-orange-500' : 'from-blue-500 to-cyan-500'}`}></div>
                    <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 px-5 py-2.5 rounded-2xl rounded-br-none shadow-2xl min-w-[170px] text-center">
                        <p className={`text-xs font-bold tracking-wide transition-colors duration-300 whitespace-nowrap ${mascotMood === 'error' || mascotMood === 'capslock' || mascotMood === 'overheat' || mascotMood === 'rage' ? 'text-red-300 glitch-effect' : isGlitching ? 'text-blue-200 glitch-effect' : 'text-blue-100'}`}>{displayedMessage}<span className="animate-pulse opacity-50">_</span></p>
                    </div>
                </div>
            )}

            <div className={`relative w-36 h-36 ${mascotMood === 'god' || mascotMood === 'warp' ? 'chromatic' : ''}`} style={{ perspective: '1000px' }}>
                <div className="w-full h-full relative transition-transform duration-100 ease-out" style={headTiltStyle}>
                    <div className={mascotBodyClasses}>
                        {mascotMood === 'shutdown' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center animate-crt-off"><Power className="text-red-900/50 h-8 w-8 animate-pulse" /><div className="h-[1px] w-full bg-white/20 absolute top-1/2 animate-pulse"></div></div>
                        ) : (
                            <>
                                {/* Corpo Robótico / Facial */}
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1/2 h-[2px] bg-white/30 blur-[1px] rounded-full" />
                                <div className="absolute w-20 h-10 bg-gradient-to-b from-white/10 to-transparent rounded-full blur-md pointer-events-none transition-transform duration-200" style={{ transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -10}px) rotate(-15deg)` }}></div>
                                <div className={`absolute inset-3 bg-[#030305] rounded-[2.3rem] overflow-hidden flex items-center justify-center border border-white/5 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)]`}>
                                    {(mascotMood === 'tracking' || mascotMood === 'excited' || mascotMood === 'flow' || mascotMood === 'god') && (
                                        <><div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/30 to-transparent w-full h-[150%] scanner-effect z-10 pointer-events-none mix-blend-overlay" /><div className="absolute inset-0 flex flex-col gap-1 opacity-20 animate-data">{[...Array(10)].map((_, i) => <div key={i} className={`text-[6px] font-mono whitespace-nowrap ${mascotMood === 'god' ? 'text-yellow-300' : 'text-green-500'}`}>0101010101</div>)}</div></>
                                    )}
                                    <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:8px_8px]" />
                                    <div className={`absolute inset-0 opacity-30 transition-colors duration-300 ${mascotMood === 'error' || mascotMood === 'capslock' || mascotMood === 'overheat' || mascotMood === 'rage' ? 'bg-red-600' : mascotMood === 'success' ? 'bg-emerald-500' : mascotMood === 'flow' ? 'bg-amber-500' : mascotMood === 'god' ? 'bg-yellow-500' : 'bg-transparent'}`} />
                                    
                                    {mascotMood === 'booting' ? (
                                        <div className="w-2/3 h-1 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${bootProgress}%` }}></div></div>
                                    ) : (
                                        <div className={`flex gap-5 transition-all duration-200 ease-out z-20 items-center ${mascotMood === 'dizzy' ? 'animate-dizzy' : ''}`} style={{ transform: (['blind', 'peek', 'sleeping', 'error', 'success', 'warp', 'party', 'confused', 'scared', 'dizzy', 'lost'].includes(mascotMood)) ? 'none' : `translate(${eyePosition.x + eyeJitter.x}px, ${eyePosition.y + eyeJitter.y}px)` }}>
                                            <div className={`transition-all duration-300 shadow-[0_0_25px_currentColor] overflow-hidden relative ${mascotMood === 'success' || mascotMood === 'warp' || mascotMood === 'excited' || mascotMood === 'party' ? 'w-8 h-4 rounded-t-full border-t-[6px] border-emerald-300 bg-transparent mb-2' : mascotMood === 'error' || mascotMood === 'capslock' ? 'w-7 h-1.5 bg-red-500 rotate-45 rounded-sm' : mascotMood === 'overheat' ? 'w-7 h-1.5 bg-orange-500 rotate-12 rounded-sm animate-pulse' : mascotMood === 'sleeping' || mascotMood === 'bored' ? 'w-7 h-1 bg-slate-500/50 rounded-full' : mascotMood === 'confused' || mascotMood === 'lost' ? 'w-7 h-3 bg-amber-300 rounded-full scale-y-75' : mascotMood === 'scared' ? 'w-5 h-5 bg-white rounded-full animate-ping' : mascotMood === 'dizzy' ? 'w-6 h-6 border-2 border-white rounded-full border-t-transparent animate-spin' : mascotMood === 'judging' ? 'w-7 h-2 bg-amber-400 rounded-sm rotate-12' : mascotMood === 'flow' ? 'w-8 h-5 rounded-md bg-amber-300 animate-pulse' : mascotMood === 'god' ? 'w-8 h-8 rounded-full bg-yellow-300 animate-pulse shadow-[0_0_20px_yellow]' : isGlitching ? 'w-7 h-1 bg-white' : 'w-6 h-9 bg-cyan-300 rounded-full' }`} style={{ transform: `scale(${pupilSize})` }}>
                                                {!['sleeping', 'error', 'success', 'warp', 'party', 'scared'].includes(mascotMood) && <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[size:100%_4px]" />}
                                            </div>
                                            <div className={`transition-all duration-300 shadow-[0_0_25px_currentColor] overflow-hidden relative ${mascotMood === 'success' || mascotMood === 'warp' || mascotMood === 'excited' || mascotMood === 'party' ? 'w-8 h-4 rounded-t-full border-t-[6px] border-emerald-300 bg-transparent mb-2' : mascotMood === 'error' || mascotMood === 'capslock' ? 'w-7 h-1.5 bg-red-500 -rotate-45 rounded-sm' : mascotMood === 'overheat' ? 'w-7 h-1.5 bg-orange-500 -rotate-12 rounded-sm animate-pulse' : mascotMood === 'sleeping' || mascotMood === 'bored' ? 'w-7 h-1 bg-slate-500/50 rounded-full' : mascotMood === 'confused' || mascotMood === 'lost' ? 'w-7 h-7 bg-amber-300 rounded-full' : mascotMood === 'scared' ? 'w-5 h-5 bg-white rounded-full animate-ping' : mascotMood === 'dizzy' ? 'w-6 h-6 border-2 border-white rounded-full border-t-transparent animate-spin' : mascotMood === 'judging' ? 'w-7 h-2 bg-amber-400 rounded-sm -rotate-12' : mascotMood === 'flow' ? 'w-8 h-5 rounded-md bg-amber-300 animate-pulse' : mascotMood === 'god' ? 'w-8 h-8 rounded-full bg-yellow-300 animate-pulse shadow-[0_0_20px_yellow]' : isGlitching ? 'w-7 h-1 bg-white' : 'w-6 h-9 bg-cyan-300 rounded-full' }`} style={{ transform: `scale(${pupilSize})` }}>
                                                {!['sleeping', 'error', 'success', 'warp', 'party', 'scared'].includes(mascotMood) && <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[size:100%_4px]" />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute top-5 right-5 w-5 h-2 bg-white/10 rounded-full blur-[2px] -rotate-45" />
                            </>
                        )}
                    </div>
                </div>

                {mascotMood !== 'shutdown' && (
                    <>
                        {currentProp === 'magnifier' && <Search className="absolute bottom-[-10px] right-[-20px] h-12 w-12 text-blue-200 rotate-12 drop-shadow-xl z-40 animate-pulse" />}
                        {currentProp === 'shield' && <ShieldCheck className="absolute bottom-[-15px] left-[-15px] h-14 w-14 text-emerald-400 -rotate-12 drop-shadow-2xl z-40 animate-pulse" />}
                        {currentProp === 'coffee' && <Coffee className="absolute bottom-[-10px] right-[-15px] h-10 w-10 text-amber-300 rotate-6 drop-shadow-xl z-40" />}
                        {currentProp === 'warning' && <AlertTriangle className="absolute top-0 right-[-20px] h-10 w-10 text-red-500 animate-bounce z-40" />}
                        {currentProp === 'glasses' && <div className="absolute top-[40%] left-1/2 -translate-x-1/2 z-40 w-28 h-8 bg-black/90 rounded-sm flex items-center justify-center border-t-2 border-white/20 shadow-xl"><div className="w-full h-[1px] bg-white/10 absolute top-1"></div></div>}
                    </>
                )}

                {mascotMood !== 'shutdown' && (
                    <>
                        <div className={`absolute left-0 w-11 h-11 bg-gradient-to-br from-slate-600 to-slate-800 border border-slate-500/50 rounded-full z-30 shadow-xl transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${mascotMood === 'blind' ? 'bottom-[38px] left-[12px] rotate-[15deg]' : mascotMood === 'peek' ? 'bottom-[28px] left-[2px] rotate-0' : mascotMood === 'confused' || mascotMood === 'lost' ? 'bottom-[40px] left-[5px] rotate-[30deg]' : mascotMood === 'scared' ? 'bottom-[50px] -left-2 rotate-[-20deg]' : mascotMood === 'judging' ? 'bottom-[25px] -left-2' : mascotMood === 'flow' || typingCombo > 5 ? 'bottom-[20px] -left-4 animate-bounce' : mascotMood === 'god' ? 'bottom-[40px] -left-8 animate-levitate' : currentProp === 'shield' ? 'bottom-[20px] -left-4' : '-bottom-4 -left-2 opacity-0 scale-50'}`}></div>
                        <div className={`absolute right-0 w-11 h-11 bg-gradient-to-bl from-slate-600 to-slate-800 border border-slate-500/50 rounded-full z-30 shadow-xl transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${mascotMood === 'blind' ? 'bottom-[38px] right-[12px] -rotate-[15deg]' : mascotMood === 'peek' ? 'bottom-[32px] -right-1 rotate-[25deg]' : mascotMood === 'scared' ? 'bottom-[50px] -right-2 rotate-[20deg]' : mascotMood === 'judging' ? 'bottom-[25px] -right-2' : mascotMood === 'flow' || typingCombo > 5 ? 'bottom-[20px] -right-4 animate-bounce' : mascotMood === 'god' ? 'bottom-[40px] -right-8 animate-levitate' : currentProp !== 'none' && currentProp !== 'shield' ? 'bottom-[20px] -right-4' : '-bottom-4 -right-2 opacity-0 scale-50'}`}></div>
                    </>
                )}

                {/* --- NOVOS PROPULSORES REALISTAS (PLASMA ENGINE) --- */}
                {mascotMood !== 'sleeping' && mascotMood !== 'shutdown' && (
                 <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex justify-center z-10 origin-top">
                      {/* Heat Haze/Glow Container */}
                      <div className={`absolute -bottom-4 w-20 h-20 blur-[20px] opacity-40 rounded-full animate-pulse transition-colors duration-500 ${isHighEnergy ? (mascotMood === 'overheat' ? 'bg-orange-500' : 'bg-amber-400') : (['error', 'capslock'].includes(mascotMood) ? 'bg-red-500' : 'bg-blue-500')}`}></div>

                      {/* Main Engine Cluster */}
                      <div className="relative flex items-start justify-center gap-1 scale-y-110">
                          {/* Left Stabilizer */}
                          <div className="relative w-3 h-8 origin-top animate-thruster-stabilizer-left">
                              <div className={`absolute inset-0 rounded-b-full blur-[4px] opacity-80 transition-colors duration-500 ${isHighEnergy ? (mascotMood === 'overheat' ? 'bg-orange-500' : 'bg-amber-400') : (['error', 'capslock'].includes(mascotMood) ? 'bg-red-500' : 'bg-blue-500')}`}></div>
                              <div className={`absolute top-0 left-[20%] w-[60%] h-[80%] rounded-b-full blur-[1px] transition-colors duration-500 ${isHighEnergy ? (mascotMood === 'overheat' ? 'bg-orange-100' : 'bg-yellow-100') : (['error', 'capslock'].includes(mascotMood) ? 'bg-red-100' : 'bg-cyan-50')}`}></div>
                          </div>

                          {/* Center Main Drive */}
                          <div className="relative w-5 h-12 origin-top animate-thruster-main mx-1">
                              {/* Outer plasma sheath */}
                             <div className={`absolute inset-0 rounded-b-full blur-[6px] transition-colors duration-500 ${isHighEnergy ? (mascotMood === 'overheat' ? 'bg-orange-500' : 'bg-amber-400') : (['error', 'capslock'].includes(mascotMood) ? 'bg-red-500' : 'bg-blue-500')}`}></div>
                              {/* Inner bright core */}
                             <div className={`absolute top-0 left-[15%] w-[70%] h-[90%] rounded-b-full bg-white blur-[2px] animate-thruster-core-pulse`}></div>
                          </div>

                          {/* Right Stabilizer */}
                          <div className="relative w-3 h-8 origin-top animate-thruster-stabilizer-right">
                              <div className={`absolute inset-0 rounded-b-full blur-[4px] opacity-80 transition-colors duration-500 ${isHighEnergy ? (mascotMood === 'overheat' ? 'bg-orange-500' : 'bg-amber-400') : (['error', 'capslock'].includes(mascotMood) ? 'bg-red-500' : 'bg-blue-500')}`}></div>
                              <div className={`absolute top-0 left-[20%] w-[60%] h-[80%] rounded-b-full blur-[1px] transition-colors duration-500 ${isHighEnergy ? (mascotMood === 'overheat' ? 'bg-orange-100' : 'bg-yellow-100') : (['error', 'capslock'].includes(mascotMood) ? 'bg-red-100' : 'bg-cyan-50')}`}></div>
                          </div>
                      </div>
                 </div>
                )}
            </div>
            <div className={`w-24 h-3 bg-black/70 rounded-[100%] blur-lg mt-10 transition-all duration-1000 ${mascotMood === 'sleeping' ? 'opacity-10 scale-50' : mascotMood === 'shutdown' ? 'opacity-0' : 'animate-pulse scale-x-90 opacity-40'}`} />
        </div>

      </div>
      
      {/* --- RODAPÉ DISCRETO --- */}
      <div className={`absolute bottom-5 w-full text-center transition-opacity duration-1000 ${isExiting ? 'opacity-0' : 'opacity-100'} z-50`}>
        <div className="inline-flex items-center gap-3 text-[10px] font-mono text-white/10 hover:text-blue-400/40 transition-all duration-700 cursor-default tracking-[0.2em] group">
            <span>© 2025 FLUXO ROYALE</span>
            <span className="w-1 h-1 rounded-full bg-white/10 group-hover:bg-blue-500/50 transition-colors duration-700"></span>
            <span>DEV BRUNO CORRAL</span>
        </div>
      </div>
    </div>
  );
}
