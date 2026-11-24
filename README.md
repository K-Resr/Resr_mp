# Resr mp

YouTube 검색, 채널 탐색(영상/재생목록/발표곡), 실시간 통합 인기차트, 로컬 오디오 자르기 가져오기, 그리고 모바일 PWA 백그라운드 재생을 지원하는 풀스택 뮤직 웹 앱입니다.

## 요구 사항

- **Node.js `>= 22.0.0`** (`node server.ts` 네이티브 TypeScript 실행 지원)
- **npm**

## 로컬 실행

```bash
npm install
npm run dev
```

개발 서버는 `http://localhost:3000` 에서 실행됩니다.

## GitHub 업로드 주의 사항

ZIP 파일 압축을 푼 뒤 GitHub 저장소에 올릴 때 **반드시 `src/`, `public/`, `api/` 폴더 구조가 그대로 유지**되도록 업로드하세요. (`index.html`만 올라가고 `src/` 폴더가 누락되면 `Failed to resolve /src/main.tsx` 빌드 오류가 발생합니다.)

## Vercel 배포

`vercel.json`과 `/api/[...slug].ts`가 포함되어 있어 GitHub 저장소를 Vercel에 연결하면 프론트엔드와 `/api/*` 서버리스 API가 함께 자동 배포됩니다.

- Vercel Project Settings → Node.js Version: **22.x** 권장

## 일반 Node.js 서버 배포 (Render / Railway / Fly.io / VPS)

```bash
npm install
npm run build
NODE_ENV=production npm start
```

### 배포 후 공통 체크리스트

1. **Firebase Google 로그인 도메인 등록**:
   - Firebase Console → Authentication → Settings → **Authorized domains**에 실제 배포 도메인(예: `your-app.vercel.app`, `your-app.onrender.com`)을 추가해야 Google 계정이 정상 작동합니다.
2. **선택 환경 변수 (`.env.example` 참고)**:
   - `YOUTUBE_API_KEY`: 선택 사항 (미설정 시 서버 메타데이터 추출 방식 자동 사용)
   - `YOUTUBE_COOKIES`: 일부 클라우드 IP에서 YouTube 직접 오디오 스트림(`/api/youtube/stream`) 추출 시 봇 확인이 발생할 경우 설정하면 모바일 화면 꺼짐 백그라운드 안정성을 높일 수 있습니다.
   - `GEMINI_API_KEY`: 선택 사항 (AI 기능 사용 시)
