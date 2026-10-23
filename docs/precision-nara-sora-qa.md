# 나라·소라 캐릭터 정밀 QA

검수 범위: 2026-10-23의 활동 v12. 사용자 DB·4180 서버·제품 빌드·제품 코드는 이 담당 검사에서 변경하지 않았다.

## 최종 담당 결과

2026-10-23 **14:09:58~14:17:38 KST**, 최종 고정 소스의 실제 표면 기준으로 **12/12 통과·실패/건너뜀 0·exit 0**. 담당 104개 소스 지문은 실행 전후 동일하다(`sourceUnchanged=true`). 실행은 약 460초이며, 30Hz 인메모리 시뮬레이션의 결과다. 실제 2시간 브라우저 검수와 합산하지 않는다.

| 최종 측정 | 나라 | 소라 |
| --- | ---: | ---: |
| 세부 측정 구간 | 48개 | 48개 |
| 캐릭터 측정 프레임 | 59,260 | 59,657 |
| planted 발 측정 | 61,655회 | 63,896회 |
| 모든 sole 정점의 실제 표면 signed gap 최저 | 0.9999955mm | 0.9999955mm |
| planted 발의 실제 표면 최소 gap 중 최댓값 | 1.000000224mm | 1.000000224mm |
| 팔·다리 고정 길이 최대 편차 | 1.00×10⁻¹⁵m 미만 | 1.00×10⁻¹⁵m 미만 |
| 손가락 링크 길이 최대 편차 | 2.08×10⁻⁹m 미만 | 2.08×10⁻⁹m 미만 |
| 실제 pad→펜 삼각면 최대 거리 | 1.347mm | 1.347mm |
| 실제 pad→컵 삼각면 최대 거리 | 1.658mm | 1.658mm |
| 실제 pad→전달 문서 삼각면 최대 거리 | 1.448mm | 2.062mm |

실제로 존재하고 측정에 사용한 지면은 `RoomFloor`, `WovenRug`, `MeetingWovenRug`다. 현재 생성 모델에는 `WorkWoolRug`가 없으며, 검사는 해당 메시가 포함되는 모델에서도 자동으로 포함하도록 되어 있다. 모든 정점의 관통, planted 발의 접촉 간격, 안전 복귀/소품 회수/예약 해제와 단계·변주 검사를 통과했다.

이 표는 나라·소라 담당 범위다. 같은 최종 병렬 실행의 [전체 통합 요약](../product/evidence/motion-precision/integration/precision-run-summary.json)도 **나라·소라 12개 + 준·민 8개 + 레오·팀 10개 전부 통과**이고, 전역 255개 파일 지문이 실행 전후 동일하다. 통합 시간은 14:09:57~14:17:38 KST다. 실제 2시간 브라우저 검수·전체 제품 테스트는 별도 루트 검수 항목이며, 이 결과만으로 완료를 주장하지 않는다.

## 검사 방법

`product/tests/living-fixture.mjs`의 인메모리 실제 모델과 런타임을 사용하며 30Hz로 전진한다. 모델을 다시 만든 가짜 관절이나 제품 솔버의 복제 구현으로 기대값을 만들지 않는다.

- 팔의 상완·전완은 최초 모델의 길이를 기준으로 최종 세계 좌표의 길이를 재측정한다. 다리는 실제 hip/knee/foot의 0.37m·0.405m 길이를 검사한다. 허용 편차는 0.002mm이다.
- 10개 손가락 링크 인스턴스의 행렬에서 각 양 끝을 복원한다. 고정 길이·이웃 링크 접합·실제 pad 끝의 연결 오차를 0.0001mm 이내로 검사한다.
- 발바닥 메시의 모든 정점을 세계 좌표로 변환하고, 각 정점 아래의 **실제 존재하는 바닥·러그 삼각형**과 signed gap을 측정한다. 어느 정점도 0.1mm를 넘어 관통하면 안 되며, `planted=true`인 발의 전체 정점 중 최소 gap은 3mm 미만이어야 한다. 러그 경계에 걸친 발을 세계 최저점만으로 판정하지 않는다. 경로가 지정한 발 목표/최종 발 위치의 편차도 별도로 검사한다.
- 정적 삼각형의 X/Z 공간 색인을 사용해 검사 계산량을 줄였으며, 각 표면의 9개 지점에서 이 독립 기하 oracle과 Three의 실제 Raycaster 높이가 0.001mm 이내로 일치하는지 먼저 확인한다. `RoomFloor`, `WovenRug`, `MeetingWovenRug`와 존재할 경우 `WorkWoolRug`를 포함한다. 존재/실제 사용 표면은 측정 파일에 기록하고, 소스 파일에 이름이 있다는 이유만으로 현재 모델에 있다고 가정하지 않는다.
- 실제 pad의 세계 위치에서 펜·컵·문서 메시의 삼각형 표면까지 거리를 독립 측정한다. 접촉이 완전히 성립한 프레임만 검사하며 실제 표면과 3mm 이내여야 한다. 손가락 목표를 빈 공간으로 이동시켜 얻은 diagnostic 수치만으로 합격시키지 않는다.
- 소파/회의 지지의 도달 오차·palm gap은 기존 측정과 함께 검사한다. 이는 피부 전체의 물리 관통 보장과 구분한다.
- 종료/취소/실제 업무 중단 후 컵·역할 소품·문서의 소유권, 자리 복귀, 공유 예약·지지 해제를 확인한다.

## 시나리오

| 범위 | 나라 | 소라 |
| --- | --- | --- |
| 기립→보행→회전→정지→소파 착석→휴식→기립→업무 자리 복귀 | 3개 변주 | 3개 변주 |
| 창가 이동·휴식·복귀 | 3개 변주 | 3개 변주 |
| 개인별 짧은 휴식 | one_arm/back_open/wrist_release | side_stretch/back_open/shoulder_release |
| 소파 전환 업무 중단 | stand/sit/rest/rise/deskSit | 같은 5단계 |
| 역할 소품 | 노트/펜 3종; observe/act/pause/check | 태블릿/스타일러스 3종; observe/act/pause/check |
| 역할 소품 중단 | reach/grasp/use/replace/release/retract | 같은 6단계 |
| 음용·양손 지지·회수 | 전체 동작 및 7단계 업무 중단 | 같은 범위 |
| 목적 있는 커피 준비 | pickup/out/brew/retrieve/home 및 각 업무 중단 | 같은 범위 |
| 빈손 회의·소파 대화 | 두 자리 순서를 바꿔 발언/경청·지지·복귀 | 같은 범위 |
| 문서 전달 | 방문자/수신자·호스트/송신자 양방향 | 같은 범위 |
| 문서 중단 | 10단계 중 두 인물을 번갈아 실제 업무 투입 | 공동 검사 |

## 실행·근거

```sh
node scripts/qa/precision-nara-sora.mjs
# 담당 테스트만 실행
node --test product/tests/precision-nara-sora.test.mjs
```

- [최종 실행 요약과 소스 지문](../product/evidence/motion-precision/nara-sora/summary.json)
- [단계·측정치](../product/evidence/motion-precision/nara-sora/measurements.json)
- [원시 테스트 결과](../product/evidence/motion-precision/nara-sora/tests.tap)

## 선행 검수 기록

첫 10개 시나리오는 9개 통과·1개 실패였다. 문서 중단 뒤 실제 업무가 시작한 역할 소품이 아직 안전 반환 중인데, 검사 helper가 문서 방문 종료만 기다린 채 소유권을 검사한 **QA 대기 조건 오류**였다. 제품 결함으로 분류하지 않았다. 역할 소품·컵·양손 지지의 반환까지 기다리도록 수정했고, 최초 실행 원시는 [initial/](../product/evidence/motion-precision/nara-sora/initial/)에 보존했다.

첫 실행 동안 제품 동작 소스의 지문은 같았고, QA 코드만 정점 변환 최적화·커버리지 확장으로 바뀌었다. 이 실행을 최종 고정 소스 합격으로 합산하지 않는다. 선행 수치는 다음과 같다.

| 측정 | 나라 | 소라 |
| --- | ---: | ---: |
| 정밀 측정 프레임 | 31,613 | 32,151 |
| 실제 발바닥 최저 높이 | +0.985mm | +0.747mm |
| 팔·다리 고정 길이 최대 편차 | 1.00×10⁻¹⁵m 미만 | 1.00×10⁻¹⁵m 미만 |
| 손가락 링크 길이 최대 편차 | 2.08×10⁻⁹m 미만 | 2.08×10⁻⁹m 미만 |
| 실제 패드→펜 메시 최대 거리 | 1.347mm | 1.347mm |
| 실제 패드→컵 메시 최대 거리 | 1.658mm | 1.658mm |
| 실제 패드→문서 메시 최대 거리 | 1.001mm 미만 | 1.006mm 미만 |

추가 휴식 검사에서는 소라의 기존 휴식→창가 연결 에피소드까지 끝나야 하므로 최초 45초 제한을 300초로 고쳤다. 이 제한 오류도 제품 결함과 구분한다. 반환 조건을 고친 문서 양방향/10단계 중단과 나라 개인 휴식/소파 5단계 중단은 별도 재실행에서 통과했다.

## 발견한 제품 결함 · 발 앞꿈치 회전 접지 · P2

단순히 발이 바닥 아래로 내려가지 않는지만 검사하면 드러나지 않는 **지지 중인 발의 부유**를 발견했다. 소라의 `side_stretch → back_open → shoulder_release` 휴식을 차례로 실행하면 세 번째 휴식이 창가 이동으로 이어진다. `out/cruise/toe`에서 `planted=true`인 왼발의 실제 sole 최저 높이가 바닥 위 **10.082mm**였다. 바닥으로 지정된 `supportPoint.y`는 1mm였다.

- [실패한 실제 발바닥 검사](../product/evidence/motion-precision/nara-sora/rest-followup.tap)
- [3개 휴식 변주의 전체 경로 최대값·해당 발/회전/단계](../product/evidence/motion-precision/nara-sora/foot-probe.json)
- 재현: `node scripts/qa/precision-nara-sora.mjs --foot-repro`.
- `GroundedRoute`는 yaw 후 발의 local pitch 회전을 가정해 앞꿈치/뒤꿈치 높이를 보정하지만, 기존 발 회전 적용은 Euler XYZ였다. 인메모리 가상 YXZ로 바꾸면 해당 프레임의 실제 sole 최저가 3.225mm로 줄었다. 잔여 차이는 실제 둥근 sole의 모서리와 사각 외곽 지지 치수의 차이까지 구분해서 검수해야 한다.
- 루트에 v12 회전 합성·실제 sole 표면 기준 높이 검토를 요청했다. v11 비교 보존, 다리 길이·기존 지지점 보존과 모든 planted 실제 sole 높이의 상한 검사는 유지한다.

루트는 v12에 YXZ 회전 합성과 실제 rounded sole의 Y/Z hull 기반 접지 보정을 적용했다. v11은 기존 XYZ를 사용한다. 별도 `--foot-repro` 재실행에서 소라의 3개 휴식 변주가 모두 보행 기준면 위 약 1mm로 끝났고 정상 복귀했다. [수정 후 발 재현 결과](../product/evidence/motion-precision/nara-sora/foot-rotation-probe.json).

## 고정 소스 1차 병렬 재검수 · 기준 보정 대기

2026-10-23 13:42:29~13:47:21 KST, **12개 중 7개 통과·5개 실패**, 실행 중 담당 지문 변경 없음(`sourceUnchanged=true`). [보존한 원시 결과](../product/evidence/motion-precision/nara-sora/frozen-attempt-1/tests.tap), [지문](../product/evidence/motion-precision/nara-sora/frozen-attempt-1/summary.json), [측정치](../product/evidence/motion-precision/nara-sora/frozen-attempt-1/measurements.json).

- 통과: 두 인물의 역할 3변주·6단계 중단, 컵 7단계 중단, 커피 왕복·5단계 중단, 문서 양방향·10단계 중단.
- 실패: 두 인물의 소파/창가 변주, 두 인물의 소파 전환 중단, 빈손 회의. 모두 `planted` sole가 `y=0` 위 21mm인 프레임에서 상한 검사에 걸렸다.
- 이 5개를 실제 표면 부유로 바로 분류할 수는 없다. 기존 `SofaScheduler.pose()`는 러그 높이를 마지막에 발 목표에 더하며, 러그 높이가 20mm인 영역의 정상 접지도 이 담당의 고정 `y=0` 상한에 걸린다. 보행 기준면과 위치별 실제 메시 표면을 구분하지 않은 **QA 기준 오류**를 확인했다. 루트에 알렸으며 실행 중 제품/테스트를 바꾸지 않았다.
- 통합의 ground mesh/Rug 검사에서 보고한 별도 간격 오류는 이 고정 `y=0` 오류로 덮지 않는다. 실제 `RoomFloor`·소파/회의 러그·`WorkWoolRug`와 발의 접촉 면적을 반영한 재검수가 필요하다.

루트의 첫 통합 실행 종료 확인 후 QA 기준을 실제 표면·전체 sole 정점의 signed gap으로 수정했다. `WorkWoolRug`는 이전 공간 소스에는 있으나 현재 모델에서 없을 수 있으므로 존재 표면만 포함한다. 제품의 경로/러그 높이 계산을 복제해 기대값을 만들지 않는다.

이후 루트가 TerrainContact를 적용해 실제 바닥/러그 삼각형과 둥근 sole의 전체 정점을 기준으로 접지를 보정했다. 해당 고정 제품 소스에서 위의 최종 12개 검사를 다시 실행해 모두 통과했다. 이 1차 실행의 실패 원시는 최종 합격 근거에 섞지 않고 보존한다.

## 실제 GLB 시각 검토

루트가 로컬 `4193`의 실제 공간 v9 GLB·동작 v12에서 캡처한 나라·소라 6개 이미지를 직접 열어 검토했다. [렌더 장면/모델/손 접촉 상태와 브라우저 오류 기록](../product/evidence/motion-precision/visual/rendered.json). 이는 뷰포트 1280×1000·DPR 1의 정지 장면 검토이며 실물 기기 검수가 아니다.

| 인물 | 역할 소품 | 컵 운반 | 소파 착석 |
| --- | --- | --- | --- |
| 나라 | [노트/펜](../product/evidence/motion-precision/visual/nara-role.png): 오른손과 노트가 같은 작업 영역에 있고 팔·몸통 실루엣 연결이 보인다. | [운반](../product/evidence/motion-precision/visual/nara-carry.png): 컵이 손잡이 쪽 손 앞에 있고 수평인 모습이다. 손 아래로 매달린 이전 인상은 보이지 않는다. | [소파](../product/evidence/motion-precision/visual/nara-sofa.png): 골반·허벅지·무릎·종아리 연결과 쿠션 위 착석이 보이며, 손은 무릎 근처에서 편다. |
| 소라 | [태블릿/스타일러스](../product/evidence/motion-precision/visual/sora-role.png): 나라와 구별되는 작업 소품·옷/머리 실루엣이 보이고 오른손은 태블릿 작업면 쪽에 있다. | [운반](../product/evidence/motion-precision/visual/sora-carry.png): 컵의 수평과 손잡이 쪽 손 위치가 보이며 상완/전완의 연결이 유지된다. | [소파](../product/evidence/motion-precision/visual/sora-sofa.png): 허벅지/다리와 소파의 상대 크기·착석 위치가 일관되게 보인다. |

이 6장에서는 추가로 확정할 시각 결함을 발견하지 않았다. 다만 운반 장면은 책상·모니터가 하체를 가리므로 발 접지·보행·회전을 평가하는 근거로 쓰지 않는다. 역할 소품은 `use` 진입 직후를 캡처했으므로 정착한 필기·3개 변주의 실제 움직임 전체를 입증하지 않는다. 소파도 테이블·화분이 발 앞부분을 가린다. 정확한 손가락 접촉·발 간격·상태 전환 연속성의 합격은 수치 검사/통합 검수와 구분한다.

### x1 연속 샘플 추가 검토

초기 6장과 별도로 나라·소라 각각 대표 변주 0의 업무 3시각, 회전·보행 4시각, 소파 착석 1장을 열어 **총 16장**을 검토했다. 첫 넓은 카메라에서는 손·소품이 작아 세부 판단이 어려웠다. 이후 인물을 따라가는 근접 카메라와 오른쪽 각도로 다시 캡처한 최종 16장을 모두 재검토했다. 아래 링크와 관찰은 **2026-10-23 14:12:09 KST 기록의 새 근접 구도** 기준이며, 첫 넓은 구도의 영상·JSON은 [이력 폴더](../product/evidence/motion-precision/continuity/history-wide-camera/)와 구분한다.

업무·보행 표본은 x1이다. 캡처 사이에는 업무 850ms·보행 500ms 대기를 사용하며, 실제 시뮬레이션 시간 간격은 캡처 처리 시간도 포함하므로 JSON에 기록된 값으로 확인한다. 예를 들어 나라 업무는 2.667→3.650→4.650초이고 소라는 2.667→3.683→4.700초다. 이동의 다른 구간은 시연에서 x3을 사용한다. [연속 샘플의 상태·레시피·오류 기록](../product/evidence/motion-precision/continuity/continuity.json), [5명 전체 연속 영상](../product/evidence/motion-precision/continuity/five-person-motion.webm).

| 인물 | 관찰한 내용 | 시각 판정 한계 |
| --- | --- | --- |
| 나라 | [업무 0](../product/evidence/motion-precision/continuity/nara-work-0.png)·[1](../product/evidence/motion-precision/continuity/nara-work-1.png)·[2](../product/evidence/motion-precision/continuity/nara-work-2.png)에서 오른손의 펜이 노트 작업면 쪽에 있고 손·펜의 작은 자세 변화가 보인다. JSON의 act→pause→observe와 구분해서 확인했다. [보행 0](../product/evidence/motion-precision/continuity/nara-walk-0.png)·[1](../product/evidence/motion-precision/continuity/nara-walk-1.png)·[2](../product/evidence/motion-precision/continuity/nara-walk-2.png)·[3](../product/evidence/motion-precision/continuity/nara-walk-3.png)에서 몸 방향 전환과 첫걸음·무릎 굽힘, 편 손을 내린 팔 자세가 보인다. [착석](../product/evidence/motion-precision/continuity/nara-seated.png)은 골반의 쿠션 위치와 허벅지·무릎·종아리 연결이 일관된다. | 업무의 왼손은 모니터에 가린다. 보행 0~2는 책상·수납판이 다리 대부분을 가리고, 3에서 한쪽 무릎·신발이 드러난다. 소파의 테이블·화분이 발 일부를 가린다. |
| 소라 | [업무 0](../product/evidence/motion-precision/continuity/sora-work-0.png)·[1](../product/evidence/motion-precision/continuity/sora-work-1.png)·[2](../product/evidence/motion-precision/continuity/sora-work-2.png)에서 스타일러스가 태블릿 작업면 쪽에 놓이며 손·도구와 머리의 작은 변화가 보인다. JSON은 act→check→act다. [보행 0](../product/evidence/motion-precision/continuity/sora-walk-0.png)·[1](../product/evidence/motion-precision/continuity/sora-walk-1.png)·[2](../product/evidence/motion-precision/continuity/sora-walk-2.png)·[3](../product/evidence/motion-precision/continuity/sora-walk-3.png)에서 옆 방향 회전→정면 첫걸음→한쪽 무릎 굽힘과 팔 위치 변화가 보인다. [착석](../product/evidence/motion-precision/continuity/sora-seated.png)에서 소파 쿠션·골반·다리의 상대 위치와 펼친 손이 유지된다. | 보행 0~1은 책상이 다리를, 3은 화이트보드가 하체 대부분을 가린다. 착석 발 앞부분도 테이블에 가린다. 배경 인물과 겹치는 표본만으로 인물 사이 피부 충돌을 판정하지 않는다. |

카메라는 매 표본에서 인물 위치를 따라 다시 배치되므로 화면 속 인물의 이동 거리로 실제 속도를 추정하지 않는다. 새 근접 16장에서도 추가 확정 시각 결함은 발견하지 않았다. 미세 접촉·1mm 접지·속도/가속도·프레임 사이 튐을 정지 표본만으로 합격시키지 않는다. 연속 webm은 전달 근거로 링크하며, 이 문서의 직접 시각 판정은 열어 본 정지 표본 범위다. 전체 영상이 x1이라고 주장하지 않는다.

## 검수 한계

이 검사는 벽시계 장시간 실행이나 WebGL 렌더 성능 검사가 아니다. 실제 화면의 자세·실루엣·박자·시선 자연스러움, 피부 전체 물리 충돌, 실물 모바일·Safari의 발열과 메모리를 보증하지 않는다. 접촉 오차는 점과 삼각면 사이의 수치이고 관절 길이/바닥 측정과 구분한다. 브라우저·최종 통합·실제 2시간 결과는 루트 통합 검수에서 별도로 기록한다.
