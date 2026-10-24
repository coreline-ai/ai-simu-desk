# Practice 캐릭터 에셋

## min-soft-curls v1

- 소스: `min-hair.mjs`의 `createMinHair`, `installMinHair`.
- 출처: 이 프로젝트에서 직접 작성한 절차형 Three.js 형상. 외부 이미지·스캔·유료 에셋·생성형 이미지·Blender 파일을 사용하지 않았다.
- 좌표: metre, +Y, 기존 MinHead의 로컬 원점. 해당 부모의 고개 회전/이동을 상속한다.
- 디자인: 기존 민의 짙은 갈색 짧은 곱슬머리·둥근 안경을 유지. 연결된 뿌리/정수리 볼륨, 비대칭 굽은 앞머리, 관자놀이 컬과 작은 결을 추가한다.
- 예산: 병합 메시 2개, 7,940 triangles, 재질 2개, 텍스처/외부 다운로드 0개. 별도 RAF·물리·매 프레임 업데이트가 없다. 실제 GPU 비용 절감을 측정/보장하는 수치는 아니다.
- 적용: practice 전용. canonical v9 GLB와 다른 네 명은 바꾸지 않는다. 기존 Min_HairBack와 순수 Min_Curl 인스턴스만 숨긴다. 피부/귀/눈/안경을 섞은 배치는 거부한다.
- 해제: 원래 visible 값을 복원하고 생성한 geometry/material을 해제한다. 중복 장착은 거부하며 해제는 멱등이다.
- 빌드: JS 번들에 포함되므로 GLB 재생성/추가 요청이 필요 없다. build-manifest.json의 practiceAssets에 식별자를 기록한다.
- 검수: `../../MIN_HAIR_QA.md`, `../../tests/min-hair.test.mjs`.
