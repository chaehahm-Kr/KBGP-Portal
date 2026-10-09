export interface CountryCallingCode {
  code: string;        // ISO 3166-1 alpha-2 country code ("US", "KR", "CN")
  name: string;        // Canonical English country name ("United States", "South Korea", "China")
  nameKo: string;      // Standard Korean country name ("미국", "대한민국", "중국")
  callingCode: string; // International dialing calling code with plus prefix ("+1", "+82", "+86")
}

// Master list of all countries sorted alphabetically by English canonical name
export const ALL_COUNTRIES_RAW: CountryCallingCode[] = [
  { code: "AF", name: "Afghanistan", nameKo: "아프가니스탄", callingCode: "+93" },
  { code: "AL", name: "Albania", nameKo: "알바니아", callingCode: "+355" },
  { code: "DZ", name: "Algeria", nameKo: "알제리", callingCode: "+213" },
  { code: "AD", name: "Andorra", nameKo: "안도라", callingCode: "+376" },
  { code: "AO", name: "Angola", nameKo: "앙골라", callingCode: "+244" },
  { code: "AG", name: "Antigua and Barbuda", nameKo: "앤티가 바부다", callingCode: "+1-268" },
  { code: "AR", name: "Argentina", nameKo: "아르헨티나", callingCode: "+54" },
  { code: "AM", name: "Armenia", nameKo: "아르메니아", callingCode: "+374" },
  { code: "AU", name: "Australia", nameKo: "호주", callingCode: "+61" },
  { code: "AT", name: "Austria", nameKo: "오스트리아", callingCode: "+43" },
  { code: "AZ", name: "Azerbaijan", nameKo: "아제르바이잔", callingCode: "+994" },
  { code: "BS", name: "Bahamas", nameKo: "바하마", callingCode: "+1-242" },
  { code: "BH", name: "Bahrain", nameKo: "바레인", callingCode: "+973" },
  { code: "BD", name: "Bangladesh", nameKo: "방글라데시", callingCode: "+880" },
  { code: "BB", name: "Barbados", nameKo: "바베이도스", callingCode: "+1-246" },
  { code: "BY", name: "Belarus", nameKo: "벨라루스", callingCode: "+375" },
  { code: "BE", name: "Belgium", nameKo: "벨기에", callingCode: "+32" },
  { code: "BZ", name: "Belize", nameKo: "벨리즈", callingCode: "+501" },
  { code: "BJ", name: "Benin", nameKo: "베냉", callingCode: "+229" },
  { code: "BT", name: "Bhutan", nameKo: "부탄", callingCode: "+975" },
  { code: "BO", name: "Bolivia", nameKo: "볼리비아", callingCode: "+591" },
  { code: "BA", name: "Bosnia and Herzegovina", nameKo: "보스니아 헤르체고비나", callingCode: "+387" },
  { code: "BW", name: "Botswana", nameKo: "보츠와나", callingCode: "+267" },
  { code: "BR", name: "Brazil", nameKo: "브라질", callingCode: "+55" },
  { code: "BN", name: "Brunei", nameKo: "브루나이", callingCode: "+673" },
  { code: "BG", name: "Bulgaria", nameKo: "불가리아", callingCode: "+359" },
  { code: "BF", name: "Burkina Faso", nameKo: "부르키나파소", callingCode: "+226" },
  { code: "BI", name: "Burundi", nameKo: "부룬디", callingCode: "+257" },
  { code: "KH", name: "Cambodia", nameKo: "캄보디아", callingCode: "+855" },
  { code: "CM", name: "Cameroon", nameKo: "카메룬", callingCode: "+237" },
  { code: "CA", name: "Canada", nameKo: "캐나다", callingCode: "+1" },
  { code: "CV", name: "Cape Verde", nameKo: "카보베르데", callingCode: "+238" },
  { code: "CL", name: "Chile", nameKo: "칠레", callingCode: "+56" },
  { code: "CN", name: "China", nameKo: "중국", callingCode: "+86" },
  { code: "CO", name: "Colombia", nameKo: "콜롬비아", callingCode: "+57" },
  { code: "KM", name: "Comoros", nameKo: "코모로", callingCode: "+269" },
  { code: "CG", name: "Congo", nameKo: "콩고", callingCode: "+242" },
  { code: "CR", name: "Costa Rica", nameKo: "코스타리카", callingCode: "+506" },
  { code: "HR", name: "Croatia", nameKo: "크로아티아", callingCode: "+385" },
  { code: "CU", name: "Cuba", nameKo: "쿠바", callingCode: "+53" },
  { code: "CY", name: "Cyprus", nameKo: "키프로스", callingCode: "+357" },
  { code: "CZ", name: "Czech Republic", nameKo: "체코", callingCode: "+420" },
  { code: "DK", name: "Denmark", nameKo: "덴마크", callingCode: "+45" },
  { code: "DJ", name: "Djibouti", nameKo: "지부티", callingCode: "+253" },
  { code: "DM", name: "Dominica", nameKo: "도미니카 연방", callingCode: "+1-767" },
  { code: "DO", name: "Dominican Republic", nameKo: "도미니카 공화국", callingCode: "+1-809" },
  { code: "EC", name: "Ecuador", nameKo: "에콰도르", callingCode: "+593" },
  { code: "EG", name: "Egypt", nameKo: "이집트", callingCode: "+20" },
  { code: "SV", name: "El Salvador", nameKo: "엘살바도르", callingCode: "+503" },
  { code: "EE", name: "Estonia", nameKo: "에스토니아", callingCode: "+372" },
  { code: "ET", name: "Ethiopia", nameKo: "에티오피아", callingCode: "+251" },
  { code: "FJ", name: "Fiji", nameKo: "피지", callingCode: "+679" },
  { code: "FI", name: "Finland", nameKo: "핀란드", callingCode: "+358" },
  { code: "FR", name: "France", nameKo: "프랑스", callingCode: "+33" },
  { code: "GA", name: "Gabon", nameKo: "가봉", callingCode: "+241" },
  { code: "GM", name: "Gambia", nameKo: "감비아", callingCode: "+220" },
  { code: "GE", name: "Georgia", nameKo: "조지아", callingCode: "+995" },
  { code: "DE", name: "Germany", nameKo: "독일", callingCode: "+49" },
  { code: "GH", name: "Ghana", nameKo: "가나", callingCode: "+233" },
  { code: "GR", name: "Greece", nameKo: "그리스", callingCode: "+30" },
  { code: "GD", name: "Grenada", nameKo: "그레나다", callingCode: "+1-473" },
  { code: "GT", name: "Guatemala", nameKo: "과테말라", callingCode: "+502" },
  { code: "GN", name: "Guinea", nameKo: "기니", callingCode: "+224" },
  { code: "GY", name: "Guyana", nameKo: "가이아나", callingCode: "+592" },
  { code: "HT", name: "Haiti", nameKo: "아이티", callingCode: "+509" },
  { code: "HN", name: "Honduras", nameKo: "온두라스", callingCode: "+504" },
  { code: "HK", name: "Hong Kong", nameKo: "홍콩", callingCode: "+852" },
  { code: "HU", name: "Hungary", nameKo: "헝가리", callingCode: "+36" },
  { code: "IS", name: "Iceland", nameKo: "아이슬란드", callingCode: "+354" },
  { code: "IN", name: "India", nameKo: "인도", callingCode: "+91" },
  { code: "ID", name: "Indonesia", nameKo: "인도네시아", callingCode: "+62" },
  { code: "IR", name: "Iran", nameKo: "이란", callingCode: "+98" },
  { code: "IQ", name: "Iraq", nameKo: "이라크", callingCode: "+964" },
  { code: "IE", name: "Ireland", nameKo: "아일랜드", callingCode: "+353" },
  { code: "IL", name: "Israel", nameKo: "이스라엘", callingCode: "+972" },
  { code: "IT", name: "Italy", nameKo: "이탈리아", callingCode: "+39" },
  { code: "JM", name: "Jamaica", nameKo: "자메이카", callingCode: "+1-876" },
  { code: "JP", name: "Japan", nameKo: "일본", callingCode: "+81" },
  { code: "JO", name: "Jordan", nameKo: "요르단", callingCode: "+962" },
  { code: "KZ", name: "Kazakhstan", nameKo: "카자흐스탄", callingCode: "+7" },
  { code: "KE", name: "Kenya", nameKo: "케냐", callingCode: "+254" },
  { code: "KR", name: "South Korea", nameKo: "대한민국", callingCode: "+82" },
  { code: "KW", name: "Kuwait", nameKo: "쿠웨이트", callingCode: "+965" },
  { code: "KG", name: "Kyrgyzstan", nameKo: "키르기스스탄", callingCode: "+996" },
  { code: "LA", name: "Laos", nameKo: "라오스", callingCode: "+856" },
  { code: "LV", name: "Latvia", nameKo: "라트비아", callingCode: "+371" },
  { code: "LB", name: "Lebanon", nameKo: "레바논", callingCode: "+961" },
  { code: "LY", name: "Libya", nameKo: "리비아", callingCode: "+218" },
  { code: "LT", name: "Lithuania", nameKo: "리투아니아", callingCode: "+370" },
  { code: "LU", name: "Luxembourg", nameKo: "룩셈부르크", callingCode: "+352" },
  { code: "MO", name: "Macau", nameKo: "마카오", callingCode: "+853" },
  { code: "MY", name: "Malaysia", nameKo: "말레이시아", callingCode: "+60" },
  { code: "MV", name: "Maldives", nameKo: "몰디브", callingCode: "+960" },
  { code: "MX", name: "Mexico", nameKo: "멕시코", callingCode: "+52" },
  { code: "MD", name: "Moldova", nameKo: "몰도바", callingCode: "+373" },
  { code: "MC", name: "Monaco", nameKo: "모나코", callingCode: "+377" },
  { code: "MN", name: "Mongolia", nameKo: "몽골", callingCode: "+976" },
  { code: "ME", name: "Montenegro", nameKo: "몬테네그로", callingCode: "+382" },
  { code: "MA", name: "Morocco", nameKo: "모로코", callingCode: "+212" },
  { code: "NP", name: "Nepal", nameKo: "네팔", callingCode: "+977" },
  { code: "NL", name: "Netherlands", nameKo: "네덜란드", callingCode: "+31" },
  { code: "NZ", name: "New Zealand", nameKo: "뉴질랜드", callingCode: "+64" },
  { code: "NGR", name: "Nigeria", nameKo: "나이지리아", callingCode: "+234" },
  { code: "NO", name: "Norway", nameKo: "노르웨이", callingCode: "+47" },
  { code: "OM", name: "Oman", nameKo: "오만", callingCode: "+968" },
  { code: "PK", name: "Pakistan", nameKo: "파키스탄", callingCode: "+92" },
  { code: "PA", name: "Panama", nameKo: "파나마", callingCode: "+507" },
  { code: "PE", name: "Peru", nameKo: "페루", callingCode: "+51" },
  { code: "PH", name: "Philippines", nameKo: "필리핀", callingCode: "+63" },
  { code: "PL", name: "Poland", nameKo: "폴란드", callingCode: "+48" },
  { code: "PT", name: "Portugal", nameKo: "포르투갈", callingCode: "+351" },
  { code: "QA", name: "Qatar", nameKo: "카타르", callingCode: "+974" },
  { code: "RO", name: "Romania", nameKo: "루마니아", callingCode: "+40" },
  { code: "RU", name: "Russia", nameKo: "러시아", callingCode: "+7" },
  { code: "SA", name: "Saudi Arabia", nameKo: "사우디아라비아", callingCode: "+966" },
  { code: "RS", name: "Serbia", nameKo: "세르비아", callingCode: "+381" },
  { code: "SG", name: "Singapore", nameKo: "싱가포르", callingCode: "+65" },
  { code: "SK", name: "Slovakia", nameKo: "슬로바키아", callingCode: "+421" },
  { code: "SI", name: "Slovenia", nameKo: "슬로베니아", callingCode: "+386" },
  { code: "ZA", name: "South Africa", nameKo: "남아프리카 공화국", callingCode: "+27" },
  { code: "ES", name: "Spain", nameKo: "스페인", callingCode: "+34" },
  { code: "LK", name: "Sri Lanka", nameKo: "스리랑카", callingCode: "+94" },
  { code: "SE", name: "Sweden", nameKo: "스웨덴", callingCode: "+46" },
  { code: "CH", name: "Switzerland", nameKo: "스위스", callingCode: "+41" },
  { code: "TW", name: "Taiwan", nameKo: "대만", callingCode: "+886" },
  { code: "TH", name: "Thailand", nameKo: "태국", callingCode: "+66" },
  { code: "TR", name: "Turkey", nameKo: "튀르키예", callingCode: "+90" },
  { code: "UA", name: "Ukraine", nameKo: "우크라이나", callingCode: "+380" },
  { code: "AE", name: "United Arab Emirates", nameKo: "아랍에미리트", callingCode: "+971" },
  { code: "GB", name: "United Kingdom", nameKo: "영국", callingCode: "+44" },
  { code: "US", name: "United States", nameKo: "미국", callingCode: "+1" },
  { code: "UY", name: "Uruguay", nameKo: "우루과이", callingCode: "+598" },
  { code: "UZ", name: "Uzbekistan", nameKo: "우즈베키스탄", callingCode: "+998" },
  { code: "VE", name: "Venezuela", nameKo: "베네수엘라", callingCode: "+58" },
  { code: "VN", name: "Vietnam", nameKo: "베트남", callingCode: "+84" },
];

// Top Priority Countries for Fast Business Selection (Korea, US, China, Japan, Vietnam)
export const TOP_COUNTRIES: CountryCallingCode[] = [
  { code: "KR", name: "South Korea", nameKo: "대한민국", callingCode: "+82" },
  { code: "US", name: "United States", nameKo: "미국", callingCode: "+1" },
  { code: "CN", name: "China", nameKo: "중국", callingCode: "+86" },
  { code: "JP", name: "Japan", nameKo: "일본", callingCode: "+81" },
  { code: "VN", name: "Vietnam", nameKo: "베트남", callingCode: "+84" },
];

const TOP_CODES = new Set(TOP_COUNTRIES.map((c) => c.code));

// Other countries sorted A-Z excluding TOP_COUNTRIES
export const OTHER_COUNTRIES: CountryCallingCode[] = ALL_COUNTRIES_RAW
  .filter((c) => !TOP_CODES.has(c.code))
  .sort((a, b) => a.name.localeCompare(b.name));

// All countries combined with top countries first
export const ALL_COUNTRIES: CountryCallingCode[] = [
  ...TOP_COUNTRIES,
  ...OTHER_COUNTRIES,
];

/**
 * Standardize any localized, alias, or legacy country string to English canonical country name.
 * 
 * Examples:
 * - "대한민국", "한국", "Korea", "Republic of Korea", "South Korea", "KR" -> "South Korea"
 * - "미국", "USA", "U.S.A.", "US", "United States", "United States of America" -> "United States"
 * - "중국", "PRC", "China", "CN" -> "China"
 * - "일본", "Japan", "JP" -> "Japan"
 * - "베트남", "Vietnam", "VN" -> "Vietnam"
 * - "영국", "UK", "United Kingdom", "GB" -> "United Kingdom"
 * - "독일", "Germany", "DE" -> "Germany"
 * - "프랑스", "France", "FR" -> "France"
 */
export function formatCanonicalCountryName(val?: string | null): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();

  // 1. South Korea aliases
  if (
    lower === "대한민국" ||
    lower === "한국" ||
    lower === "korea" ||
    lower === "south korea" ||
    lower === "republic of korea" ||
    lower === "kr" ||
    lower === "kor" ||
    lower === "rok"
  ) {
    return "South Korea";
  }

  // 2. United States aliases
  if (
    lower === "미국" ||
    lower === "usa" ||
    lower === "u.s.a." ||
    lower === "us" ||
    lower === "u.s." ||
    lower === "united states" ||
    lower === "united states of america" ||
    lower === "america"
  ) {
    return "United States";
  }

  // 3. China aliases
  if (
    lower === "중국" ||
    lower === "china" ||
    lower === "prc" ||
    lower === "p.r.c." ||
    lower === "cn" ||
    lower === "chn"
  ) {
    return "China";
  }

  // 4. Japan aliases
  if (lower === "일본" || lower === "japan" || lower === "jp" || lower === "jpn") {
    return "Japan";
  }

  // 5. Vietnam aliases
  if (lower === "베트남" || lower === "vietnam" || lower === "viet nam" || lower === "vn" || lower === "vnm") {
    return "Vietnam";
  }

  // 6. United Kingdom aliases
  if (
    lower === "영국" ||
    lower === "uk" ||
    lower === "u.k." ||
    lower === "united kingdom" ||
    lower === "great britain" ||
    lower === "gb" ||
    lower === "gbr"
  ) {
    return "United Kingdom";
  }

  // 7. Germany
  if (lower === "독일" || lower === "germany" || lower === "deutschland" || lower === "de" || lower === "deu") {
    return "Germany";
  }

  // 8. France
  if (lower === "프랑스" || lower === "france" || lower === "fr" || lower === "fra") {
    return "France";
  }

  // 9. Hong Kong
  if (lower === "홍콩" || lower === "hong kong" || lower === "hongkong" || lower === "hk" || lower === "hkg") {
    return "Hong Kong";
  }

  // 10. Taiwan
  if (lower === "대만" || lower === "taiwan" || lower === "tw" || lower === "twn" || lower === "roc") {
    return "Taiwan";
  }

  // 11. Singapore
  if (lower === "싱가포르" || lower === "singapore" || lower === "sg" || lower === "sgp") {
    return "Singapore";
  }

  // 12. Thailand
  if (lower === "태국" || lower === "thailand" || lower === "th" || lower === "tha") {
    return "Thailand";
  }

  // 13. Australia
  if (lower === "호주" || lower === "australia" || lower === "au" || lower === "aus") {
    return "Australia";
  }

  // 14. Canada
  if (lower === "캐나다" || lower === "canada" || lower === "ca" || lower === "can") {
    return "Canada";
  }

  // 15. Italy
  if (lower === "이탈리아" || lower === "italy" || lower === "it" || lower === "ita") {
    return "Italy";
  }

  // 16. Spain
  if (lower === "스페인" || lower === "spain" || lower === "es" || lower === "esp") {
    return "Spain";
  }

  // 17. Switzerland
  if (lower === "스위스" || lower === "switzerland" || lower === "ch" || lower === "che") {
    return "Switzerland";
  }

  // Lookup in master list by ISO code, English Name, or Korean Name
  const matched = ALL_COUNTRIES_RAW.find(
    (c) =>
      c.code.toLowerCase() === lower ||
      c.name.toLowerCase() === lower ||
      c.nameKo.toLowerCase() === lower
  );

  if (matched) return matched.name;

  return trimmed;
}

/**
 * Returns formatted country display label for UI rendering.
 * - Korean UI ('ko'): "대한민국 (South Korea)"
 * - English UI ('en'): "South Korea"
 */
export function getCountryDisplayLabel(
  countryNameOrCode?: string | null,
  lang: "ko" | "en" = "ko"
): string {
  if (!countryNameOrCode) return "";
  const canonical = formatCanonicalCountryName(countryNameOrCode);
  const found = ALL_COUNTRIES_RAW.find(
    (c) => c.name.toLowerCase() === canonical.toLowerCase() || c.code.toLowerCase() === countryNameOrCode.toLowerCase()
  );

  if (!found) return countryNameOrCode;

  if (lang === "ko") {
    return `${found.nameKo} (${found.name})`;
  }
  return found.name;
}

/**
 * Validates if the given string is a valid canonical English country name in the Country Master.
 */
export function isValidCanonicalCountry(val?: string | null): boolean {
  if (!val) return false;
  const canonical = formatCanonicalCountryName(val);
  return ALL_COUNTRIES_RAW.some((c) => c.name === canonical);
}

/**
 * Finds country metadata by ISO 3166-1 alpha-2 code.
 */
export function getCountryByCode(code?: string | null): CountryCallingCode | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  return ALL_COUNTRIES_RAW.find((c) => c.code === upper);
}

/**
 * Finds country metadata by Canonical English Name.
 */
export function getCountryByName(name?: string | null): CountryCallingCode | undefined {
  if (!name) return undefined;
  const canonical = formatCanonicalCountryName(name);
  return ALL_COUNTRIES_RAW.find((c) => c.name === canonical);
}
