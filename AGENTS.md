<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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

## 8. Mandatory Completion Report Format
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
