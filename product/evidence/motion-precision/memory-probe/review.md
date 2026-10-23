# 메모리 독립 선검토 추가 실험

작성: 2026-10-23T06:14:47.690Z

## 결론

**확정된 제품 의존성 잔류:** 비교 버튼으로 WebGLRenderer를 재생성할 때 Three의 모듈 전역 DataTexture `DFG_LUT`가 이전 renderer의 dispose listener를 강하게 보유한다. v11과 v12 모두 LUT 하나의 listener 수가 재생성 0/6/30회에서 **1/7/31**이다. 이전 view·준 actor·scheduler가 모두 수거돼도 renderer 내부 program/context wrapper는 남는다. 단순 코드 warming으로 설명할 수 없는 참조 경로다.

**분리할 관측:** 총 V8 heap 증가는 코드/JIT 및 DevTools Network 응답 보관을 함께 포함한다. snapshot에서 별도의 InspectorNetworkAgent → NetworkResourcesData 경로도 확인했다. 각 기여량은 아직 분리하지 않았으며 전체 증가량을 제품 잔류량으로 해석하지 않는다.

**GPU 미해제는 측정하지 않음:** 제품 quality-view는 renderer.dispose 후 forceContextLoss를 호출한다. 아래 WebGL wrapper 개수 증가는 JS/native 객체 잔류 근거이며 VRAM 보존량이나 실기기 GPU 누수 근거가 아니다.

## 재현과 수치

- 독립 headless Chrome, 새 BrowserContext 하나, 공개 QA4193 personal 페이지. v11과 v12를 페이지별로 순차 실행했다.
- 같은 버전 버튼으로 30회 mount, 사용자 중단 후 idle을 boolean으로 기다리고 double full GC 후 Runtime.getHeapUsage를 기록했다.
- 각 버전 0/6/30회 snapshot을 별도로 저장했다. snapshot 계측 자체가 heap에 영향을 줄 수 있다. 6회 값은 초기 warming과 이후 추세의 구분용이며 기존 8MiB 판정 기준을 바꾸지 않았다.
- old view·준 actor·scheduler WeakRefs는 모든 프레임에서0, canvas1, textures45, geometries303초기→308안정, backingStorage약15.9MiB, pageerror0.

| 버전 | 0회 heap MiB | 6회 | 30회 | 0→30 증가 | 6→30 증가 | 원래8MiB 기준 |
|---|---:|---:|---:|---:|---:|---|
| v11 | 19.780 | 23.375 | 28.448 | +8.668 | +5.073 | 초과 |
| v12 | 20.637 | 23.597 | 29.109 | +8.472 | +5.512 | 초과 |

30회 rapid 재생성 결과는 현재 별도 진행하는 실제2시간 soak와 다른 실험이다. 한 실험으로 다른 실험의 합격/실패를 대체하지 않는다.

| full GC snapshot 클래스 | 재생성6회 | 30회 | 증가 |
|---|---:|---:|---:|
| DFG_LUT dispose listener | 7 | 31 | +24 |
| native WebGL2RenderingContext | 7 | 31 | +24 |
| native WebGLProgram | 96 | 360 | +264 |
| native WebGLShader | 180 | 708 | +528 |
| native WebGLUniformLocation | 761 | 1913 | +1152 |

## 강한 참조와 원본 대조

v12의 실제 객체 id116109는 isTexture=true, isDataTexture=true, name='DFG_LUT', uuid='88e5e604-2a41-4485-8fd3-ef4dc6d285cf'다. 0/6/30 snapshot에서 같은 객체를 유지한다.

강한 경로(weak edge 제외 BFS):

`Global handles → NativeContext → Window.__personalStudio → get engine/diagnostics closure → module Context._n → DataTexture DFG_LUT → _listeners.dispose[13~28] → old renderer onTextureDispose closure → renderer program/state closure → WebGLProgram / WebGL2RenderingContext`

원본 대응:

- node_modules/three/src/renderers/shaders/DFGLUTData.js:31~48: 모듈 전역 lut를 한번 만들어 모든 renderer가 재사용한다.
- node_modules/three/src/renderers/WebGLRenderer.js:2743~2745: PBR shader uniform dfgLUT에 해당 공유 texture를 공급한다.
- node_modules/three/src/renderers/webgl/WebGLTextures.js:324~330: texture.dispose 이벤트 시 해당 renderer의 onTextureDispose listener를 제거한다.
- node_modules/three/src/renderers/WebGLRenderer.js:1086~1108: renderer.dispose에 공유 DFG LUT dispose 경로가 없다.
- pilot-3d/personal-office/app.mjs:19: 비교 버튼 mount가 기존 view를 dispose하고 renderer를 새로 만든다.
- pilot-3d/sample/quality-view.mjs:31: 자산·조명·renderer·context·canvas 정리 후에도 모듈 전역 DFG LUT의 이전 listener는 남는다.

## 최소 수정 방향과 회귀

renderer 해제 경로에서 DFG LUT의 renderer별 dispose listener가 남지 않게 해야 한다. Three 의존성의 내부 texture lifecycle 보완 또는 앱의 한정된 해제 adapter를 검토하되, 다른 살아 있는 renderer와 공유하는 texture의 영향을 함께 확인해야 한다. 제품 소스나 node_modules는 이 실험에서 수정하지 않았다.

회귀는 30회 v11/v12 비교 재생성 후 이전 view·actor·scheduler뿐 아니라 **이전 canvas.getContext('webgl2') WeakRef**를 확인하고, fullGC snapshot의 DFG LUT listener 수·WebGL context wrapper 수가 재생성 수에 비례하지 않는지 검사한다. 원래 8MiB gate를 유지하고 Network 도메인 미활성 대조도 별도로 수행한다.

## Network 대조 상태

Playwright는 내부 페이지 CDP session에서 Network.enable을 호출한다(coreBundle.js:35824). 별도 session에서 Network.disable을 호출해도 내부 session 캐시가 제거됐다고 해석할 수 없으므로, raw CDP로 Runtime/Page/HeapProfiler만 사용하는 새 Chrome 대조를 준비했다.

첫 실행(2026-10-23T06:12:22Z)은 QA4193 public page의 HTTP500(INTERNAL_ERROR)으로 초기 engine 준비 전에 timeout됐다. 앱 측정값이 없으므로 대조 결과로 사용하지 않는다. 해당 Chrome은 종료했고 기존 서버·2시간 soak에는 조작하지 않았다.

## 재실행 경로와 한계

- 원 측정 harness: /private/tmp/ai-simu-memory-probe.mjs
- snapshot analyzer: /private/tmp/ai-simu-heap-analyze.mjs
- LUT count analyzer: /private/tmp/ai-simu-lut-summary.mjs
- Network 대조 harness: /private/tmp/ai-simu-memory-network-control.mjs
- raw snapshot 디렉터리: /private/tmp/ai-simu-memory-2026-10-23T06-01-59-575Z
- 처음 실패한 Network 대조 로그: /private/tmp/ai-simu-network-control.log
- 저장한 작은 근거: probe-result.json, heap-analysis.json, retained-object.json, lut-listener-summary.json.
- 모든 snapshot은 공개 로컬 QA 페이지만 대상으로 했으며 수십MiB 원본은 /private/tmp에만 보존했다.
- 클래스 수/바이트는 V8 snapshot의 shallow 합계이며 dominator retained size·RSS·GPU VRAM·사용자기기 장기 안정성을 측정한 값이 아니다.
- source bundle SHA256(v11/v12 동일): ffc6cc93b16e8aaf73136c611f21d40d9dbb87b4ff0824e79e02e9562833f637.
