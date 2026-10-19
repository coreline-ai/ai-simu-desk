# Vercel Hobby + PostgreSQL 배포

확인일: 2026-10-20 KST. Docker 없이 Node.js 22 Vercel Function 하나와 정적 CDN, Neon Free PostgreSQL을 사용한다. 별도 도메인 없이 프로젝트의 기본 `vercel.app` HTTPS로 시작한다. 현재 저장소에는 배포 설정과 검증된 코드가 있으며, 실제 사용자 Vercel/Neon 프로젝트에 배포한 상태는 아니다.

## 먼저 정할 것

- Vercel **Hobby**, Neon **Free**를 선택한다. 유료 플랜/체험/상시 작업자를 자동으로 생성하지 않는다. 무료 한도 내 개인·비상업 프로젝트가 대상이며, 사용자 수와 사용 시간에 따라 한도를 소모한다. [Hobby 조건](https://vercel.com/docs/plans/hobby), [Neon 통합](https://vercel.com/marketplace/neon).
- 현재 GitHub 저장소는 개인 사용자 소유의 비공개 저장소로 확인했다. Git 연결 시 Vercel 계정에 해당 저장소 접근 권한이 있어야 한다.
- DB는 Function과 가까운 지역에 둔다. 기본 Function 지역은 `iad1`이며, Neon도 미국 동부 지역을 선택한다. 이후 두 설정을 함께 바꿀 수 있다.

## 배포 순서

1. Vercel에서 이 GitHub 저장소를 Import한다. Root Directory는 저장소 루트, Node.js는 22.x, Framework Preset은 Other다. `vercel.json`의 빌드 명령 `npm run vercel-build`, 출력 `product/dist`를 사용한다.
2. Vercel Marketplace의 Neon을 **Free**로 연결하거나 기존 Neon Free DB를 연결한다. PostgreSQL의 **pooled connection string**을 서버 환경변수 `DATABASE_URL`에 넣는다. 브라우저용 변수에 넣지 않는다.
3. 프로젝트의 실제 Production URL을 확인하고 아래 환경변수를 Production 범위에 저장한다. 예제는 [환경 설정 예제](../deploy/vercel.env.example)다.

| 변수 | 설정 |
|---|---|
| `APP_MODE` | `vercel` |
| `APP_ORIGIN` | 실제 Production의 `https://프로젝트주소.vercel.app` 하나. 경로·쿼리 없음 |
| `DATABASE_URL` | Neon pooled PostgreSQL URL. 서버 전용 |
| `BETTER_AUTH_SECRET` | 암호학적 난수 32자 이상. 서버 전용·장기 보관 |
| `AI_PROVIDER` | `fake` |
| `FAKE_AI_DELAY_MS` | `65` (선택) |

`APP_ORIGIN`을 생략하면 Vercel의 `VERCEL_PROJECT_PRODUCTION_URL`을 사용한다. Preview는 `VERCEL_URL`을 사용한다. 시스템 환경변수를 제공하지 않는 설정이면 `APP_ORIGIN`을 반드시 명시한다. 기존 별도 도메인은 나중에 연결하고 APP_ORIGIN도 같은 주소로 바꾼 뒤 재배포한다. 임의 Host/Origin과 여러 호스트의 동시 로그인을 허용하지 않는다.

4. Redeploy한다. 빌드는 먼저 PostgreSQL에 체크섬 마이그레이션을 트랜잭션으로 적용하고, 정적 UI를 빌드한다. 마이그레이션 실패 시 배포 빌드도 실패한다. 기존 DB를 초기화하거나 덮어쓰지 않는다.
5. `/api/health`에서 `edition: vercel`, `database: postgresql`, `aiProvider: fake`를 확인한다. 앱에서 계정을 만들고 공동 공간을 만든다.
6. 다른 기기/독립 계정에서 같은 HTTPS 주소로 접속해 초대 코드로 참여한다. 온라인 집계, 나라·준 업무/승인/답변 공유, 로그아웃 후 퇴장을 확인한다. 휴대폰을 포함한 실제 원격 기기 검증은 프로젝트 배포 이후 수행해야 한다.

Preview에 Production DB/인증 비밀값을 그대로 연결하지 않는다. 별도 Preview DB·별도 secret을 사용하고 Preview의 실제 주소를 APP_ORIGIN에 설정한다. 기본 Production 도메인과 현재 배포의 고유 URL이 다르면 설정한 Production 주소로 접속한다.

## 왜 상시 서버가 필요하지 않은가

- `api/index.ts`는 요청을 Hono에 전달한다. 파일 DB와 상시 루프를 시작하지 않는다. 한 함수 인스턴스의 메모리가 다른 기기로 공유된다고 가정하지 않는다.
- 사용자/세션/권한/업무/입장·퇴장/임대는 PostgreSQL에 저장한다. 다중 탭은 사용자별 집계한다. 종료 알림 유실 시 마지막 heartbeat 후 75초 만료다.
- Fake AI는 입력에 따른 규칙 기반 답변이다. 저장된 시작 시각과 서버 시각으로 조회 시점의 진행·답변을 계산한다. 모든 화면을 닫으면 다음 조회 때 진행이 반영된다. 실제 외부 AI나 독립 백그라운드 작업을 실행했다고 표시하지 않는다.
- 2.5초마다 한 `/sync` 요청으로 업무·접속을 확인한다. 숨김 탭은 30초다. 원격에서도 승인·취소·실패/재시도·요청 키와 역할 제한을 유지한다.
- 소규모판의 모든 PostgreSQL 트랜잭션은 DB advisory transaction lock으로 직렬화한다. 여러 Function 인스턴스와 트랜잭션 풀링에서 같은 정책을 적용한다. 고부하 운영용 분산 처리로 검증한 구조는 아니다.

## 무료 사용량 관리

활성 탭 하나는 정기 sync만 약 **시간당 1,440회**, 숨김 탭은 약 **120회**다. 로그인·초대·업무 조작·초기 로딩은 추가된다. 현재 Hobby 문서의 월 1,000,000 Function 호출을 전부 sync에 쓴다는 단순 계산으로도 약 694 활성 탭 시간이며, 실제 한도에는 CPU·메모리·전송량과 DB compute/storage가 함께 작용한다. 무제한 무료 운영을 보장하지 않는다. [Vercel 한도](https://vercel.com/docs/plans/hobby), [Neon 요금/무료 범위](https://neon.com/pricing).

데모를 보지 않을 때 탭을 닫고, 계정 대시보드에서 사용량을 확인한다. 지속 조회는 Neon의 유휴 중단을 방해할 수 있다. 한도 증설을 자동으로 켜지 않는다. DB가 절전 중이면 첫 연결이 지연될 수 있고, 실패하면 화면은 확인 중으로 바꾼 뒤 재시도한다.

## 보안·운영 경계

- HTTPS 세션 쿠키는 Secure·HttpOnly·SameSite=Lax다. 출처는 설정된 origin 하나이고, IP 요청 제한은 Vercel이 전달하는 `x-vercel-forwarded-for`와 공유 PostgreSQL 카운터를 사용한다.
- 외부 PostgreSQL은 TLS 인증서/호스트 검증을 유지한다. URL의 ssl 옵션이 명시적 검증 설정을 약화하지 못하게 제거한다. `DATABASE_SSL=disable`은 loopback 시험에서만 가능하다.
- 공개 파일은 `product/dist`의 생성 UI/에셋이다. `.data`, 환경 파일, 소스·검증 계정은 공개 경로로 제공하지 않는다. 함수 진입점은 PGlite를 참조하지 않는다.
- 원격 접속 상태/최근 20건은 인스턴스 재생성 뒤에도 공유 DB에 남는다. 이전 로컬 메모리판과 보관 방식이 다르며 영구 감사 로그는 아니다.
- 신규 PostgreSQL은 별도 DB다. 기존 `.data/studio` 데이터를 자동 업로드하지 않는다. 원격 배포 전에 기존 DB 백업을 보존한다.
- `db:backup`/`db:restore`는 로컬 PGlite 전용이다. 원격 백업은 PostgreSQL `pg_dump`/`pg_restore` 또는 제공자의 백업 기능을 사용하고, 복구는 새 DB에서 검증한다. 이번 작업은 PGlite→Neon 실데이터 이전/클라우드 복구 훈련을 수행하지 않았다.
- 이메일 발송/인증·비밀번호 재설정 메일·MFA·상용 운영 보장은 이번 범위 밖이다.

## 검증 명령

```sh
npm ci
npm run typecheck
npm run check:boundaries
npm test
npm run build:vercel
# 별도 QA PostgreSQL에서만 실행: DB 이름이 studio_qa로 시작해야 한다.
# TEST_DATABASE_URL과 필요한 CA/HTTPS 파일 경로는 비공개 환경에 설정한다.
npm run test:postgres
```

`TEST_DATABASE_CA_FILE`, `TEST_HTTPS_CERT_FILE`, `TEST_HTTPS_KEY_FILE`을 설정하면 실제 로컬 TLS 네트워크 검사도 실행한다. 없으면 해당 HTTPS 검사는 skip으로 표시된다. 인증서 검증을 끄거나 브라우저 경고를 우회하지 않는다.

실제 Vercel 프로젝트가 연결된 환경에서는 Vercel CLI/대시보드로 배포한다. 이번 환경에는 Vercel CLI 인증/프로젝트 링크와 Neon 자격증명이 제공되지 않아 Vercel 플랫폼 빌드·공개 배포·실물 기기 시험은 하지 않았다. [구현·QA 결과](remote-qa.md).

## Docker 지원 여부

2026-10-20 확인한 [Vercel 공식 Docker 안내](https://vercel.com/kb/guide/deploy-nodejs-on-vercel-with-docker)는 `Dockerfile.vercel` 지원을 설명한다. 컨테이너도 요청 기반 Function으로 실행되며 PostgreSQL 저장과 상시 작업자를 함께 띄우는 Compose 서버가 아니다. 이 저장소의 Hobby 배포 경로는 Docker가 필요 없는 네이티브 Node Function이다.
