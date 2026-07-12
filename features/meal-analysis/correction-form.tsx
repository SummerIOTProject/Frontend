"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Save } from "lucide-react";
import { useState } from "react";
import { correctMealAnalysis } from "@/lib/api/meals";
import type { IntakePreset, MealAnalysis } from "@/lib/api/types";

const presets: Array<{ value: IntakePreset; label: string }> = [
  { value: "ALMOST_NONE", label: "거의 먹지 않음" },
  { value: "HALF", label: "절반 정도 섭취" },
  { value: "MOST", label: "대부분 섭취" },
  { value: "ALL", label: "모두 섭취" },
  { value: "CUSTOM", label: "섭취율 직접 입력" },
];

export function CorrectionForm({ analysis }: { analysis: MealAnalysis }) {
  const queryClient = useQueryClient();
  const firstReviewTarget = analysis.menuResults.find((item) => item.confidence < 70 && !item.correctedByUser) ?? analysis.menuResults[0];
  const [menuId, setMenuId] = useState(firstReviewTarget?.menuId ?? "");
  const [preset, setPreset] = useState<IntakePreset>("HALF");
  const [customRate, setCustomRate] = useState("50");
  const mutation = useMutation({
    mutationFn: () => correctMealAnalysis(analysis.mealId, { menuId, preset, ...(preset === "CUSTOM" ? { intakeRate: Number(customRate) } : {}) }),
    onSuccess: (updated) => queryClient.setQueryData(["meal-analysis", analysis.mealId], updated),
  });

  if (!analysis.correctionAvailable || analysis.menuResults.length === 0) return null;
  return (
    <section className="panel correction-panel">
      <div className="section-heading"><div><span className="eyebrow muted"><Edit3 size={14} />USER CHECK</span><h2>AI 분석 결과 보정</h2></div></div>
      <p className="correction-intro">사진과 결과가 다르게 보인다면 실제 섭취 정도를 알려 주세요. 보정값은 백엔드로 전송됩니다.</p>
      <div className="correction-form">
        <label className="form-field"><span>보정할 메뉴</span><select value={menuId} onChange={(event) => setMenuId(event.target.value)}>{analysis.menuResults.map((item) => <option value={item.menuId} key={item.menuId}>{item.menuName}{item.correctedByUser ? " (보정 완료)" : ""}</option>)}</select></label>
        <fieldset><legend>실제 섭취 정도</legend><div className="preset-grid">{presets.map((item) => <label className={preset === item.value ? "preset-option selected" : "preset-option"} key={item.value}><input type="radio" name="intakePreset" value={item.value} checked={preset === item.value} onChange={() => setPreset(item.value)} /><span>{preset === item.value && <Check size={14} />}{item.label}</span></label>)}</div></fieldset>
        {preset === "CUSTOM" && <label className="form-field custom-rate"><span>섭취율 직접 입력</span><div><input type="number" min="0" max="100" value={customRate} onChange={(event) => setCustomRate(event.target.value)} aria-label="섭취율 직접 입력" /><span>%</span></div></label>}
        {mutation.isError && <p className="field-error" role="alert">보정 결과를 저장하지 못했습니다. 다시 시도해 주세요.</p>}
        {mutation.isSuccess && <p className="success-message" role="status"><Check size={16} />보정 결과를 저장했습니다.</p>}
        <button className="button primary" type="button" onClick={() => mutation.mutate()} disabled={!menuId || mutation.isPending || (preset === "CUSTOM" && (Number(customRate) < 0 || Number(customRate) > 100))}><Save size={17} />{mutation.isPending ? "저장 중" : "보정 결과 저장"}</button>
      </div>
    </section>
  );
}
