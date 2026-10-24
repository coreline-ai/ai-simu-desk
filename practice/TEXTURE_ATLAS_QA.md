# 초기 텍스처 증가 원인·공용 골격 텍스처 검수

2026-10-24 · 대상: 현재 practice / localhost4198 · 원격 배포 없음

## 원인 확인

이전 [2시간 검수](STABILITY_QA.md)의56→65는 이미지 에셋의 반복 생성이 아니었다. **5명×양손의 기존 v13 HandSkin**이 컵·문서·안경 등의 소유 접촉을 위해 처음 보일 때, Three가 손마다 **8×8 RGBA32F 골격 행렬 텍스처**를 지연 생성했다. 처음56개를 기록할 때는10개 중1개가 이미 올라가 있었고, 나머지9개가 뒤늦게 사용되며65개가 됐다.

별도 로컬 진단 번들에서 native WebGL createTexture/texStorage2D와 Three의 실제 소유 객체·핸들을 대응했다. 일상240 **시뮬레이션초** 표본은55→56→61→62→65였으며 새 자원10개가 모두 `ContinuousHandSkin_L/R`의8×8 골격 팔레트였다. 따라서 그 관측은 무한 누수의 증거가 아니지만, 손별 GPU 객체를 줄일 여지는 있었다. 이전 `soak.json`의 실패 gate와 `passed:false`는 수정하지 않는다.

## 품질 유지 개선

| 파일 | 역할 |
|---|---|
| pilot-3d/sample/bone-texture-atlas.mjs | 동일160뼈의 Float32 행렬을4×160 텍스처1개로 묶음. stock Three shader, 같은 정밀도 |
| pilot-3d/activities/hand-grips.mjs | 해당 손의 room/close 전용 geometry와 골격을 연결, 종료 시 원복/해제 |
| pilot-3d/activities/team-runtime.mjs | `sharedLegacyHandTexture` opt-in. 기본값false로 기존 제품 계약 보존 |
| practice/src/app.mjs | practice만 공용화 사용 |
| practice/tests/texture-atlas.test.mjs | CPU 스키닝/바운드/레이캐스트·전환·해제·복구·격리·visible-owner 검사 |

- 별도 숨은 손을 미리 렌더하거나 처음 카운터를 부풀리지 않았다. 첫 실제 사용 전에는 GPU 업로드하지 않는다.
- 원래 geometry의 위치·노멀·가중치·LOD는 그대로다. 소유한 skinIndex만 전역 뼈 번호로 대응하고, 전체 뼈 목록을 가진 공용 Skeleton을 사용해 CPU 선택/raycast/바운드도 유효하게 유지한다.
- 바인드 행렬·손/소품 목표·IK·개성·활동·배속·그림자·DPR·FPS 정책은 그대로다. GLB/포스터/CSS/머리 에셋도 변경하지 않았다.
- GPU 직전에는 **보이는 기존 손 소유자만** 최종 행렬을 갱신한다. 공유 때문에 숨긴10개 손의 계산을 매 프레임 추가하지 않는다.
- 원본 골격의 행렬 배열은 공용 버퍼의 서로 겹치지 않는 view다. 컨텍스트 복구에도 같은 버퍼/compact 레이아웃을 사용하며, 종료 시 skinIndex·골격 연결 원복 후 공용 텍스처를 한 번 해제한다.

## 자원 결과와 한계

| 항목 | 이전 | 개선 |
|---|---:|---:|
| 기존 손 골격 GPU 텍스처 | 최대10개 | 최대1개 |
| 동일 일상 표본 전체 텍스처 | 최대65개 | 최대56개 |
| 골격 Float32 데이터 payload |10,240 bytes|10,240 bytes|

**GPU 객체9개를 줄인 것이며 VRAM/RAM 용량이13.8% 줄었다는 뜻이 아니다.** 공용화로 손 하나만 보일 때도1KiB 대신 최대10KiB를 업로드할 수 있다는 교환 조건이 있다. 숨긴 손의 CPU 재계산은 생략하며, 기기 전체 자원 절감률은 보장하지 않는다.

최종 코드의 교차4짝×대기/업무/컵, 총24표본에서 같은120스텝+15 WebGL draw를 측정했다(360스텝/30draw 준비). CPU 중앙값은 대기216.1965→213.184ms, 업무273.5105→267.791ms, 컵251.709→218.2765ms. **각 조건4짝 중2짝만 감소**했으므로 일관된 CPU 개선율로 주장하지 않는다. 다른 테스트 부하가 병행됐고 실제 RAF FPS·전체 CPU·RSS/GPU 메모리 측정이 아니다. 유지 JS 힙은 탐색/페이지 수명 차이도 있어 RAM 절감으로 판정하지 않는다. 원시값/한계는 `performance-summary.json`을 따른다.

## 화면·손·소품·수명

- 네 배속0.5/1/1.5/2의 각자 업무·민 컵, 1배 준 안경·레오→나라 전달: **10짝** 모두 접촉 단계·완료·소품 desk 반납·전원 home·예약 해제·violations=[]·reset0 일치.
- 해당 접촉/5명 손 카메라 **14짝**의 framebuffer 해시/장면 SHA256/접촉 진단 동일. 별도 성능 표본12짝도 픽셀·장면 동일. 총26짝은 표본 비교이며 모든 프레임/모든 기기를 보장하지 않는다. framebuffer는 FNV1a32다.
- 실제 캡처에서 나라·소라·준·민·레오의 손과 펜/키보드/문서, 컵·안경·자료 전달을 다시 확인했다. 기존 주먹형 컵 손·일부 가림은 유지됐고 추가 사실적 조형을 한 것은 아니다.
- 임시 복구용 QA 화면에서 WebGL 컨텍스트3회 재생성: 같은 포즈의 픽셀/장면 동일,4×160 텍스처1개 유지. 카운터56→50→50→50으로 누적 없음. 복구 시 현재 보이지 않는 자원은 아직 재업로드되지 않으므로 초기 피크와 동일 수일 필요가 없다.
- 일반 practice는 이전처럼 손실 후 캔버스/시나리오를 폐기하고2D 실습을 계속한다. canvas0·player 참조 해제·2D done을 재확인했다. 복구용 QA 함수나 native 계측은 배포 번들에 넣지 않았다.

## 일반 자동 재생 재검수

최종 코드의 일반 주소에서 **실제1,200.635초(20분)**, 1배/균형 품질로 실행했다.41개 표본에서 texture **55→56, 증가1개**로 초기+5 및 전체56 상한을 모두 충족했다. 오류·hidden·컨텍스트 손실·violations·강제 초기화 없음. 시뮬레이션369.3초/그리기11,276회 전진, 중단 뒤19.699초 자연 복귀하여 전원home·소품desk·예약해제를 확인했다.

5분 GC 후 JS 힙 약23.09MiB,20분 약23.63MiB였다. 이는 RSS/VRAM이나 메모리 절감 측정이 아니다. 앞선30초 시도는 다른 비교 탭 전환의hidden 이벤트로 무효 처리하고 최종 집계에서 제외했다. 이번 검수는 새 코드의20분 검수이며 과거2시간을 새 코드의2시간 통과로 사용하지 않는다.

## 검사·진행 상태

practice **35/35**, 타입/경계/check:product 통과. 새5개 검사는160뼈/양손·room/close CPU 스키닝 동일, raycast/바운드, 세 번 context epoch와 반복 해제, 실패 원자성·새 런타임 격리, 역할/컵/안경/전달/복귀·최종 visible-owner 행렬을 확인한다.

단독 일반 자동 재생20분과 전체 회귀 **537/537**(fail0, 약37분25초)를 완료했다. practice35개는 root537개와 별도다. 이전2시간을 새 코드의2시간 검수로 재사용하지 않는다. 실제 모바일·장시간2시간 재실행·열/VRAM·전 프레임 관통은 이번 검사 범위가 아니다.

## 증거·재현

`evidence/texture-atlas/`: allocation-root-cause.json, contacts-and-returns.json, browser-performance.json, performance-summary.json, context-lifecycle.json, PNG. 단위 검사:

```sh
# Node22, 저장소 루트
npm run build:practice
npm run test:practice
npm test
npm run typecheck
npm run check:boundaries
npm run serve:practice
```

진단 전용 번들은 ignored .data에 보존하며 public 배포 파일이 아니다. 정적 배포 화이트리스트는 QA 문서·이미지를 포함하지 않는다. 로컬4198만 갱신하고4180/DB/managed release 및 외부 호스팅/DNS는 보존한다. 사용자 승인에 따라 최종 소스·문서·검수 증거는 main에 커밋·푸시한다.

## 최종 로컬 인계

정적 검사/빌드·자산 명세 동일성·실제 제공 JS SHA256 검증 완료. 임시4197 및 보조 검수 탭은 종료했고, 최종4198은1배 자동 하루/소라 근접으로 남겼다.4180/기존 managed release/DB는 유지한다. 원격 사이트 배포는 수행하지 않으며 최종 Git 전달은 main 원격 해시 확인으로 별도 기록한다.
