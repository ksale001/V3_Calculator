import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { Plus, Download, LinkIcon, Trash, Info } from "lucide-react";

// NOTE: Tailwind is optional. UI uses utility-like classes; without Tailwind it still renders.
// Obol brand palette
const BRAND = {
  bg: "#091011",
  panel: "#111F22",
  panel2: "#182D32",
  accent: "#2FE4AB",
  accent2: "#9167E4",
  text: "#E1E9EB",
  subtext: "#A7E2D0",
  warn: "#FABA5A",
  ok: "#B6EA5C",
  info: "#3CD2DD",
};

// ---------- Types ----------

type Persona = "Curator/Allocator" | "Node Operator" | "Retail";

type Scenario = {
  id: string;
  name: string;
  persona: Persona;
  depositEth: number; // base deposit
  operatorCount: number; // 1..7
  reserveRatioPct: number; // editable
  lidoCoreAprPct: number; // e.g., 3
  mintedDeploymentAprPct: number; // APR earned by deploying minted stETH (optional)
  fees: {
    infraPct: number; // default 1%
    reservationPct: number; // default 0%
    liquidityPct: number; // default 6.5%
    nodeOperatorPct: number; // default 5%
    obolShareOfNOFeesPct: number; // default 10% of NO fees
    obolWaived: boolean;
  };
};

// Rails based on Lido defaults (Aug 8, 2025 update)
const RR_SINGLE_OP = [5, 6, 9, 14, 20];
const RR_MULTI_DVT = [2, 3, 4];

function isMultiOperator(operatorCount: number) {
  return operatorCount > 1;
}

function withinRails(operatorCount: number, rr: number) {
  return isMultiOperator(operatorCount)
    ? RR_MULTI_DVT.includes(rr)
    : RR_SINGLE_OP.includes(rr);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Calculation engine (yearly estimates)
function computeScenario(s: Scenario) {
  const deposit = Math.max(0, s.depositEth);
  const rr = clamp(s.reserveRatioPct, 0, 100) / 100; // 0..1
  const coreApr = clamp(s.lidoCoreAprPct, 0, 100) / 100; // 0..1

  // Mintable & Minted stETH (assume minted==mintable for baseline)
  const mintedStETH = deposit * (1 - rr);

  // Rewards basis (approx): use Lido Core APR on total deposit
  const grossRewards = deposit * coreApr; // ETH/year

  // Optional additional yield from deploying minted stETH (e.g., restaking without leverage in v1)
  const secondaryApr = clamp(s.mintedDeploymentAprPct, 0, 100) / 100;
  const secondaryRewards = mintedStETH * secondaryApr;

  // Lido fees
  const infraFee = deposit * coreApr * (s.fees.infraPct / 100);
  const reservationFee = mintedStETH * coreApr * (s.fees.reservationPct / 100);
  const liquidityFee = mintedStETH * coreApr * (s.fees.liquidityPct / 100);
  const lidoFeesTotal = infraFee + reservationFee + liquidityFee;

  // Node Operator fee (set by operator(s))
  const noFeesTotal = grossRewards * (s.fees.nodeOperatorPct / 100);

  // Obol share (carved from NO fees)
  const obolShare = s.fees.obolWaived
    ? 0
    : noFeesTotal * (s.fees.obolShareOfNOFeesPct / 100);

  // Split remaining NO fees across operators
  const operatorsTake = Math.max(0, noFeesTotal - obolShare);
  const perOperator = operatorsTake / s.operatorCount;

  // Net to depositor (APR after fees)
  const depositorRewards = Math.max(
    0,
    grossRewards + secondaryRewards - lidoFeesTotal - noFeesTotal
  );
  const netDepositorAprPct = deposit > 0 ? (depositorRewards / deposit) * 100 : 0;

  return {
    mintedStETH,
    secondaryRewards,
    grossRewards,
    lidoFees: { infraFee, reservationFee, liquidityFee, total: lidoFeesTotal },
    noFees: { total: noFeesTotal, obolShare, operatorsTake, perOperator },
    depositorRewards,
    netDepositorAprPct,
    withinRails: withinRails(s.operatorCount, s.reserveRatioPct),
  };
}

function formatEth(n: number) {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETH/yr`;
}

function formatPct(n: number) {
  return `${n.toFixed(2)}%`;
}

const DISTRIBUTION_COLORS = [BRAND.accent, BRAND.accent2, BRAND.warn, BRAND.info];

// ---------- Components ----------

const Pill: React.FC<{ label: string; tone?: "ok" | "warn" | "info" | "default" }>
  = ({ label, tone = "default" }) => {
  const map: Record<string, string> = {
    ok: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    info: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    default: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };
  return (
    <span className={`px-2 py-1 text-xs rounded-full border ${map[tone]}`}>{label}</span>
  );
};

const HeroNetwork: React.FC<{ operators: number }>= ({ operators }) => {
  // Draw nodes around a circle and animate using framer-motion
  const nodes = Array.from({ length: operators });
  const radius = 110;
  return (
    <svg viewBox="0 0 320 200" className="w-full h-48">
      <defs>
        <radialGradient id="grad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={BRAND.panel2} />
          <stop offset="100%" stopColor={BRAND.bg} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="320" height="200" fill="url(#grad)" rx="16" />
      {/* center hub */}
      <circle cx={160} cy={100} r={8} fill={BRAND.accent} />
      {nodes.map((_, i) => {
        const angle = (i / nodes.length) * Math.PI * 2;
        const cx = 160 + radius * Math.cos(angle);
        const cy = 100 + radius * Math.sin(angle);
        const key = `n-${i}`;
        return (
          <g key={key}>
            {/* link */}
            <motion.line
              x1={160}
              y1={100}
              x2={cx}
              y2={cy}
              stroke={BRAND.subtext}
              strokeOpacity={0.35}
              strokeWidth={2}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: i * 0.05 }}
            />
            {/* node */}
            <motion.circle
              cx={cx}
              cy={cy}
              r={10}
              fill={BRAND.panel}
              stroke={BRAND.accent}
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 + i * 0.05 }}
            />
          </g>
        );
      })}
      <text x={16} y={24} fill={BRAND.text} className="text-sm font-medium">
        Cluster visualization
      </text>
      <text x={16} y={42} fill={BRAND.subtext} className="text-xs">
        {operators} operator{operators === 1 ? "" : "s"} (DVT)
      </text>
    </svg>
  );
};

const ScenarioCard: React.FC<{
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  onRemove?: () => void;
  index: number;
}> = ({ scenario, onChange, onRemove, index }) => {
  const r = computeScenario(scenario);
  const isMulti = isMultiOperator(scenario.operatorCount);

  const distributionData = [
    { name: "Depositor (net)", value: r.depositorRewards },
    { name: "Lido fees", value: r.lidoFees.total },
    { name: "NO fees", value: r.noFees.total },
  ];

  return (
    <div className="rounded-2xl p-4 bg-[#111F22] shadow-lg border border-white/5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Pill label={scenario.persona} tone="info" />
          {r.withinRails ? (
            <Pill label="Within DAO rails" tone="ok" />
          ) : (
            <Pill label="Needs RFC" tone="warn" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRemove && (
            <button
              onClick={onRemove}
              className="px-2 py-1 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-200 hover:bg-red-500/20"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hero for this scenario */}
      <HeroNetwork operators={scenario.operatorCount} />

      {/* Scenario header controls */}
      <div className="flex flex-col md:flex-row gap-2">
        <input
          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40"
          value={scenario.name}
          onChange={(e) => onChange({ ...scenario, name: e.target.value })}
          placeholder={`Scenario ${index + 1}`}
        />
        <select
          className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-sm text-white"
          value={scenario.persona}
          onChange={(e) => onChange({ ...scenario, persona: e.target.value as Persona })}
        >
          <option>Curator/Allocator</option>
          <option>Node Operator</option>
          <option>Retail</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {/* Inputs */}
        <div className="space-y-3">

          <div className="grid grid-cols-3 gap-3 items-end">
            <label className="text-xs text-white/70">Deposit (ETH)
              <input
                type="number"
                min={0}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.depositEth}
                onChange={(e) => onChange({ ...scenario, depositEth: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs text-white/70">Lido Core APR (%)
              <input
                type="number"
                step={0.1}
                min={0}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.lidoCoreAprPct}
                onChange={(e) => onChange({ ...scenario, lidoCoreAprPct: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs text-white/70">Minted stETH deployment APR (%)
              <input
                type="number"
                step={0.1}
                min={0}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.mintedDeploymentAprPct}
                onChange={(e) => onChange({ ...scenario, mintedDeploymentAprPct: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <label className="text-xs text-white/70">Operators (1–7)
              <input
                type="range"
                min={1}
                max={7}
                step={1}
                className="mt-1 w-full"
                value={scenario.operatorCount}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  // adjust RR default when switching single↔multi
                  const wasMulti = isMultiOperator(scenario.operatorCount);
                  const willMulti = isMultiOperator(next);
                  let rr = scenario.reserveRatioPct;
                  if (!wasMulti && willMulti) rr = 2; // default DVT
                  if (wasMulti && !willMulti) rr = 5; // default single-op
                  onChange({ ...scenario, operatorCount: next, reserveRatioPct: rr });
                }}
              />
            </label>
            <label className="text-xs text-white/70">Reserve Ratio (%)
              <input
                type="number"
                step={0.1}
                min={0}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.reserveRatioPct}
                onChange={(e) => onChange({ ...scenario, reserveRatioPct: Number(e.target.value) })}
              />
              <div className="mt-1 text-[10px] text-white/50">
                Allowed presets: {isMulti ? "2, 3, 4" : "5, 6, 9, 14, 20"}
              </div>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <label className="text-xs text-white/70">Infra fee (%)
              <input
                type="number"
                step={0.1}
                min={0}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.fees.infraPct}
                onChange={(e) => onChange({ ...scenario, fees: { ...scenario.fees, infraPct: Number(e.target.value) } })}
              />
            </label>
            <label className="text-xs text-white/70">Reservation fee (%)
              <input
                type="number"
                step={0.1}
                min={0}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.fees.reservationPct}
                onChange={(e) => onChange({ ...scenario, fees: { ...scenario.fees, reservationPct: Number(e.target.value) } })}
              />
            </label>
            <label className="text-xs text-white/70">Liquidity fee (%)
              <input
                type="number"
                step={0.1}
                min={0}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.fees.liquidityPct}
                onChange={(e) => onChange({ ...scenario, fees: { ...scenario.fees, liquidityPct: Number(e.target.value) } })}
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <label className="text-xs text-white/70">NO fee (%)
              <input
                type="number"
                step={0.1}
                min={0}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.fees.nodeOperatorPct}
                onChange={(e) => onChange({ ...scenario, fees: { ...scenario.fees, nodeOperatorPct: Number(e.target.value) } })}
              />
            </label>
            <label className="text-xs text-white/70">Obol share of NO (%)
              <input
                type="number"
                step={1}
                min={0}
                max={100}
                className="mt-1 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={scenario.fees.obolShareOfNOFeesPct}
                onChange={(e) => onChange({ ...scenario, fees: { ...scenario.fees, obolShareOfNOFeesPct: Number(e.target.value) } })}
              />
            </label>
            <label className="text-xs text-white/70 flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={scenario.fees.obolWaived}
                onChange={(e) => onChange({ ...scenario, fees: { ...scenario.fees, obolWaived: e.target.checked } })}
                className="accent-emerald-400"
              />
              Waive Obol share
            </label>
          </div>
        </div>

        {/* Outputs */}
        <div className="space-y-3">
          <div className="rounded-xl bg-black/30 border border-white/10 p-3">
            <div className="text-xs text-white/70">Mintable stETH</div>
            <div className="text-lg font-semibold text-white">{scenario.depositEth.toLocaleString()} ETH → {r.mintedStETH.toLocaleString()} stETH</div>
          </div>

          <div className="rounded-xl bg-black/30 border border-white/10 p-3">
            <div className="text-xs text-white/70">Additional yield from minted stETH</div>
            <div className="text-lg font-semibold text-white">{formatEth(r.secondaryRewards)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-white/70">Net depositor APR</div>
              <div className="text-lg font-semibold text-white">{formatPct(r.netDepositorAprPct)}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-white/70">Per‑operator revenue</div>
              <div className="text-lg font-semibold text-white">{formatEth(r.noFees.perOperator)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 12, right: 0, bottom: 24, left: 0 }}>
                  <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60}>
                    {distributionData.map((_, i) => (
                      <Cell key={i} fill={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip wrapperStyle={{ zIndex: 50 }} contentStyle={{ background: "#0b1112", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, color: "#E1E9EB" }} itemStyle={{ color: "#E1E9EB" }} labelStyle={{ color: "#A7E2D0" }} />
                  <Legend verticalAlign="bottom" height={24} wrapperStyle={{ color: "white" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
              <div className="text-sm text-white/80 space-y-1">
              <div className="flex justify-between border-b border-white/10 py-1"><span>Lido infra fee</span><span>{formatEth(r.lidoFees.infraFee)}</span></div>
              <div className="flex justify-between border-b border-white/10 py-1"><span>Lido reservation fee</span><span>{formatEth(r.lidoFees.reservationFee)}</span></div>
              <div className="flex justify-between border-b border-white/10 py-1"><span>Lido liquidity fee</span><span>{formatEth(r.lidoFees.liquidityFee)}</span></div>
              <div className="flex justify-between border-b border-white/10 py-1"><span>NO fees (total)</span><span>{formatEth(r.noFees.total)}</span></div>
              <div className="flex justify-between border-b border-white/10 py-1"><span>— Obol share</span><span>{formatEth(r.noFees.obolShare)}</span></div>
              <div className="flex justify-between py-1"><span>— Operators share</span><span>{formatEth(r.noFees.operatorsTake)}</span></div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function encodeState(scenarios: Scenario[]) {
  const payload = scenarios.map(({ id, ...rest }) => rest);
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

function decodeState(str: string): Scenario[] | null {
  try {
    const arr = JSON.parse(decodeURIComponent(atob(str)));
    return arr.map((rest: any, i: number) => ({ id: `restored-${i}`, ...rest }));
  } catch {
    return null;
  }
}

function download(filename: string, text: string) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

const defaultScenario = (id: string, name: string, operators: number): Scenario => ({
  id,
  name,
  persona: "Curator/Allocator",
  depositEth: 10000,
  operatorCount: operators,
  reserveRatioPct: operators > 1 ? 2 : 5, // per your defaults
  lidoCoreAprPct: 3,
  mintedDeploymentAprPct: 1,
  fees: {
    infraPct: 1.0,
    reservationPct: 0.0,
    liquidityPct: 6.5,
    nodeOperatorPct: 5.0,
    obolShareOfNOFeesPct: 10,
    obolWaived: false,
  },
});

export default function VaultEconomicsApp() {
  // Initial two side-by-side presets; allow a third
  const [scenarios, setScenarios] = useState<Scenario[]>([
    defaultScenario("s1", "Single‑Operator DVT", 1),
    defaultScenario("s2", "Multi‑Operator DVT (3)", 3),
  ]);

  // Load from URL if present
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const qs = url.searchParams.get("state");
    if (qs) {
      const restored = decodeState(qs);
      if (restored) setScenarios(restored);
    }
  }, []);

  const addScenario = () => {
    if (scenarios.length >= 3) return;
    const n = scenarios.length + 1;
    setScenarios((prev) => [...prev, defaultScenario(`s${n}`, `Custom DVT (${n===3?5:3})`, n===3?5:3)]);
  };

  const updateScenario = (idx: number, next: Scenario) => {
    setScenarios((prev) => prev.map((s, i) => (i === idx ? next : s)));
  };

  const removeScenario = (idx: number) => {
    setScenarios((prev) => prev.filter((_, i) => i !== idx));
  };

  const shareLink = useMemo(() => {
    const encoded = encodeState(scenarios);
    const url = new URL(window.location.href);
    url.searchParams.set("state", encoded);
    return url.toString();
  }, [scenarios]);

  const exportCSV = () => {
    const header = [
      "Scenario",
      "Persona",
      "DepositETH",
      "Operators",
      "ReserveRatio%",
      "APR%",
      "LidoInfra%",
      "LidoReservation%",
      "LidoLiquidity%",
      "NO%",
      "ObolShareOfNO%",
      "ObolWaived",
      "MintedStETH",
      "GrossRewardsETH",
      "LidoFeesETH",
      "NOFeesETH",
      "ObolShareETH",
      "OperatorsShareETH",
      "PerOperatorETH",
      "NetDepositorAPR%",
      "WithinRails",
    ];
    const rows = scenarios.map((s) => {
      const r = computeScenario(s);
      return [
        s.name,
        s.persona,
        s.depositEth,
        s.operatorCount,
        s.reserveRatioPct,
        s.lidoCoreAprPct,
        s.fees.infraPct,
        s.fees.reservationPct,
        s.fees.liquidityPct,
        s.fees.nodeOperatorPct,
        s.fees.obolShareOfNOFeesPct,
        s.fees.obolWaived,
        r.mintedStETH,
        r.grossRewards,
        r.lidoFees.total,
        r.noFees.total,
        r.noFees.obolShare,
        r.noFees.operatorsTake,
        r.noFees.perOperator,
        r.netDepositorAprPct,
        r.withinRails,
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    download("obol-vault-scenarios.csv", csv);
  };

  const exportJSON = () => {
    const payload = scenarios.map((s) => ({ ...s, computed: computeScenario(s) }));
    download("obol-vault-scenarios.json", JSON.stringify(payload, null, 2));
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      alert("Shareable link copied to clipboard");
    } catch {
      alert("Could not copy link");
    }
  };

  return (
    <div className="min-h-screen w-full" style={{ background: `radial-gradient(1200px 600px at 20% -10%, ${BRAND.panel2}, ${BRAND.bg})` }}>
      <div className="max-w-7xl mx-auto p-6 text-white">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">Obol Vault Economics — Scenario Explorer</h1>
            <p className="text-white/70 text-sm mt-1">Default DVT infra for Lido V3 • Compare single‑operator vs multi‑operator DVT and quantify reserve & fee trade‑offs.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={addScenario} className="px-3 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/30 hover:bg-emerald-400/25 text-emerald-200 flex items-center gap-2"><Plus className="w-4 h-4"/> Add scenario</button>
            <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-cyan-400/15 border border-cyan-400/30 hover:bg-cyan-400/25 text-cyan-200 flex items-center gap-2"><Download className="w-4 h-4"/> Export CSV</button>
            <button onClick={exportJSON} className="px-3 py-2 rounded-xl bg-purple-400/15 border border-purple-400/30 hover:bg-purple-400/25 text-purple-200 flex items-center gap-2"><Download className="w-4 h-4"/> Export JSON</button>
            <button onClick={copyShare} className="px-3 py-2 rounded-xl bg-amber-400/15 border border-amber-400/30 hover:bg-amber-400/25 text-amber-200 flex items-center gap-2"><LinkIcon className="w-4 h-4"/> Share link</button>
          </div>
        </div>

        {/* Global note bar */}
        <div className="rounded-2xl p-4 bg-black/30 border border-white/10 mb-6">
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <Info className="w-4 h-4 text-cyan-300" />
            <span>
              Defaults reflect Lido V3 posts (Aug 2025): RR presets (single‑op 5/6/9/14/20; multi‑op 2/3/4), fees (Infra 1%, Reservation 0%, Liquidity 6.5%), and example APR of 3%. All inputs are editable.
            </span>
          </div>
        </div>

        {/* Scenario grid */}
        <div className={`grid gap-6 ${scenarios.length === 1 ? "grid-cols-1" : scenarios.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {scenarios.map((s, i) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              index={i}
              onChange={(next) => updateScenario(i, next)}
              onRemove={scenarios.length > 1 ? () => removeScenario(i) : undefined}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-xs text-white/50">
          Estimates only. Actual parameters & limits are governed by Lido DAO rails.
        </div>
      </div>
    </div>
  );
}
