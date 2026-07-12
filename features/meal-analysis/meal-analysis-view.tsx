"use client";

/* eslint-disable @next/next/no-img-element */

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock3, ImageIcon, Info, LoaderCircle, RefreshCw, Sparkles, UploadCloud } from "lucide-react";
import Link from "next/link";
import { ErrorState, LoadingState } from "@/components/state-view";
import { StatusBadge } from "@/components/status-badge";
import { getMealAnalysis } from "@/lib/api/meals";
import type { MealStatus } from "@/lib/api/types";
import { formatDate, isTerminalStatus } from "@/lib/format";
import { CorrectionForm } from "./correction-form";

export function getAnalysisPollingInterval(status?: MealStatus): number | false {
  return status && !isTerminalStatus(status) ? 2_000 : false;
}

const steps: Array<{ status: MealStatus; label: string }> = [
  { status: "UPLOAD_COMPLETED", label: "사진 업로드" },
  { status: "QUEUED", label: "분석 대기" },
  { status: "ANALYZING", label: "AI 분석" },
  { status: "COMPLETED", label: "결과 준비" },
];

const stageIndex: Partial<Record<MealStatus, number>> = { UPLOADING: 0, UPLOAD_COMPLETED: 0, QUEUED: 1, ANALYZING: 2, COMPLETED: 3, NEEDS_REVIEW: 3 };

export function MealAnalysisView({ mealId }: { mealId: string }) {
  const query = useQuery({
    queryKey: ["meal-analysis", mealId],
    queryFn: () => getMealAnalysis(mealId),
    refetchInterval: (result) => getAnalysisPollingInterval(result.state.data?.status),
  });

  if (query.isPending) return <LoadingState label="식사 분석 상태를 확인하고 있습니다." />;
  if (query.isError) return <ErrorState title="분석 정보를 찾을 수 없습니다." message="주소가 올바른지 확인하거나 잠시 후 다시 시도해 주세요." onRetry={() => query.refetch()} />;

  const analysis = query.data;
  const currentStage = stageIndex[analysis.status] ?? 0;
  const inProgress = !isTerminalStatus(analysis.status);

  return (
    <div className="page analysis-page">
      <Link href="/dashboard" className="back-link"><ArrowLeft size={17} />대시보드로 돌아가기</Link>
      <header className="analysis-header"><div><span className="eyebrow"><Sparkles size={15} />MEAL ANALYSIS</span><h1>{inProgress ? "식사 사진을 분석하고 있습니다." : analysis.status === "FAILED" ? "분석을 완료하지 못했습니다." : "식사 분석 결과"}</h1><p>{formatDate(analysis.mealDate, true)} · {analysis.restaurantName}</p></div><StatusBadge status={analysis.status} /></header>

      {inProgress && <section className="panel analysis-progress-card" aria-live="polite"><div className="analysis-orbit"><LoaderCircle className="spin" size={32} /><span><ImageIcon size={18} /></span></div><h2>{analysis.status === "UPLOADING" ? "사진을 업로드하고 있습니다." : analysis.status === "UPLOAD_COMPLETED" ? "업로드가 완료되었습니다." : analysis.status === "QUEUED" ? "분석 순서를 기다리고 있습니다." : "메뉴별 섭취량을 확인하고 있습니다."}</h2><p>페이지를 닫아도 분석은 계속됩니다. 완료될 때까지 상태를 자동으로 확인합니다.</p><ol className="analysis-steps">{steps.map((step, index) => <li key={step.status} className={index < currentStage ? "done" : index === currentStage ? "current" : ""}><span>{index < currentStage ? <Check size={15} /> : index + 1}</span><strong>{step.label}</strong></li>)}</ol></section>}

      {analysis.status === "FAILED" && <section className="panel failure-card" role="alert"><span className="failure-icon"><AlertTriangle size={28} /></span><h2>사진 분석에 실패했습니다.</h2><p>{analysis.errorMessage ?? "사진을 확인한 뒤 다시 등록해 주세요."}</p><div><button type="button" className="button secondary" onClick={() => query.refetch()}><RefreshCw size={17} />상태 다시 확인</button><Link href="/meals/upload" className="button primary"><UploadCloud size={17} />사진 다시 등록</Link></div></section>}

      {(analysis.status === "COMPLETED" || analysis.status === "NEEDS_REVIEW") && <>
        <div className="ai-notice"><Info size={18} /><span>AI가 식사 전·후 사진을 바탕으로 추정한 결과이며 실제 중량과 차이가 있을 수 있습니다.</span></div>
        <section className="photo-comparison" aria-label="식사 전후 사진 비교"><figure><div>{analysis.beforeImageUrl ? <img src={analysis.beforeImageUrl} alt="분석에 사용된 식사 전 사진" /> : <ImageIcon size={32} />}</div><figcaption><span>BEFORE</span><strong>식사 전</strong></figcaption></figure><figure><div>{analysis.afterImageUrl ? <img src={analysis.afterImageUrl} alt="분석에 사용된 식사 후 사진" /> : <ImageIcon size={32} />}</div><figcaption><span>AFTER</span><strong>식사 후</strong></figcaption></figure></section>

        <section className="results-section"><div className="section-heading"><div><span className="eyebrow muted">MENU RESULTS</span><h2>메뉴별 분석 결과</h2></div><span className="section-note">백엔드 분석값</span></div><div className="result-list">{analysis.menuResults.map((result) => <article className="result-card" key={result.menuId}><div className="result-title"><div><strong>{result.menuName}</strong><span>기준 배식량 {result.standardServing}{result.unit}</span></div><div className="result-badges">{result.confidence < 70 && <span className="review-badge"><AlertTriangle size={13} />확인 필요</span>}{result.correctedByUser && <span className="corrected-badge"><CheckCircle2 size={13} />사용자 보정</span>}</div></div><div className="result-metrics"><div className="intake-rate"><span>추정 섭취율</span><strong>{result.intakeRate}<small>%</small></strong><div className="rate-track"><span style={{ width: `${result.intakeRate}%` }} /></div></div><dl><div><dt>추정 섭취량</dt><dd>{result.consumedAmount}{result.unit}</dd></div><div><dt>추정 잔반량</dt><dd>{result.leftoverAmount}{result.unit}</dd></div><div><dt>분석 신뢰도</dt><dd>{result.confidence}%</dd></div></dl></div><div className="next-serving"><div><Clock3 size={17} /><span>다음 권장 배식량</span></div><strong>{result.recommendedAmount}<small>{result.unit}</small></strong><p>{result.recommendationReason}</p></div></article>)}</div></section>
        <CorrectionForm analysis={analysis} />
      </>}
    </div>
  );
}
