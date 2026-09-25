<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DEPLOY-STD-001: Standard Development → Git → Vercel Production Deployment Workflow

## 적용 대상
이 규칙은 `KSelectNetwork-ADMIN` 및 `KSelectNetwork-Portal` 프로젝트를 개발하는 **모든 Antigravity Agent / 개발 환경**에 공통 적용합니다.
현재 여러 장소/Agent에서 동일 Repository를 개발할 수 있으므로, 모든 개발 Task는 아래 표준 절차를 반드시 따릅니다.

---

# 핵심 원칙
**코드 작성 완료 ≠ Task COMPLETE**

Task는 다음 전체 과정이 끝난 경우에만 COMPLETE입니다:
Local Development → Latest Git Sync → Code QA → SQL Migration QA → Git Commit → Git Push → Vercel Production Deployment → Production Supabase Migration → Custom Domain Verification → Production Browser QA

---

# 1. 개발 시작 전 — Git 최신화 필수
어떤 Task를 시작하기 전에도 먼저 현재 Repository 상태를 확인합니다:
- `git status`
- current branch (`main`)
- local HEAD vs `origin/main` HEAD
- uncommitted changes, untracked files
- remote commits not pulled (`git fetch origin`, `git pull origin main`)

> **원칙**: 오래된 Local Code 위에서 개발을 시작하지 마세요. 다른 Agent가 이미 main에 올린 변경사항을 먼저 가져온 후 개발합니다.

---

# 2. 기존 작업 보호
세 개 이상의 Agent가 동일 Repository에서 작업할 수 있습니다:
- 다른 Task의 코드를 임의 삭제하지 말 것
- Unrelated file을 revert하지 말 것
- 다른 Agent의 recent commit을 overwrite하지 말 것
- Force push 금지
- `git reset --hard origin/main`을 임의 사용하지 말 것
- Conflict 발생 시 내용 확인 없이 한쪽 버전을 선택하지 말 것 (각 Task 변경사항 보존)

---

# 3. Task 개발
- 각 Task는 기존 Task ID를 유지 (예: `ADM-WHS-002-R1`, `PORT-CMP-001`)
- 요청된 범위만 수정하고 unrelated redesign 금지

---

# 4. 개발 완료 후 Local QA
코드 수정 완료 후 반드시 실행:
- `npx tsc --noEmit` (또는 `npm.cmd exec tsc -- --noEmit`) → TypeScript errors = 0
- `npm run build` → Production Build = Success
- 기능 단위 테스트 및 Playwright E2E 테스트 실행

---

# 5. Git Diff Review
Commit 전에 반드시:
- `git status` 및 `git diff` 확인
- 이번 Task 관련 파일만 수정되었는지 확인
- Debug code, test-only credentials, secrets, temporary files 잔존 여부 점검

---

# 6. SQL / Supabase Migration Audit
- Table, column, index, RLS, constraint, enum/type, function, trigger 변경 시 `supabase/migrations/00XX_xxx.sql`로 관리
- Migration 파일 생성으로 끝나는 것이 아니라 Production DB 실제 적용 및 스키마 검증 필수

---

# 7. Destructive SQL Protection
- `DROP TABLE`, `DROP COLUMN`, 대량 DELETE, 데이터 초기화 등 비가역적 변경은 자동 실행 금지 → 사용자 명시적 승인 후 진행

---

# 8. Commit 전 Remote 재확인
- Commit/Push 전 `git fetch origin` 실행하여 remote `origin/main` 최신 커밋 반영 및 충돌 방지

---

# 9. Git Commit
- Task ID가 포함된 명확한 Commit 메시지 작성 (예: `feat(company): ADM-CMP-002 add shipping origin information`)

---

# 10. Git Push
- `origin/main`으로 push 후 `Local HEAD === origin/main HEAD` 확인

---

# 11. Vercel Production Deployment
- Vercel Production 자동 배포 상태 확인 (Deployment status = Ready, Commit SHA 일치)

---

# 12. Custom Domain Verification
- 실제 운영 도메인 확인:
  - Admin: `https://admin.kselectnetwork.com`
  - Brand Portal: `https://portal.kselectnetwork.com`
- Custom Domain이 최신 Production Deployment를 가리키는지 확인

---

# 13. Deployment Fingerprint 확인
- `Local HEAD = origin/main = Vercel Production = Custom Domain Runtime` 일치 확인

---

# 14. Production Supabase Environment 확인
- Production Supabase Project Ref 및 마이그레이션 적용 상태 확인

---

# 15. SQL Migration 실제 적용 확인
- Production DB에 column, FK, index, RLS가 실제 생성되었는지 스키마 확인

---

# 16. Production Browser QA
- 실제 Production 도메인에서 브라우저를 통해 새 기능 동작, 저장/새로고침 시 영속성(Persistence), 기존 기능 회귀(Regression) 여부 테스트

---

# 17. Admin + Portal Shared Feature
- Admin과 Portal 공유 기능은 양방향 동기화(Admin 수정 → Portal 반영, Portal 수정 → Admin 반영) 검증

---

# 18. Cache / Revalidation
- `revalidatePath`, `revalidateTag` 적절히 호출하여 실시간 UI 갱신 보장

---

# 19. COMPLETE 금지 조건
다음 중 하나라도 해당하면 `COMPLETE`로 보고하지 않음:
- Local에서만 코드 수정됨 / Commit 안 됨 / Push 안 됨
- Vercel Production deployment 미완료 또는 SHA 불일치
- SQL migration이 Production DB에 미적용됨
- Custom Domain에서 최신 기능 미반영
- Production Browser QA 미실행
- 미완료 시 상태: `IMPLEMENTATION COMPLETE / DEPLOYMENT PENDING` 또는 `DEPLOYMENT COMPLETE / PRODUCTION QA PENDING`

---

# 20. 최종 COMPLETE 정의
다음 7개 단계가 모두 충족되어야 `COMPLETE`:
1. Code Implementation Complete
2. TypeScript 0 Errors & Production Build PASS
3. Git Commit & Push (`Local HEAD === origin/main`)
4. Supabase Production Migration Applied & Schema Verified
5. Vercel Production Deployment Ready (`Vercel SHA === Git SHA`)
6. Custom Domain Serving Latest Deployment
7. Production Browser QA Passed (Persistence & No Regression)

---

# 21. Mandatory Completion Report Schema
모든 개발 Task 완료 보고에는 아래 정보를 포함:

```markdown
## Task
- Task ID:
- Task Name:

## Development
- Modified Files:
- Migration Files:

## QA
- TypeScript:
- Build:
- Functional Test:

## Git
- Commit SHA:
- Commit Message:
- origin/main SHA:
- Push Status:

## Vercel
- Production Deployment:
- Production SHA:
- Deployment Status:

## Production Domain
- Admin:
- Portal:

## Supabase
- Production Project Ref:
- Migration Applied:
- Schema Verified:

## Production Browser QA
- Tested URL:
- Scenario:
- Persistence:
- Regression:

## Final Integrity
- Local HEAD = origin/main = Vercel Production = Custom Domain Runtime: YES / NO
- Production Supabase Migration Applied & Schema Verified: YES / NO (or N/A)

## Final Status
COMPLETE
```

---

# 22. 핵심 작업 신조 (Core Mantras)
> 1. 개발의 완료는 Local Code가 아니라 Production에서 실제 사용자가 사용할 수 있는 상태를 의미한다.
> 2. 다른 Agent가 작업할 수 있으므로 작업 시작 전과 Push 직전에 반드시 origin/main을 다시 확인한다.
# 24. Standalone One-Click Copyable SQL Execution Block
- 작업 중 Supabase SQL Editor 등에서 사용자/관리자가 직접 SQL을 실행해야 하는 경우, 반드시 **실행할 순수 SQL만 포함된 독립된 단일 ` ```sql ` 코드 블록**을 제공합니다.
- 복사 과정에서 문법 오류를 유발할 수 있는 불필요한 서식, 마크다운 중첩, 오류 유발 주석을 배제하고 즉시 "Copy code" 버튼 하나로 복사하여 붙여넣고 실행할 수 있도록 작성합니다.

---

# 25. Standing Rule for Product Domain Architecture Alignment (Brand Portal & Admin)
- Brand Portal과 Admin은 서로 분리된 별개의 제품 시스템으로 진화해서는 안 됩니다.
- K SELECT 전체 시스템에는 단 하나의 authoritative Product domain model이 존재합니다.
- 브랜드 포털(`lib/product/*`, `components/product/*`)에 새로운 기능, 속성 연산 로직, 검증 규칙, 로지스틱스 스펙 등이 추가되거나 수정되는 경우, 반드시 어드민 제품 관리(`app/admin/products/*`, `components/admin/*`)에서도 동일한 도메인 모델과 연산식을 맞추어 동기화 작업을 수행해야 합니다.

---

<!-- BEGIN:deploy-std-001-rules -->
# [DEPLOY-STD-001] Standard Development → Git → Vercel Production Deployment Workflow

All Antigravity Agents working in this repository MUST strictly comply with this workflow without exception.

## 1. Core Principle
**Code writing complete ≠ Task COMPLETE**
A task is only COMPLETE when:
Local Development → Latest Git Sync → Code QA (`tsc` + `npm run build`) → SQL Migration QA → Git Commit → Git Push → Vercel Production Deployment → Production Supabase Migration → Custom Domain Verification → Production Browser QA.

## 2. Before Starting Any Task (Git Sync)
Always run and verify:
- `git status`, current branch, local HEAD, `origin/main` HEAD.
- Fetch and pull latest changes from `origin/main` before starting.
- Never start work on stale local code.

## 3. Protect Existing Work & Multi-Agent Concurrency
- Never delete or revert another agent's code/commit without confirmation.
- No force push (`--force` is forbidden).
- No arbitrary `git reset --hard origin/main`.
- Resolve conflicts by preserving both task changes safely.

## 4. Local QA Requirements
- `npx tsc --noEmit` (TypeScript errors = 0)
- `npm run build` (Production Build = Success)

## 5. SQL / Supabase Migrations
- Migration files must be created in `supabase/migrations/xxxx_name.sql`.
- Migration files in Git do NOT mean DB is migrated.
- Migration MUST be applied to Production Supabase (`shzfrppdobpmrstcjfqu`) and verified.
- **Destructive SQL Protection**: `DROP TABLE`, `DROP COLUMN`, bulk `DELETE`, table resets are FORBIDDEN without explicit user sign-off.

## 6. Pre-Push Remote Check & Git Push
- Run `git fetch origin` before commit/push to ensure `origin/main` has not moved.
- Commit with clear Task ID (e.g. `feat(warehouse): ADM-WHS-002-R1 ...`).
- Push to `origin/main` and verify `Local HEAD == origin/main HEAD`.

## 7. Vercel Production Deployment & Domain Verification
- Wait for Vercel production build to complete.
- Verify live `/api/diagnostics` fingerprint:
  `Local HEAD = origin/main = Vercel Production = Custom Domain Runtime`
- Verify custom domains:
  - Admin: `https://admin.kselectnetwork.com`
  - Brand Portal: `https://portal.kselectnetwork.com`
- Strict Timeout: All curl/network requests must use strict timeouts (e.g. `curl -sS --max-time 15`) and must never run indefinitely.

## 8. Standalone One-Click Copyable SQL Blocks
Whenever manual SQL execution is required in Supabase SQL Editor:
- Always provide the pure SQL code in a standalone, dedicated ` ```sql ` code block.
- Do not nest the SQL inside other markdown containers so the user can copy and run it with one click.

## 9. Mandatory Completion Report Format
Every completed task MUST output a single one-click copyable markdown block containing:
- Task ID & Name
- Development (Modified files, Migration files)
- QA (TypeScript, Build, Functional tests)
- Git (Commit SHA, Message, origin/main SHA, Push status)
- Vercel (Production Deployment status, Production SHA)
- Production Domain & Supabase verification
- Production Browser QA results
- Integrity Line: `Local HEAD = origin/main = Vercel Production = Custom Domain Runtime` -> YES / NO
- DB Integrity Line (if DB changed): `Production Supabase Migration Applied & Schema Verified` -> YES / NO
- Final Status: `COMPLETE` (or specific pending status)
<!-- END:deploy-std-001-rules -->
