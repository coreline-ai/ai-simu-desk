# 로컬 배포·개발 핸드오프

갱신: 2026-10-24 · 대상 브랜치: `main` · 저장소: `coreline-ai/ai-simu-desk`

## 현재 인계 범위

공간 v9 + 5명 개성 v13 + 손 v14. 사용자가 손의 추가 사실적 조형은 중단하고 **현재 소라 손 품질로 전원 확대**하도록 승인했다. 나라·소라·준·민·레오의 개별 업무 리듬/경로·표정·시선을 보존하며 기본 제품과 개인별 데모에 적용했다. 손 자연스러움이 모두 해결되었다는 인계가 아니다.

- 기본 제품: `/` 또는 `/start`.
- 전체 업무: `/demos/activities/personal/?demo=roles`.
- 준 마우스: `/demos/activities/personal/?demo=role&actor=jun&variant=1`.
- 이전 손 비교: `?hands=13`; 이전 개인화/활동 비교: `?version=13`, `?version=12`, `?version=11`.
- 기본 데모는 새로고침 후 버튼 없이 자동 하루를 재생한다. 수동 정지와 실행 중 OS 동작 줄이기 변경을 보존한다. `play=0`은 시연 명령을 보내지 않는 링크이며 별도의 전체 시간 정지 옵션은 아니다.

## 핵심 파일

| 경로 | 역할 |
|---|---|
| `pilot-3d/character-personalities/<id>/` | 캐릭터별 profile / 순수 sample / 책상 소품 |
| `pilot-3d/character-personalities/director.mjs` | 개성 합성·소품 소유권 양보·시작 분산 |
| `pilot-3d/hand-v14/` | 관절/FK·피부·펜 캘리브레이션·키/마우스 어댑터 |
| `pilot-3d/activities/{hand-grips,desk-actions,team-runtime}.mjs` | 손·도구 연결과 최종 접촉 우선권 |
| `pilot-3d/personal-office/{app,replay}.mjs` | 자동 재생·포즈/버전 비교·정확한 시연 반복 |
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

- 손/개성/재생 관련 **81개 회귀 통과**, 실제 화면에서 5명 대표 업무·준 마우스/가리키기·5명 컵·레오 문서·준 안경 검수 완료.
- 이번 커밋 전 관련81개/서버79개 통과, 새 잠금 의존성 설치·전체 빌드·격리 서버 smoke 통과. 전체 npm test는 장시간 회귀 중 중단한 미완료 상태다. 상세 결과는 `docs/local-release-20261024.md`와 `product/evidence/local-release-20261024/validation.json`에 기록했다. 예전 장시간/Safari 검수 결과를 이번 손 v14의 새 검사로 합산하지 않는다.
- 실물 모바일, 새 2시간 soak, 피부 전체의 매 프레임 무관통, 의료적 손 구조·FPS 보장은 하지 않는다.
- `.data/`의 세부 로그/전체 캡처는 로컬 전용이며 Git에 없다. Git에서 재현 가능한 소스/테스트와 요약은 저장소에 포함한다.
