# 확정 이미지 기반 넓은 사무실 · 공간 v7 / 활동 v9

기준: `ea13047`, 로컬 구현. 사용자 첨부 이미지 `design/office-final-concepts/20261022/approved-reference.png`에 맞춰 크림·밝은 오크·세이지 색상과 창가 5개 작업 자리, 왼쪽 회의/오른쪽 라운지·커피 바를 제작했다. 이미지를 평면 배경으로 쓰지 않고 회전 가능한 실제 Three.js/GLB로 구현했다.

## 구현 범위

- 13.2×10.2m. 이전 v6(9.6×7.6m)보다 바닥 면적 약 1.85배. 창가 쪽 의자에서 +Z를 바라보며 기본 구도에는 모니터 뒷면이 보인다.
- 기존 다섯 캐릭터의 정체성·리그·105개 클립을 유지한다. 새로운 현대식 작업 의자/데스크톱 모니터·수납·소파·타원 회의 테이블과 6개 회의 의자, 바닥/패브릭/목재 표면·정적 가구 AO·확장된 그림자 범위를 제공한다.
- 모델 메타데이터의 목적지/의자/팔걸이/타원 테이블/컵 위치를 읽는다. 25개 목적지, 20방향 방문/전달을 새 가구의 장애물 검사에 연결한다.
- 공통 동작 x1/x1.5/x2/x3. 단일 시각 시계를 1/60초 하위 단계로 진행하며 원시 프레임 지연은 60ms로 제한한다. 이동·보행·포즈·컵·문서·예약이 같은 시각 시계를 쓴다.
- 카메라·UI·API·presence·인증/게스트 만료·Fake AI/DB 시간은 배속에 영향을 받지 않는다. 저장은 브라우저의 시각 설정 한 개뿐이다. 정지/OS 동작 줄이기/숨김은 시간 누적 없이 멈춘다.
- 새 공간/동작 쌍의 실패는 공간 v6/활동 v8로 복구하고 이전 복구 계층으로 내려간다. 공간이 다르면 카메라를 실제 bounds에 다시 맞춘다.

## 검증 기록

| 검증 | 결과/근거 |
|---|---|
| 신규 GLB 재로드 | 5명 바인딩·105클립·표면/화면 맵·AO 계약 통과. 7,735,284 bytes(약 7.4MiB), 381,192 원본 삼각형 |
| 목적지·방문 | 25개 경로와 20개 방향 접근/방문 경로 검사 통과 |
| 실제 소품·복귀 | 5명 역할 소품·창가·소파·회의 지지·업무 중단/복귀, 4개 배속 설정 회귀 통과 |
| 실제 문서 인계 | 20방향의 소유권/손 접촉·완전 회수/예약 해제 통과 |
| 배속 수학 | 30/60/120fps×4배속, 정지·큰 delta·설정 변경·저장소 접근 실패 통과 |
| 브라우저 배속 | 실측 1.000/1.500/2.000/3.000배. [측정 JSON](../product/evidence/final-activities/browser-controls.json) |
| 브라우저 조작 | 정지·OS 동작 줄이기 우선·새로고침 저장·v8 비교·기본 복구·WebGL 복구·단일 canvas 통과 |
| 제품 반응형 | 320/360/375/390/414/768/1024/1440px, 키보드·OS 설정 통과. [근거](../product/evidence/final-activities/assets-layout.json) |
| 전체 회귀 | 264개 통과. [전체 TAP](../product/evidence/final-activities/full-regression.tap) |
| 최종 공간 회귀 | 최종 파일 10개 모두 통과(시드 혼합·새 업무 시나리오·창가 복귀 후 작성 포함). [공간 TAP](../product/evidence/final-activities/final-unit-tests.tap) |
| 배속·시드 혼합 | seed 17/29 × 4배속의 8개 시나리오. 동일한 실제 시간 업무 도착 5회씩, 충돌/소품 단일 소유권·완전 복귀 통과. [시드 TAP](../product/evidence/final-activities/seeded-speed-tests.tap) |
| 형상/경로 실측 | 25개 목적지 + 20방향 전체 구간, 가구 바닥 경계·컵 바닥 2mm 지지 간격·창가 실제 좌표 통과. [형상 JSON](../product/evidence/final-activities/geometry-contract.json) |
| 오프라인 실행 | 별도 폴더의 잠금 의존성 오프라인 설치·전체 재빌드가 후보 JS/GLB와 일치했다. 17개 경로·비공개 경로 차단·5개 브라우저 협업/승인/저장/댓글/수정 비교/인계·취소/재시도·알림/권한 철회·DB 복원/쿠키 유지 통과, JS 오류 0. [원본 JSON](../product/evidence/final-activities/compiled-smoke.json) |
| 실제 10분 연속 | 최종 소스 x1: 측정 601초·활성 599초, 5명 역할/소파 대화·완전 복귀·소품/예약 회수 통과. JS 오류 0, 소스/3D 지문 동일. [원본 JSON](../product/evidence/final-activities/actual-continuous.json) |
| 실제 30분 혼합 | 최종 소스 x1, 240초 주기/작성 190초 × 5명. 측정 1801초·활성 1799초. 전원 작성/완료·역할 3변주·소파/창가/컵/회의/휴식·문서 전달 참여, 완료 인계 6회, 2명 통행과 전원 복귀/예약·소품 회수 통과. 오류 0, 소스/3D 지문 동일. [원본 JSON](../product/evidence/final-activities/actual-mixed.json) |
| 렌더링 성능 | 동일 1280×900/DPR1/균형/낮/전체 공간, 각각 30초×3회. 신규 p95 중앙값 16.7ms(회차 16.7~16.8ms), 기존 16.7ms. 신규 1,026 calls·743,846 렌더 삼각형·textures 45. 모든 예산 통과. [원본 JSON](../product/evidence/final-activities/performance.json) |
| 제품 수명주기 단기 | 3공간/4회 전환·로그아웃과 단일 canvas/오류 0 통과. 60분 이상 또는 장기 메모리 인증을 의미하지 않는다. [원본 JSON](../product/evidence/final-activities/lifecycle-smoke.json) |

성능 환경은 Chrome 155.0.8059.85이며, 두 개의 x1 실시간 검사 브라우저가 동시에 실행 중이었다. 렌더 삼각형은 원본 GLB의 삼각형 개수와 구별한다. runner의 전체 경과에는 결과 확인/안전 복귀 대기가 포함되므로 실제 판정은 report.elapsedSeconds와 activeSeconds를 사용한다.

## 발견하여 수정한 문제

1. 레오의 오른쪽 통로가 수납장에 막힘: 수납장의 깊이/위치와 실제 충돌 메타데이터를 함께 수정했다.
2. 컵 드롭이 빈 가구 필드를 읽어 원점으로 잡힘: 슬롯별 실제 위치를 사용하고 팔 도달 범위·타원 테이블 안쪽 지지를 함께 검사했다.
3. 새 공간의 소파 팔걸이/회의 테이블에 구 좌표를 쓰는 문제: 의미 기준점과 실제 표면 raycast로 연결했다.
4. 비교 화면의 하위 복구에서 활동 v7을 건너뛰던 문제: v8→v7→v6 이하 순서를 복원했다.
5. 소파 확대에서 직교 카메라의 중심이 실내에 있어도 오른쪽 벽이 준을 가리는 경우를 재현했다. 시선 방향으로 벽과 부착 그림/등을 함께 숨겨 두 인물이 보이도록 수정했다.
6. 창가 진단 좌표에 남아 있던 이전 공간 값을 새 메타데이터와 맞췄다.
7. 모션 축소를 수동 재생 뒤 변경해도 적용되도록 우선순위를 명시했다. 측정은 이전 paused 샘플을 재사용하지 않고 새 시각의 진단을 기다린다.

검수 도구의 수정도 구별해 기록했다. 검색 첫 결과가 최신 수정본일 수 있어 원본 업무 제목을 정확히 선택하도록 고쳤다. 실행 응답에는 prompt가 없으므로 입력 문자열을 기준으로 선택하며, 잘못 지정한 QA 프로필 환경변수를 정정했다. 이 중단 기록은 `runner-repair/`에 보존하고 합격 근거로 사용하지 않는다.

첫 30분 시나리오의 미달은 `before-long-workload/`에 원본 JSON/상태/실패를 보존했다. 별도 고정 단계 시뮬레이션에서는 기존 65초 업무도 레오의 타이핑에 도달했으므로 특정 이동 결함을 확정하지 않았다. 긴 복귀가 가능한 장기 업무 검수와 복귀 전에 끝나는 짧은 업무의 API 검수를 분리했다. 새 검수의 경계/5명 순서와 창가 복귀 후 실제 작성 회귀가 통과했다. 별도 1,800초 고정 단계 시뮬레이션에서도 기존 합격 조건과 전원 복귀가 통과했다. 이 근거는 실제 시간 브라우저 검사와 구별한다. [시뮬레이션 JSON](../product/evidence/final-activities/simulated-long-workload.json).

## 명시적인 범위와 남은 검수

- 가구는 회의 의자 6개이며 회의 동작은 검증된 2인 진행기다. 동시 이동 상한도 2명이다. 3명 동시 통행·5인 회의 진행기는 [별도 7번 후속 계획](../dev-plan/implement_20261021_213222.md)이다.
- 팔/몸 진단은 보수적인 capsule/AABB 겹침 후보이며 실제 피부의 물리 충돌 보장은 아니다.
- 실물 iPhone XS Max는 사용자 응답에 따라 접속 불가로 미완료다. 발열·VRAM과 신규 공간의 장시간 제품 수명주기는 별도로 남긴다. 데스크톱 viewport 검수나 이전 v8의 장시간 결과로 대신 합격 처리하지 않는다.
- 외부 DB·실제 AI·원격 배포·유료 서비스·git 커밋/푸시는 이번 작업에 포함하지 않는다.

## 로컬 미리보기 적용

실제 사용자 DB 서버를 정상 종료한 뒤 비공개 PGlite 백업을 보존하고 검증된 release로 재시작했다. 초기 미리보기 코드 후보는 `1792630649388-94deb058-38e0-486f-a1fd-1bcd68e1c1b6`이며 17개 공개 경로·3개 비공개 차단·응답 자산 지문을 확인했다. CUA에서 공간 v7/활동 v9/x1/정지 해제와 시간이 진행하는 것을 확인했다. 실제 10분/30분 재검수가 모두 완료됐다. 30분의 runner 전체 1890.73초에는 약 90초의 정상 귀환/확인 대기가 포함되며 판정 대상은 1801초다. 최종 문서 release는 이 후보와 실행 JS·서버·GLB가 같은지 비교한 뒤 원자적으로 게시한다.

- [로컬 웹](http://127.0.0.1:4180/demos/activities/final/?play=1), [실제 미리보기](../product/evidence/final-activities/published-preview.png), [응답 검증](../product/evidence/final-activities/published-preview.json)
- QA 업무 시나리오 변경 전후의 런타임 지문 차이는 검수 UI/시나리오 2개 파일뿐이다. [차이 범위](../product/evidence/final-activities/workload-source-diff.json). 3D 자산과 실제 이동·접촉·렌더링 코드는 동일하다.

## 시각 근거

- [선택 이미지](../design/office-final-concepts/20261022/approved-reference.png), [새 공간 전체](../product/evidence/final-activities/working-preview.png), [기존 v8](../product/evidence/final-activities/baseline-browser.png)
- [회의의 컵/손 지지](../product/evidence/final-activities/meeting-contact-browser.png)
- [소파 확대 가림 전](../product/evidence/final-activities/sofa-before-wall-fix.png), [벽/장식 가림 보정 후](../product/evidence/final-activities/sofa-final-browser.png)

공간 크기와 기본 관찰 방향이 달라 비교 전환은 선택 동료·화질·배속·정지 설정을 유지하되 실제 공간 bounds로 구도를 다시 맞춘다. 고정 시점의 픽셀 동일 비교를 의미하지 않는다. 원본 v6 GLB의 SHA-256은 `7d6addce4b58447bdc8d45c4c725fefb26df4986a96759e14c75cb1bb7dd1aab`로 소스/후보 빌드가 동일했다.

최종 v7 GLB: `bc7058b568dd333caeb933d77824a835853834c5abd1902090a93c562d13dd89`, 원본 렌더 메시 533개·삼각형 381,192개. 렌더링 호출/삼각형은 그림자·포털·동작의 실제 비용을 따로 측정한다.
