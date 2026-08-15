# K SELECT NETWORK — Curation Operations Documentation

본 디렉토리는 K SELECT NETWORK Admin 큐레이션 시스템의 **공식 내부 운영 매뉴얼(Korean Primary SOP)** 및 **실무 퀵 가이드**, 편집 가능한 HTML 원본, PDF 생성 스크립트 모음입니다.

---

## 📂 파일 구조 (File Directory)

* `01_K_SELECT_NETWORK_Curation_Operations_Manual_KR.pdf`: 한국어 공식 큐레이션 운영 매뉴얼 (PDF)
* `02_K_SELECT_NETWORK_Curation_Quick_Reference_Guide_KR.pdf`: 한국어 공식 큐레이션 실무 퀵 가이드 (PDF)
* `curation_operations_manual_kr.html`: Full Manual 편집용 원본 HTML 소스
* `curation_quick_reference_kr.html`: Quick Reference Guide 편집용 원본 HTML 소스
* `generate_kr_manuals.js`: Puppeteer 기반 한국어 PDF 자동 재생성 스크립트
* `assets/`: 큐레이션 가이드용 디자인 및 스크린샷 자산 저장 디렉토리

---

## 🛠️ 매뉴얼 수정 및 PDF 재빌드 방법 (Maintenance Guide)

Admin UI 변경이나 큐레이션 정책 변경 시 다음 명령어로 PDF를 손쉽게 재빌드할 수 있습니다:

```bash
$env:NODE_PATH="node_modules"
node docs/manuals/curation/generate_kr_manuals.js
```

---

* **발행 기관**: K SELECT NETWORK Operating Team
* **최종 개정일**: 2026년 8월 15일
