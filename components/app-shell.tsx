"use client";

import { History, LayoutDashboard, Leaf, Upload, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/meals/upload", label: "사진 등록", icon: Upload },
  { href: "/history", label: "식사 기록", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/dashboard" className="brand" aria-label="한끼로그 대시보드로 이동">
          <span className="brand-mark" aria-hidden="true"><Leaf size={20} strokeWidth={2.4} /></span>
          <span>
            <strong>한끼로그</strong>
            <small>SMART MEAL</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="주요 메뉴">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/history" && pathname.startsWith("/history"));
            return <Link key={href} href={href} className={active ? "nav-link active" : "nav-link"}><Icon size={18} />{label}</Link>;
          })}
        </nav>
        <button className="profile-button" type="button" aria-label="사용자 프로필">
          <UserRound size={19} /><span>사용자</span>
        </button>
      </header>
      <main className="main-content">{children}</main>
      <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href === "/history" && pathname.startsWith("/history"));
          return <Link key={href} href={href} className={active ? "mobile-nav-link active" : "mobile-nav-link"}><Icon size={20} /><span>{label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
