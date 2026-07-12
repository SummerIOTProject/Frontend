# 한끼로그 — 스마트 배식 사용자 웹

식사 전·후 식판 사진을 백엔드로 전송하고, 분석 진행 상태·메뉴별 섭취 결과·다음 권장 배식량·과거 식사 기록을 제공하는 사용자용 웹 프론트엔드입니다.

이 저장소는 사용자 웹 UI만 포함합니다. 이미지 분석, 섭취량 계산, 배식량 추천, 데이터 저장, LLM 호출은 모두 외부 백엔드의 책임입니다. Arduino, RFID, 키오스크, 장치 제어 및 관리자 기능은 포함하지 않습니다.

## 기술 스택

- Next.js App Router 호환 구조(vinext 런타임), React, TypeScript
- Tailwind CSS 4 및 공통 CSS 디자인 시스템
- TanStack Query
- React Hook Form, Zod
- Vitest, Testing Library

## 실행 방법

Node.js 22.13 이상이 필요합니다.

```bash
npm install
copy .env.example .env.local
npm run dev
```

기본 개발 주소는 `http://localhost:3000`입니다. 첫 화면은 `/dashboard`로 이동합니다.

검증 명령:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 환경변수

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_USE_MOCK_API=true
```

- `NEXT_PUBLIC_API_BASE_URL`: 실제 백엔드의 base URL입니다.
- `NEXT_PUBLIC_USE_MOCK_API=true`: 네트워크 요청 없이 `mocks/`의 고정 응답을 사용합니다.
- `NEXT_PUBLIC_USE_MOCK_API=false`: 실제 백엔드 API를 호출합니다.

환경변수를 바꾸면 개발 서버를 다시 시작해야 합니다. Mock 모드는 미리 작성된 응답과 상태 전환만 제공하며 LLM 분석이나 추천 알고리즘을 구현하지 않습니다.

## 주요 경로

- `/dashboard`: 오늘의 메뉴, 최근 통계, 권장 배식량, 최근 기록, 진행 중 분석
- `/meals/upload`: 전·후 사진 검증, 미리보기, multipart 업로드, 진행률 및 취소
- `/meals/[mealId]`: 분석 상태 polling, 성공/실패 결과, 사용자 보정
- `/history`: 메뉴 검색, 식당/상태 필터, 백엔드 집계, 페이지네이션

## API 연동 위치

컴포넌트에는 base URL이나 endpoint가 들어 있지 않습니다.

- `lib/api/endpoints.ts`: 변경 가능한 모든 endpoint
- `lib/api/client.ts`: 공통 fetch, 오류 처리, XHR 업로드 진행률
- `lib/api/types.ts`: 요청·응답 타입 경계
- `lib/api/menus.ts`: 오늘의 메뉴
- `lib/api/dashboard.ts`: 대시보드
- `lib/api/meals.ts`: 업로드, 상세, 분석, 보정, 기록
- `lib/api/recommendations.ts`: 권장 배식량
- `mocks/server.ts`: 실제 API 함수와 같은 인터페이스의 Mock 어댑터
- `mocks/data.ts`: 고정 Mock 응답

백엔드 경로나 응답 필드가 확정되면 `endpoints.ts`, `types.ts`, 각 API 어댑터만 수정합니다. UI 컴포넌트는 백엔드 응답을 표시하며 섭취량·잔반량·권장량을 재계산하지 않습니다.

## 예상 API

| Method | Endpoint | 용도 |
|---|---|---|
| GET | `/menus/today` | 오늘의 메뉴 |
| GET | `/dashboard` | 대시보드 집계 |
| POST | `/meals` | `multipart/form-data` 식사 사진 업로드 |
| GET | `/meals/{mealId}` | 식사 기본 정보 |
| GET | `/meals/{mealId}/analysis` | 분석 상태 및 결과 |
| PATCH | `/meals/{mealId}/analysis` | 사용자 보정 |
| GET | `/meals/history` | 검색·필터·페이지 기반 기록 |
| GET | `/recommendations` | 다음 권장 배식량 |

`POST /meals`의 FormData 필드는 `userId`, `restaurantId`, `mealDate`, 반복 가능한 `menuIds`, `beforeImage`, `afterImage`입니다. 인증 방식과 오류 응답 envelope는 백엔드 명세 확정 후 `lib/api/client.ts`에서 일괄 적용합니다.
