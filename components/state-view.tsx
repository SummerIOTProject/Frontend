import { AlertTriangle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";

export function LoadingState({ label = "정보를 불러오는 중입니다." }: { label?: string }) {
  return <div className="state-view" role="status"><LoaderCircle className="spin" size={28} /><strong>{label}</strong><span>잠시만 기다려 주세요.</span></div>;
}

export function ErrorState({ title = "정보를 불러오지 못했습니다.", message = "잠시 후 다시 시도해 주세요.", onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return <div className="state-view state-error" role="alert"><AlertTriangle size={28} /><strong>{title}</strong><span>{message}</span>{onRetry && <button className="button secondary small" onClick={onRetry} type="button"><RefreshCw size={16} />다시 시도</button>}</div>;
}

export function EmptyState({ title = "표시할 정보가 없습니다.", message }: { title?: string; message?: string }) {
  return <div className="state-view"><Inbox size={28} /><strong>{title}</strong>{message && <span>{message}</span>}</div>;
}
