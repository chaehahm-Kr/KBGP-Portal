/**
 * Automated Verification Script for SYS-VAL-001
 * Global English Name & Numeric Price Input Validation Standardization
 */

const assert = require("assert");

// Test Regexes and Logic
const ENGLISH_NAME_REGEX = /^[A-Za-z\s'\-]+$/;
const NUMERIC_PRICE_REGEX = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function isPureEnglishName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  return ENGLISH_NAME_REGEX.test(trimmed);
}

function isNumericPrice(val, allowZero = true) {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (str === "") return false;
  if (!NUMERIC_PRICE_REGEX.test(str)) return false;
  const num = Number(str);
  if (isNaN(num)) return false;
  if (!allowZero && num <= 0) return false;
  return num >= 0;
}

function normalizePrice(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === "") return null;
  if (!NUMERIC_PRICE_REGEX.test(str)) return null;
  const num = Number(str);
  return isNaN(num) || num < 0 ? null : num;
}

function validateEnglishName(name, options = {}) {
  const {
    required = true,
    fieldNameKo = "영문 이름",
    fieldNameEn = "English name",
    language = "ko",
  } = options;

  const trimmed = (name || "").trim();

  if (!trimmed) {
    if (required) {
      return {
        valid: false,
        error: language === "ko" ? `${fieldNameKo}을(를) 입력해 주세요.` : `Please enter the ${fieldNameEn}.`,
      };
    }
    return { valid: true, sanitizedValue: "" };
  }

  if (!ENGLISH_NAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 영문자로 입력해 주세요.`
        : `Please enter the ${fieldNameEn} using English letters only.`,
    };
  }

  return { valid: true, sanitizedValue: trimmed };
}

function validatePrice(val, options = {}) {
  const {
    required = true,
    allowZero = true,
    allowDecimal = true,
    fieldNameKo = "가격",
    fieldNameEn = "price",
    language = "ko",
  } = options;

  if (val === null || val === undefined || String(val).trim() === "") {
    if (required) {
      return {
        valid: false,
        error: language === "ko" ? `${fieldNameKo}을(를) 입력해 주세요.` : `Please enter the ${fieldNameEn}.`,
      };
    }
    return { valid: true, value: null };
  }

  const str = String(val).trim();

  if (!NUMERIC_PRICE_REGEX.test(str)) {
    if (/[a-zA-Z가-힣$₩,]/.test(str)) {
      return {
        valid: false,
        error: language === "ko"
          ? `${fieldNameKo}은(는) 숫자만 입력해 주세요.`
          : `Please enter numbers only for the ${fieldNameEn}.`,
      };
    }
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 올바른 숫자 형식으로 입력해 주세요. 예: 12.99`
        : `Please enter a valid numeric format for the ${fieldNameEn}. (e.g. 12.99)`,
    };
  }

  const num = Number(str);
  if (isNaN(num)) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 숫자만 입력해 주세요.`
        : `Please enter numbers only for the ${fieldNameEn}.`,
    };
  }

  if (num < 0) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 0 이상의 숫자만 입력해 주세요.`
        : `${fieldNameEn} must be 0 or greater.`,
    };
  }

  if (!allowZero && num === 0) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 0보다 큰 숫자를 입력해 주세요.`
        : `${fieldNameEn} must be greater than 0.`,
    };
  }

  if (!allowDecimal && str.includes(".")) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 정수로만 입력해 주세요.`
        : `${fieldNameEn} must be an integer.`,
    };
  }

  return { valid: true, value: num };
}

async function runTests() {
  console.log("==================================================");
  console.log("SYS-VAL-001 Validation QA Test Suite");
  console.log("==================================================");

  // 1. English Name Valid Cases
  const validEnglishNames = [
    "John",
    "Chae",
    "Mary Jane",
    "O'Connor",
    "Anne-Marie",
    "De La Cruz",
    "Smith-Jones",
  ];
  for (const name of validEnglishNames) {
    assert.strictEqual(isPureEnglishName(name), true, `Expected "${name}" to be pure English name`);
    const res = validateEnglishName(name, { fieldNameKo: "영문 이름" });
    assert.strictEqual(res.valid, true, `Expected validateEnglishName("${name}") to be valid`);
  }
  console.log("✅ 1. Valid English Names PASS (Apostrophe, Hyphen, Spaces, Pure English)");

  // 2. English Name Invalid Cases (Korean, Numbers, Symbols)
  const invalidEnglishNames = [
    "채환",
    "함",
    "John123",
    "John@",
    "홍GilDong",
    "123",
    "John_Doe",
    "Jane!",
    "",
    "   ",
  ];
  for (const name of invalidEnglishNames) {
    assert.strictEqual(isPureEnglishName(name), false, `Expected "${name}" to be invalid English name`);
    if (name.trim()) {
      const res = validateEnglishName(name, { fieldNameKo: "영문 이름", language: "ko" });
      assert.strictEqual(res.valid, false);
      assert.ok(res.error.includes("영문자로 입력해 주세요"));
    }
  }
  console.log("✅ 2. Invalid English Names Rejected PASS (Korean, Numbers, Symbols blocked)");

  // 3. Price Valid Numeric Cases
  const validPrices = [
    "0",
    "0.00",
    "0.99",
    "10",
    "12.99",
    "1500",
    "25000",
    "1000000",
    12.99,
    25000,
  ];
  for (const p of validPrices) {
    assert.strictEqual(isNumericPrice(p), true, `Expected "${p}" to be valid numeric price`);
    const num = normalizePrice(p);
    assert.ok(typeof num === "number" && !isNaN(num) && num >= 0);
  }
  console.log("✅ 3. Valid Numeric Prices PASS (Integers, Decimals, Zero)");

  // 4. Price Invalid Cases (Characters, Currency Symbols, Negative)
  const invalidPrices = [
    "Chae",
    "Hahm",
    "$12.99",
    "USD 12.99",
    "12 dollars",
    "₩15000",
    "15,000원",
    "abc",
    "-10",
    "-0.01",
    "12..99",
    "12.99.00",
    "$",
    "₩",
  ];
  for (const p of invalidPrices) {
    assert.strictEqual(isNumericPrice(p), false, `Expected "${p}" to be invalid price`);
    assert.strictEqual(normalizePrice(p), null);
    const res = validatePrice(p, { fieldNameKo: "한국 소비자 판매가" });
    assert.strictEqual(res.valid, false, `Expected validatePrice("${p}") to fail`);
  }
  console.log("✅ 4. Invalid Prices Rejected PASS (Letters, Currency Symbols, Negative blocked)");

  // 5. Integer-only constraint test
  const decimalForInteger = validatePrice("1500.50", { allowDecimal: false, fieldNameKo: "한국 소비자 판매가" });
  assert.strictEqual(decimalForInteger.valid, false);
  assert.ok(decimalForInteger.error.includes("정수로만"));
  console.log("✅ 5. Integer-only constraint test PASS");

  console.log("==================================================");
  console.log("ALL SYS-VAL-001 VALIDATION TESTS PASSED!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
