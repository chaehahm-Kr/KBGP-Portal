# REFERENCE GUIDE & GLOSSARY: MAN-B-LOG-001
## K SELECT Brand Portal Shipping & Logistics Manual

본 문서는 `MAN-B-LOG-001` 공식 매뉴얼의 부록 및 퀵 레퍼런스 가이드입니다.

---

## 1. Domain Status Codes & Lifecycle Glossary

### 1.1 `purchase_orders.po_status` (발주서 승인 상태)
| 상태 코드 | 한글 표기 | 설명 |
| :--- | :--- | :--- |
| `DRAFT` | 임시저장 | 관리자가 발주서를 작성 중인 초기 상태 (공급사 미공개) |
| `PENDING_APPROVAL` | 승인대기 | 발주서 내부 결재 진행 중 |
| `APPROVED` | 승인완료 | 발주서 내부 결재가 완료되어 공급사에 발송 가능한 상태 |
| `SENT` | 발송완료 | 공급사에 공식 발주서가 전달되어 수락 검토 대기 중인 상태 |
| `CANCELLED` | 취소됨 | 발주서가 공식 취소된 상태 |

---

### 1.2 `purchase_orders.supplier_confirmation_status` (공급사 수락 상태)
| 상태 코드 | 한글 표기 | 설명 |
| :--- | :--- | :--- |
| `PENDING` | 확인대기 | 공급사의 수락/반려 검토 대기 상태 |
| `CONFIRMED` | 확정완료 | 공급사가 발주서를 수락하여 법적·물류 계약이 성립된 상태 |
| `REJECTED` | 거절/반려 | 공급사가 발주 조건을 거절하거나 수정을 요청한 상태 |

---

### 1.3 `purchase_orders.fulfillment_status` (발주 이행 진척도)
| 상태 코드 | 한글 표기 | 설명 |
| :--- | :--- | :--- |
| `PENDING` | 이행대기 | 발주 확정 후 아직 출고 준비가 시작되지 않은 초기 상태 |
| `READY_TO_SHIP` | 출고준비완료 | 공급사가 Goods Readiness 등록을 제출(`READY_SUBMITTED`)한 상태 |
| `PARTIALLY_SHIPPED` | 부분선적 | 발주 수량 중 일부 카고가 출항/선적된 상태 |
| `SHIPPED` | 선적완료 | 발주 전체 수량이 선적되어 운송 중인 상태 |
| `RECEIVED` | 입고완료 | 미국 물류센터에서 전수 실물 검수가 완료된 상태 |

---

### 1.4 `goods_readiness.handover_status` (출고 준비 인계 상태)
| 상태 코드 | 한글 표기 | 설명 |
| :--- | :--- | :--- |
| `DRAFT` | 임시저장 | 출고 정보가 임시 저장된 상태 (자유 수정 가능) |
| `READY_SUBMITTED` | 출고준비완료 | 출고 스펙 및 서류 제출 완료 (포워더 배정 및 선적 준비 개시) |
| `HANDOVER_PENDING` | 인계대기 | 본사 지정 포워더 픽업 예약 진행 중 |
| `HANDED_OVER` | 물품인계완료 | 포워더 차량에 화물 상차 완료 또는 공급사 자체 선적 등록 완료 |

---

### 1.5 `inbound_shipments.status` (국제 선적 상태)
| 상태 코드 | 한글 표기 | 설명 |
| :--- | :--- | :--- |
| `CREATED` | 선적생성 | 선적 마스터 번호 생성 및 부킹 단계 |
| `IN_TRANSIT` | 운송중 | 항공/해상 출항하여 미국으로 이동 중인 상태 |
| `ARRIVED` | 창고도착 | 미국 현지 물류센터 도크에 화물이 도착한 상태 |
| `PARTIALLY_RECEIVED` | 부분입고 | 일부 카톤에 대해 실물 바코드 검수가 완료된 상태 |
| `RECEIVED` | 전수검수완료 | 전체 화물 피스 카운팅 및 외관 검수가 완료된 상태 |
| `COMPLETED` | 행정종결 | 선적 및 창고 검수 행정 프로세스가 최종 종결된 상태 |
| `CANCELLED` | 선적취소 | 운송 취소 또는 사고로 선적이 취소된 상태 |

---

## 2. Cargo Packaging & CBM Calculation Formulas

### 2.1 CBM (Cubic Meter, 입방미터) 산출 공식
$$\text{CBM} = \text{카톤 가로(m)} \times \text{카톤 세로(m)} \times \text{카톤 높이(m)} \times \text{총 박스 수(Cartons)}$$

- **예시 계산**:
  - 카톤 규격: $50\text{cm} \times 40\text{cm} \times 30\text{cm} = 0.5\text{m} \times 0.4\text{m} \times 0.3\text{m} = 0.06\text{ CBM / 박스}$
  - 총 박스 수: $20\text{ Cartons}$
  - $\text{총 CBM} = 0.06 \times 20 = 1.200\text{ CBM}$

---

### 2.2 실측 중량 vs 용적 중량 (Gross Weight vs Volumetric Weight)
- **실측 총중량 (Gross Weight)**: 제품, 완충재, 카톤 박스를 포함한 저울 실측 중량 (kg).
- **항공 용적 중량**: $\text{가로(cm)} \times \text{세로(cm)} \times \text{높이(cm)} \div 6,000$ (kg).
- **해상 운임 기준**: $1\text{ CBM} \approx 1,000\text{ kg}$ (R/T 기준).

---

## 3. Disambiguation Principles (용어 혼동 방지 원칙)

> 1. `ARRIVED ≠ RECEIVED`
>    - `ARRIVED`는 화물이 목적지 도크에 도달한 물리적 도착 시점입니다.
>    - `RECEIVED`는 창고 검수자가 카톤을 개봉하여 바코드를 스캔하고 실물 수량/품질을 검수한 완료 시점입니다.
>
> 2. `RECEIVED ≠ COMPLETED`
>    - `RECEIVED`는 물품 검수 완료를 뜻합니다.
>    - `COMPLETED`는 정산 전표 및 행정 물류 절차가 최종 마감된 상태를 뜻합니다.
>
> 3. `Shipping Complete ≠ Settlement Complete`
>    - 물류의 선적/도착 완료와 재무의 인보이스 대금 결제/정산은 상호 독립적인 비즈니스 이벤트입니다.

---

## 4. Support & Inquiry Channels (고객지원)

- **Ask K SELECT (AI 지식 센터)**: Brand Portal 우측 상단 `Ask K SELECT` 메뉴를 통해 24시간 실시간 정책 및 물류 가이드 검색 가능.
- **1:1 운영 문의 (Support Center)**: `https://portal.kselectnetwork.com/portal/support` 에서 물류/선적 문의 티켓 발행.
- **긴급 물류 핫라인**: `logistics@letusto.com` / 본사 물류운영본부.
