# 품질 유지 계산 최적화 — 2026-10-24

## 개요

> 후속: [장시간·전체 회귀 검수](STABILITY_QA.md). 전체537/537과 실제2시간 실행을 추가했다. 초기 texture 증가 gate는 실패했으며 조건부 결과를 명시했다. 이번 사용자 승인으로 main 소스 전달 범위가 추가됐고 원격 사이트 배포 금지는 유지한다. 아래 수치는 이전 비교 시점의 기록이다.

나라·소라·레오 머리 틈과 민 머리를 보강한 **현재 practice 화면**을 기준으로 중복 계산만 줄였다. 기존 미커밋 머리 보완을 보존하며 로컬4198 빌드를 갱신했다. 4180/DB/managed release와 원격 사이트는 변경하지 않는다.

| 파일 | 변경 |
|---|---|
| pilot-3d/activities/interactions.mjs | 팔 IK 시작/중간 단계는 필요한 관절 행렬만 갱신. 마지막 손 서브트리와 기존 런타임/렌더의 전신 갱신은 유지 |
| pilot-3d/hand-v14/adapter.mjs | 키 후보 검색 동안 변하지 않는 actor inverse를 한 번 계산. 기존 좌표 계산·동률 시 첫 키 선택 유지 |
| src/scenarios.mjs | 같은 선택/단계/오류 상태의 틱에서는 snapshot·JSON 직렬화 생략. 실제 변경 시 기존 JSON 동등성 검사 유지 |
| src/app.mjs | 단순 정지 안내를 이벤트로 갱신해 주기적 전체 진단 호출 제거. 3D 실패 시 폐기된 player 참조 해제 |

IK 목표·수학·정밀도·반복 횟수·손가락/피부·리그·소품 소유권·개성·경로·60Hz·배속·그림자·DPR·FPS 정책은 바꾸지 않았다. 모델/텍스처 간략화나 프레임 제한으로 비용을 줄인 것이 아니다. 일시정지 안내 문구는 이제 주기적 진단을 기다리지 않고 즉시 반영된다.

## 자동 검사

- practice **30/30**: 기존25 + 최적화5. 팔 양쪽×5명×8포즈 **80개**에서 이전 eager 솔버와 오차·최종 가시 변환·스켈레톤 해시 정확히 일치.
- 키 검색: 이동/회전/비균일 크기의 부모, 빈 목록, 동률에서 기존 선택과 일치. 후보 수와 무관하게 actor 갱신은1회.
- 변화 없는10,000틱에서 추가 snapshot 생성0회. 하루 단계·중단·재시작 등 UI 이벤트 목록은 기존 eager 직렬화와 일치.
- 기존 손/전원 접촉/시계/품질 회귀 **19/19** 통과. 전체 장시간 npm test 결과로 확대하지 않는다.
- 빌드·문법·typecheck·check:boundaries·diff whitespace 검사 통과.
- 기반 GLB·포스터·CSS·화질 명세·머리 에셋 명세가 전후 동일. 최종 정적 빌드11,279,098 bytes, 직전 머리 보완본 대비469 bytes 증가. 파일 크기 절감 주장은 하지 않는다.

## 실제 브라우저 자원 비교

Ego Lite에서 직전 빌드를4197에 보존하고 후보4198과 **순서를 교차한4회 짝 비교**를 수행했다. 기준에도 최신 머리 보완을 포함했다. 양쪽 같은120 fixed steps +15회 실제 WebGL draw, 측정 전120스텝/10draw 준비. 픽셀 readback/추가 품질 draw와 GC는 CPU 측정 구간 밖이다.

CPU는 해당 Chromium 렌더러의 CDP Performance.ProcessTime 누적 차이다. 전체 컴퓨터·브라우저 본체·GPU·다른 탭·서버의 합계 점유율이나 실제 자동 RAF의 FPS 측정이 아니다. 다른 사용자 앱/탭을 종료하지 않았다.

| 동일 작업 | 이전 CPU 중앙값 | 최적화 CPU 중앙값 | 관찰 |
|---|---:|---:|---|
| 대기 | 313.288ms | 292.314ms | 약6.69% 감소, 4짝 중3짝 감소 |
| 5명 역할 업무 | 523.207ms | 455.186ms | 약13.00% 감소, 4짝 중3짝 감소 |

**각 조건에 증가한 표본도1개씩 있다.** 작은 통제 표본의 중앙값이지 안정적 개선율/기기별 보장이 아니다. 1차 탐색은 다른 작업량이었으므로 성공 집계에서 제외하고 ignored .data에만 보존했다.

강제 GC 후 유지 JS 힙은 대기 약23.17→23.18MB, 업무 약23.37→23.40MB로 유사하며 후보가 소폭 크다. **RAM 절감 성공으로 판정하지 않는다.** RSS·GPU 메모리·장시간 누수 검사는 하지 않았다. 원시 roundWallMs는 GC/후속 품질 검수까지 포함하므로 CPU% 분모로 사용하지 않는다.

## 품질·손·소품·복귀

- 성능 검수8짝 + 접촉/카메라 검수14짝 = **22짝**에서 장면 패킷 SHA256 및 실제 framebuffer 해시 일치. framebuffer 해시는 FNV-1a32 표본이며 암호학적 이미지 증명/전 프레임 보장은 아니다.
- 네 배속(0.5·1·1.5·2)에서 각자의 업무와 민의 컵, 1배에서 준 안경과 레오→나라 자료 전달: **10짝**, 양쪽 각각10회 완료.
- use/sip/adjust/read 실제 단계에서 손 진단·소품 소유권·개성·위치·진행 상태까지 비교. 5명 업무 손 카메라 표본을 포함한다.
- 모두 완료 후 원위치(<1e-6), 소품 desk 반납, 예약 해제, violations=[], 전후 최종 진단 일치. resetTimes=0.
- 기존 단순한 legacy 컵 손과 팔/소품 가림은 남는다. 최적화가 손의 조형을 교정하거나 모든 피부 관통을 해결한 것은 아니다.

## 일반 UI·실패 경로

일반 주소에서 실제 키보드로 민 선택·0.5배·정지·예시 결과·2배·재생을 확인했다. 결과/배속/정지는 유지되고 일반 주소에 제어된 reviewFrames는 노출되지 않는다. 정지/재생 안내는 현재 상태를 즉시 표시한다.

자체 검수 탭의 WebGL 손실 후 캔버스0, 대체 안내, 장면 버튼 비활성화, 새 2D 요청 done을 확인했다. 최적화본은 폐기된 player가 QA에서도 undefined가 되어 더 이상 그 참조가 3D 상태를 보유하지 않는다. 강제 GC 힙1회 표본은 이전 실패 후16.36MB / 후보17.72MB로 후보가 더 컸다. 해당 단일 비동등 자동 재생 표본을 메모리 절감 수치로 사용하지 않는다.

## 증거·재현·현재 범위

`evidence/quality-optimization/`: summary.json, browser-performance.json, contacts-and-returns.json, native-lifecycle.json, build-manifest.json 및 실제 PNG. 기준/후보는 머리 보완까지 같은 장면이며 실행/메모리 로그는 개인정보 없는 검수 입력만 포함한다. 개인 DB/설정은 사용하지 않는다.

```sh
# Node.js 22, 저장소 루트
npm run build:practice
npm run test:practice
node --test --test-concurrency=1 product/tests/personal-inspection.test.mjs product/tests/resource-quality.test.mjs product/tests/hand-v14.test.mjs product/tests/hand-v14-team.test.mjs
npm run typecheck
npm run check:boundaries
npm run serve:practice
```

UI는 http://127.0.0.1:4198/ . 새로고침하면 새 번들로 바뀐다. 로컬 QA 기준 서버4197은 검수 후 종료한다. 원본4180과 DB/managed release는 보존하며 이번 변경의 Git 커밋/푸시·Hostinger/DNS·원격 배포는 하지 않는다. 전체 npm test, 모든 GPU/실물 모바일/2시간 soak, 전 프레임 이미지 동일성은 검수하지 않았다.
