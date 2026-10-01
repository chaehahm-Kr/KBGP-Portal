const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

const ASSETS_ROOT = path.join(process.cwd(), 'KSELECT_Brand_Portal_Manual_Assets');
const CLEAN_DIR = path.join(ASSETS_ROOT, '01_Clean_Screenshots');
const ANNOTATED_DIR = path.join(ASSETS_ROOT, '02_Annotated_Screenshots');

async function getAuthSession(email = 'account@letusto.com') {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email
  });
  if (linkErr) throw linkErr;
  const tokenHash = linkData.properties?.hashed_token;

  const client = createClient(supabaseUrl, anonKey);
  const { data: sessionData, error: verifyErr } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink'
  });
  if (verifyErr) throw verifyErr;
  return sessionData;
}

// Annotation Helper using Playwright computed bounding boxes
async function injectAnnotationsWithBoxes(page, resolvedItems) {
  await page.evaluate((items) => {
    document.querySelectorAll('.manual-annotation-overlay').forEach(el => el.remove());

    const overlayContainer = document.createElement('div');
    overlayContainer.className = 'manual-annotation-overlay';
    overlayContainer.style.position = 'absolute';
    overlayContainer.style.top = '0';
    overlayContainer.style.left = '0';
    overlayContainer.style.width = '100%';
    overlayContainer.style.height = `${Math.max(document.documentElement.scrollHeight, window.innerHeight)}px`;
    overlayContainer.style.pointerEvents = 'none';
    overlayContainer.style.zIndex = '999999';
    document.body.appendChild(overlayContainer);

    items.forEach((item, idx) => {
      const { box, label, number } = item;
      if (!box) return;

      // Highlight Box
      const boxEl = document.createElement('div');
      boxEl.style.position = 'absolute';
      boxEl.style.top = `${box.y - 4}px`;
      boxEl.style.left = `${box.x - 4}px`;
      boxEl.style.width = `${box.width + 8}px`;
      boxEl.style.height = `${box.height + 8}px`;
      boxEl.style.border = '2.5px solid #2563EB';
      boxEl.style.backgroundColor = 'rgba(37, 99, 235, 0.08)';
      boxEl.style.borderRadius = '8px';
      boxEl.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.85), 0 4px 12px rgba(37, 99, 235, 0.3)';
      boxEl.style.pointerEvents = 'none';
      overlayContainer.appendChild(boxEl);

      // Number Badge + Label
      const badge = document.createElement('div');
      badge.style.position = 'absolute';
      badge.style.top = `${Math.max(8, box.y - 16)}px`;
      badge.style.left = `${Math.max(8, box.x - 12)}px`;
      badge.style.display = 'flex';
      badge.style.alignItems = 'center';
      badge.style.gap = '6px';
      badge.style.backgroundColor = '#1D4ED8';
      badge.style.color = '#FFFFFF';
      badge.style.padding = '4px 10px 4px 6px';
      badge.style.borderRadius = '20px';
      badge.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif';
      badge.style.fontSize = '12px';
      badge.style.fontWeight = '700';
      badge.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25), 0 0 0 2px #FFFFFF';
      badge.style.zIndex = '1000000';

      const numCircle = document.createElement('span');
      numCircle.style.width = '20px';
      numCircle.style.height = '20px';
      numCircle.style.backgroundColor = '#FFFFFF';
      numCircle.style.color = '#1D4ED8';
      numCircle.style.borderRadius = '50%';
      numCircle.style.display = 'inline-flex';
      numCircle.style.alignItems = 'center';
      numCircle.style.justifyContent = 'center';
      numCircle.style.fontSize = '12px';
      numCircle.style.fontWeight = '900';
      numCircle.innerText = number || (idx + 1);
      badge.appendChild(numCircle);

      if (label) {
        const txt = document.createElement('span');
        txt.innerText = label;
        badge.appendChild(txt);
      }

      overlayContainer.appendChild(badge);
    });
  }, resolvedItems);
}

async function removeAnnotations(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.manual-annotation-overlay').forEach(el => el.remove());
  });
}

async function captureScreen(page, baseName, annotationLocators = [], options = {}) {
  const cleanPath = path.join(CLEAN_DIR, `${baseName}_Clean.png`);
  const annotatedPath = path.join(ANNOTATED_DIR, `${baseName}_Annotated.png`);

  await page.waitForTimeout(1000);
  if (options.beforeCapture) {
    await options.beforeCapture(page);
    await page.waitForTimeout(500);
  }

  // Ensure annotations removed for clean shot
  await removeAnnotations(page);
  await page.screenshot({ path: cleanPath, fullPage: options.fullPage || false });
  console.log(`  ✓ Saved Clean: ${path.basename(cleanPath)}`);

  // Resolve bounding boxes
  const resolvedItems = [];
  for (let i = 0; i < annotationLocators.length; i++) {
    const item = annotationLocators[i];
    let box = null;
    if (item.locator) {
      try {
        const loc = item.locator.first();
        if (await loc.isVisible()) {
          const bb = await loc.boundingBox();
          if (bb) {
            const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
            box = {
              x: bb.x + scroll.x,
              y: bb.y + scroll.y,
              width: bb.width,
              height: bb.height
            };
          }
        }
      } catch (e) {
        // ignore fallback
      }
    } else if (item.box) {
      box = item.box;
    }

    if (box) {
      resolvedItems.push({
        box,
        label: item.label,
        number: item.number || (i + 1)
      });
    }
  }

  if (resolvedItems.length > 0) {
    await injectAnnotationsWithBoxes(page, resolvedItems);
    await page.waitForTimeout(200);
    await page.screenshot({ path: annotatedPath, fullPage: options.fullPage || false });
    console.log(`  ✓ Saved Annotated: ${path.basename(annotatedPath)} (${resolvedItems.length} callouts)`);
    await removeAnnotations(page);
  } else {
    await page.screenshot({ path: annotatedPath, fullPage: options.fullPage || false });
    console.log(`  ✓ Saved Annotated: ${path.basename(annotatedPath)}`);
  }
}

async function main() {
  console.log('===================================================================');
  console.log('=== K SELECT BRAND PORTAL MANUAL ASSET PACK GENERATOR ===');
  console.log('===================================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // -------------------------------------------------------------
  // SCREEN 01-A: Website Entry Point (Home Hero & Header)
  // -------------------------------------------------------------
  console.log('\n[Screen 01-A] Capturing Marketing Site Entry Point...');
  await page.goto('https://www.kselectnetwork.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));

  await captureScreen(page, '01_01_Website_Home', [
    { locator: page.locator('button:has-text("PARTNER WITH US"), a:has-text("PARTNER WITH US")').first(), label: 'Partner With Us / 입점 신청' },
    { locator: page.locator('a[href*="portal.kselectnetwork.com"]').first(), label: 'Brand Portal Login / 포털 로그인' },
    { locator: page.locator('header, nav').first(), label: 'Main Navigation & Program Overview' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 01-B: Marketing Site Partner Application
  // -------------------------------------------------------------
  console.log('\n[Screen 01-B] Capturing Partner Application Form...');
  const applyBtn = page.locator('button:has-text("PARTNER WITH US"), a:has-text("PARTNER WITH US"), a[href*="/apply"]').first();
  if (await applyBtn.isVisible()) {
    await applyBtn.click();
    await page.waitForTimeout(1500);
  }
  
  await captureScreen(page, '01_02_Website_Partner_Application', [
    { locator: page.locator('input[name="company_name"], input[placeholder*="회사명"]').first(), label: '회사 기본 정보' },
    { locator: page.locator('input[name="contact_name_kr"], input[name="name_kr"], input[name="first_name_en"]').first(), label: '담당자 한글/영문 성명 & 연락처' },
    { locator: page.locator('input[name="brand_name"], input[placeholder*="브랜드명"]').first(), label: '주력 브랜드명' },
    { locator: page.locator('form button[type="submit"], button:has-text("신청"), button:has-text("제출")').first(), label: '입점 신청서 제출' }
  ], { fullPage: false });

  // -------------------------------------------------------------
  // SCREEN 02-A: Brand Portal Login
  // -------------------------------------------------------------
  console.log('\n[Screen 02-A] Capturing Brand Portal Login...');
  await page.goto('https://portal.kselectnetwork.com/portal/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  await captureScreen(page, '02_01_Portal_Login', [
    { locator: page.locator('input[type="email"], input[name="email"]').first(), label: '계정 이메일 입력' },
    { locator: page.locator('input[type="password"], input[name="password"]').first(), label: '비밀번호 입력' },
    { locator: page.locator('button[type="submit"], button:has-text("로그인")').first(), label: '로그인' },
    { locator: page.locator('a[href*="reset-password"], a:has-text("비밀번호")').first(), label: '비밀번호 재설정' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 02-B: Brand Portal Sign Up
  // -------------------------------------------------------------
  console.log('\n[Screen 02-B] Capturing Brand Portal Sign Up...');
  await page.goto('https://portal.kselectnetwork.com/portal/signup', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  await captureScreen(page, '02_02_Portal_Signup', [
    { locator: page.locator('input[type="email"], input[name="email"]').first(), label: '가입 이메일' },
    { locator: page.locator('input[type="password"], input[name="password"]').first(), label: '비밀번호' },
    { locator: page.locator('input[name="company_name"], input[placeholder*="회사명"]').first(), label: '회사명' },
    { locator: page.locator('button[type="submit"], button:has-text("가입"), button:has-text("회원가입")').first(), label: '회원가입 요청' }
  ]);

  // -------------------------------------------------------------
  // SETUP AUTHENTICATED SESSION FOR BRAND PORTAL
  // -------------------------------------------------------------
  console.log('\n[Auth] Authenticating brand session for portal pages...');
  const sessionData = await getAuthSession('account@letusto.com');
  const projectRef = 'shzfrppdobpmrstcjfqu';
  const sessionCookieValue = JSON.stringify({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_at: sessionData.session.expires_at,
    token_type: 'bearer',
    user: sessionData.user
  });

  await context.addCookies([
    {
      name: `portal-sb-${projectRef}-auth-token`,
      value: encodeURIComponent(sessionCookieValue),
      domain: 'portal.kselectnetwork.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax'
    },
    {
      name: `sb-${projectRef}-auth-token`,
      value: encodeURIComponent(sessionCookieValue),
      domain: 'portal.kselectnetwork.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax'
    }
  ]);

  // -------------------------------------------------------------
  // SCREEN 03-A: Company Profile & Information
  // -------------------------------------------------------------
  console.log('\n[Screen 03-A] Capturing Company Profile & Information...');
  await page.goto('https://portal.kselectnetwork.com/portal/company/info', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  await captureScreen(page, '03_01_Company_Profile_Info', [
    { locator: page.locator('input[value*="Brands Global"], div:has-text("회사명"), div:has-text("사업자등록번호")').first(), label: '회사 기본 정보 (상호, 사업자번호, 대표 연락처)' },
    { locator: page.locator('div:has-text("출하지 정보"), div:has-text("Shipping Origin")').first(), label: '출하지 / 물류 발송지 등록' },
    { locator: page.locator('button:has-text("저장"), button:has-text("수정")').first(), label: '회사 정보 저장' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 03-B: Company Contacts & Role Assignments
  // -------------------------------------------------------------
  console.log('\n[Screen 03-B] Capturing Company Contacts & Roles...');
  await page.goto('https://portal.kselectnetwork.com/portal/company/users', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  await captureScreen(page, '03_02_Company_Contacts_Roles', [
    { locator: page.locator('table, div:has-text("소속 담당자 목록")').first(), label: '소속 담당자 목록 (한글/영문 성명 표준화)' },
    { locator: page.locator('button:has-text("담당자 초대"), button:has-text("사용자 추가")').first(), label: '새 담당자 초대' },
    { locator: page.locator('div:has-text("담당 업무 및 주 담당자")').first(), label: '영역별 주 담당자 지정' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 04-A: Brand Management List
  // -------------------------------------------------------------
  console.log('\n[Screen 04-A] Capturing Brand Management List...');
  await page.goto('https://portal.kselectnetwork.com/portal/brands', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  await captureScreen(page, '04_01_Brand_Management_List', [
    { locator: page.locator('a[href*="/portal/brands/new"], button:has-text("새 브랜드"), a:has-text("브랜드 추가")').first(), label: '새 브랜드 등록' },
    { locator: page.locator('table, div:has-text("브랜드 목록"), div:has-text("Brand")').first(), label: '보유 브랜드 카탈로그' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 04-B: New Brand Registration Form
  // -------------------------------------------------------------
  console.log('\n[Screen 04-B] Capturing Brand Registration Form...');
  await page.goto('https://portal.kselectnetwork.com/portal/brands/new', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  await captureScreen(page, '04_02_Brand_Registration_New', [
    { locator: page.locator('input[name="name_kr"], input[placeholder*="한글"]').first(), label: '브랜드 국문명 (필수)' },
    { locator: page.locator('input[name="name_en"], input[placeholder*="영문"]').first(), label: '브랜드 영문명 (필수)' },
    { locator: page.locator('input[name="website"], input[placeholder*="https://"]').first(), label: '공식 웹사이트 / 온라인 몰' },
    { locator: page.locator('textarea[name="description"], textarea[placeholder*="소개"]').first(), label: '브랜드 스토리 및 소개' },
    { locator: page.locator('input[type="file"], div:has-text("로고")').first(), label: '브랜드 로고 업로드' },
    { locator: page.locator('button[type="submit"], button:has-text("등록"), button:has-text("저장")').first(), label: '브랜드 등록 완료' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 05: Product List & Navigation
  // -------------------------------------------------------------
  console.log('\n[Screen 05] Capturing Product Management List...');
  await page.goto('https://portal.kselectnetwork.com/portal/products', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  await captureScreen(page, '05_01_Product_Management_List', [
    { locator: page.locator('a[href="/portal/products/new"], button:has-text("새 제품 추가")').first(), label: '새 제품 추가 (New Product)' },
    { locator: page.locator('button:has-text("스킨케어"), div:has-text("카테고리:")').first(), label: '카테고리 원클릭 필터 버튼' },
    { locator: page.locator('button:has-text("등록완료"), div:has-text("등록 상태:")').first(), label: '등록 상태 다중 필터' },
    { locator: page.locator('table thead, table tbody').first(), label: '제품 목록 및 썸네일' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 06-A: New Product Registration - Basic Info
  // -------------------------------------------------------------
  console.log('\n[Screen 06-A] Capturing New Product Registration (Basic Info)...');
  await page.goto('https://portal.kselectnetwork.com/portal/products/new', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));

  await captureScreen(page, '06_01_Product_Reg_Basic_Info', [
    { locator: page.locator('select[name="brand_id"], select#brand_id').first(), label: '소속 브랜드 선택' },
    { locator: page.locator('input[name="name_kr"], input[name="name"]').first(), label: '제품명 국문 (필수)' },
    { locator: page.locator('input[name="name_en"]').first(), label: '제품명 영문 (글로벌 표기용)' },
    { locator: page.locator('input[name="manufacture_sku"]').first(), label: '제조사 SKU (고유 식별코드)' },
    { locator: page.locator('input[name="sales_link_1"]').first(), label: '국내/해외 판매 링크' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 06-B: New Product Registration - Category & Attributes
  // -------------------------------------------------------------
  console.log('\n[Screen 06-B] Capturing Category & Dynamic Attributes...');
  const catSection = page.locator('select#category, select[name="category"], div:has-text("카테고리")').first();
  if (await catSection.isVisible()) {
    await catSection.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1000);

  await captureScreen(page, '06_02_Product_Reg_Category_Attributes', [
    { locator: page.locator('select#category, select[name="category"]').first(), label: '제품 카테고리 선택' },
    { locator: page.locator('input[name="volume"], input[placeholder*="용량"]').first(), label: '용량 / 규격' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 06-C: New Product Registration - Logistics & Master Carton
  // -------------------------------------------------------------
  console.log('\n[Screen 06-C] Capturing Logistics & Master Carton Specs...');
  const logisticsSection = page.locator('input[name="carton_pack_qty"], input[name="package_width"]').first();
  if (await logisticsSection.isVisible()) {
    await logisticsSection.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1000);

  await captureScreen(page, '06_03_Product_Reg_Logistics_Carton', [
    { locator: page.locator('input[name="package_width"], input[name="package_weight"]').first(), label: '단품 포장 규격 및 중량' },
    { locator: page.locator('input[name="carton_pack_qty"]').first(), label: '마스터 카톤 입수량 (Qty.)' },
    { locator: page.locator('input[name="carton_width"], input[name="carton_cbm"]').first(), label: '카톤 치수 및 자동 CBM 산출' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 06-D: New Product Registration - Pricing
  // -------------------------------------------------------------
  console.log('\n[Screen 06-D] Capturing Pricing Section...');
  const priceSection = page.locator('input[name="price_krw_retail"], input[name="price_usd_fob"]').first();
  if (await priceSection.isVisible()) {
    await priceSection.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1000);

  await captureScreen(page, '06_04_Product_Reg_Pricing', [
    { locator: page.locator('input[name="price_krw_retail"]').first(), label: '국내 소비자가 (KRW MSRP)' },
    { locator: page.locator('input[name="price_usd_fob"]').first(), label: '수출 FOB 공급가 (USD)' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 07-A: Product Identifiers (UPC / EAN)
  // -------------------------------------------------------------
  console.log('\n[Screen 07-A] Capturing Identifiers (UPC/EAN)...');
  const idSection = page.locator('input[name="upc"], input[name="ean"]').first();
  if (await idSection.isVisible()) {
    await idSection.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1000);

  await captureScreen(page, '07_01_Product_Reg_Identifiers', [
    { locator: page.locator('input[name="upc"]').first(), label: 'UPC 바코드 번호 (12자리)' },
    { locator: page.locator('input[name="ean"]').first(), label: 'EAN 바코드 번호 (13자리)' },
    { locator: page.locator('button:has-text("문의"), a:has-text("문의")').first(), label: '바코드 미발급 시 지원 문의' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 07-B: Product Images & Ingredients Documents
  // -------------------------------------------------------------
  console.log('\n[Screen 07-B] Capturing Product Images & Documents...');
  const docSection = page.locator('textarea[name="ingredients_text"], input[name="ingredients_file"]').first();
  if (await docSection.isVisible()) {
    await docSection.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1000);

  await captureScreen(page, '07_02_Product_Reg_Images_Documents', [
    { locator: page.locator('div:has-text("대표 이미지"), div:has-text("이미지 업로드")').first(), label: '대표 제품 이미지 등록' },
    { locator: page.locator('textarea[name="ingredients_text"]').first(), label: '전성분 목록 (국문/영문)' },
    { locator: page.locator('input[type="file"], input[name="ingredients_file"]').first(), label: '전성분표 및 인증 서류 업로드' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 08: Review, Draft Save & Submit Actions
  // -------------------------------------------------------------
  console.log('\n[Screen 08] Capturing Draft Save & Submit Action Area...');
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(1000);

  await captureScreen(page, '08_01_Product_Draft_Save_Validation', [
    { locator: page.locator('button:has-text("임시 저장")').first(), label: '임시 저장 후 나중에 등록 (Draft Save)' },
    { locator: page.locator('button:has-text("제품 등록 및 계속")').first(), label: '제품 등록 및 계속 (Submit)' },
    { locator: page.locator('a[href="/portal/products"], button:has-text("취소")').first(), label: '목록으로 돌아가기' }
  ]);

  // -------------------------------------------------------------
  // SCREEN 09-A: Product Detail, Status & Attributes Review
  // -------------------------------------------------------------
  console.log('\n[Screen 09-A] Capturing Registered Product Detail...');
  const { data: testProds } = await admin.from('products').select('id, name').limit(1);
  if (testProds && testProds.length > 0) {
    const testProd = testProds[0];
    await page.goto(`https://portal.kselectnetwork.com/portal/products/${testProd.id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    await captureScreen(page, '09_01_Product_Detail_Status_Review', [
      { locator: page.locator('span:has-text("등록완료"), div:has-text("등록 상태")').first(), label: '제품 등록 상태 (Registered)' },
      { locator: page.locator('div:has-text("카테고리 & 속성")').first(), label: '지정 카테고리 및 맞춤 속성값' },
      { locator: page.locator('button:has-text("수정"), button:has-text("저장")').first(), label: '제품 정보 수정 및 저장' },
      { locator: page.locator('button:has-text("문의"), a[href*="/support"]').first(), label: '제품 전담 1:1 문의' }
    ]);
  }

  // -------------------------------------------------------------
  // SCREEN 09-B: 1:1 Partner Inquiries / Support
  // -------------------------------------------------------------
  console.log('\n[Screen 09-B] Capturing Support & Inquiry Center...');
  await page.goto('https://portal.kselectnetwork.com/portal/support', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  await captureScreen(page, '09_02_Portal_Support_Inquiries', [
    { locator: page.locator('button:has-text("새 문의"), button:has-text("문의하기")').first(), label: '1:1 새 문의 작성' },
    { locator: page.locator('table, div:has-text("문의 내역")').first(), label: '문의 진행 상태 및 관리자 답변' }
  ]);

  await browser.close();
  console.log('\n===================================================================');
  console.log('>>> ALL SCREENSHOTS SUCCESSFULLY CAPTURED & SAVED! <<<');
  console.log('===================================================================');
}

main().catch(console.error);
