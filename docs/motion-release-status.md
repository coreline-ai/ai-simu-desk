# 5명 동작 최신 구현·검수 상태

현재 구현·후속 검수는 2026-10-24 절을 우선한다. 2026-10-23 역사 기록은 공간 v9 / 개인별 하루 v12, 로컬 PGlite·Fake AI, 기존 main `7b72c61` 이후 P0~P2 보정 당시 결과다. 각 절의 수치를 최신 코드 재실행으로 혼용하지 않는다.

## 2026-10-24 후속 — 품질 유지 리소스 최적화

숨긴 legacy 손 계산·반복 노드 검색/진단/detail 지정을 줄이고, 화면 밖에서는 시뮬레이션을 유지한 채 그리기만 생략한다. FPS/DPR/모델/접촉 계약·캐릭터 개성은 유지했다. 수치 167개·WebGL 13개 표본이 기준과 같고 관련 테스트 43개를 통과했다. CPU 단독 워크로드 중앙값은 대기 13.10%·업무 21.67% 감소했지만 전체 앱 CPU/FPS/전력 수치가 아니다. 정상 전경 성능·실물 모바일·새 장시간 검수는 미확정이다.

[변경·측정·한계·재현](resource-efficiency-20261024.md) · [기계 판독 증거](../product/evidence/resource-efficiency-20261024/validation.json) · [현재 운영 인계](../HANDOFF.md). 로컬 4180에는 검수한 실행 코드와 에셋을 적용했으며 기존 탭 새로고침이 필요하다. 아래 결과는 각 시점의 역사 기록으로 보존한다.

## 2026-10-24 최신 전달 — 5명 개성 v13 + 손 v14

**현재 최신 구현은 공간 v9 / 개성 v13 / 전원 손 v14**다. 사용자가 소라 손의 현재 품질을 기준으로 전원 확대하도록 승인했으며, 자연스러움 문제가 모두 해결된 것은 아니다. 기본 제품과 개인별 데모에 연결했고 15개 업무 변형의 고유 리듬·중단/반납을 보존했다. 나라·소라·민의 삼점 필기, 준의 교대 입력과 실제 마우스 표면 접촉을 적용했다. 컵·문서·안경·전달은 기존 접촉 그립을 명시적으로 유지한다.

[최신 손/화면 QA](team-hand-v14-qa.md) · [다음 로컬 배포 핸드오프](../HANDOFF.md) · [커밋 전 검증](local-release-20261024.md).

관련 81개 회귀 및 대표 실제 화면 검수를 통과했다. 아래의 464개/2시간/Safari/3계정 결과는 **2026-10-23 v12의 역사 기록**이며 이번 v14의 재실행으로 표시하지 않는다. 이번 전체 회귀와 준비 빌드 결과는 커밋 전 검증 문서에 별도로 기록한다. 새 손/개성은 공동 프레임 스키마가 달라지므로 모든 탭을 최신 번들로 갱신하고 새 송신을 시작한다.

## 2026-10-23 기록

## 완료 범위
| 우선순위 | 항목 | 결과 |
|---|---|---|
| P0 | 나라·소라·준·민·레오 실제 접촉/중단/복귀 전문 QA | 3담당·30묶음 통과 |
| P0 | 필기·밑창/러그 접촉 보정 | 실제 표면 기준으로 수정·원 재현 조건 통과 |
| P0 | 렌더러 해제·컨텍스트/환경광 복구·초기화 실패 | 단위8개·실제 브라우저7흐름 통과 |
| P0 | 전체 회귀·실제2시간·공동 관찰·로컬 전달 | 464개/2시간/3계정/4180 통과 |
| P1 | x0.25/x0.5·구간 반복·선택 동료 접촉 표시 | 비교 화면 구현·브라우저 통과 |
| P1 | 실제 Safari | 26.5.2 다섯 흐름 통과·설정 원복 |
| P1 | 실물 모바일 | 기기 offline, 사용자 확인에 따라 미완료 |
| P2 | 5명별 컵 운반·회전/도착 안정화 | 실제 손잡이/패드 접촉·소품 회수 통과 |
| P2 | 업무/회의/휴식 맥락에 따른 자동 활동 | 우선권·시드·공정성·반복 억제 통과 |
| P2 | 수동 선택한 활동/참가자의 정확한 구간 반복 | 실제 app 핸들러5검사·브라우저3흐름 통과 |

[최신 비교 화면](http://127.0.0.1:4180/demos/activities/personal/?play=1&demo=team)에서 정밀 관찰을 열 수 있다. 저배속은 비교 페이지 전용이며 기본 제품 배속 x1/x1.5/x2/x3을 유지한다. 구간 반복은 실제 업무·서버 시간·저장 기록을 바꾸지 않으며 새 활동/업무/참가자/시연 조건 변경·모션 축소에 양보한다. 접촉 표시는 공동 관찰 스키마 밖에서 관리한다.

## 핵심 보정
- 민의 펜 끝 최대 약5mm 부유를 실제 종이/체크 메시 raycast+0.4mm로 보정했다.
- 소라의 약10.082mm 발 부유는 v12 YXZ 회전과 실제 둥근 밑창 단면으로 보정했다. v11 XYZ는 보존한다.
- 나라의 러그 경계 약18.7mm 관통은 실제 바닥/러그 삼각형·전체 밑창 정점으로 보정했다. 독립 Three raycast32조건에서 약1mm 간격을 확인했다. y=0/최저정점 한 점만 보던 QA의 오탐도 구분해 수정했다.
- Three 공유 `DFG_LUT`에 이전 렌더러의 dispose 콜백이 남던 경로를 실제 렌더링 uniform에서 포착해 해제한다. 컨텍스트 손실 시 CPU 배열·포즈를 유지하면서 GPU 참조를 정리하고 그림자·PMREM 환경을 다시 생성한다. 초기화 예외와 로딩 취소도 회수한다.
- 직접 고른 컵/3인 회의가 이전5인 회의로 반복되던 문제는 마지막 성공 명령의 인물·상대·인원·실제 변주를 저장해 해결했다. 동료 라벨 선택도 반복을 취소한다.
- 5명별 운반 높이/거리·회전 준비/도착 완급과 업무 직후/회의 직후/휴식 후의 자동 활동을 구분했다. 기존 예약·소유권·수동 활동 우선권을 유지한다.

## 최종 검증 근거
| 검사 | 실제 결과 | 근거 |
|---|---|---|
| 전체 npm test | 464/464, 실패/취소/skip0·약114.1분 | [요약](../product/evidence/motion-precision/integration/full-tests-summary.json), [TAP](../product/evidence/motion-precision/integration/full-tests.tap) |
| 3담당 병렬 정밀 QA | 나라·소라12 / 준·민8 / 레오·다인10 모두 통과,263파일 불변 | [최종 지문/결과](../product/evidence/motion-precision/integration/precision-run-summary.json) |
| 타입·구조 경계·문법 | 최종 코드 통과, git diff --check 통과 | [정적 검사](../product/evidence/motion-precision/integration/static-final-checks.json) |
| 실제 연속 브라우저 | 7,207.957초,311표본·오류0·예약/소품 회수 | [2시간 JSON](../product/evidence/motion-precision/final-soak/soak.json) |
| 장시간 JS heap | 22.96→24.03MiB, +1.07MiB,8MiB 기준 통과 | 위2시간 JSON |
| 렌더러 회수 | 재생성30회·복구3회·조기 취소3회·초기화 예외3회, 이전context0·전체RGBA동일 | [렌더러 보고서](renderer-lifecycle-qa.md) |
| 기존/최신3D 화면 | 빌드된16진입점 에셋 로드·컨텍스트/문서 재로드 복구·단일canvas·오류0 | [16화면 결과](../product/evidence/motion-precision/built-studios/studios.json) |
| Chrome 기능·레이아웃 | 실제 접촉/정지·4배속·업무/취소·모션 축소·v11·320/390/768/1440 통과 | [브라우저](../product/evidence/motion-precision/browser/browser.json) |
| 정밀 관찰·수동 반복 | 6배속/반복/업무 우선/비교4흐름, 컵/3인 반복3흐름 | [관찰](../product/evidence/motion-precision/inspection/browser.json), [수동 선택](../product/evidence/motion-precision/replay/browser.json) |
| 실제 Safari | 5기능 흐름·native 입력 도착 확인, 설정0/0복원 | [Safari](../product/evidence/motion-precision/safari/browser.json), [원복](../product/evidence/motion-precision/safari/settings-restored.json) |
| 공동 관찰 | 임시DB3계정 좌표/소품·늦은 입장·권한·제어권/로그아웃 해제 통과 | [공동 관찰](../product/evidence/motion-precision/sharing/shared-browser.json) |
| 실제 숨김/최소화 | 시간 정지·복귀 누적 없음·일시정지 유지 통과 | [가시성](../product/evidence/motion-precision/visibility/visibility.json) |
| 로컬 전달 | 사용자DB 비공개 백업,4180의 검수 번들/5명/접촉14점/PGlite·Fake AI 통과 | [전달 결과](../product/evidence/motion-precision/delivery/delivery.json) |

병렬 최종 실행: 2026-10-23 15:55:07 KST~2026-10-23 16:05:29 KST. 해시 범위는 `pilot-3d`, `product/tests`, `scripts/qa`의263파일이며 전체 회귀 종료 뒤 다시 동일성을 확인했다. 장시간 실행은 v11/v12 비교 전환24회를 포함한다. 실제2시간은 수치 테스트의 계산 시간과 합산하지 않는다.

검수/전달된 개인별 하루 번들 SHA-256: `5080c2ac07b03d333d943f6a3759a18ba5c5905594f0a5920f16f50f809b5791`. 준비 빌드의 GLB도 검수 서버에서 사용한 원본과 바이트가 같고105클립·8,768,140bytes를 유지한다.

## 캐릭터별 전문 검수와 시각 근거
- [나라·소라](precision-nara-sora-qa.md): 역할3변주·휴식/회의/문서·중단·실제 밑창/손 접촉.
- [준·민](precision-jun-min-qa.md): 보행/회전·필기·컵·준 안경의 실제 얼굴/테/검지·업무 선점.
- [레오·다인](precision-leo-team-qa.md):2~5인 착석/서서 회의·전원 발언/필기·문서 양방향·회수.
- 실제 GLB 역할/컵/소파15장과 근접 업무/보행/착석40장·연속영상을3담당이 직접 검토했다. [근접 촬영](../product/evidence/motion-precision/continuity/continuity.json), [영상](../product/evidence/motion-precision/continuity/five-person-motion.webm).

## 검수 입력과 이전 실패 기록
Chrome의 eligibility 확인과 native 클릭 사이에 실제 미세동작이 시작되면 명령이 정상 거절된다. QA는 클릭·수락을 기록하고 정확한 거절 조건에서만 최대3회 재시도한다. 수락된 동작의 완료 timeout은 재시도하지 않는다. [거절 경계 재현](../product/evidence/motion-precision/browser/input-precondition-attempt/simu-glasses-eligible-boundary.json).

Safari는 포인터 명령 응답만으로 클릭을 가정하지 않는다. DOM 이벤트가 없으면 해당 버튼에 실제 Enter를 보내고 도착을 확인한다. 포인터/키보드 경로는 최종 JSON에 기록했다. 초기 전체274개/장시간4,059초 중단은 성공 집계에서 제외하고 [별도 보존](../product/evidence/motion-precision/interrupted-attempt/status.json)했다.

## 남은 범위와 해석 한계
- 실물 iPhone은 offline이며 사용자 확인에 따라 미완료다. 데스크톱Safari/화면 크기 검사를 실물 터치·발열·배터리 검사로 대신 표시하지 않는다.
- 기존 절차형 관절 리그를 보강했으며 새 전신 모델/모션 캡처로 교체하지 않았다. 수치 접촉·표본 이미지 통과는 전체 피부 폴리곤 비관통이나 모든 프레임의 주관적 자연스러움 증명이 아니다. 가구 가림도 담당 보고서에 기록했다.
- 현재 자산은 InstancedMesh morph texture를 쓰지 않는다. 이 미래 자산의 GPU epoch 콜백 정리는 이번 범위 밖이며 CPU morph 데이터 보존만 단위 검사했다.
- 2시간 중 CPU회귀를 함께 수행했다. p95는 단독 성능/실물 모바일 벤치마크가 아니다. Chrome named GPU allocator 자료와 JS heap을 물리VRAM 총량으로 해석하지 않는다.

## 재실행
```sh
npm run qa:motion:precision
npm test
npm run typecheck
npm run check:boundaries
STUDIO_QA_PORT=4193 npm run qa:server
```
브라우저/렌더러 검사는 `STUDIO_QA_ORIGIN=http://127.0.0.1:4193`으로 `personal-inspection-browser.mjs`, `renderer-lifecycle.mjs`, `personal-safari.mjs`를 실행한다. Safari 설정은 검수 동안만 허용하고 반드시 원복한다. 2시간은 새 출력 폴더를 지정해 `STUDIO_QA_OUT=/private/tmp/studio-soak-recheck node scripts/qa/personal-final-soak.mjs`로 실행하며7,200초 미만은 허용하지 않는다. QA서버는 사용자DB를 열지 않는다.
