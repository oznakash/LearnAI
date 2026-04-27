import { useEffect, useState, type ReactNode } from "react";

export type MascotMood = "neutral" | "happy" | "thinking" | "wow" | "sad" | "wink";

interface Props {
  mood?: MascotMood;
  size?: number;
  className?: string;
  message?: string;
}

const eyes: Record<MascotMood, ReactNode> = {
  neutral: (
    <>
      <circle cx="42" cy="60" r="5" fill="#0b1020" />
      <circle cx="78" cy="60" r="5" fill="#0b1020" />
    </>
  ),
  happy: (
    <>
      <path d="M37 60 Q42 53 47 60" stroke="#0b1020" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M73 60 Q78 53 83 60" stroke="#0b1020" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  thinking: (
    <>
      <circle cx="42" cy="60" r="5" fill="#0b1020" />
      <circle cx="78" cy="58" r="4" fill="#0b1020" />
      <circle cx="78" cy="58" r="1.5" fill="#fff" />
    </>
  ),
  wow: (
    <>
      <circle cx="42" cy="60" r="6" fill="#0b1020" />
      <circle cx="42" cy="59" r="2" fill="#fff" />
      <circle cx="78" cy="60" r="6" fill="#0b1020" />
      <circle cx="78" cy="59" r="2" fill="#fff" />
    </>
  ),
  sad: (
    <>
      <path d="M37 62 Q42 67 47 62" stroke="#0b1020" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M73 62 Q78 67 83 62" stroke="#0b1020" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  wink: (
    <>
      <circle cx="42" cy="60" r="5" fill="#0b1020" />
      <path d="M73 60 L83 60" stroke="#0b1020" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
};

const mouth: Record<MascotMood, ReactNode> = {
  neutral: <path d="M52 80 Q60 84 68 80" stroke="#0b1020" strokeWidth="3" fill="none" strokeLinecap="round" />,
  happy: <path d="M48 78 Q60 92 72 78" stroke="#0b1020" strokeWidth="3" fill="#ffb547" strokeLinecap="round" />,
  thinking: <path d="M55 82 L65 82" stroke="#0b1020" strokeWidth="3" strokeLinecap="round" />,
  wow: <ellipse cx="60" cy="84" rx="6" ry="8" fill="#0b1020" />,
  sad: <path d="M48 86 Q60 76 72 86" stroke="#0b1020" strokeWidth="3" fill="none" strokeLinecap="round" />,
  wink: <path d="M48 78 Q60 90 72 78" stroke="#0b1020" strokeWidth="3" fill="#ffb547" strokeLinecap="round" />,
};

export function Mascot({ mood = "neutral", size = 96, className = "", message }: Props) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="drop-shadow-lg animate-float">
        <defs>
          <linearGradient id="mbody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c5cff" />
            <stop offset="1" stopColor="#28e0b3" />
          </linearGradient>
          <radialGradient id="mglow" cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* antenna */}
        <line x1="60" y1="14" x2="60" y2="26" stroke="#28e0b3" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="12" r="4" fill="#ffb547">
          <animate attributeName="r" values="3;5;3" dur="1.4s" repeatCount="indefinite" />
        </circle>
        {/* head */}
        <rect x="20" y="28" width="80" height="70" rx="22" fill="url(#mbody)" stroke="#0b1020" strokeWidth="2" />
        <rect x="20" y="28" width="80" height="70" rx="22" fill="url(#mglow)" />
        {/* face plate */}
        <rect x="32" y="48" width="56" height="40" rx="14" fill="#fefae6" />
        {eyes[mood]}
        {mouth[mood]}
        {/* cheeks */}
        <circle cx="34" cy="78" r="3" fill="#ff8fb1" opacity="0.6" />
        <circle cx="86" cy="78" r="3" fill="#ff8fb1" opacity="0.6" />
        {/* arms */}
        <circle cx="14" cy="70" r="6" fill="#7c5cff" stroke="#0b1020" strokeWidth="2" />
        <circle cx="106" cy="70" r="6" fill="#7c5cff" stroke="#0b1020" strokeWidth="2" />
      </svg>
      {message && (
        <div className="card px-3 py-2 text-sm relative">
          <div className="absolute left-[-8px] top-3 w-3 h-3 rotate-45 bg-ink2/90 border-l border-t border-white/5" />
          {message}
        </div>
      )}
    </div>
  );
}

export function MoodCycle({ messages, size = 80 }: { messages: { mood: MascotMood; text: string }[]; size?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, [messages.length]);
  const m = messages[i];
  return <Mascot mood={m.mood} message={m.text} size={size} />;
}
