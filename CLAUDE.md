@AGENTS.md

## 데이터베이스 작업 규칙 (Supabase MCP)

이 프로젝트는 Supabase MCP 서버가 `.mcp.json`에 연결되어 있다
(project ref: `shzfrppdobpmrstcjfqu`, 개발용 프로젝트).

**절대 사용자에게 Supabase 대시보드 SQL Editor에서 SQL을 수동 실행하라고 요청하지 말 것.**
SQL은 반드시 MCP 툴로 직접 실행한다. README의 "Supabase 프로젝트 준비" 3번(SQL Editor에서
수동 실행)은 신규 환경을 처음 세팅할 때의 안내이며, 이 개발 프로젝트의 일상 작업에는
적용하지 않는다.

- 새 마이그레이션(`create table`, `alter table`, RLS 정책, 함수/트리거 등)은
  `supabase/migrations/` 에 번호 순서대로 파일을 만든 뒤 **`apply_migration` 툴로 직접 적용**한다.
  → 마이그레이션 히스토리에 기록되어 추적·롤백이 가능하다.
- 확인용 조회(SELECT, 스키마 점검 등)는 **`execute_sql` 툴**을 사용한다.
- `read_only` 모드는 사용하지 않는다 — DDL이 필요하기 때문이다. `.mcp.json`의 URL에
  `read_only=true`를 임의로 추가하지 마라.

### 각 단계(스테이지) 완료 시 절차

1. 해당 단계의 마이그레이션 파일을 작성한다
2. `apply_migration`으로 **직접 적용**한다
3. `execute_sql`로 **직접 검증**한다 — 테이블·컬럼·제약조건·RLS 정책이 의도대로 생성됐는지 확인
4. 검증 결과를 요약해서 보고한다 (사용자가 대시보드를 열어볼 필요가 없도록)
5. 사용자 승인을 받은 뒤 다음 단계로 넘어간다

에러가 나면 사용자에게 떠넘기지 말고, 에러 메시지를 스스로 읽고 원인을 수정한 뒤 재시도한다.

### 마이그레이션 작성 시 주의

`create table` 다음에 그 테이블을 참조하는 `create function`이 오는 순서를 반드시 지킨다.
`language sql` 함수는 plpgsql과 달리 생성 시점에 본문이 참조하는 테이블의 존재 여부를
검증하므로, 순서가 바뀌면 `relation ... does not exist` 에러가 난다.

## 의사결정 및 자동 진행(Auto-Proceed) 규칙

기획 및 설계 단계에서 사용자에게 질문을 제시한 뒤 시스템 정책에 의해 **자동 진행(Auto-Proceed / Auto-Approved)**이 될 경우, **어떤 질문에 대해 어떻게 판단하고 결정하여 개발을 진행했는지(답변 내역 및 이유)**를 사용자에게 명시적으로 보고해야 한다.
- 질문 내용 및 해당 질문에 대해 AI가 선택한 최종 결정안(Option) 요약
- 해당 결정을 선택한 비즈니스/기술적 근거
- 진행된 작업과 최종 결과의 연관성 명시
