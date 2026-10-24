# 2026-10-24 main 로컬 배포 준비

상태: 커밋 전 영향 범위 검증·새 설치/빌드/격리 서버 smoke 완료. 이 문서를 포함하는 main 커밋으로 전달한다. 전체 회귀 미완료는 아래에 별도 명시한다.

## 범위

- 기준 main `2ba6276`에서 5명 개성 모듈, 연속 손 피부, v14 손 전원 확대, 정지 첫 프레임 초기화와 자동 재생·반복 재생을 함께 인계한다.
- 기본 제품과 공개 개인별 데모 모두 전원 v14 opt-in. 기존 v11/v12/v13 비교 및 접촉 fallback 보존.
- 의존성/lockfile/DB 스키마/외부 서비스 설정은 변경하지 않았다.
- 실행 산출물·개인 DB·백업·쿠키·비밀 설정·node_modules·`.data/runtime`은 커밋하지 않는다.

## 문서 정본

- 최신 운영 인계: [HANDOFF](../HANDOFF.md).
- 최신 시각/접촉 검수: [5명 손 v14](team-hand-v14-qa.md).
- 개성 설계/계약: [제안](character-personality-proposal.md), [계약](personality-contract.md), [당시 QA](character-personality-qa.md).
- 이전 소라 한정 검수는 당시 역사 기록이다. 현재 전원 적용/사용자 품질 수용 범위는 위 두 문서가 우선한다.

## 이번 검증

| 검사 | 결과 |
|---|---|
| 원격 main 확인 | origin fetch 후 HEAD와 origin/main 동일 (`2ba6276`), 발산0/0 |
| 관련 회귀 커밋 전 재실행 | 81/81 통과, 실패/skip0, 약71.6초 |
| 서버 회귀 | 79/79 통과, 실패/skip0, 약77.1초 |
| 커밋 전 전체 `npm test` | 미완료 — 중단. 기존 장시간 회귀 약114분; 이번 성공 집계에서 제외 |
| 타입·경계·기본/제품 구문·diff | 모두 통과 |
| 새 소스 내보내기·잠금 의존성·전체 `build:product` | 통과 — 원본 node_modules/.data/DB/설정 없이 격리 경로에서 설치·빌드 |
| 새 release의 격리 DB/HTTP smoke | 통과 — PGlite/Fake AI, 공개8경로/버전 JS 200, 비공개4경로404, no-cache |
| 민감/생성 파일·staged diff 확인 | 명시적 경로 staging·고신뢰 비밀 패턴 검사·생성/DB/설정 제외 확인 |

로컬 로그 경로는 `.data/handoff-20261024/`. 전체 `npm test`는 관측52개 통과 후 장시간 회귀에서 중단(exit130)했으며 전체 성공으로 집계하지 않는다. 관련81개와 서버79개는 별도 명령의 완료 결과다. Git에 포함한 [기계 판독 검증 요약](../product/evidence/local-release-20261024/validation.json)에 최종 수치·코드 해시·실제 번들 일치를 보존한다.

## 다음 설치/교체 시 주의

Node22 → `npm ci` → `npm run setup:local` → `npm run build:prepare` → 기존 서버 정상 종료/비공개 DB 백업 → 해당 기기 release publish → `npm start`. 자세한 명령은 HANDOFF를 따른다. Git 소스만으로는 생성된 JS/GLB가 배포되지 않는다. 기존 DB/`.env.local` 보존 및 전원 탭 새로고침·새 공동 장면 송신이 필요하다.


## 새 로컬 환경에서 확인한 사항

- Git 대상 소스652파일을 새 임시 경로로 내보냈다. 기존 node_modules, .data, .env.local, dist, private DB를 복사하지 않았다. 기존 product/evidence는 빌드 입력이 아니므로 설치 검수 복사에서 제외했다.
- 첫 offline npm ci는 xtend4.0.2 캐시가 없어 ENOTCACHED로 실패했다. 원인을 숨기지 않고 공식 레지스트리에서 lockfile 버전만 설치(설치 스크립트 비실행)한 뒤 전체 빌드와 서버 smoke를 통과했다. 새 기기의 첫 설치에는 레지스트리 접근이 필요할 수 있다.
- 새 빌드 릴리스 `1792805946836-a2325f47-5d22-471f-a1df-b9fde0796edb`의 기본 제품 JS·개인별 데모 JS·공간v9 GLB SHA-256이 앞서 실제 시각 검수한 실행본과 각각 일치했다. GLB8,768,140bytes/105클립 확인.
- 새 임시 DB/임의 loopback 포트에서 컴파일 서버를 시작하고 검사 후 SIGTERM으로 정상 종료했다. 사용자4180 서버와 실제 DB/설정을 건드리지 않았다. setup 재실행의 .env.local 보존과0600 권한 확인.
- source hash가 바뀐 코드 변경은 없다. 그 뒤 검증 결과를 문서/JSON에 기록했다. 다음 로컬 배포는 새 기기에서 다시 빌드해야 하며 여기에 적힌 release ID를 복사해 사용하는 방식이 아니다.
