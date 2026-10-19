# AI Simu Desk

작은 3D 사무실에서 동료에게 업무를 맡기고 결과를 모으는 로컬 제품입니다. **로그인과 DB 저장은 실제 기능이며, 답변은 규칙 기반 Fake AI가 만듭니다.** 외부 모델·검색 API·API 키를 사용하지 않습니다.

## 로컬 제품 실행

검증 환경은 macOS와 Node.js 22.22.2입니다. 프로젝트 루트에서 실행합니다.

```sh
npm ci
npm run setup:local
npm run build:product
npm start
```

[나의 스튜디오 열기](http://127.0.0.1:4180/). `계정 만들기`에서 이름·이메일 형식의 식별자·12자 이상 비밀번호를 입력합니다. 이메일 확인 메일은 발송하지 않습니다.

- Better Auth 이메일/비밀번호 로그인·로그아웃, 서버 DB 세션, 사용자별 개인 작업 공간.
- Drizzle + 파일 영속 PGlite(Postgres WASM)에 업무·실행·승인·이벤트·답변 저장.
- 나라(기획)·준(개발)의 역할과 입력 유형에 따른 Fake AI 답변, 단계 표시와 스트리밍.
- 승인·거절·취소·장애 재현·재시도와 최근 실행 20개 조회. 새로고침·재로그인·서버 재시작 후 기록 복원.
- 실제 GLB 사무실과 나라·준의 각 작업 공간, 독립 휴식/타이핑 동작. 동료 클릭·키보드 선택, 함께 보기·동료별 초점을 지원합니다. 선택이나 과거 기록을 바꿔도 실행 담당자는 유지됩니다.

`시뮬레이션 설정 → 일시적 장애 재현`으로 실패·재시도를 살펴볼 수 있습니다. 예시 요청은 `첫 화면의 핵심 메시지와 구성을 제안해 줘`, `로그인 API와 DB 연결 설계를 검토해 줘`입니다. 답변은 키워드·유형별 템플릿으로 생성되며 실제 언어 모델의 추론이나 검색 결과가 아닙니다.

설정은 서버 전용 `.env.local`, 데이터는 `.data/studio`에 저장합니다. 설정 생성 명령은 기존 파일을 보존합니다. 비밀값·DB·백업을 공유하거나 정적 서버로 제공하지 마세요. 제품 서버는 `product/dist`의 공개 파일만 제공합니다. 개발 중에는 `npm run dev:product`를 사용할 수 있으며 프런트엔드 변경 후 `npm run build:product`를 다시 실행합니다.

이 버전은 loopback HTTP·단일 서버 프로세스용입니다. 공개 배포, 운영 PostgreSQL, OAuth·이메일 인증·비밀번호 재설정 메일·MFA, 공동 편집, 실제 LLM 연결은 포함하지 않습니다.

## 백업과 복구

먼저 제품 서버를 `Ctrl+C`로 정상 종료합니다. 다른 프로세스가 DB를 사용 중이면 백업 명령이 거절됩니다.

```sh
npm run db:backup
# 출력된 실제 백업 파일 경로를 사용하고, 새 대상 폴더를 지정합니다.
npm run db:restore -- .data/backups/실제-파일명.tar.gz .data/restored-studio
```

기존 데이터 폴더를 덮어쓰지 않습니다. 복구 DB를 사용하려면 서버가 꺼진 상태에서 `.env.local`의 `STUDIO_DATA_DIR`을 새 경로로 변경하고 `npm start`로 실행합니다. 기존 `.env.local`의 인증 비밀값도 보관해야 기존 세션을 이어갈 수 있습니다. 백업에는 계정·세션·업무 데이터가 포함되므로 비공개로 보관합니다.

## 기존 시각 데모

2.5D와 3D 파일럿은 이전 모의 업무 흐름을 보존합니다. 이 두 화면의 기록은 탭 메모리에만 있으며 새로고침하면 초기화됩니다.

```sh
npm run serve:demos
```

- [2.5D 단일 파일 데모](http://127.0.0.1:4173/demo/preview.html): 오피스 이미지와 접지·크기·방향을 보정한 투명 직원 아틀라스.
- [실제 3D 파일럿](http://127.0.0.1:4173/pilot-3d/): 자체 제작 GLB, 같은 카메라·광원, 회전·확대·화질·오류 대체 화면.

서버는 `demo/`, `pilot-3d/`, `docs/`만 제공합니다. 프로젝트 루트를 일반 정적 서버로 제공하지 않습니다. 소스 수정 후 `npm run build:preview`, `npm run build:3d`로 각각 갱신합니다. 모델은 계층형 노드 애니메이션이며 인체 스키닝·보행 리그가 아닙니다. 에셋 출처·치수는 각 `assets/manifest.json`에 기록했습니다.

## 검증

```sh
npm run check
npm run check:product
npm run typecheck
npm run check:boundaries
npm test
npm run build:product
```

자동 검사 30개에 인증·계정 간 인가·중복 요청·영속 DB·백업 복구·Fake AI 스트리밍·실패·취소·타임아웃과 기존 시각 데모 회귀 검사가 포함됩니다. [로그인·DB 검증](docs/auth-db-fake-ai-qa.md)과 [두 동료 3D 검증](docs/team-3d-qa.md)를 참고하세요.

## 문서

- [나라·준 3D 확장 계획](dev-plan/implement_20261019_185641.md) · [검증 결과](docs/team-3d-qa.md)

- [로그인·DB·Fake AI 실행 계획](dev-plan/implement_20261019_180900.md)
- [로그인·DB·Fake AI 검증 결과](docs/auth-db-fake-ai-qa.md)
- [장기 제품 개발 계획](dev-plan/implement_20261019_164437.md)
- [전문가 검토](docs/expert-review.md)
- [1차 데모 명세](docs/demo-spec.md)
- [시각 보정 결과](docs/visual-calibration-review.md)
- [3D 파일럿 계획](dev-plan/implement_20261019_173618.md) · [검증 결과](docs/3d-pilot-qa.md)
- [통합 데모 프롬프트](prompts/demo-master-prompt.md)
