# SafeMeal — Vanilla JS 멀티페이지 프론트엔드

`HTML + Vanilla JavaScript + Tailwind CSS + Vite`로 만든 로컬 실행용 스마트 배식 웹 프론트엔드입니다. React, Next.js, SPA 라우터, 별도 상태 관리 라이브러리와 외부 호스팅 설정을 사용하지 않습니다.

## 실행

```bash
npm install
copy .env.development.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 개발 모드에서는 `.env.local` 설정에 따라 로컬 백엔드 `http://localhost:8000`을 호출합니다.

로컬 백엔드는 별도 터미널에서 다음 순서로 실행합니다.

```powershell
cd backend/Backend-dev1
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DEBUG = "true"
alembic upgrade head
uvicorn app.main:app --host localhost --port 8000
```

로컬 백엔드의 `.env`는 SQLite, `VISION_ANALYSIS_MODE=MOCK`, `STORAGE_BACKEND=LOCAL`, `CORS_ORIGINS=["http://localhost:3000"]`을 포함한 개발 설정을 사용해야 합니다. 운영 비밀키를 로컬 파일에 복사하지 않습니다.

```bash
npm test
npm run build
npm run preview
```

## 페이지

- `index.html`: 로그인 아이디와 비밀번호를 사용하는 로그인
- `dashboard.html`: 오늘의 급식, 권장 배식량, 최근 식사 기록
- `upload.html`: 오늘 날짜의 식사 전·후 사진 업로드와 분석 요청
- `history.html`: 최근 5일간의 점심 메뉴 및 분석 기록
- `meal.html?id={meal_record_id}`: 분석 상태, 메뉴별 섭취·영양 결과, 사용자 보정
- `admin.html`: 날짜별 운영 통계, 새 메뉴 생성과 일자별 점심 식단 통합 등록, 기존 메뉴 수정

각 HTML은 자기 페이지의 JavaScript 파일만 불러옵니다. 공통 인증·헤더·표시 함수만 `src/common.js`에서 공유합니다.

## 환경변수와 mock 모드

```dotenv
VITE_API_BASE_URL=/backend
VITE_USE_MOCK_API=false
```

- `VITE_USE_MOCK_API=true`: 백엔드 없이 `src/api.js`의 미리 작성된 응답을 사용합니다.
- `VITE_USE_MOCK_API=false`: 실제 FastAPI 서버를 호출합니다.
- 운영 환경의 `/backend/*` 요청은 `vercel.json`에 따라 `https://backend-five-kohl-41.vercel.app/*`로 전달됩니다.
- 로컬 백엔드를 직접 사용할 때만 `.env.local`의 `VITE_API_BASE_URL`을 `http://localhost:8000`으로 변경합니다.

## 무료 배포

이 프로젝트는 Vercel Hobby 배포를 기준으로 준비되어 있습니다. 개인·교육 목적의 무료 배포에 적합하며, 저장소를 Vercel에 연결하면 `vercel.json` 설정에 따라 자동으로 의존성을 설치하고 Vite 프로덕션 빌드를 배포합니다.

1. 프로젝트를 GitHub 저장소에 push합니다.
2. Vercel에서 **Add New → Project**를 선택하고 저장소를 가져옵니다.
3. Framework Preset이 `Vite`, Build Command가 `npm run build`, Output Directory가 `dist`인지 확인합니다.
4. 저장소의 `.env.production`이 다음 운영 설정을 빌드에 자동 적용합니다. Vercel에 같은 이름의 기존 환경변수가 있다면 아래 값으로 변경하거나 삭제하여 저장소 설정을 사용합니다.

```dotenv
VITE_API_BASE_URL=/backend
VITE_USE_MOCK_API=false
```

5. 배포 후 `/backend/api/v1/...`가 Vercel의 동일 출처 프록시를 통해 운영 백엔드로 전달됩니다. 브라우저가 백엔드 도메인을 직접 호출하지 않으므로 프론트 배포 주소를 백엔드 CORS 목록에 추가하지 않아도 됩니다.

별도 `mock.js`는 없습니다. 실제 요청과 mock 분기는 모두 같은 `api` 인터페이스와 DTO 어댑터를 사용하므로 페이지 코드는 실행 모드를 구분하지 않습니다.

mock 로그인 정보:

- 학생: `student01` / `Password123!`
- 관리자: `admin01` / `Password123!`

mock 로그인이 아닌 실제 모드에서는 백엔드가 발급한 Access Token과 Refresh Token을 사용합니다. 로그인 후 `/api/v1/me`를 호출해 사용자 이름과 역할을 확인하며, 인증 요청에는 Bearer Token이 자동으로 추가됩니다.

## API 연동 위치

모든 경로, 공통 응답 처리, JWT 갱신, DTO 변환은 `src/api.js`에 있습니다. 페이지에는 endpoint나 백엔드의 `snake_case` 응답 필드를 직접 작성하지 않습니다.

현재 화면에서 사용하는 API:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `GET /api/v1/allergens`
- `GET /api/v1/meals/today`
- `GET /api/v1/me/meal-records/recent`
- `GET /api/v1/me/meal-records/{meal_record_id}`
- `GET /api/v1/me/rfid-cards`
- `POST /api/v1/device/meal-records`
- `POST /api/v1/me/meal-records/{meal_record_id}/images/before`
- `POST /api/v1/me/meal-records/{meal_record_id}/images/after`
- `POST /api/v1/me/meal-records/{meal_record_id}/analyze`
- `PATCH /api/v1/me/meal-item-records/{meal_item_record_id}/consumed-ratio`
- `GET /api/v1/me/recommendations`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/leftover-summary`
- `GET /api/v1/menus`
- `GET /api/v1/menus/{menu_id}`
- `POST /api/v1/admin/menus`
- `PATCH /api/v1/admin/menus/{menu_id}`
- `POST /api/v1/admin/meals`

공통 성공 응답의 `data`만 화면용 데이터로 반환하며, 공통 오류 응답의 `message`, `error.code`, `error.detail`은 `ApiError`에 보존합니다.

## 사용자 사진 업로드 계약

식사 기록은 RFID 장치가 먼저 생성합니다. 웹은 로그인 사용자의 최근 기록에서 오늘 식단과 일치하는 기록을 찾아 사용자 JWT 기반 이미지·분석 API를 호출합니다. 장치 키는 브라우저에 저장하거나 전송하지 않습니다.

1. RFID 장치: `POST /api/v1/device/meal-records` — 식사 기록 생성
2. 웹: `GET /api/v1/me/meal-records/recent?days=1` — 오늘 기록 확인
3. 웹: `POST /api/v1/me/meal-records/{id}/images/before` — multipart 필드 `file`
4. 웹: `POST /api/v1/me/meal-records/{id}/images/after` — multipart 필드 `file`
5. 웹: `POST /api/v1/me/meal-records/{id}/analyze` — 요청 body 없음
6. 웹: `GET /api/v1/me/meal-records/{id}` — 저장된 분석 결과 조회

업로드일은 사용자가 변경하지 못하며 Asia/Seoul 기준 오늘 급식 날짜로 고정합니다. 실제 모드에서 DB 및 이미지 저장은 백엔드가 담당합니다.

식사 전·후 사진은 분석 과정에서만 사용하며 개별 식사 기록 화면에는 표시하지 않습니다. Mock은 분석 완료 시 이미지 메타데이터를 제거합니다. 실제 파일 삭제 시점과 보존 정책은 백엔드가 담당합니다.

## 권장 배식량 기준

Mock 권장량은 예시 사용자의 나잇대·키·몸무게와 점심 권장 영양소를 백엔드가 반영했다고 가정한 미리 작성된 응답입니다. 섭취 기록이나 선호도를 이용해 추천량을 변경하지 않으며 프론트엔드에서 권장량을 계산하지 않습니다.

## 개발자 콘솔 로그

API 요청·응답, 페이지 초기화, 업로드 단계, 조회, 보정, 메뉴·식단 등록과 수정 흐름을 브라우저 콘솔에 표시합니다. 비밀번호와 Access/Refresh Token 값은 출력하지 않으며 테스트 모드에서는 로그를 숨깁니다.

## 파일 구조

```text
index.html
dashboard.html
upload.html
history.html
meal.html
admin.html
src/
  api.js
  common.js
  styles.css
  pages/
    login.js
    dashboard.js
    upload.js
    history.js
    meal.js
    admin.js
tests/
  app.test.js
vite.config.js
```

프론트엔드는 RFID 판독, Arduino 제어, LLM 직접 호출, 이미지 분석, 섭취량 계산, 배식량 추천 계산을 수행하지 않습니다. 실제 데이터 저장·분석은 백엔드 API에 요청하고 화면에는 백엔드 응답 또는 미리 작성된 mock 응답만 표시합니다.
