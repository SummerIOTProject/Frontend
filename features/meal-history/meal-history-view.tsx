"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Filter, History, Recycle, Search, SlidersHorizontal, Utensils } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/state-view";
import { StatusBadge } from "@/components/status-badge";
import { getMealHistory } from "@/lib/api/meals";
import type { MealStatus } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

export function MealHistoryView() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [status, setStatus] = useState<MealStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["meal-history", { search, restaurantId, status, page }], queryFn: () => getMealHistory({ search, restaurantId, status, page, pageSize: 4 }) });

  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchInput); };
  const clearFilters = () => { setSearchInput(""); setSearch(""); setRestaurantId(""); setStatus("ALL"); setPage(1); };

  return (
    <div className="page history-page">
      <header className="page-header history-heading"><span className="eyebrow"><History size={15} />MEAL HISTORY</span><h1>식사 기록</h1><p>과거 분석 결과와 백엔드가 제공한 누적 섭취 통계를 확인하세요.</p></header>

      <section className="panel filter-panel" aria-label="식사 기록 필터">
        <form className="history-search" onSubmit={submitSearch}><Search size={18} aria-hidden="true" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="메뉴명으로 검색" aria-label="메뉴명 검색" /><button className="button primary small" type="submit">검색</button></form>
        <label className="filter-select"><span><Utensils size={15} />식당</span><select value={restaurantId} onChange={(event) => { setRestaurantId(event.target.value); setPage(1); }} aria-label="식당별 필터"><option value="">전체 식당</option>{query.data?.restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>
        <label className="filter-select"><span><Filter size={15} />분석 상태</span><select value={status} onChange={(event) => { setStatus(event.target.value as MealStatus | "ALL"); setPage(1); }} aria-label="분석 상태 필터"><option value="ALL">전체 상태</option><option value="COMPLETED">분석 완료</option><option value="NEEDS_REVIEW">확인 필요</option><option value="ANALYZING">분석 중</option><option value="FAILED">분석 실패</option></select></label>
        {(search || restaurantId || status !== "ALL") && <button className="text-button" type="button" onClick={clearFilters}><SlidersHorizontal size={15} />필터 초기화</button>}
      </section>

      {query.isPending ? <LoadingState label="식사 기록을 불러오고 있습니다." /> : query.isError ? <ErrorState message="검색 조건에 맞는 기록을 가져오지 못했습니다." onRetry={() => query.refetch()} /> : <>
        <section className="history-stat-grid" aria-label="기간 집계">
          <article className="history-stat"><span className="stat-icon green"><BarChart3 size={19} /></span><div><span>평균 섭취율</span><strong>{query.data.aggregate.averageIntakeRate}<small>%</small></strong></div></article>
          <article className="history-stat"><span className="stat-icon amber"><Recycle size={19} /></span><div><span>평균 잔반율</span><strong>{query.data.aggregate.averageLeftoverRate}<small>%</small></strong></div></article>
          <article className="history-stat wide"><div><span>메뉴별 섭취율 · 다음 권장량</span><div className="mini-stat-list">{query.data.aggregate.menuStats.map((item) => <span key={item.menuId}><strong>{item.menuName}</strong><em>{item.intakeRate}%</em><small>{item.recommendedAmount}{item.unit} 권장</small></span>)}</div></div></article>
        </section>

        <div className="history-result-header"><h2>날짜별 식사 기록 <span>{query.data.total}</span></h2><span>{page} 페이지</span></div>
        {query.data.items.length === 0 ? <EmptyState title="조건에 맞는 식사 기록이 없습니다." message="검색어나 필터를 바꿔 다시 확인해 주세요." /> : <div className="history-list">{query.data.items.map((meal) => <article className="history-card" key={meal.mealId}><div className="history-date"><strong>{new Date(meal.mealDate).getDate()}</strong><span>{new Intl.DateTimeFormat("ko-KR", { month: "short", weekday: "short" }).format(new Date(meal.mealDate))}</span></div><div className="history-card-main"><div className="history-card-top"><div><strong>{meal.menus.map((menu) => menu.menuName).join(", ")}</strong><span>{meal.restaurantName} · {formatDate(meal.mealDate, true)}</span></div><div className="history-card-badges"><StatusBadge status={meal.status} />{meal.correctedByUser && <span className="corrected-badge"><CheckCircle2 size={13} />사용자 보정</span>}</div></div><div className="history-menu-results">{meal.menus.map((menu) => <span key={menu.menuId}><strong>{menu.menuName}</strong><small>섭취율 {menu.intakeRate}% · 다음 {menu.recommendedAmount}{menu.unit}</small></span>)}</div></div><div className="history-average"><span>평균 섭취율</span><strong>{meal.averageIntakeRate}%</strong><small>잔반 {meal.averageLeftoverRate}%</small></div><Link href={`/meals/${meal.mealId}`} className="detail-link" aria-label={`${formatDate(meal.mealDate)} 상세 결과 보기`}><ChevronRight size={19} /></Link></article>)}</div>}
        <nav className="pagination" aria-label="식사 기록 페이지 이동"><button type="button" className="button secondary small" disabled={page === 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} />이전</button><span>{page} / {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))}</span><button type="button" className="button secondary small" disabled={!query.data.hasNext} onClick={() => setPage((current) => current + 1)}>다음<ChevronRight size={16} /></button></nav>
      </>}
    </div>
  );
}
