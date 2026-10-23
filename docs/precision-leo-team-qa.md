# 레오·다인 상호작용 정밀 QA

작성: 2026-10-23 KST. [실행 계획](../dev-plan/implement_20261023_131542.md)에 따른 담당 검수다. 제품 소스·사용자 DB·4180 서버·빌드는 이 담당 작업에서 변경하지 않는다.

## 범위와 통과 기준

전용 검사는 `product/tests/precision-leo-team.test.mjs`, 실행·측정 함수는 `scripts/qa/precision-leo-team.mjs`다. `node --import tsx --test --test-concurrency=1 product/tests/precision-leo-team.test.mjs`로 재실행한다. 수치 결과는 `product/evidence/motion-precision/leo-team/numeric-qa.json`에 기록한다.

| 검사 | 성공 경로의 필수 관측 |
|---|---|
| 레오 문서 3종 | observe/act/pause/check 실제 진입, 3개 변주 각각 완료 수 증가, 한 장의 문서 부모·소유권, 집기/놓기 정확히 2회, 원위치 회수 |
| 레오 소파·창가 | 기립·출발·정렬·휴식·복귀·책상 착석 단계 실제 진입, 보행 관측, 완료 수 증가, 발 목표 오차·고정 뼈 길이·골반 전환, 실제 Sole 정점의 관통/접지 부유 상한 3mm |
| 레오 휴식 3종 | back_open/shoulder_drop/side_stretch 각각 실제 팔 이동 관측·완료, 예약/소품 원복 |
| 레오 컵·커피 | reach→grasp→lift→sip→lower→place→release→idle, 커피 각 단계·실제 왕복 보행·정상 complete, 컵 수평·연속성·비어 있는 반대손 |
| 2~5인 착석 회의 | 모든 인원수에 레오 포함, 왕복 보행과 발언 참가자 집합 정확히 일치, 3~5인 전원 실제 필기 use·펜 부모·메모 완료, 전 과정 컵 책상 고정·전원 planted 발 실제 Sole 지지면 간격 -0.1~3mm |
| 2~5인 서서 회의 | 전원 도착 전 발언 금지, 모든 참가자 실제 발언·정상 complete, 레오 포함·전원 복귀 |
| 레오 문서 인계 | 방문자/수신자 양쪽 역할, 10단계 모두 실제 진입·양쪽 손 소유권·인계 완료 |
| 업무·제거·취소 | 집결/발언/필기 × 실제 업무/레오 제거/수동 취소 9조건. 정상 성공 검사와 분리하여 cancelled 및 예약·펜·컵·문서 회수를 확인 |
| 레오 소품 업무 선점 | 컵 7단계·커피 8단계 각각 실제 업무 도착으로 중단하고, 자리/컵·역할 소품을 안전하게 회수 |
| 잘못된 참가자 | 중복/알 수 없는 인물/1명/6명은 부분 예약이나 부분 세션 생성 없이 거절 |

시작 호출이 성공해도 종료 조건이 처음부터 참이면 완료 검수로 인정하지 않는다. 정상 성공 검사는 `cancelAll()`로 끝내지 않으며, 완료 이력·완료 카운트와 실제 발언/필기 집합을 함께 검사한다. 회의 인원수에 따라 `slice(0,n)`만 사용해 레오가 빠지는 공백을 방지한다.

## 측정의 의미와 한계

- `living-fixture`는 실제 런타임과 로컬 생성 모델을 사용한다. 발 위치는 최종 렌더 노드의 월드 좌표를 저작된 목표와 비교하고, 다리/팔 관절 길이·행렬 유한성을 확인한다.
- 손가락 목표 오차와 별도로 레오 문서의 3변주×4구간, 음용과 커피 왕복에서 최종 GripPad 좌표와 실제 문서/컵 손잡이 메시 삼각형 사이의 거리를 측정한다. 이는 부호 없는 기준점-표면 간격이며 손가락 피부 메시 관통·가림·표정·시각적 자연스러움을 보증하지 않는다. 부동소수점 수준의 솔버 오차를 실제 물리 정밀도로 해석하지 않는다.
- Sole은 최종 메시의 모든 고유 정점과 실제 RoomFloor/러그 메시를 비교한다. WorkWoolRug도 실제 존재하면 포함한다(v9 fixture에서는 없음). 제품 TerrainContact를 재사용하지 않으며, 실제 수평 삼각형 내부의 직접 높이 조회와 곡면 경계의 Three.js raycast를 사용한다. ankle 높이는 heel/toe 보정이 포함되어 고정 85mm를 빼 지면으로 오인하지 않는다. 어느 정점도 실제 지형 아래로 0.1mm 이상 들어가지 않고, planted 발 전체의 최소 유효 접촉 간격은 3mm 이내여야 한다. 이는 모든 신체·가구 메시의 물리 충돌 해석이 아니다.
- 테이블 지지는 구현의 팔 도달 오차·palmGap을 측정한다. 물리 충돌 해석 또는 천/신체 변형 검수가 아니다.
- `violations`는 현재 몸/통로 정책의 위반 목록이다. 몸 전체 메시 간 충돌 검사를 완료했다는 뜻이 아니다.
- 절차적 시간으로 전 경로를 검수하며 실제 벽시계 2시간·브라우저 성능·실물 기기·내보낸 GLB의 시각 품질은 통합 최종 검수에서 별도 확인한다.

## 실행 상태

- 선검토: 기존 개인/팀 검사와 런타임을 대조했다.
- 초기 실행: 8개 중 5개 통과. 나머지 3개는 검사 자체의 잘못된 가정으로 분류했다(실제 필드 `page`, 이미 도착 상태인 초기 predicate, 정상 컵 경로에 없는 `retract` 요구). 제품 결함으로 집계하지 않으며 원래 로그를 보존한다.
- 두 번째 실행: 정상 성공 8개 통과. 업무 종료 후 이미 시작된 역할 소품 회수를 한 프레임 만에 끝내도록 요구한 검사 자체 오류 1개를 교정했다. 제품의 안전한 정리 시간을 기다리며, 빈 predicate로 정상 경로를 통과시키지 않는다.
- 기준 10개 실행: **10개 통과·실패/취소/건너뜀 0**, 442,845ms. [로그](../product/evidence/motion-precision/leo-team/baseline-complete.tap), [상세 수치](../product/evidence/motion-precision/leo-team/baseline-complete.json). P2 최종 구현 이전 기준이며 확정 소스 전체 검수와 구분한다.
- 이후 발바닥 실제 정점, 노트의 실제 메시/연필 끝·보이는 strokes, 참가자별 발언 손 이동을 더한 4개 강화 검사는 모두 통과했다. 다만 실행 중 제품 소스가 바뀌어 sourceStable=false이며 최종 확정 검수로 취급하지 않는다. 다른 담당의 소라 발 부유 재현에 따른 v12 YXZ 보정 후, 레오/다인 planted 발의 실제 Sole 지지면 간격 상한 3mm를 추가했다.
- 지형 보정 후 2차 병렬 실행의 레오 담당은 **10개 통과·실패 0**, 합산 427,069ms였다(14:08:29 KST). [담당 결과 보존본](../product/evidence/motion-precision/leo-team/second-parallel-cli-10-pass.json), [당시 통합 요약](../product/evidence/motion-precision/leo-team/second-parallel-run-summary.json). 당시 다른 담당의 선택적 러그 가정 오류와 `scripts/qa/precision-continuity.mjs` 카메라 변경으로 통합은 `passed=false`, `sourceUnchanged=false`였다. 보존된 SHA와 현재 제품/담당 테스트·CLI의 SHA는 같지만, 이를 전체 확정 소스 통과로 표현하지 않는다. 선택적 러그/근접 카메라를 수정한 뒤 모든 코드를 다시 고정한 최종 병렬 실행을 아래처럼 별도 진행했다.
- **최종 확정 실행 완료:** 14:09:57~14:17:38 KST, 레오 담당 **10/10 통과**, 실패·취소·건너뜀 0. 담당 CLI 벽시계 449.305초이며 개별 케이스 시간 합계 448,918ms다. [최종 담당 수치 보존본](../product/evidence/motion-precision/leo-team/final-cli-numeric-qa.json), [최종 병렬 통합 요약](../product/evidence/motion-precision/leo-team/final-parallel-run-summary.json), [전체 로그](../product/evidence/motion-precision/integration/parallel-fixed.log). 세 담당 12+8+10개 모두 통과했고 제품·테스트·QA 코드 **255개 파일의 실행 전후 SHA가 일치**하여 `passed=true`, `sourceUnchanged=true`다. 이는 결정적 메모리 내 정밀 동작 게이트의 통과이며, 전체 `npm test`·실제 벽시계 2시간·실물 기기 성능 게이트의 완료를 대신하지 않는다.

### 기준 실행의 실제 관측

| 관측 | 결과와 해석 |
|---|---|
| 레오 문서 | 변주마다 실제 5패드 접촉 163표본, 4개 레시피 구간 모두 관측. 기준점-실제 문서 표면 간격 최대 약 1.001mm |
| 레오 컵 | 음용 229접촉표본, 커피 보행 왕복 각각 255접촉표본. 기준점-실제 손잡이 표면 간격 약 0.38~1.66mm |
| 레오 운반 | 컵 위쪽 축 y=1, 30Hz 연속 운반 프레임 이동 최대 약 5.50cm. 실제 카메라에서의 잔떨림·시각 자연스러움과 별도 |
| 레오 전환 | 소파·창가 왕복의 프레임간 골반 이동 최대 약 3.25cm. 발 목표/뼈 길이 검사 통과 |
| 5인 중단 정리 | 발언·필기 중 중단에서 전원 복귀/소품 정리에 약 112.2시각초, 업무 역할 소품 회수까지 포함한 관측 최대 114.43시각초. 서버 업무 시간이나 실제 대기 시간 측정이 아니다. 기아/잔류는 없으나 업무 담당자 체감 복귀는 후속 UX 관측 대상으로 남긴다 |

기준 실행에서는 제품 결함을 보고하지 않았으나, 이후 실제 러그 메시 경계 검사에서 아래 결함을 확인했다. 발견·교정·최종 수치 재검수와 브라우저 표본 관찰을 각각 구분해 남긴다.

## 최종 1차 검수: 러그 경계 발견

[읽기 전용 경계 프로브](../product/evidence/motion-precision/leo-team/rug-boundary-probe.json)는 최저점뿐 아니라 실제 Sole 전체 900개 정점을 실제 바닥/러그 메시와 대조했다. 제품 코드·테스트는 최종 동결 중 변경하지 않았다.

- **확정 제품 결함:** `[leo,nara]` 2인 착석 회의에서 나라의 출발 15.500시각초, 오른발 heel 구간. 실제 Sole 112/900개 정점이 MeetingWovenRug 아래에 들어간다. 최악점 `[-5.2945933, 0.001, 1.7281045]`, 실제 러그 y≈0.019702565로 약 18.70mm 관통한다. ankle 중심 또는 한 supportPoint의 높이만 확인하면 놓치는 러그 경계다. 전체 Sole 형상과 지형 높이를 함께 고려한 보정·원래 경로 재검수가 필요하다.
- **검사 오탐:** 레오의 소파 복귀 62.233시각초에서 최저 Sole 정점만 보면 바닥과 약 21mm 떠 있지만, 다른 더 높은 정점이 WovenRug에 약 1.48mm로 접촉하고 침투 정점은 0개다. 발 전체를 고려하지 않은 최저점 기준을 고쳐야 한다. 허용치를 늘려 통과시키지 않는다.
- **검사 수정 방향:** 실제 Sole의 어떤 정점도 실제 지형 아래로 -0.1mm 이상 들어가지 않고, 발 전체에서 최소 유효 접촉 간격이 3mm 이내인지 각각 확인한다. 실제 평면 삼각형을 선계산하고 곡면 경계는 raycast해 검사 비용을 제한할 수 있다. 나라의 기존 18.7mm 재현은 수정한 검사에서도 실패해야 한다.

최종 1차 병렬 게이트는 위 발견으로 실패했으며, 원래 결과를 [실패 JSON](../product/evidence/motion-precision/leo-team/first-frozen-failed.json)과 [로그](../product/evidence/motion-precision/leo-team/first-frozen-failed.log)에 보존했다.

Root가 실제 지형 삼각형과 전체 Sole 형상을 고려하는 TerrainContact를 적용하고, QA는 발 전체의 접촉/침투를 분리하도록 교정했다. [같은 경로 재검수](../product/evidence/motion-precision/leo-team/terrain-fast-recheck.json)에서 **레오 소파·창가 전체 왕복과 2~5인 착석 회의 두 케이스 모두 통과**했다(각 11.7초/38.7초). 실제 지형 간격 약 0.999995~1.000002mm, 5인 회의 각 인물 planted 8천 이상 표본을 관측했다. 기존 나라 관통은 해소됐으며, 3~5인 실제 필기 표면 관측도 각 인물 56표본씩 통과했다. 이는 같은 경로의 영향 재검수이며 최종 10개 전체 통과로 합산하지 않는다.

위 결함 수정 후 최종 3병렬 확정 소스 재실행에서 레오 담당 10개와 타 담당 20개가 모두 통과했다. 러그 경계 관통은 최종 전체 경로에서 재현되지 않았다. 최종4193 브라우저 근접 화면은 아래 관찰 범위로 연결하며, 수치 검사만으로 시각 검수를 완료 처리하지 않는다.

## 실제 GLB 정지 화면 검토

루트가 4193의 실제 내보낸 GLB로 캡처한 [레오 역할](../product/evidence/motion-precision/visual/leo-role.png), [컵 운반](../product/evidence/motion-precision/visual/leo-carry.png), [소파](../product/evidence/motion-precision/visual/leo-sofa.png)를 직접 확인했다. [렌더 상태 기록](../product/evidence/motion-precision/visual/rendered.json)의 각각 `role_leo/use`, `walk/out/carry`, `sofa_rest`와 대조했다.

- 컵 운반의 한 컷에서는 손잡이 방향·손목 높이·컵 수평과 몸 앞 공간이 자연스럽게 연결되며 뚜렷한 컵 부유/팔 관통을 보지 못했다. 사진에서 모든 손가락의 피부 접촉이나 시간에 따른 잔떨림까지 확정하지 않는다.
- 소파의 좌면/허벅지·팔의 휴식 배치는 확인할 수 있으며 뚜렷한 관통은 보지 못했다. 앞쪽 식물/테이블에 발 일부가 가려져 발 접지는 수치/지형 검사와 분리한다.
- 역할 컷은 초기 `use`이고 모니터가 손을 가린다. 이 한 컷으로 문서 3변주의 세부 손가락 접촉을 시각 완료 처리하지 않는다. 전체 3변주/4구간의 소유권·실제 메시 간격은 전용 수치 검사에 따른다.
- 선택적 연출 제안: 소파 구도에서 뒤편 녹색 의자가 뒷목 가까이 겹쳐 보이는 tangent가 있다. 카메라 각도/가림 보완으로 개선할 수 있다. 실제 의자가 캐릭터를 따라간다는 결함으로 단정하지 않는다.

이 검토는 정지 3장에 대한 직접 시각 관찰이다. 동영상의 보행 주기·정지/가속·전체 5인 시간 동기, 실물 기기의 성능 검수를 대신하지 않는다.

### 연속 촬영의 최초 와이드 표본

4193에서 추가한 레오 작업 3장·x1 전환/보행 4장·소파 1장을 직접 확인하고 `continuity.json` 상태와 대조했다. 작업은 `act→check→observe`, 이동은 `pivot` 두 표본 뒤 `cruise` 두 표본이며 서로 다른 발 지지/스윙 상태를 기록한다. 머리·몸통의 뚜렷한 위치 도약은 보지 못했다. 새 소파 구도에서 녹색 작업 의자는 별도 자리에 보여 앞선 뒷목 겹침을 실제 소품 귀속 결함으로 판단할 근거는 없다.

단, 최초 와이드 카메라는 레오가 작고 책상·소파가 발/손을 가린다. 이 8장만으로 문서 변주·발 미끄럼·세부 접촉을 시각 통과시키지 않는다. 근접 구도로 갱신할 캡처와 별도로 구분한다. 연속 영상 파일이 생성되었다는 사실과, 이 담당이 직접 확인한 정지 표본의 관찰 범위도 구분한다.

### 최종 근접 표본 재검토

근접 focus/frustum과 오른쪽 시점으로 갱신한 [작업 0](../product/evidence/motion-precision/continuity/leo-work-0.png)·[1](../product/evidence/motion-precision/continuity/leo-work-1.png)·[2](../product/evidence/motion-precision/continuity/leo-work-2.png), [전환/보행 0](../product/evidence/motion-precision/continuity/leo-walk-0.png)·[1](../product/evidence/motion-precision/continuity/leo-walk-1.png)·[2](../product/evidence/motion-precision/continuity/leo-walk-2.png)·[3](../product/evidence/motion-precision/continuity/leo-walk-3.png), [소파](../product/evidence/motion-precision/continuity/leo-seated.png)를 직접 다시 확인했다. 위 최초 와이드 관찰의 가림 한계를 최종 근접 확인과 혼동하지 않는다.

- 업무 3표본에서 팔·문서 끝 높이와 머리/손목의 미세 변화가 보인다. 보이는 손에서 뚜렷한 문서 이탈이나 팔-몸 관통은 보지 못했다. 모니터가 반대손과 문서 상당 부분을 가리므로 모든 손가락 접촉·3변주 전체의 시각 보증은 아니다.
- 전환/보행 0·1은 전신 방향 전환과 무릎/발의 지지 차이가 보인다. 2·3도 이동을 확인하지만 파티션이 하체 일부를 가린다. 노출된 발에서 큰 부유/관통은 보지 못했으며, 밀리미터 접지 판정은 실제 Sole/지형 수치 검사에 따른다.
- 소파는 허벅지-좌면·몸통·양손의 휴식 배치가 안정적이고 뚜렷한 관통은 보지 못했다. 테이블이 발 일부를 가린다. 작업 의자가 캐릭터에 붙어 이동한다는 증거는 없다.

[상태 기록](../product/evidence/motion-precision/continuity/continuity.json)과 [연속 영상](../product/evidence/motion-precision/continuity/five-person-motion.webm)은 루트 통합 근거다. 이 담당의 직접 시각 판정은 근접 정지 8표본에 한정하며 영상 전체의 연속 재생/프레임별 심사를 했다고 표현하지 않는다.
