# REGULATORY_ARCHITECTURE_DIAGRAMS.md
## Regulatory, Certification & Compliance Process Diagrams

**Manual ID:** `MAN-B-REG-001`  
**Document Type:** Process Architecture & Technical Diagrams  
**Asset Folder:** `03_DIAGRAMS/`  

---

## 1. Compliance Lifecycle & Product Completion Evaluator Diagram

```mermaid
flowchart TD
    Start["Brand Portal Access"] --> Step1["Step 1: Brand Registration & Trademark Declaration"]
    Step1 --> CheckTM{"Has Trademark?"}
    CheckTM -- "Yes (KIPO / USPTO)" --> TMUpload["Enter Reg Number & Upload Proof PDF"]
    CheckTM -- "No / Pending" --> SkipTM["Continue Brand Registration (Policy 02)"]
    
    TMUpload --> Step2["Step 2: Product Creation & Catalog Identification"]
    SkipTM --> Step2
    
    Step2 --> RegInputs["Input Identification Data: UPC/EAN"]
    RegInputs --> IngInput["Input Ingredients (Korean Text / PDF)"]
    IngInput --> AITrans["Click AI Translation Widget (Korean -> English INCI)"]
    AITrans --> ApplyEN["Apply English INCI Text & Upload English PDF"]
    
    ApplyEN --> Step3["Step 3: Document Upload (FDA, MSDS, COA, Patents)"]
    Step3 --> CertSelect["Select Certificate Type: fda_registration / ingredient_certification / etc."]
    CertSelect --> FileUpload["Upload PDF/Image to company-uploads Bucket"]
    
    FileUpload --> EvalCheck{"Registration Evaluator Check"}
    EvalCheck -- "Missing UPC / Ingredients" --> StatusDraft["Status: DRAFT (보완 대기)"]
    EvalCheck -- "All Identification & Catalog Fields Valid" --> StatusComplete["Status: COMPLETE (등록 완료)"]
    
    StatusDraft --> Revisit["Brand User Updates Required Fields"]
    Revisit --> EvalCheck
    
    StatusComplete --> AdminAudit["Admin Audit & System Revalidation"]
```

---

## 2. Certificate Version Control Data Flow

```mermaid
flowchart TD
    A["Upload New Certificate File (e.g. FDA Registration or MSDS PDF)"] --> B["Query Existing Certificates for product_id + certificate_type"]
    B --> C{"Existing Certificate Found?"}
    C -- "Yes" --> D["Set Existing File is_current = false"]
    D --> E["Increment Next Version = Current Version + 1"]
    C -- "No" --> F["Set Next Version = 1"]
    E --> G["Insert New Record into product_certificates (is_current = true)"]
    F --> G
    G --> H["Record Audit Log in product_change_history"]
    H --> I["Trigger revalidatePath for Product Detail & Admin Views"]
```
