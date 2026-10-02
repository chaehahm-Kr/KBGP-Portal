# MAN-B-REG-001 — Workflow Map
## Regulatory, Certification & Compliance Process Diagrams

**Manual ID:** `MAN-B-REG-001`  
**Document Type:** Process Workflow Specifications & Diagram Maps  
**Scope:** Brand Portal & Admin Regulatory/Compliance Integration  

---

## 1. End-to-End Regulatory & Compliance Lifecycle

```mermaid
flowchart TD
    Start["Brand Portal Access"] --> Step1["Step 1: Brand Registration & Trademark Declaration"]
    Step1 --> CheckTM{"Has Trademark?"}
    CheckTM -- "Yes (KIPO / USPTO)" --> TMUpload["Enter Reg Number & Upload Proof PDF"]
    CheckTM -- "No / Pending" --> SkipTM["Continue Brand Registration (Policy 02)"]
    
    TMUpload --> Step2["Step 2: Product Creation & Catalog Identification"]
    SkipTM --> Step2
    
    Step2 --> RegInputs["Input Identification Data: UPC/EAN, Origin, FOB Price"]
    RegInputs --> IngInput["Input Ingredients (Korean Text / PDF)"]
    IngInput --> AITrans["Click AI Translation Widget (Korean -> English INCI)"]
    AITrans --> ApplyEN["Apply English INCI Text & Upload English PDF"]
    
    ApplyEN --> Step3["Step 3: Document Upload (FDA, MSDS, COA, Patents)"]
    Step3 --> CertSelect["Select Certificate Type: fda_registration / ingredient_certification / etc."]
    CertSelect --> FileUpload["Upload PDF/Image to company-uploads Bucket"]
    
    FileUpload --> EvalCheck{"Registration Evaluator Check"}
    EvalCheck -- "Missing UPC/FOB/Ingredients" --> StatusDraft["Status: DRAFT (보완 대기)"]
    EvalCheck -- "All Identification & Catalog Fields Valid" --> StatusComplete["Status: COMPLETE (등록 완료)"]
    
    StatusDraft --> Revisit["Brand User Updates Required Fields"]
    Revisit --> EvalCheck
    
    StatusComplete --> AdminAudit["Admin Audit & System Revalidation"]
```

---

## 2. Brand Trademark Registration Workflow (KIPO / USPTO)

```mermaid
flowchart LR
    subgraph Portal["Brand Portal (/portal/brands/new or edit)"]
        A["Check KIPO / USPTO Checkbox"] --> B["Input Registration Number"]
        B --> C["Upload Trademark Proof File (PDF/Image)"]
        C --> D["Submit Brand Form"]
    end

    subgraph Storage["Supabase Storage & DB"]
        D --> E["Save to company-uploads bucket"]
        E --> F["Serialize Metadata into intro JSON column"]
    end

    subgraph Admin["Admin Portal (/admin/brands/[brandId])"]
        F --> G["Parse Trademarks via parseBrandTrademarks()"]
        G --> H["Render Badge (KR / US) & Signed View/Download Links"]
        H --> I["Admin Audits Trademark Proof File"]
    end
```

---

## 3. Product Ingredient Declaration & AI Translation Workflow

```mermaid
flowchart TD
    A["User Enters Korean Ingredients in Textarea"] --> B["Click '번역하기 (Translate)' Button"]
    B --> C["Trigger API Request to Claude AI Engine"]
    C --> D["Return Standard English INCI Names"]
    D --> E["User Reviews AI Translation in Preview Box"]
    E --> F["Click '리뷰 완료 및 적용 (Apply to field)'"]
    F --> G["English Ingredients Field Automatically Populated"]
    G --> H["Upload Optional Korean/English PDF Files"]
    H --> I["Auto-sync File to product_certificates as 'ingredient_certification'"]
```

---

## 4. Product Certificate & Document Versioning Workflow

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

---

## 5. Admin Verification & Compliance Revalidation Workflow

```mermaid
flowchart LR
    A["Brand User Updates Regulatory Data"] --> B["Trigger Action / Server Mutation"]
    B --> C["Evaluate Registration Status Evaluator"]
    C --> D["Write Audit Log to product_change_history"]
    D --> E["Revalidate Admin & Portal Detail Pages"]
    E --> F["Admin Inspects Regulatory & Certificate Summary Card"]
    F --> G["Admin Verifies UPC/EAN, FOB & Uploaded Proof Files"]
```
