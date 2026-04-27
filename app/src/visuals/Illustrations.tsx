import type { ReactNode } from "react";
import type { VisualKey } from "../types";

const grad = (from: string, to: string) => (
  <linearGradient id={from + to} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor={from} />
    <stop offset="1" stopColor={to} />
  </linearGradient>
);

const ill: Record<VisualKey, ReactNode> = {
  neural: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#7c5cff", "#28e0b3")}</defs>
      {[20, 60, 100, 140, 180].map((x, i) => (
        <g key={i}>
          {[20, 60, 100].map((y, j) => (
            <circle key={j} cx={x} cy={y} r="8" fill="url(#7c5cff28e0b3)">
              <animate attributeName="r" values="6;10;6" dur="2s" begin={`${(i + j) * 0.2}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
      ))}
      {[20, 60, 100, 140].map((x1, i) => (
        <g key={i} stroke="#7c5cff" strokeOpacity="0.35" strokeWidth="1.5">
          {[20, 60, 100].map((y1) => [20, 60, 100].map((y2) => <line key={`${y1}-${y2}`} x1={x1} y1={y1} x2={x1 + 40} y2={y2} />))}
        </g>
      ))}
    </svg>
  ),
  data: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#28e0b3", "#7c5cff")}</defs>
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <rect key={`${row}-${col}`} x={20 + col * 32} y={20 + row * 30} width="22" height="22" rx="4" fill="url(#28e0b37c5cff)" opacity={0.4 + (row + col) * 0.06}>
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="3s" begin={`${(row + col) * 0.2}s`} repeatCount="indefinite" />
          </rect>
        ))
      )}
    </svg>
  ),
  embed: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#7c5cff", "#ffb547")}</defs>
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const r = 40 + (i % 5) * 4;
        const x = 100 + Math.cos(angle) * r;
        const y = 60 + Math.sin(angle) * r;
        return <circle key={i} cx={x} cy={y} r="3" fill="url(#7c5cffffb547)" />;
      })}
      <circle cx="100" cy="60" r="14" fill="#0b1020" stroke="#7c5cff" strokeWidth="2" />
      <text x="100" y="64" textAnchor="middle" fontSize="10" fill="#fff">cat</text>
    </svg>
  ),
  tokens: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      {["un", "believ", "able", "→", "AI"].map((t, i) => (
        <g key={i}>
          <rect x={10 + i * 38} y={50} width="34" height="22" rx="6" fill={i === 3 ? "transparent" : "#1b2348"} stroke="#7c5cff" strokeWidth={i === 3 ? 0 : 1.5} />
          <text x={27 + i * 38} y={66} textAnchor="middle" fontSize="11" fill="#e6e8f2">{t}</text>
        </g>
      ))}
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#ff5d8f", "#7c5cff")}</defs>
      <path d="M100 14 L160 38 V78 C160 100 130 110 100 116 C70 110 40 100 40 78 V38 Z" fill="url(#ff5d8f7c5cff)" stroke="#0b1020" strokeWidth="2" />
      <path d="M82 64 L96 78 L122 52" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cloud: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#7c5cff", "#28e0b3")}</defs>
      <path d="M40 80 Q40 60 60 60 Q65 40 90 42 Q110 30 130 50 Q160 50 160 75 Q170 80 165 95 L45 95 Q30 90 40 80 Z" fill="url(#7c5cff28e0b3)" stroke="#0b1020" strokeWidth="2" />
      {[60, 90, 120, 150].map((x, i) => (
        <circle key={i} cx={x} cy={108} r="2" fill="#28e0b3">
          <animate attributeName="cy" values="105;115;105" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  ),
  rocket: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#ffb547", "#ff5d8f")}</defs>
      <g transform="translate(100,60)">
        <path d="M-20 0 L0 -45 L20 0 L10 20 L-10 20 Z" fill="url(#ffb547ff5d8f)" stroke="#0b1020" strokeWidth="2" />
        <circle cx="0" cy="-15" r="6" fill="#0b1020" />
        <path d="M-10 20 L-25 35 L-5 25 Z" fill="#7c5cff" />
        <path d="M10 20 L25 35 L5 25 Z" fill="#7c5cff" />
        <path d="M-6 25 L0 50 L6 25 Z" fill="#ffb547">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="0.4s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
  ),
  graph: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#28e0b3", "#7c5cff")}</defs>
      <polyline points="20,90 50,70 80,80 110,40 140,55 180,20" fill="none" stroke="url(#28e0b37c5cff)" strokeWidth="3" strokeLinecap="round" />
      {[20, 50, 80, 110, 140, 180].map((x, i) => (
        <circle key={i} cx={x} cy={[90, 70, 80, 40, 55, 20][i]} r="4" fill="#28e0b3" />
      ))}
    </svg>
  ),
  robot: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#28e0b3", "#7c5cff")}</defs>
      <rect x="60" y="30" width="80" height="60" rx="14" fill="url(#28e0b37c5cff)" stroke="#0b1020" strokeWidth="2" />
      <circle cx="85" cy="58" r="6" fill="#0b1020" />
      <circle cx="115" cy="58" r="6" fill="#0b1020" />
      <rect x="80" y="74" width="40" height="6" rx="3" fill="#0b1020" />
      <line x1="100" y1="14" x2="100" y2="28" stroke="#28e0b3" strokeWidth="2" />
      <circle cx="100" cy="12" r="4" fill="#ffb547" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#ffb547", "#ff5d8f")}</defs>
      <path d="M70 30 H130 V60 C130 78 115 90 100 90 C85 90 70 78 70 60 Z" fill="url(#ffb547ff5d8f)" stroke="#0b1020" strokeWidth="2" />
      <rect x="88" y="90" width="24" height="10" fill="#0b1020" />
      <rect x="78" y="100" width="44" height="6" rx="3" fill="#ffb547" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#7c5cff", "#ffb547")}</defs>
      <path d="M100 20 L110 50 L140 60 L110 70 L100 100 L90 70 L60 60 L90 50 Z" fill="url(#7c5cffffb547)">
        <animateTransform attributeName="transform" type="rotate" from="0 100 60" to="360 100 60" dur="12s" repeatCount="indefinite" />
      </path>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#7c5cff", "#28e0b3")}</defs>
      <rect x="70" y="50" width="60" height="50" rx="8" fill="url(#7c5cff28e0b3)" />
      <path d="M82 50 V36 a18 18 0 0 1 36 0 V50" stroke="#7c5cff" strokeWidth="6" fill="none" />
      <circle cx="100" cy="74" r="6" fill="#0b1020" />
      <rect x="98" y="74" width="4" height="14" fill="#0b1020" />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#ffb547", "#ff5d8f")}</defs>
      <circle cx="100" cy="60" r="42" fill="#1b2348" stroke="url(#ffb547ff5d8f)" strokeWidth="3" />
      <polygon points="100,28 108,60 100,92 92,60" fill="url(#ffb547ff5d8f)" />
      <circle cx="100" cy="60" r="4" fill="#fff" />
    </svg>
  ),
  stack: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#7c5cff", "#28e0b3")}</defs>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={50} y={20 + i * 22} width="100" height="16" rx="4" fill="url(#7c5cff28e0b3)" opacity={0.4 + i * 0.18} />
      ))}
    </svg>
  ),
  chip: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#28e0b3", "#7c5cff")}</defs>
      <rect x="60" y="30" width="80" height="60" rx="6" fill="url(#28e0b37c5cff)" stroke="#0b1020" strokeWidth="2" />
      <rect x="80" y="50" width="40" height="20" rx="2" fill="#0b1020" />
      {[35, 55, 75].map((y) => (
        <g key={y}>
          <line x1="50" y1={y} x2="60" y2={y} stroke="#28e0b3" strokeWidth="2" />
          <line x1="140" y1={y} x2="150" y2={y} stroke="#28e0b3" strokeWidth="2" />
        </g>
      ))}
      {[70, 90, 110].map((x) => (
        <g key={x}>
          <line x1={x} y1="20" x2={x} y2="30" stroke="#28e0b3" strokeWidth="2" />
          <line x1={x} y1="90" x2={x} y2="100" stroke="#28e0b3" strokeWidth="2" />
        </g>
      ))}
    </svg>
  ),
  news: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#28e0b3", "#7c5cff")}</defs>
      <rect x="40" y="20" width="120" height="80" rx="6" fill="url(#28e0b37c5cff)" stroke="#0b1020" strokeWidth="2" />
      <rect x="50" y="30" width="60" height="10" rx="2" fill="#0b1020" />
      <rect x="50" y="46" width="100" height="4" rx="2" fill="#0b1020" opacity="0.6" />
      <rect x="50" y="56" width="80" height="4" rx="2" fill="#0b1020" opacity="0.6" />
      <rect x="50" y="70" width="100" height="22" rx="4" fill="#0b1020" opacity="0.4" />
    </svg>
  ),
  open: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#7c5cff", "#28e0b3")}</defs>
      <circle cx="100" cy="60" r="40" fill="none" stroke="url(#7c5cff28e0b3)" strokeWidth="3" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x = 100 + Math.cos(a) * 40;
        const y = 60 + Math.sin(a) * 40;
        return <circle key={i} cx={x} cy={y} r="6" fill="#28e0b3" />;
      })}
      <circle cx="100" cy="60" r="10" fill="#7c5cff" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#ffb547", "#ff5d8f")}</defs>
      {[20, 50, 80, 110, 140, 170].map((x, i) => (
        <rect key={i} x={x} y={100 - (i + 1) * 12} width="20" height={(i + 1) * 12} rx="3" fill="url(#ffb547ff5d8f)" opacity={0.5 + i * 0.08} />
      ))}
    </svg>
  ),
  build: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#28e0b3", "#7c5cff")}</defs>
      <rect x="36" y="40" width="48" height="60" fill="url(#28e0b37c5cff)" />
      <rect x="92" y="20" width="36" height="80" fill="url(#28e0b37c5cff)" opacity="0.85" />
      <rect x="136" y="60" width="32" height="40" fill="url(#28e0b37c5cff)" opacity="0.6" />
      <rect x="20" y="100" width="160" height="6" fill="#0b1020" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#ffb547", "#ff5d8f")}</defs>
      <circle cx="70" cy="60" r="22" fill="none" stroke="url(#ffb547ff5d8f)" strokeWidth="6" />
      <line x1="92" y1="60" x2="160" y2="60" stroke="url(#ffb547ff5d8f)" strokeWidth="6" />
      <line x1="140" y1="60" x2="140" y2="74" stroke="url(#ffb547ff5d8f)" strokeWidth="6" />
      <line x1="155" y1="60" x2="155" y2="80" stroke="url(#ffb547ff5d8f)" strokeWidth="6" />
    </svg>
  ),
  memory: (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>{grad("#ff5d8f", "#7c5cff")}</defs>
      <path d="M60 30 Q40 60 60 90 Q80 110 100 90 Q120 110 140 90 Q160 60 140 30 Q120 10 100 30 Q80 10 60 30 Z" fill="url(#ff5d8f7c5cff)" stroke="#0b1020" strokeWidth="2" />
      <circle cx="80" cy="55" r="3" fill="#0b1020" />
      <circle cx="120" cy="55" r="3" fill="#0b1020" />
      <path d="M85 78 Q100 88 115 78" stroke="#0b1020" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  ),
};

export function Illustration({ k, className = "" }: { k?: VisualKey; className?: string }) {
  if (!k) return null;
  return <div className={className}>{ill[k]}</div>;
}
