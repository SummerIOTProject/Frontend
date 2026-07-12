import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, suffix, hint, icon: Icon, tone = "green" }: { label: string; value: number | string; suffix?: string; hint?: string; icon: LucideIcon; tone?: "green" | "amber" | "blue" }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-icon"><Icon size={20} /></div><div><span className="metric-label">{label}</span><strong className="metric-value">{value}<small>{suffix}</small></strong>{hint && <span className="metric-hint">{hint}</span>}</div></article>;
}
