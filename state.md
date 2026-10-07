# 지하철 게임 진행 상태

갱신: 2026-10-06

## Solarena 바이럴성 개선

- 결과에서 실제 탑승 수·점유율(또는 endless peak)·최고 콤보를 묶어 초대 URL을 공유한다. 기존 `COPY SCORE TEXT` 버튼은 보존했다.
- 초대받은 플레이어는 타이틀에서 친구 기록을 확인하고 동일 모드·노선을 `TAKE THIS COMMUTE`로 시작한다. 게임 난수는 고정하지 않았으므로 동일한 승객 배치/물리 리플레이가 아니라 기록 목표 도전이다.
- Poki `shareableURL`/일반 query fallback, Web Share/클립보드 fallback을 연결했다.
- 확인: `npm run build` 통과(TypeScript + Vite, dist/index.html 345.21 kB / gzip 106.79 kB). `git diff --check` 통과.
- 실제 브라우저에서 Gangnam 180%/17 riders challenge 진입, `TAKE THIS COMMUTE` 누른 뒤 Gangnam 결과 화면까지 확인. Web Share 호출은 브라우저 함수 대체(mock)로 payload 제목·기록·URL 및 성공 문구를 확인했다.
- 제한: 조작 없는 브라우저 진입에서 첫 라운드는 0 riders/0%로 종료했다. 의도한 실제 sling 플레이 기록/자연 라운드·모바일 공유/Poki Inspector/SDK는 미검증. 콘솔은 기존 `frame-ancestors` meta 경고와 사용자 제스처 전 AudioContext 경고가 있었다.
- 코드: `src/game/share.ts`, `src/App.tsx`, `src/components/Screens.tsx`.
- 다음: 실제 터치/마우스 조작으로 승객 투척 후 정상 결과 링크를 확인한다.


## 첫 출근 튜토리얼 타이머 수정 (2026-10-06)

- 첫 Sindorim campaign에서 첫 유효 passenger launch 전에는 aim timer가 흐르지 않도록 했다. 잘못된 짧은 포인터 입력은 코치를 닫지 않고, 성공 launch 때 자동으로 종료한다. SKIP은 시계를 재개한다.
- sim.ts의 firstRunIntro 옵션은 Sindorim 첫 campaign에만 활성화된다. 다른 노선/무한 모드의 시간 규칙은 변경하지 않았다.
- 검증: TypeScript/Vite 빌드 통과(345.47 kB / gzip 106.86 kB), diff 검사 통과. 격리 브라우저에서 코치 시작 시 6.4초가 6.5초 대기 뒤에도 유지됨을 확인했다. 실제 drag로 승객 1명을 발사하자 코치가 사라지고 결과 화면까지 진행됐다.
- 로컬 browser에는 meta-CSP 경고를 제거한 뒤 남은 console error는 확인하지 않았다. 첫 페이지 로그의 기존 AudioContext autoplay 경고 2건은 남아 있으며, 모바일/실포털 오디오 검증은 필요하다.


## Poki rewarded-action affordance — 2026-10-06

- Changed the double-fare rewarded button from mint to gold and added the 🎬 marker. Build passed (345.47 kB / gzip 106.86 kB), `git diff --check` passed.
