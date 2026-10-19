# 실제 3D 파일럿 검증 결과

검증일: 2026-10-19 KST. [실행 계획](../dev-plan/implement_20261019_173618.md)의 선행 파일럿 범위입니다. 제품 서버·인증·DB·실제 AI·협업 구현과 구분합니다.

## 구현 결과

- `pilot-3d/`에서 자체 사무실·나라 한 명·책상·의자·노트북을 실제 GLB로 읽어 렌더링합니다. 생성 PNG를 3D로 자동 변환하지 않았습니다.
- 원본 모델 생성기 [model.mjs](../pilot-3d/src/model.mjs), [GLB](../pilot-3d/assets/afternoon-studio-v1.glb), [실제 사양·해시](../pilot-3d/assets/manifest.json), [제작 출처](../pilot-3d/assets/MODEL-PROVENANCE.txt)를 보존합니다. 외부 모델·텍스처를 사용하지 않았으며 Three.js의 MIT 라이선스를 별도 포함합니다.
- 미터 단위, Y 상방, 바닥 표면 Y=0. 책상 상면 0.74m, 의자 좌면 0.45m. 실제 GLB를 다시 읽어 책상·의자·신발 14개 지지 형상의 하단 높이와 바닥 경계를 검사했습니다.
- 하나의 직교 카메라와 같은 조명·그림자 계산으로 크기·차폐·접지를 표현합니다. 전체/나라 확대, 드래그 회전, 확대, 화질 선택을 제공합니다.
- `idle` 3.6초와 `typing` 0.8초의 계층형 노드 애니메이션을 포함합니다. 스키닝·인체 보행 리그는 제공하지 않습니다.

## 코드 경계

| 파일 | 책임 |
|---|---|
| `demo/src/domain.mjs` | 기존 모의 업무 규칙. 3D 라이브러리나 DOM을 가져오지 않음 |
| `pilot-3d/src/model.mjs` | 자체 형상·치수·피벗·애니메이션 제작 |
| `scripts/build-3d.mjs` | GLB 내보내기·사양·출처·로컬 JS 번들 생성 |
| `pilot-3d/src/view-model.mjs` | 실행 상태에서 읽기 전용 포즈·라벨·정지 상태로 변환 |
| `pilot-3d/src/scene.mjs` | GLB 읽기·카메라·조명·애니메이션·품질·선택·복구·GPU 해제 |
| `pilot-3d/src/app.mjs` | UI·모의 타이머·상태 명령·장면 수명 연결 |

Three.js 0.186.1, esbuild 0.28.2를 package-lock으로 고정했습니다. 실행 시 라이브러리 CDN과 외부 모델 서버에 의존하지 않습니다. 구현 API는 공식 [GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html), [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)를 기준으로 확인했습니다.

## 자동 검사

- `npm test`: 18/18 통과. 기존 13개 + 실제 GLB 재읽기/치수/클립, 14개 접지 형상, 루프 경계·타이핑 손 이동·고정 발, 업무/포즈 계약, 공유 GPU 자원 중복 해제 방지 5개.
- `npm run check`: 기존·신규 모듈과 빌드 스크립트 구문 검사 통과.
- `npm run build:3d`: GLB 3,922,788 bytes(약 3,831KiB), 로컬 JS 번들 약 653KiB 생성.

## 브라우저 검증

| 항목 | 확인 결과 |
|---|---|
| GLB 로딩 | 실제 모델·idle/typing 클립을 읽고 씬 표시 |
| 회전·확대·선택 | 드래그로 다른 면 표시, 전체/나라 확대 복귀, 나라 얼굴 클릭 시 선택 안내 |
| 정상 업무 | running에서 typing, 완료 후 idle·예시 결과 표시 |
| 정지 | 동작 정지 중에도 업무 완료, 시각 루프와 업무 타이머 분리 |
| 승인·거절 | 3/4 승인 대기에 idle, 승인 후 재개·완료, 거절 후 취소 표시 |
| 실패·재시도·취소 | 연결 실패 안내, 정상 시나리오 재시도, 그래픽 중단 중에도 취소 가능 |
| 20회 장면 재진입 | 승인 대기 상태 유지, 연결된 canvas 1개, 활성 형상 214·텍스처 3으로 일정 |
| 자원 해제 | 매번 이전 장면의 형상 카운터 0, 실제 WebGL 컨텍스트 손실 확인. 내부 텍스처 카운터 1은 남으므로 모든 카운터가 0이라고 표시하지 않음 |
| GLB 오류 | 파일을 잠시 분리해 실제 404를 재현. 대체 이미지·안내와 업무 입력 유지, 파일 복원 후 3D 재로딩 성공 |
| 그래픽 중단 | WEBGL_lose_context로 실제 중단. 2D 대체 화면·업무 취소 유지, 재생성 후 canvas 1개로 복구 |
| 1280/768/390/319px | DOM 기준 가로 넘침 없음, 주요 버튼 최소 44×44px, 전체 공간과 모바일 나라 확대 확인 |
| 기존 2.5D | 링크로 이동해 v2 에셋·업무 시작 UI 확인, 3D로 돌아와 새 장면 로딩 확인 |
| 입력 오류 | 공백 요청 거절, 오류 문구·aria-invalid·입력 포커스 유지, 업무 미생성 확인 |

GPU 카운터는 `renderer.info.memory` 관측값입니다. 자체 모델·재질·그림자 자원을 해제하고 렌더러를 종료한 뒤 컨텍스트를 명시적으로 잃도록 했습니다. 20회 검사에서 활성 자원 수가 증가하지 않았다는 결과이며, 브라우저 프로세스의 장시간 힙·실제 VRAM 전체 누수가 없다는 보장으로 확대하지 않습니다. DOM 이벤트는 AbortController, OrbitControls와 ResizeObserver는 명시적 해제로 수명을 관리하며 해제 경로는 코드로 함께 검토했습니다.

## 성능 관측과 제한

- 현재 내장 브라우저, 로컬 HTTP, DPR 1, 전체 공간·idle 재생에서 3초 애니메이션 루프: 1280×900 **75.2fps**, 390×844 **75.1fps**.
- 20회 반복 재진입의 GLB 로딩·초기 렌더 호출까지 **26~40ms**. 같은 로컬 환경과 따뜻한 캐시의 반복 측정이며 인터넷 첫 로딩 시간은 아닙니다.
- 전체 장면의 렌더 통계는 그림자 패스를 포함해 약 381 draw calls / 118,778 triangles. 원본 GLB 자체는 213 meshes / 68,016 triangles입니다.
- 자동 품질은 씬 폭에 따라 그림자 1024/2048, DPR 상한 1/1.5를 사용합니다. 실제 휴대폰·중급 모바일 GPU·고해상도 DPR·네트워크 제한·장시간 발열·GPU 타이머 검사는 미실시입니다.
- 비활성 탭과 OS 움직임 감소 연결은 구현·코드 검토했습니다. OS 설정 자체를 변경해 검증하지 않았습니다. 브라우저가 노출한 CSS viewport와 앱 캡처 이미지의 픽셀 크기는 다를 수 있어 배치는 DOM 수치로 기록했습니다.

## 증거

- [최종 전체 공간](../pilot-3d/evidence/final-desktop.png), [최종 나라 확대](../pilot-3d/evidence/final-closeup.png), [원래 브라우저 폭](../pilot-3d/evidence/final-native.png)
- [업무·포즈](../pilot-3d/evidence/workflow.json), [승인 대기 확대](../pilot-3d/evidence/approval-closeup.png)
- [20회 재진입](../pilot-3d/evidence/reentry-20.json), [context loss·복구](../pilot-3d/evidence/context-recovery.json), [에셋 오류](../pilot-3d/evidence/asset-error.png)
- [화면별 DOM](../pilot-3d/evidence/viewports.json), [1280px](../pilot-3d/evidence/viewport-1280.png), [390px](../pilot-3d/evidence/viewport-390.png), [319px 확대](../pilot-3d/evidence/closeup-319.png), [드래그 회전](../pilot-3d/evidence/orbit-narrow.png)
- [데스크톱 성능](../pilot-3d/evidence/performance-desktop.json), [390px 성능](../pilot-3d/evidence/performance-390.json), [환경](../pilot-3d/evidence/environment.json), [2.5D 회귀](../pilot-3d/evidence/demo-regression.json)

## 후속 작업

선행 파일럿은 완료했습니다. 제품 구현은 [후속 계획](../dev-plan/implement_20261019_164437.md)의 Phase 1에서 TypeScript 계약·애플리케이션 포트·제품 골격을 고정한 뒤 진행합니다. 제품용 캐릭터 리깅·GLB 최적화와 실기기 품질 기준, 인증·영속 저장·Hermes 실행은 별도 미완료 항목입니다.
