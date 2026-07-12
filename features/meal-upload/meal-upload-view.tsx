"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, CircleAlert, Info, MapPin, Send, ShieldCheck, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ErrorState, LoadingState } from "@/components/state-view";
import { getTodayMenu } from "@/lib/api/menus";
import { uploadMeal } from "@/lib/api/meals";
import { mealUploadFieldsSchema, type MealUploadFields } from "@/lib/validation/image";
import { PhotoDropzone, type PhotoSelection } from "./photo-dropzone";

const shootingTips = [
  "식판 전체가 보이도록 촬영해 주세요.",
  "식사 전·후 사진을 같은 위치와 각도에서 촬영해 주세요.",
  "음식이 다른 물체에 가리지 않도록 촬영해 주세요.",
  "음식의 위치를 바꾸지 않고 촬영해 주세요.",
];

export function MealUploadView() {
  const router = useRouter();
  const menuQuery = useQuery({ queryKey: ["today-menu"], queryFn: getTodayMenu });
  const [beforePhoto, setBeforePhoto] = useState<PhotoSelection | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<PhotoSelection | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const form = useForm<MealUploadFields>({ resolver: zodResolver(mealUploadFieldsSchema), defaultValues: { mealDate: "", restaurantId: "" } });

  useEffect(() => {
    if (menuQuery.data) {
      form.setValue("mealDate", menuQuery.data.date);
      form.setValue("restaurantId", menuQuery.data.restaurant.id);
    }
  }, [form, menuQuery.data]);

  if (menuQuery.isPending) return <LoadingState label="오늘의 메뉴를 확인하고 있습니다." />;
  if (menuQuery.isError) return <ErrorState title="오늘의 메뉴를 불러오지 못했습니다." message="사진을 등록하려면 메뉴 정보가 필요합니다." onRetry={() => menuQuery.refetch()} />;

  const menuData = menuQuery.data;
  const canSubmit = Boolean(beforePhoto && afterPhoto && !uploading);
  const onSubmit = form.handleSubmit(async (fields) => {
    if (!beforePhoto || !afterPhoto) return;
    setServerError(null);
    setProgress(0);
    setUploading(true);
    const controller = new AbortController();
    setAbortController(controller);
    try {
      const response = await uploadMeal(
        { userId: "demo-user", restaurantId: fields.restaurantId, mealDate: fields.mealDate, menuIds: menuData.menus.map((menu) => menu.id), beforeImage: beforePhoto.file, afterImage: afterPhoto.file },
        { onProgress: setProgress, signal: controller.signal },
      );
      router.push(`/meals/${response.mealId}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setServerError("업로드를 취소했습니다. 사진을 확인한 뒤 다시 요청할 수 있습니다.");
      else setServerError("사진을 전송하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    } finally {
      setUploading(false);
      setAbortController(null);
    }
  });

  return (
    <div className="page upload-page">
      <header className="page-header"><span className="eyebrow"><ShieldCheck size={15} />안전한 사진 분석</span><h1>식사 전·후 사진 등록</h1><p>같은 위치에서 촬영한 두 장의 사진을 등록하면 AI 분석을 요청합니다.</p></header>
      <form onSubmit={onSubmit} className="upload-layout">
        <div className="upload-main">
          <section className="panel meal-context-panel">
            <div className="section-heading"><div><span className="eyebrow muted">MEAL INFO</span><h2>식사 정보</h2></div></div>
            <div className="context-grid">
              <label className="form-field"><span><CalendarDays size={16} />식사 날짜</span><input type="date" {...form.register("mealDate")} max="2099-12-31" disabled={uploading} />{form.formState.errors.mealDate && <small className="field-error">{form.formState.errors.mealDate.message}</small>}</label>
              <div className="form-field"><span><MapPin size={16} />식당</span><div className="readonly-field"><strong>{menuData.restaurant.name}</strong><small>{menuData.restaurant.location}</small></div><input type="hidden" {...form.register("restaurantId")} /></div>
            </div>
            <div className="menu-summary"><span>오늘의 메뉴</span><div>{menuData.menus.map((menu) => <span className="menu-chip" key={menu.id}>{menu.name}<small>{menu.standardServing}{menu.unit}</small></span>)}</div></div>
          </section>

          <section className="panel photo-upload-panel">
            <div className="section-heading"><div><span className="eyebrow muted">PHOTOS</span><h2>사진 등록</h2></div><span className="section-note">2장 모두 필요</span></div>
            <div className="photo-grid"><PhotoDropzone label="식사 전" description="배식 직후의 식판" value={beforePhoto} onChange={setBeforePhoto} disabled={uploading} /><PhotoDropzone label="식사 후" description="식사를 마친 식판" value={afterPhoto} onChange={setAfterPhoto} disabled={uploading} /></div>
          </section>

          {uploading && <section className="upload-progress" aria-live="polite"><div><strong>사진을 안전하게 업로드하고 있습니다.</strong><span>{progress}%</span></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><button type="button" className="button ghost small" onClick={() => abortController?.abort()}><Square size={14} />업로드 취소</button></section>}
          {serverError && <div className="inline-error" role="alert"><CircleAlert size={20} /><div><strong>요청을 완료하지 못했습니다.</strong><span>{serverError}</span></div><button type="submit" className="button secondary small" disabled={!canSubmit}>재시도</button></div>}
          <div className="submit-bar"><div><strong>{beforePhoto && afterPhoto ? "분석 요청 준비가 완료되었습니다." : "식사 전·후 사진을 모두 등록해 주세요."}</strong><span>섭취량과 권장량은 백엔드 분석 결과를 그대로 표시합니다.</span></div><button type="submit" className="button primary submit-button" disabled={!canSubmit} aria-label="등록한 사진으로 분석 요청"><Send size={18} />분석 요청</button></div>
        </div>

        <aside className="upload-aside">
          <section className="tip-card"><div className="tip-icon"><Info size={21} /></div><h2>정확한 분석을 위한 촬영 안내</h2><ul>{shootingTips.map((tip) => <li key={tip}><Check size={15} />{tip}</li>)}</ul></section>
          <div className="privacy-note"><ShieldCheck size={18} /><div><strong>사진은 분석 목적으로만 전송됩니다.</strong><span>저장과 보관 정책은 연결된 백엔드 설정을 따릅니다.</span></div></div>
        </aside>
      </form>
    </div>
  );
}
