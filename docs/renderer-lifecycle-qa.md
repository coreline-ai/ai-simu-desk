# Renderer lifecycle QA

범위: 공유 Three DFG LUT의 renderer별 dispose listener, 실제 createQualityView의 PMREM 선행 렌더링, 동시 화면, 로딩 중 취소, context loss/restore 및 반복 생성의 회귀 검증. 사용자 DB·4180·배포 환경은 사용하지 않는다.

## 소유 파일과 관측 방식

- `product/tests/renderer-resources.test.mjs`: fake renderer.properties를 사용하되 실제 렌더 uniform과 재질 측 가짜 값을 구분한다. 공유 LUT의 owner별 중복 해제·첫 LUT 고정·dispose 멱등·빈 화면·context epoch release/recapture를 검증한다.
- `scripts/qa/renderer-fixture.mjs`: 실제 createQualityView를 roomQuality=true, 공간v9, createTeamRuntime으로 마운트한다. Three의 동일 bundled Texture.prototype.addEventListener를 fixture에서만 관측하고 이름 DFG_LUT인 실제 Texture에 WeakRef를 둔다. src/getDFGLUT를 직접 import하여 다른 singleton을 만드는 방식은 사용하지 않는다.
- `scripts/qa/renderer-lifecycle.mjs`: 독립 Chrome의 공개 `/qa/renderer-fixture/`만 연다. 대기 함수는 boolean을 반환하며 실제 renderer/context/scene의 JSHandle을 보유하지 않는다.
- 근거: `product/evidence/motion-precision/lut-fix/`.

## 검증 기준

1. 두 실제 화면을 동시에 렌더링했을 때 실제 전역 DFG LUT는 하나, dispose listener는2개다.
2. 오른쪽 화면 context loss/restore를3회 수행한다. 복구마다 왼쪽·오른쪽 화면의 살아 있는 WebGL context와 nonuniform pixel을 readPixels로 확인하고 listener는2개로 유지한다.
   최종 보강 검증은 두 화면을 일시정지한 뒤 전체RGBA framebuffer의 평균 절대 차이≤1, 채널차이3 초과 pixel비율≤1.5%도 확인한다. 실제 모델의 geometry/material/mapTexture/InstancedMesh/skeleton별 객체수와 dispose listener 총수·최댓값을 복구 전후 비교한다.
3. 오른쪽 화면을 해제해도 왼쪽 화면을 다시 그릴 수 있고 listener는1개이며 이전 view/context WeakRef는 fullGC 후0이다.
4. PMREM 선행 렌더링 후 GLB 로딩을 마치기 전에 오른쪽 화면을3회 취소한다. ready=false, canvas0, 이전 context/view0을 확인한다.
5. 왼쪽 화면은 유지한 채 오른쪽 화면을30회 생성·해제한다. 매회 double fullGC 후 이전 view/context0, canvas1, LUT listener1을 확인한다.
6. 동일 30회 구간의 V8 heap 증가가 기존8MiB 이하인지 검사한다. 이 기준을 임의 완화하지 않는다.
7. 전부 해제하면 view/context/canvas/LUT listener가 모두0이다.
8. helper·quality-view·room lighting·fixture·CLI 소스 해시는 실행 전후 동일해야 한다.
9. 실제 PMREM fromScene 렌더 후 예외를3회 강제로 일으켜 초기화 rollback을 확인한다. 실패한 constructor의 WebGL context WeakRef0·canvas0·LUT listener 잔류0 및 생존 화면의 framebuffer 동등성을 확인한다. 이 예외 주입은 공개 fixture의 prototype 임시 대체이며 제품 코드를 변경하지 않는다.

픽셀 검사는 context가 살아 있고, WebGL error0이며, 5×5 표본 중5개 이상이 불투명하고 RGB 범위가10을 넘는지 확인한다. 이는 화면이 실제로 그려지는지의 회귀 확인이며 캐릭터 동작의 미학적 품질이나 전체 프레임의 동일성은 판정하지 않는다.

## 실행

```sh
node --test product/tests/renderer-resources.test.mjs
STUDIO_QA_ORIGIN=http://127.0.0.1:4193 node scripts/qa/renderer-lifecycle.mjs
```

QA 서버는 루트 담당자가 fixture bundle과 source asset route를 준비한 격리 서버를 사용한다. 기존 장기 실험 중인 서버는 이 담당자가 재시작하지 않는다.

## 현재 결과

- 단위 테스트: **6/6 통과**. 로그 `lut-fix/unit.log`.
- 첫 LUT 정리 보정 브라우저: **6/6 통과**, 소스 불변. 2026-10-23T06:25:24Z 종료. 이전 view/context는 모든30회에서0, 한 생존 화면의 LUT listener1, 최종 전체 해제 후 view/context/canvas/listener0이었다.
- 첫 보정 heap: 21.775→23.038MiB, **+1.264MiB**, 원래8MiB 기준 이내. 전체 해제 후7.304MiB. `lut-fix/first-lut-fix/`에 이 결과·로그·PNG를 보존했다.
- 첫 보정 PNG를 직접 확인했으며 두 화면 모두 전체 사무실·다섯 동료·가구가 정상 렌더링됐다. 이 시점은 단순 유효 pixel검사였으므로 PMREM 복구 전후 동등성이나 개별 geometry/material의 epoch 잔류가 해결됐다는 뜻은 아니다.
- context epoch CPU 자산·PMREM 복구·초기화 rollback 최종 보강 검증: **7/7 통과**, 소스 불변, pageerror0. 실행 2026-10-23T06:31:58Z~06:33:06Z. `lut-fix/lifecycle-summary.json`에 간결한 근거를, `lifecycle.json`에 전체 실행 기록을 보존했다.
- 정지 화면 복구3회: 왼쪽·오른쪽 전체600×440 RGBA 모두 초기 화면과 **완전 동일**했다(MAE0, 변경 pixel0, 최대 채널차이0). 생존 화면은 peer 해제와 PMREM 예외 후에도 동일했다.
- PMREM 실제 렌더 후 예외3회: 새 constructor context를 각각1개 관측했고 fullGC 후 잔류0, 실패 host canvas0, 생존 renderer의 LUT listener1이었다.
- 최종30회 재생성: 기준20.219→종료21.528MiB, **+1.309MiB**, 기존8MiB 기준 통과. 기준은 동시 화면·context 복구·예외·로딩 취소 단계가 끝난 뒤 한 화면만 살아 있는 상태에서 측정했다. 모든30회에서 old view/context0·canvas1·LUT listener1이었다.
- 최종 전체 해제: 기록한35개 이전 view/context와 예외 constructor context3개가 모두 수거됐고, canvas/LUT listener/view/context 모두0, heap7.235MiB였다. 전역 LUT 자체는 재사용용 CPU 객체로1개 남으며 dispose listener는0이다.
- 최종 `concurrent.png`, `survivor-after-30.png`도 직접 확인했다. 두 초기 사무실과30회 후 생존 사무실 모두 다섯 동료·가구·창밖·접촉 그림자가 렌더링되며 빈 화면이나 눈에 띄는 손상은 없었다. 이 광각 정지 화면으로 캐릭터 관절·접촉의 세부 품질을 판정하지 않는다.

실제 모델 자산은 두 화면 각각 복구 전·후3회 모두 아래 수를 유지했다. listener 최댓값은 skeleton을 제외하고1이며, skeleton 자체에는 dispose listener가 없었다. skeleton의 CPU 객체수 및 그 GPU boneTexture는 texture 집계에 포함된다.

| 실제 객체 종류 | CPU 객체수 | dispose listener 총수 | 복구 후3회 |
|---|---:|---:|---|
| Geometry | 380 | 303 | 동일 |
| Material | 183 | 160 | 동일 |
| Map/bone texture | 41 | 41 | 동일 |
| InstancedMesh | 159 | 128 | 동일 |
| Skeleton | 20 | 0 | 동일 |

## 한계

- old WebGL context WeakRef와 Texture dispose listener는 실제 객체의 수명 확인이다. V8 heap·native wrapper 수와 GPU VRAM/RSS를 동일하게 해석하지 않는다.
- Playwright의 Network instrumentation 및 JIT warming이 V8 heap에 포함될 수 있다. 이전 미보정의 snapshot 결과와 browser guard를 혼합해 제품 잔류 바이트를 추정하지 않는다.
- 동시 뷰 공유 texture 해제 후 활성 뷰가 정상적으로 재업로드·재렌더링하는 경로를 검사한다. 다른 렌더러 종류, WebGPU 및 실제2시간/실기기 검증의 대체가 아니다.
