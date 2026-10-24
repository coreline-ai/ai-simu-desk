# 로컬 배포·개발 핸드오프

갱신: 2026-10-24 · 대상 브랜치: `main` · 저장소: `coreline-ai/ai-simu-desk`

## 최신 후속 — practice 장시간 검수·Git 전달

2026-10-24 사용자 승인: 남은 검수·문서·main 커밋/푸시 진행. **원격 사이트 배포 금지**, 원본4180/DB/managed release 유지. 최신 문서 `practice/STABILITY_QA.md`, 증거 `practice/evidence/stability-20261024/`.

- 최신 머리 보완과 계산 최적화 빌드: 전체537/537, 별도practice30/30, 타입/경계/check:product/동일 빌드 통과.
- 일반1배 실제7,201.421초 실행, 오류/WebGL손실/hidden/violations 없음. 시뮬레이션 약4,086.52초,96,697회 그리기. 중단 후327.002초 자연 복귀, 전원 home/소품desk/예약해제/reset0.
- 유지 JS 힙 중앙값23.47→24.50MiB,8MiB 성장 경계 이내. **초기 texture56→65로 +5 gate 실패**, 원시passed:false를 보존.15분 이후65 고정이라는 후속 관찰은 사전 gate를 대체하지 않는다. 무조건 장시간 전체 통과/누수 없음/RAM 절감으로 인계하지 않는다.
- 장시간 종료 후 일반1배 역할 업무를 다시 시작하고5명 손 카메라를 확인, 재생 후 자연 완료/반납/예약해제. 손/팁 표본 최대 약8.96e-16·reset0. Ego 검수64는 종료하고 최종1배 daily 탭만 사용자에게 남겼다.
- 실물 모바일·RSS/VRAM·온도·정상 전경FPS·전 프레임 관통 검수는 남는다. 이전 약13% CPU 표본은 별도 조건의 결과이며 이번2시간과 합산하지 않는다.
- 아래 미커밋/푸시 금지/전체 테스트 미완료 표현은 이전 단계의 기록이다. 이번에는 Git 소스 전달만 승인됐으며 웹 게시를 재개하지 않는다.

## 현재 인계 범위

공간 v9 + 5명 개성 v13 + 손 v14. 사용자가 손의 추가 사실적 조형은 중단하고 **현재 소라 손 품질로 전원 확대**하도록 승인했다. 나라·소라·준·민·레오의 개별 업무 리듬/경로·표정·시선을 보존하며 기본 제품과 개인별 데모에 적용했다. 손 자연스러움이 모두 해결되었다는 인계가 아니다.

- 기본 제품: `/` 또는 `/start`.
- 전체 업무: `/demos/activities/personal/?demo=roles`.
- 준 마우스: `/demos/activities/personal/?demo=role&actor=jun&variant=1`.
- 이전 손 비교: `?hands=13`; 이전 개인화/활동 비교: `?version=13`, `?version=12`, `?version=11`.
- 기본 데모는 새로고침 후 버튼 없이 자동 하루를 재생한다. 수동 정지와 실행 중 OS 동작 줄이기 변경을 보존한다. `play=0`은 시연 명령을 보내지 않는 링크이며 별도의 전체 시간 정지 옵션은 아니다.

## 품질 유지 리소스 최적화

2026-10-24 후속: 숨긴 legacy 손의 중복 계산, 반복 노드 검색/진단/detail 재지정을 줄였다. 화면 밖에서는 **그리기만 생략하고 시뮬레이션·공동 송신은 유지**한다. FPS/DPR/모델/그림자/손 접촉 알고리즘과 배속은 낮추거나 바꾸지 않았다. 컵의 기존 원래 손 메시 표시 복원을 매 스텝 다시 숨기는 계약을 보존해야 한다.

167개 수치 표본과 WebGL 13개 장면 해시 동일. CPU 단독 워크로드 3회 중앙값은 대기 13.10%, 역할 업무 21.67% 감소했으며 전체 앱 CPU 절감률은 아니다. 상세 검증/측정 한계/재현은 [리소스 최적화 검수](docs/resource-efficiency-20261024.md)를 따른다. 관련 회귀 43개와 정적 검사도 통과했다. 자동화 브라우저 RAF 약 2Hz 제한으로 정상 전경 FPS·전체 CPU 절감률은 미확정이다. 이번 결과를 기존 장시간/실물 기기 결과로 확대 해석하지 않는다.

이 기기의 로컬 적용 release는 `1792820338580-e8f0935f-55f1-4ff0-b3f9-cbdc5188f631`이며 정상 종료·비공개 DB 백업·publish·재시작과 4180 health/제공 JS 해시 확인을 완료했다. 기존 탭을 새로고침한다. 이 ID는 다른 기기의 배포 명령에 복사하지 않는다. 외부 호스팅 배포는 하지 않았다.

## 후속 Ego Lite 재검수

2026-10-24: [실제 브라우저 CPU·메모리·접촉 재검수](docs/ego-resource-recheck-20261024.md). 35개 시각/접촉 쌍 동일. 같은60스텝·총16회 WebGL 그리기에서 역할 업무 CPU 시간 중앙값 약16.45% 감소(3회 모두 감소), 대기는 결과 엇갈림. 유지 JS 힙 약32MiB로 유사하며 RSS 증가 표본도 있어 RAM 절감 판정은 하지 않는다. 자동 재생의 낮고 불균등한 RAF 때문에 일반 전경 CPU%/FPS 개선 보장은 하지 않는다. Google Chrome 복구 완료로 인계하지 않으며 사용자 선택으로 Ego Lite에서 검사했다. 제품 코드와 실행 release는 변경하지 않았다.

## 핵심 파일

| 경로 | 역할 |
|---|---|
| `pilot-3d/character-personalities/<id>/` | 캐릭터별 profile / 순수 sample / 책상 소품 |
| `pilot-3d/character-personalities/director.mjs` | 개성 합성·소품 소유권 양보·시작 분산 |
| `pilot-3d/hand-v14/` | 관절/FK·피부·펜 캘리브레이션·키/마우스 어댑터 |
| `pilot-3d/activities/{hand-grips,desk-actions,team-runtime}.mjs` | 손·도구 연결과 최종 접촉 우선권 |
| `pilot-3d/personal-office/{app,replay}.mjs` | 자동 재생·포즈/버전 비교·정확한 시연 반복 |
| `pilot-3d/sample/{runtime,quality-view}.mjs` | 경량 표시 조회·노드 캐시·화면 밖 render 생략과 해제 |
| `product/tests/resource-quality.test.mjs` | 숨긴 손 계산 생략·표시 복원·detail/소유권 전환 동등성 |
| `scripts/qa/resource-*.mjs`, `scripts/qa/build-resource-fixture.mjs` | CPU/수치/격리 화면 재현 도구 |
| `product/evidence/resource-efficiency-20261024/` | 품질 해시·성능 원시 표본·실제 화면 증거 |
| `product/src/app.mjs` | 기본 제품에서 5명 opt-in |
| `product/tests/hand-v14{,-team}.test.mjs` | 전원 초기화·15개 업무·후처리 접촉·공유/해제 |
| `docs/team-hand-v14-qa.md` | 실제 화면 목록·오차 기준·검수 한계 |
| `docs/local-release-20261024.md` | 이번 커밋 전 검증·다음 배포 체크리스트 |

## 변경하면 안 되는 계약

1. 실제 업무/DB/네트워크 시간과 시각 배속·정밀 반복 시간을 분리한다.
2. 펜은 나라·소라·민만 삼점 접촉을 사용한다. 준의 없는 펜이나 레오의 페이지를 펜으로 처리하지 않는다.
3. 컵·페이지·안경·전달·공동 활동의 소유 접촉은 **기존 v13 그립으로 명시적 전환**한다. 이 경로까지 새 v14 피부로 대체한 것이 아니다. 단순 주먹형 외형도 남아 있다.
4. 개별 motion은 의도를 출력한다. 최종 손목·도구·접촉 및 업무 선점/반납은 공용 런타임이 결정한다. 테스트는 콜백 직후가 아니라 전체 후처리 후의 world 위치를 검사한다.
5. 준 마우스는 실제 메시 raycast를 사용한다. 가상의 평면으로 옮겨 오차를 숨기지 않는다.
6. 새 손/소품 노드는 공동 장면 스키마를 변경한다. **모든 참여 탭을 같은 새 번들로 새로고침하고 새 공동 장면 송신을 시작한다.** 과거 v12/v13/소라만 v14인 저장 패킷과 혼용하지 않는다. DB/과거 결과를 지워 해결하지 않는다.

## 다음 로컬 배포 순서

Node.js **22.x** 필요. 이번 검증 런타임은 22.23.4. 이 기기의 `.data/runtime`은 Git에 없으며 다른 PC에서는 정상 설치된 Node22를 사용한다.

```sh
# 사용자 변경이 없음을 먼저 확인한다. dirty 상태를 reset/clean/stash로 지우지 않는다.
git status --short
git switch main
git pull --ff-only origin main
node --version
npm ci
npm run setup:local
npm run typecheck
npm run check:boundaries
npm run check:product
npm run build:prepare
```

`setup:local`은 기존 `.env.local`을 보존한다. 새 기기에서는 그 기기용 설정/로컬 DB를 생성한다. 기존 기기의 DB·로그인 설정을 덮거나 Git으로 전달하지 않는다.

1. 준비 빌드 성공과 출력된 **해당 기기의** release ID를 확인한다. 현재 서버를 유지하는 동안 후보 검증이 가능하다.
2. 실행 중 서버를 해당 터미널의 Ctrl-C 또는 프로세스에 SIGTERM으로 정상 종료한다. DB 잠금이 해제되었는지 확인한다.
3. 기존 데이터가 있으면 `npm run db:backup`으로 비공개 백업을 만든다. 실제 데이터나 백업을 커밋하지 않는다.
4. 다음 명령의 `<release-id>`를 방금 준비한 값으로 교체한다. 준비 후 소스가 바뀌었으면 다시 빌드한다.

```sh
node --env-file-if-exists=.env.local scripts/build-product.mjs --publish <release-id>
npm start
```

5. `/api/health`, `/start`, 개인별 데모 및 JS/GLB 응답을 확인하고 새로고침 자동 재생·5명·정지·업무/컵 반납을 확인한다. `/.env.local`, `/.data/`는 공개되면 안 된다.
6. 기존 열린 탭을 새로고침한다. 공동 관찰은 같은 최신 번들의 탭끼리 새 송신을 시작한다.

첫 managed build의 경로 전환은 서버가 멈춰 있어야 한다. 이미 managed 상태여도 실제 적용 후 서버 재시작이 필요하다. **실행 중 서버는 시작한 release의 정적 경로를 고정**하기 때문이다. 단순 `git pull`이나 개별 데모 빌더 실행만으로 배포가 갱신되지 않는다.

### 문제 발생 시

현재 서버를 정상 종료 → `npm run build:rollback` → `npm start`. 직전 release가 이 기기에 보존되어 있어야 한다. 클라이언트/서버 산출물만 되돌리며 DB 복원/삭제는 하지 않는다. 새 기기에는 이전 release가 없으므로 필요한 경우 이전 소스 커밋을 별도 체크아웃해 다시 준비한다. 이번 변경은 DB 스키마/잠금 파일 의존성을 바꾸지 않았다.

## 검증과 남은 범위

- 후속 리소스 최적화: 관련 **43/43** 통과, 수치 167개·WebGL 13개 표본 동일, 화면 재진입/컨텍스트 복구 동일. prepare/격리 제품 요청·저장 smoke/실제 로컬 적용 확인 완료. 아래 81개/79개 및 과거 장시간 결과와 중복 합산하지 않는다.

- 손/개성/재생 관련 **81개 회귀 통과**, 실제 화면에서 5명 대표 업무·준 마우스/가리키기·5명 컵·레오 문서·준 안경 검수 완료.
- 전원 손 v14 전달 당시 관련81개/서버79개 통과, 새 잠금 의존성 설치·전체 빌드·격리 서버 smoke 통과. 전체 npm test는 장시간 회귀 중 중단한 미완료 상태다. 상세 결과는 `docs/local-release-20261024.md`와 `product/evidence/local-release-20261024/validation.json`에 기록했다. 예전 장시간/Safari 검수 결과를 이번 손 v14의 새 검사로 합산하지 않는다.
- 실물 모바일, 새 2시간 soak, 피부 전체의 매 프레임 무관통, 의료적 손 구조·FPS 보장은 하지 않는다.
- `.data/`의 세부 로그/전체 캡처는 로컬 전용이며 Git에 없다. Git에서 재현 가능한 소스/테스트와 요약은 저장소에 포함한다.

## 2026-10-24 실습 하위 폴더 — 최신 요청 우선

- `practice/`에 기존 3D 소스를 재사용하는 정적 실습 화면 구현. 루트 `build:practice`, `test:practice`, `serve:practice` 명령 추가. 별도 저장소/의존성 설치 없음.
- **사용자가 최종적으로 로컬 실행만 요청했다. Hostinger 운영 업로드 금지.** 전용 화면은 practice/에서 별도 4198로 로컬 실행한다. 2026-10-24 사용자의 로컬 진행 요청으로 범위를 확정했다.
- 4341은 승인받은 일시 검수 뒤 보존한 원래 미리보기로 복구. 임시 4199 종료. 4180/DB/기존 managed 배포는 그대로.
- Hostinger에는 앞선 승인으로 빈 work.aitoolslab.win 사이트 항목만 생성됨. 파일 업로드·DNS 수정·유료 구매·커밋/푸시 없음. 불필요한 사이트 삭제는 별도 승인 필요.
- 상세 상태·검수 한계는 `practice/DEPLOYMENT.md`. `.data/hostinger-work-20261024/`의 부모 통합 후보는 **배포하지 않는다**.

## 2026-10-24 로컬 실습 마무리

- 활성 코드는 `practice/`, 실행 `npm run build:practice && npm run serve:practice`, 화면 127.0.0.1:4198. `practice/` 내부에서 `node build.mjs`, `node serve.mjs`도 가능.
- 다른 웹사이트 연결 도구/관련 테스트를 활성 트리에서 제거. 별도 저장소·새 의존성·원격 배포 없음.
- 최신 빌드·8/8 기본 검사·typecheck·check:boundaries 통과. 원본 4180 health 200, 공유 3D 소스 변경 없음, GLB 바이트 동일.
- Ego 실제 역할 결과·진행 중 초기화·늦은 완료 억제·키보드 일시정지·새로고침 자동 재생·나라 필기 손 표본 검수. WebGL 손실 뒤 캔버스 해제/안내/2D 결과 계속 가능 확인.
- 자세한 결과와 한계: `practice/DEPLOYMENT.md`, `practice/evidence/final-validation.json`. 계획: `dev-plan/implement_20261024_161015.md`. 새 CPU/RAM 비교·전체 장시간 회귀·실물 모바일 검수는 미실행.
- 빈 호스팅 사이트는 이전 승인으로 만들어진 과거 이력일 뿐 현재 실습 실행에 사용하지 않는다. 추가 원격 작업·커밋/푸시는 별도 요청 없이는 금지.

## 2026-10-24 practice 배속·시나리오 추가 완료

- 현재 practice 로컬4198 화면에 0.5/1/1.5/2배 및 기존3+새11 시나리오. 업무·협업·휴식·하루 필터, 상대 선택, 진행·다시 시작·중단 후 복귀.
- `practice/src/scenarios.mjs`가 목록/참가자 스냅샷/최신 요청 하나/안전 복귀를 관리한다. 기존 런타임의 cancelAll을 기다리고 resetActivity로 강제 초기화하지 않는다. 요청 결과·배속·수동 정지는 보존한다.
- 모델·캐릭터·리그는 변경 없음. 공용 motion-clock/quality-view만 allowSlowMotion 및 motionReview 옵션 추가(기본 제품 정책/자동 RAF 유지). localhost `?review=1`만 제어된 실제 WebGL 검수 모드이며 FPS/CPU 측정용이 아니다.
- 로컬17/17·기존 시계/품질회귀6/6·typecheck·경계 통과. 4배속×4행동16회와 추가9종 전체 복귀·3개 하루4단계·native완료 기록·배속별 동일 포즈 해시·일시정지 전환/중단 검수.
- 최신 문서 `practice/SCENARIO_QA.md`, 증거 `practice/evidence/speed-scenarios/`, 계획 `dev-plan/implement_20261024_162550.md`. 전체 장시간 테스트·새CPU/RAM비교·실물모바일 검수 없음.
- 기존4180/DB/managed release 보존, 원격/Hostinger/DNS·커밋/푸시 없음. `npm run build:practice`, `npm run test:practice`, `npm run serve:practice`로 재현한다.

## 2026-10-24 최종 인계 — 민 머리·practice main 전달

**최신 범위: main 커밋·푸시 승인 / 원격 사이트 배포 금지.** 이전 단계의 커밋/푸시 없음·별도 요청 필요 문구는 역사 기록이며 현재 요청으로 Git 소스 동기화만 추가됐다. Hostinger·DNS·다른 웹사이트 연결을 재개하지 않는다.

- `practice/src/assets/min-hair.mjs`: 민 전용 min-soft-curls v1. 연결된 머리 볼륨·굽은 앞머리·관자놀이 컬. 메시2·7,940 triangles·텍스처0·추가 렌더 루프 없음. 기존 GLB는 바이트 동일하고 나머지 네 명·눈/안경·손·소품·개성 코드는 유지한다.
- 머리는 MinHead를 상속한다. 기존 HairBack 및 순수 Curl 인스턴스만 숨기며 혼합 피부 배치를 거부한다. dispose는 기존 가시성을 복원하고 새 자원을 해제한다.
- 0.5/1/1.5/2배와 총14 시나리오·상대·안전 전환/복귀는 유지한다. 시나리오/결과 시간 분리, 마지막 대기 요청 하나, 실습 결과/수동 정지 보존 계약을 유지한다.
- 최종 practice **21/21**, 민 개성+기존 시계/품질 회귀 **13/13**, 빌드·typecheck·check:boundaries 통과. 전체 장시간 npm test 결과는 아니다.
- 머리 최종본의 실제 WebGL 4배속×업무/민 커피 **8회** 완료·소품반납·5명원위치·예약해제·violations=[] 확인. 머리 전 기존16회+추가9종과 구분하며 합산하지 않는다.
- 새 문서 `practice/MIN_HAIR_QA.md`가 최신 결과/한계, `practice/SCENARIO_QA.md`는 이전 전체 시나리오 검수, `practice/README.md`는 사용법, `practice/DEPLOYMENT.md`는 로컬 범위/취소 이력이다. 머리 출처는 `practice/src/assets/README.md`.
- 컵의 기존 legacy 그립·주먹형 손·팔/컵 겹침은 남는다. 접촉 수치를 모든 프레임의 무관통·손의 해부학적 완성으로 해석하지 않는다. 새 성능 측정·실물 모바일·2시간 soak는 하지 않았다.
- 재현: Node22, `npm ci` → `npm run build:practice` → `npm run test:practice` → `npm run serve:practice`. 화면 127.0.0.1:4198, 원본4180/DB/managed release 보존. 기존 dist는 Git 제외이므로 pull만으로 실행 화면이 바뀌지 않는다.
- 이전 Ego 자원 비교의 아직 미커밋 문서·증거도 링크 무결성을 위해 함께 보존한다. 그 수치를 이번 머리/실습의 새 CPU/RAM 결과로 재사용하지 않는다.

## 2026-10-24 후속 로컬 보완 — 나라·소라·레오 머리 틈

- 최신 요청에 따라 세 명의 앞머리–정수리 사이 두피 띠를 `practice/src/assets/hair-fill.mjs`의 연속 연결 면으로 메웠다. 기존 단발·포니테일·낮은 번과 색상·민/준·손·개성은 유지한다.
- 각1메시·736 triangles(총3개·2,208), 원본 머리 재질 공유, 새 텍스처/루프/물리 없음. Head를 상속하며 해제 시 추가 geometry만 반납한다. 원본 노드/GLB는 변경하지 않는다.
- practice25/25, 세 명 개성+공용 회귀28/28·typecheck/경계 통과. 실제 확대/정면/측면/뒤/저녁 및 세 명 업무/휴식6회 완료·복귀·반납·예약해제 확인. 제어된 WebGL 검수로 FPS/CPU 측정은 아니다.
- 최신 QA: `practice/HAIR_FILL_QA.md`, 증거 `practice/evidence/hair-fill/`, 계획 `dev-plan/implement_20261024_170217.md`.
- 현재 로컬4198의 빌드만 갱신. 4180/DB/managed release 유지. 이번 후속 변경은 아직 커밋/푸시하지 않았고 원격 배포하지 않았다. 직전 main 전달은 2f9bd21이다.

## 2026-10-24 최신 로컬 — 품질 유지 계산 최적화

- 기존 미커밋 세 명 머리 연결 면/민 머리 보강을 그대로 보존했다. `solveArm`의 중간 갱신은 필요한 관절만, 마지막 손과 기존 전신 flush는 유지한다. 키 검색은 actor inverse1회, UI는 불변 틱 직렬화/주기 진단을 생략하고 상태 이벤트로 안내한다. 3D 실패 시 폐기된 player 참조를 끊는다.
- 정밀도·목표·손/소품/개성·60Hz·네 배속·GLB/포스터/CSS/머리 에셋·DPR/그림자/FPS 정책은 변경하지 않았다. 공유 소스는 바뀌었으나 실행 중인4180의 managed release는 변경하지 않는다.
- practice30/30·기존 손/시계/품질19/19·typecheck/경계 통과. eager솔버와80포즈 정확히 일치. 실제 장면/픽셀해시22짝 및 네 배속 포함10짝 동작·접촉·복귀 일치.
- 동일120스텝+15draw 실제 WebGL CPU 중앙값: 대기313.288→292.314ms(약6.69%), 업무523.207→455.186ms(약13.00%). 각각4짝 중3짝 개선/1짝 증가. 기기 전체CPU%·FPS·안정적 절감률 보장 아님. 유지 JS힙은 유사/소폭 증가, 실패 후 힙도 후보가 더 큰 표본이므로 RAM 절감 주장 금지.
- 최신 문서 `practice/OPTIMIZATION_QA.md`, 증거 `practice/evidence/quality-optimization/`, 계획 `dev-plan/implement_20261024_171151.md`. 과거 자원 비교 수치나 다른 작업량의1차 실험을 합산하지 않는다.
- 최종 로컬4198 새 빌드만 유지, QA 기준4197 종료. 원본4180/DB/managed release 보존. 이후 머리/최적화 변경은 아직 커밋/푸시하지 않았고 원격 배포하지 않았다. 직전 main은2f9bd21.
