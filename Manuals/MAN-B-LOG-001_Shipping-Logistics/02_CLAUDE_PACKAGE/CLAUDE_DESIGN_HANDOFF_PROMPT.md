# CLAUDE DESIGN HANDOFF PROMPT: MAN-B-LOG-001
## K SELECT Brand Portal Shipping & Logistics Manual

> **사용 방법**: 아래 프롬프트 전체를 복사하여 Claude Design 대화창에 바로 입력하세요.

```markdown
당신은 K SELECT의 수석 출판물 디자이너입니다.
제공된 `MAN-B-LOG-001_Shipping-Logistics/02_CLAUDE_PACKAGE` 패키지를 바탕으로, 브랜드사 물류 실무자를 위한 **공식 K SELECT 선적 & 출고 관리(Shipping & Logistics) 매뉴얼 PDF 및 최종 디자인**을 제작해 주십시오.

### 1. Master Design Reference
- `MAN-B-BRAND-001_Brand-Policy_V1.pdf`의 디자인 시스템(12-컬럼 그리드, 타이포그래피, 여백, 콜아웃, 다이어그램, 캡션 박스, 러닝 헤더/푸터)을 일관되게 계승하여 제작하십시오.

### 2. Mandatory Content & Chapter Structure
- `01_CONTENT/MAN-B-LOG-001_Manual_Content.md`의 본문 텍스트 전체를 한 글자도 누락 없이 정확히 배치하십시오.
  - Chapter 1: 선적 및 국제 물류 개요 (Logistics Overview & Domain Alignment)
  - Chapter 2: 선적 & 출고 관리 허브 둘러보기 (Shipping Hub UI)
  - Chapter 3: 출고 준비 완료 등록 (Goods Readiness Submission & Cargo Spec)
  - Chapter 4: 운송 책임별 출고 및 선적 이행 (Fulfillment Execution: LETUSTO vs SUPPLIER)
  - Chapter 5: 선적 추적 및 미국 창고 입고 인계 (Inbound Tracking & Receiving Handoff)
  - Chapter 6: 권한 관리 및 문제 해결 FAQ (ACL & Troubleshooting)

### 3. Visual Assets Integration
- `02_SCREENSHOTS/`: 11개의 실측 프로덕션 스크린샷(`SCR-B-LOG-001.png` ~ `SCR-B-LOG-011.png`)을 `SCREENSHOT_ANNOTATION_GUIDE.md`의 번호 콜아웃 및 캡션과 함께 배치하십시오.
- `03_DIAGRAMS/`: 7개의 아키텍처 다이어그램을 고대비 박스 카드 형태로 본문 흐름에 맞추어 시각화하십시오.

### 4. Strict Domain Rules
- `po_status`와 `supplier_confirmation_status`를 엄격히 분리 표기하십시오.
- `ARRIVED ≠ RECEIVED`, `RECEIVED ≠ COMPLETED`, `Shipping Complete ≠ Settlement Complete` 원칙을 유지하십시오.
- `MAN-B-FIN-001` 재무/인보이스 도메인을 물류의 후속 단계가 아닌 확정 PO 기준의 병렬 도메인으로 표현하십시오.
```
