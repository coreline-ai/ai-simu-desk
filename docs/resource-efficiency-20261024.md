# 품질 불변 리소스 최적화 · 2026-10-24

## 적용 원칙

공간 v9, 개성 v13, 손 v14의 외형·리듬·접촉 우선권을 보존한다. FPS 상한을 새로 두거나 DPR·텍스처·메시·그림자 해상도·IK 반복 수를 낮추지 않는다. 60Hz 시각 시뮬레이션, 업무/DB/인증/네트워크 시간과 공동 장면 스키마는 그대로다.

## 변경

| 영역 | 변경과 보존 계약 |
| --- | --- |
| 노드 검색 | 의자·표정·시선 대상·화면의 배우/머리 참조를 런타임별 캐시. 재생성/폐기 시 참조도 해제한다. |
| 표시 상태 | 화면 색상 판단에 필요한 scheduler state만 읽는다. 전체 접촉/소품 진단 트리는 진단 요청 때 생성한다. |
| 손 | v14 피부가 보일 때 legacy 손의 IK·피부/인스턴스 갱신을 생략한다. blend와 원래 메시 숨김은 계속 적용한다. 컵·문서·안경·전달 등 소유 접촉에서는 기존 전체 계산을 실행한다. |
| 디테일 | 같은 손 detail 설정을 반복 지정하지 않는다. 새/기존 피부 양쪽에 설정해 접촉 소유권 전환 중에도 해상도가 변하지 않는다. |
| 화면 밖 | IntersectionObserver로 화면에서 완전히 벗어났을 때 GPU render와 이름표 갱신만 생략한다. scheduler·고정 스텝·배속·공동 송신은 계속한다. 보이면 즉시 현재 장면을 그린다. API 미지원 시 기존대로 그린다. |

화면 밖에서 시뮬레이션을 정지하거나 시간을 건너뛰는 방식이 아니다. 탭 숨김·OS 동작 줄이기·사용자 정지는 기존 정책을 따른다. 모델/노드 추가·삭제, 공유 packet 스키마 변경, 서버·DB·업무 동작 변경은 없다.

## 검증 결과

기준 소스: `b963d1795895daa1658b334858cf30f49fe9d267`.

- 고정 1/60초로 대기·15개 역할 업무·5명 컵·안경·문서 전달을 진행한 167개 표본: 표시 메시 world matrix, skeleton, 동적 instance, 종이 정점과 전체 런타임 접촉 진단 해시 **모두 동일**. 기준 재실행도 동일했다.
- 실제 Apple M4 / ANGLE Metal WebGL, balanced, DPR 1.5, 1650×1110: 전체/업무 3종/5명 손 확대/준 마우스/컵/안경/전달 **13개 framebuffer 해시 전부 동일**. 각 장면의 draw call·triangle 수도 동일했다.
- 화면 밖 → 재진입, WebGL 컨텍스트 손실 → 복구 후 해당 정지 장면의 framebuffer 해시도 동일했다.
- 신규 동등성/표시 전환/경량 조회 테스트 3개, 기존 관련 회귀 23개, 정지/공간/리소스 수명 관련 17개로 총 43개 통과. 커밋 직전 같은 43개를 한 명령으로 재실행해 43/43 통과(실패·취소·skip 0, 약 72.4초)했다. TypeScript·구문·의존성 경계 검사 통과. 전체 장시간 npm test/실물 모바일/새 장시간 soak는 수행하지 않았다.

### CPU 단독 비교

Node.js 22, 모델 생성 제외, 동일 360 fixed steps, 기준/후보 순서를 바꾼 각 3회 중앙값. `process.cpuUsage()`의 프로세스 CPU 시간이며 **전체 앱 CPU 점유율이나 브라우저/GPU 전력 절감률이 아니다**.

| 워크로드 | 기준 CPU 시간 | 후보 CPU 시간 | 감소 |
| --- | ---: | ---: | ---: |
| 대기 | 579.497ms | 503.567ms | 13.10% |
| 5명 역할 업무 variant 1 | 1,225.440ms | 959.925ms | 21.67% |

브라우저의 6초×2 교차 표본에서는 후보의 화면 밖 render 제출이 두 번 모두 **0회**였고 시뮬레이션 스텝은 계속 진행했다. 다만 자동화 환경의 RAF가 약 2Hz로 제한되어 있었고 TaskDuration에 큰 변동이 있어, 이 표본으로 정상 전경 FPS·전체 CPU 절감률을 주장하지 않는다.

## 재현 및 증거

- [validation.json](../product/evidence/resource-efficiency-20261024/validation.json): 표본 해시, CPU 원시 표본, 브라우저 지표/한계.
- [전체 화면](../product/evidence/resource-efficiency-20261024/room.png)·[소라 손 확대](../product/evidence/resource-efficiency-20261024/sora-hand.png): 실제 네이티브 캡처. 생성형 이미지·픽셀 편집 없음. README 대표 이미지는 변경하지 않는다.

```sh
# Node.js 22.x / 저장소 루트에서 실행. 총 43개 관련 테스트.
node --import tsx --test --test-concurrency=1 \
  product/tests/resource-quality.test.mjs \
  product/tests/hand-v14.test.mjs product/tests/hand-v14-team.test.mjs \
  product/tests/renderer-resources.test.mjs \
  product/tests/living-frames.test.mjs product/tests/personal-frames.test.mjs \
  product/tests/natural-motion.test.mjs product/tests/personal-motion.test.mjs \
  product/tests/paused-hands.test.mjs product/tests/room-quality.test.mjs \
  product/tests/renderer-epoch.test.mjs
npm run typecheck
npm run check:boundaries
npm run check:product
node scripts/qa/resource-cpu.mjs b963d17
# 기준 버전에서 첫 JSON을 기록한 뒤 후보 버전에서 같은 도구/조건으로 비교
node scripts/qa/resource-equivalence.mjs .data/resource-equivalence/candidate.json .data/resource-equivalence/baseline.json
# 기존 실행 중 release를 수정하지 않는 공개 in-memory QA 화면 생성
node scripts/qa/build-resource-fixture.mjs candidate
```

정식 prepare 빌드 성공. v9 GLB 8,768,140 bytes는 기존 실행 release와 바이트 단위 동일했다. 분리된 임시 게스트에서 모델 v9/손 v14, 합성 요청 실행·답변 저장·기록 표시, 공개 라우트 200/비공개 경로 404를 확인했다.

## 로컬 적용 상태

- 이 기기에 적용한 release: `1792820338580-e8f0935f-55f1-4ff0-b3f9-cbdc5188f631`. 검수한 후보와 실행 코드·에셋이 동일하며, 라이브러리 문서 두 개만 갱신한 최종 prepare 결과다.
- 기존 서버 정상 종료 → 비공개 DB 백업 → publish → 재시작을 완료했다. 사용자 DB·설정은 보존했고 백업·실행 산출물은 Git에서 제외했다.
- `http://127.0.0.1:4180`의 health·기본 화면·시작 화면·개인별 데모 200, 비공개 설정/DB 경로 404 및 제공 중인 JS 해시와 manifest 일치를 확인했다. 실제 적용 화면에서 모델 v9·전원 손 v14와 새 진단 필드도 확인했다.
- 기존 탭은 새로고침해야 새 코드가 적용된다. 위 release ID는 이 기기 기록이며 다른 기기에서 재사용하지 않는다. 이후 문서만 변경한 Git 커밋이 실행 중 release를 자동 교체하지는 않는다.

## 운영

새 로컬 실행에는 `HANDOFF.md`의 prepare → 정상 종료 → 비공개 DB 백업 → publish → 재시작을 따른다. 기존 페이지/공동 관찰 참여 탭은 새 번들로 새로고침한다. 외부 호스팅 배포나 네트워크/서버 전체의 최소 자원 보장을 수행한 작업은 아니다.
