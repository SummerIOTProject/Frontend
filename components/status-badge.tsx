import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, UploadCloud } from "lucide-react";
import type { MealStatus } from "@/lib/api/types";
import { statusLabels } from "@/lib/format";

export function StatusBadge({ status }: { status: MealStatus }) {
  const Icon = status === "FAILED" ? AlertCircle : status === "COMPLETED" ? CheckCircle2 : status === "UPLOADING" || status === "UPLOAD_COMPLETED" ? UploadCloud : status === "ANALYZING" ? LoaderCircle : Clock3;
  return <span className={`status-badge status-${status.toLowerCase()}`}><Icon size={14} aria-hidden="true" />{statusLabels[status]}</span>;
}
