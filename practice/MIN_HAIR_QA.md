# 민 머리 보강·최종 로컬 인계 — 2026-10-24

> 민 보강 당시의 인계 기록이다. 이후 나라·소라·레오의 머리 연결 면은 [HAIR_FILL_QA.md](HAIR_FILL_QA.md)에 별도로 기록한다.

## 변경 내용

민의 작은 구형 컬이 떨어져 보이던 머리를 **min-soft-curls v1**으로 보강했다. 짙은 갈색 짧은 곱슬머리·둥근 안경·보라색 의상은 유지하고, 연결된 정수리/머리 뿌리, 비대칭 굽은 앞머리, 관자놀이 컬과 작은 결을 적용했다. 외부 에셋이나 Blender 연결 없이 직접 만든 절차형 3D 메시다.

| 파일 | 책임 |
|---|---|
| src/assets/min-hair.mjs | 정적 머리 생성, MinHead 장착, 기존 머리만 숨김, 안전한 해제 |
| src/assets/README.md | 출처·좌표·예산·적용 범위 |
| src/app.mjs | practice 런타임 연결, 진단/해제, 기존 단일 update 유지 |
| build.mjs | 번들 포함 및 build-manifest practiceAssets 식별자 |
| tests/min-hair.test.mjs | 형상/예산·민 한정·혼합 배치 거부·해제·실제 5명 모델 불변 검사 |

**practice 전용**이며 원본 앱의 canonical v9 GLB와 WebGL 실패 시 사용하는 기존 사무실 포스터는 변경하지 않는다. 새 머리는 practice의 실제 3D 화면에 적용된다. 다른 네 명·민의 피부/귀/눈/안경·손·IK·소품·업무 개성 코드는 그대로다. MinHead를 부모로 사용하므로 끄덕임·회전·이동을 그대로 상속하며 별도 애니메이션/물리 업데이트가 없다.

## 리소스 정책

병합 메시 **2개 / 7,940 triangles / 재질 2개 / 텍스처 0개**. 기존 머리 두 노드(뒷머리와 순수 컬 인스턴스)를 숨기고 교체한다. 기존 geometry는 다른 노드의 공유 자원을 훼손하지 않도록 유지하며, 새 자원은 런타임 해제 시 반납한다. 별도 파일 요청·새 의존성·렌더 루프·품질 하향·FPS 제한은 없다.

최종 practice 빌드: **11,276,035 bytes**. 머리 추가 전 11,272,922 bytes 대비 약3.1KB 증가다. 이는 산출물 바이트 비교이지 브라우저 CPU/GPU/RAM 성능 측정이 아니다. 과거 최적화 검수의 16.45% 수치를 이번 머리 변경 성능으로 인용하지 않는다.

기반 GLB SHA256:
`ff2187450fa2270e572ce0c5a16f532e252007afb973875e03c711427030249e`.

## 자동 검사

| 검사 | 결과 |
|---|---|
| practice 단위·시나리오·시계·HTTP·패키징·머리 | **21/21 통과** (기존17+머리4) |
| 민 개성·기존 시계/검수·품질 회귀 | **13/13 통과** (민7+기존6) |
| 빌드·문법·타입·의존성 경계 | 통과 |
| 기존 5명 모델 | 기존 전 노드의 parent/position/quaternion/scale/geometry/material 불변; 민 머리 2개 visible만 변경 |
| 해제 | 기존 visible 복구·새 geometry/material 4개 해제·멱등·재장착 통과 |
| 방어 | 없는 머리/중복 장착/피부가 섞인 인스턴스 배치 거부 |
| 서버 보존 | 4198 HTML 200 / 4180 health 200, 원본 서버·DB·managed release 변경 없음 |

이 숫자는 전체 npm test·장시간 soak의 완료를 의미하지 않는다.

## 실제 화면 검수

Ego Lite의 실제 로컬 WebGL에서 최종 머리 에셋을 검수했다. 일반 자동 재생과 제어된 검수를 구분한다.

### 배속별 동작·접촉·복귀

0.5·1·1.5·2배에서 **각자의 업무(5명)와 민의 커피**, 총 **8회**를 완료했다. 각 업무 use 단계의 민 재확인 개성(`min-recheck-stop`)과 삼점 펜 잡기, 실제 sip 단계의 기존 컵 그립을 표본으로 저장했다.

- 네 배속 모두 업무/컵 소품 반납, 5명 원위치(오차 <1e-6), 예약 해제, violations=[] 확인.
- 민 업무 표본: 손 패드 오차 약0.000159 장면 단위, 펜 끝 오차 약5.55e-16. 네 배속 동일.
- 컵 표본은 실제 `recipe.phase=sip`, owner=hand이며 손 접촉 오차는 부동소수점 수준. 완료 후 owner=desk.
- 모델9·손14·balanced 유지. 민의 확인/대조 리듬과 나머지 캐릭터의 서로 다른 동작은 유지.
- 이 검사는 `?review=1`의 동일 MotionClock/런타임을 고정 wall-frame으로 전진하여 실제 WebGL로 그린 것이다. **일반 실시간 FPS/체감 배속/CPU 측정이 아니다.**

### 일반 자동 재생·실패 경로

일반 주소의 실제 키보드 Enter로 민 선택·근접 카메라·0.5배·정지·예시 요청/결과 생성을 실행했다. 정지 상태에서 새 업무 장면과 2배를 선택해 결과·정지가 유지됐고, 재생 후 시뮬레이션 시간이 진행됐다. 일반 주소의 reviewFrames 노출은 false였다.

WebGL 컨텍스트 손실 후 캔버스 0개·대체 안내·모든 장면 제어 비활성화를 확인했다. 이 상태에서 새 2D 요청도 done까지 완료했다. 최종 사용자 화면은 새 일반 주소의 1배 자동 자유로운 하루·민 근접 화면으로 돌려놓았다. 실물 모바일·모든 GPU 실패를 새로 검수한 것은 아니다.

### 외형·일반 화면

민 근접 낮/저녁과 업무·컵 중 고개 방향 변화를 확인했다. 눈·안경이 앞머리에 가리지 않으며 머리는 기존 고개를 따라간다. 손 카메라와 회전한 반대 시점에서 컵을 추가 관찰했다.

**남은 기존 한계:** 컵 사용은 기존 legacy-owned-contact 손을 사용한다. 주먹처럼 단순한 손 형상, 팔/손·컵이 겹쳐 보이거나 가려지는 구간이 남아 있다. 수치 접촉과 소유권 통과를 전 프레임 무관통·자연스러운 해부학적 손의 완성으로 표현하지 않는다. 이번 작업은 새 손 교정이 아니다.

이전 [속도·시나리오 검수](SCENARIO_QA.md)의 16회+추가9종/연속 하루 완료는 **머리 보강 전** 결과다. 이번에 해당 전체 시나리오를 다시 실행했다고 주장하거나 8회와 합산하지 않는다. 손/시나리오 코드를 바꾸지 않은 범위와 새 민 검수를 따로 기록한다.

## 재현

```sh
# 저장소 루트, Node.js 22
npm ci
npm run build:practice
npm run test:practice
node --test --test-concurrency=1 product/tests/personality-min.test.mjs product/tests/personal-inspection.test.mjs product/tests/resource-quality.test.mjs
npm run serve:practice
```

일반 화면: http://127.0.0.1:4198/ . 제어된 화면은 로컬에서만 `?review=1`로 연다. 일반 화면에는 reviewFrames 진입점이 없다.

## 증거·인계 범위

`evidence/min-hair/`의 before.png, after-day.png, after-evening.png, 배속별 PNG, rates.json, native-ui.json, validation.json, alternate-contact.json, cup-front.png, final-screen.png, build-manifest.json을 사용한다. 화면은 실제 브라우저 캡처이며 생성 이미지가 아니다. 새 외형과 기존 범위의 차이를 판독할 수 있도록 이전 증거도 유지한다.

소스·문서·증거는 사용자 요청대로 **main Git 커밋·푸시로 전달**한다. 웹 실행은 로컬4198만 유지한다. Hostinger 업로드·DNS 변경·원격 배포 명령은 수행하지 않으며 원본4180·DB·managed release는 보존한다. Git 전달은 웹사이트 배포가 아니다. 다른 PC는 pull 후 practice 빌드를 다시 해야 한다. dist·.data·설정·DB·비공개 로그는 Git에서 제외한다.
