"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Camera, ChevronRight, Clock3, MapPin, Recycle, Sparkles, Utensils } from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { ErrorState, LoadingState } from "@/components/state-view";
import { StatusBadge } from "@/components/status-badge";
import { getDashboard } from "@/lib/api/dashboard";
import { formatDate, formatShortDate } from "@/lib/format";

export function DashboardView() {
  const query = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  if (query.isPending) return <LoadingState label="오늘의 식사 정보를 준비하고 있습니다." />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} message="오늘의 메뉴와 최근 분석 정보를 가져오지 못했습니다." />;

  const data = query.data;
  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} />오늘의 스마트 배식</span>
          <h1>오늘도 내게 맞는 만큼,<br />기분 좋은 한 끼를 시작해요.</h1>
          <p>{formatDate(data.menuContext.date)} · {data.menuContext.restaurant.name}</p>
          <Link href="/meals/upload" className="button primary hero-button"><Camera size={20} />식사 사진 등록하기<ArrowRight size={18} /></Link>
        </div>
        <div className="hero-menu-card">
          <div className="section-heading compact"><div><span className="eyebrow muted">TODAY&apos;S MENU</span><h2>오늘의 메뉴</h2></div><span className="location"><MapPin size={14} />{data.menuContext.restaurant.location}</span></div>
          <ul className="today-menu-list">
            {data.menuContext.menus.map((menu, index) => <li key={menu.id}><span className="menu-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{menu.name}</strong><small>{menu.category}</small></div><span>{menu.standardServing}{menu.unit}</span></li>)}
          </ul>
        </div>
      </section>

      {data.activeMeal && (
        <Link href={`/meals/${data.activeMeal.mealId}`} className="active-analysis-card">
          <span className="pulse-dot" aria-hidden="true" />
          <div><strong>식사 분석이 진행 중입니다</strong><span>{data.activeMeal.restaurantName} · 완료되면 결과를 바로 확인할 수 있어요.</span></div>
          <StatusBadge status={data.activeMeal.status} />
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      )}

      <section className="metrics-grid" aria-label="최근 식사 통계">
        <MetricCard label="최근 평균 섭취율" value={data.summary.averageIntakeRate} suffix="%" hint={`최근 ${data.summary.recentMealCount}회 기준`} icon={BarChart3} />
        <MetricCard label="최근 평균 잔반율" value={data.summary.averageLeftoverRate} suffix="%" hint="백엔드 집계 결과" icon={Recycle} tone="amber" />
        <MetricCard label="최근 분석" value={data.summary.latestAnalyzedAt ? formatShortDate(data.summary.latestAnalyzedAt) : "기록 없음"} hint="마지막 완료 시점" icon={Clock3} tone="blue" />
      </section>

      <div className="dashboard-columns">
        <section className="panel recommendations-panel">
          <div className="section-heading"><div><span className="eyebrow muted">NEXT SERVING</span><h2>다음 권장 배식량</h2></div><span className="section-note">누적 섭취 데이터 기반</span></div>
          <div className="recommendation-list">
            {data.recommendations.map((item) => <article key={item.menuId} className="recommendation-row"><div className="food-icon"><Utensils size={18} /></div><div className="recommendation-main"><strong>{item.menuName}</strong><span>{item.reason}</span></div><div className="recommended-amount"><strong>{item.recommendedAmount}</strong><span>{item.unit}</span></div></article>)}
          </div>
        </section>

        <section className="panel recent-panel">
          <div className="section-heading"><div><span className="eyebrow muted">RECENT MEALS</span><h2>최근 식사 기록</h2></div><Link href="/history" className="text-link">전체 보기<ChevronRight size={16} /></Link></div>
          <div className="recent-list">
            {data.recentMeals.map((meal) => <Link href={`/meals/${meal.mealId}`} className="recent-row" key={meal.mealId}><div className="date-tile"><strong>{new Date(meal.mealDate).getDate()}</strong><span>{new Intl.DateTimeFormat("ko-KR", { month: "short" }).format(new Date(meal.mealDate))}</span></div><div className="recent-main"><strong>{meal.menus.map((menu) => menu.menuName).join(", ")}</strong><span>{meal.restaurantName}</span></div><div className="recent-rate"><strong>{meal.averageIntakeRate}%</strong><span>섭취율</span></div><ChevronRight size={18} /></Link>)}
          </div>
        </section>
      </div>
    </div>
  );
}
