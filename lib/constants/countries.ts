export interface CountryCallingCode {
  code: string;        // ISO 2-letter country code ("US", "KR")
  name: string;        // English country name ("United States", "South Korea")
  callingCode: string; // Calling code with plus prefix ("+1", "+82")
}

// Master list of all countries sorted alphabetically
const ALL_COUNTRIES_RAW: CountryCallingCode[] = [
  { code: "US", name: "United States", callingCode: "+1" },
  { code: "KR", name: "South Korea", callingCode: "+82" },
  { code: "AF", name: "Afghanistan", callingCode: "+93" },
  { code: "AL", name: "Albania", callingCode: "+355" },
  { code: "DZ", name: "Algeria", callingCode: "+213" },
  { code: "AD", name: "Andorra", callingCode: "+376" },
  { code: "AO", name: "Angola", callingCode: "+244" },
  { code: "AG", name: "Antigua and Barbuda", callingCode: "+1-268" },
  { code: "AR", name: "Argentina", callingCode: "+54" },
  { code: "AM", name: "Armenia", callingCode: "+374" },
  { code: "AU", name: "Australia", callingCode: "+61" },
  { code: "AT", name: "Austria", callingCode: "+43" },
  { code: "AZ", name: "Azerbaijan", callingCode: "+994" },
  { code: "BS", name: "Bahamas", callingCode: "+1-242" },
  { code: "BH", name: "Bahrain", callingCode: "+973" },
  { code: "BD", name: "Bangladesh", callingCode: "+880" },
  { code: "BB", name: "Barbados", callingCode: "+1-246" },
  { code: "BY", name: "Belarus", callingCode: "+375" },
  { code: "BE", name: "Belgium", callingCode: "+32" },
  { code: "BZ", name: "Belize", callingCode: "+501" },
  { code: "BJ", name: "Benin", callingCode: "+229" },
  { code: "BT", name: "Bhutan", callingCode: "+975" },
  { code: "BO", name: "Bolivia", callingCode: "+591" },
  { code: "BA", name: "Bosnia and Herzegovina", callingCode: "+387" },
  { code: "BW", name: "Botswana", callingCode: "+267" },
  { code: "BR", name: "Brazil", callingCode: "+55" },
  { code: "BN", name: "Brunei", callingCode: "+673" },
  { code: "BG", name: "Bulgaria", callingCode: "+359" },
  { code: "BF", name: "Burkina Faso", callingCode: "+226" },
  { code: "BI", name: "Burundi", callingCode: "+257" },
  { code: "KH", name: "Cambodia", callingCode: "+855" },
  { code: "CM", name: "Cameroon", callingCode: "+237" },
  { code: "CA", name: "Canada", callingCode: "+1" },
  { code: "CV", name: "Cape Verde", callingCode: "+238" },
  { code: "CL", name: "Chile", callingCode: "+56" },
  { code: "CN", name: "China", callingCode: "+86" },
  { code: "CO", name: "Colombia", callingCode: "+57" },
  { code: "KM", name: "Comoros", callingCode: "+269" },
  { code: "CG", name: "Congo", callingCode: "+242" },
  { code: "CR", name: "Costa Rica", callingCode: "+506" },
  { code: "HR", name: "Croatia", callingCode: "+385" },
  { code: "CU", name: "Cuba", callingCode: "+53" },
  { code: "CY", name: "Cyprus", callingCode: "+357" },
  { code: "CZ", name: "Czech Republic", callingCode: "+420" },
  { code: "DK", name: "Denmark", callingCode: "+45" },
  { code: "DJ", name: "Djibouti", callingCode: "+253" },
  { code: "DM", name: "Dominica", callingCode: "+1-767" },
  { code: "DO", name: "Dominican Republic", callingCode: "+1-809" },
  { code: "EC", name: "Ecuador", callingCode: "+593" },
  { code: "EG", name: "Egypt", callingCode: "+20" },
  { code: "SV", name: "El Salvador", callingCode: "+503" },
  { code: "EE", name: "Estonia", callingCode: "+372" },
  { code: "ET", name: "Ethiopia", callingCode: "+251" },
  { code: "FJ", name: "Fiji", callingCode: "+679" },
  { code: "FI", name: "Finland", callingCode: "+358" },
  { code: "FR", name: "France", callingCode: "+33" },
  { code: "GA", name: "Gabon", callingCode: "+241" },
  { code: "GM", name: "Gambia", callingCode: "+220" },
  { code: "GE", name: "Georgia", callingCode: "+995" },
  { code: "DE", name: "Germany", callingCode: "+49" },
  { code: "GH", name: "Ghana", callingCode: "+233" },
  { code: "GR", name: "Greece", callingCode: "+30" },
  { code: "GD", name: "Grenada", callingCode: "+1-473" },
  { code: "GT", name: "Guatemala", callingCode: "+502" },
  { code: "GN", name: "Guinea", callingCode: "+224" },
  { code: "GY", name: "Guyana", callingCode: "+592" },
  { code: "HT", name: "Haiti", callingCode: "+509" },
  { code: "HN", name: "Honduras", callingCode: "+504" },
  { code: "HK", name: "Hong Kong", callingCode: "+852" },
  { code: "HU", name: "Hungary", callingCode: "+36" },
  { code: "IS", name: "Iceland", callingCode: "+354" },
  { code: "IN", name: "India", callingCode: "+91" },
  { code: "ID", name: "Indonesia", callingCode: "+62" },
  { code: "IR", name: "Iran", callingCode: "+98" },
  { code: "IQ", name: "Iraq", callingCode: "+964" },
  { code: "IE", name: "Ireland", callingCode: "+353" },
  { code: "IL", name: "Israel", callingCode: "+972" },
  { code: "IT", name: "Italy", callingCode: "+39" },
  { code: "JM", name: "Jamaica", callingCode: "+1-876" },
  { code: "JP", name: "Japan", callingCode: "+81" },
  { code: "JO", name: "Jordan", callingCode: "+962" },
  { code: "KZ", name: "Kazakhstan", callingCode: "+7" },
  { code: "KE", name: "Kenya", callingCode: "+254" },
  { code: "KW", name: "Kuwait", callingCode: "+965" },
  { code: "KG", name: "Kyrgyzstan", callingCode: "+996" },
  { code: "LA", name: "Laos", callingCode: "+856" },
  { code: "LV", name: "Latvia", callingCode: "+371" },
  { code: "LB", name: "Lebanon", callingCode: "+961" },
  { code: "LY", name: "Libya", callingCode: "+218" },
  { code: "LT", name: "Lithuania", callingCode: "+370" },
  { code: "LU", name: "Luxembourg", callingCode: "+352" },
  { code: "MO", name: "Macau", callingCode: "+853" },
  { code: "MY", name: "Malaysia", callingCode: "+60" },
  { code: "MV", name: "Maldives", callingCode: "+960" },
  { code: "MX", name: "Mexico", callingCode: "+52" },
  { code: "MD", name: "Moldova", callingCode: "+373" },
  { code: "MC", name: "Monaco", callingCode: "+377" },
  { code: "MN", name: "Mongolia", callingCode: "+976" },
  { code: "ME", name: "Montenegro", callingCode: "+382" },
  { code: "MA", name: "Morocco", callingCode: "+212" },
  { code: "NP", name: "Nepal", callingCode: "+977" },
  { code: "NL", name: "Netherlands", callingCode: "+31" },
  { code: "NZ", name: "New Zealand", callingCode: "+64" },
  { code: "NGR", name: "Nigeria", callingCode: "+234" },
  { code: "NO", name: "Norway", callingCode: "+47" },
  { code: "OM", name: "Oman", callingCode: "+968" },
  { code: "PK", name: "Pakistan", callingCode: "+92" },
  { code: "PA", name: "Panama", callingCode: "+507" },
  { code: "PE", name: "Peru", callingCode: "+51" },
  { code: "PH", name: "Philippines", callingCode: "+63" },
  { code: "PL", name: "Poland", callingCode: "+48" },
  { code: "PT", name: "Portugal", callingCode: "+351" },
  { code: "QA", name: "Qatar", callingCode: "+974" },
  { code: "RO", name: "Romania", callingCode: "+40" },
  { code: "RU", name: "Russia", callingCode: "+7" },
  { code: "SA", name: "Saudi Arabia", callingCode: "+966" },
  { code: "RS", name: "Serbia", callingCode: "+381" },
  { code: "SG", name: "Singapore", callingCode: "+65" },
  { code: "SK", name: "Slovakia", callingCode: "+421" },
  { code: "SI", name: "Slovenia", callingCode: "+386" },
  { code: "ZA", name: "South Africa", callingCode: "+27" },
  { code: "ES", name: "Spain", callingCode: "+34" },
  { code: "LK", name: "Sri Lanka", callingCode: "+94" },
  { code: "SE", name: "Sweden", callingCode: "+46" },
  { code: "CH", name: "Switzerland", callingCode: "+41" },
  { code: "TW", name: "Taiwan", callingCode: "+886" },
  { code: "TH", name: "Thailand", callingCode: "+66" },
  { code: "TR", name: "Turkey", callingCode: "+90" },
  { code: "UA", name: "Ukraine", callingCode: "+380" },
  { code: "AE", name: "United Arab Emirates", callingCode: "+971" },
  { code: "GB", name: "United Kingdom", callingCode: "+44" },
  { code: "UY", name: "Uruguay", callingCode: "+598" },
  { code: "UZ", name: "Uzbekistan", callingCode: "+998" },
  { code: "VE", name: "Venezuela", callingCode: "+58" },
  { code: "VN", name: "Vietnam", callingCode: "+84" },
];

// Top Priority Countries
export const TOP_COUNTRIES: CountryCallingCode[] = [
  { code: "US", name: "United States", callingCode: "+1" },
  { code: "KR", name: "South Korea", callingCode: "+82" },
];

// Other countries sorted A-Z excluding US and KR to prevent duplication
export const OTHER_COUNTRIES: CountryCallingCode[] = ALL_COUNTRIES_RAW
  .filter((c) => c.code !== "US" && c.code !== "KR")
  .sort((a, b) => a.name.localeCompare(b.name));

// All countries combined with top countries first
export const ALL_COUNTRIES: CountryCallingCode[] = [
  ...TOP_COUNTRIES,
  ...OTHER_COUNTRIES,
];

/**
 * Standardize any localized or legacy country string to English canonical country name.
 * Examples:
 * - "대한민국", "KR", "Korea", "Republic of Korea" -> "South Korea"
 * - "미국", "US", "USA", "United States of America" -> "United States"
 * - "중국", "CN" -> "China"
 * - "일본", "JP" -> "Japan"
 */
export function formatCanonicalCountryName(val?: string | null): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();

  if (
    lower === "대한민국" ||
    lower === "korea" ||
    lower === "kr" ||
    lower === "south korea" ||
    lower === "republic of korea" ||
    lower === "한국"
  ) {
    return "South Korea";
  }

  if (
    lower === "미국" ||
    lower === "usa" ||
    lower === "us" ||
    lower === "united states" ||
    lower === "united states of america"
  ) {
    return "United States";
  }

  if (lower === "중국" || lower === "china" || lower === "cn") return "China";
  if (lower === "일본" || lower === "japan" || lower === "jp") return "Japan";
  if (lower === "홍콩" || lower === "hong kong" || lower === "hk") return "Hong Kong";
  if (lower === "대만" || lower === "taiwan" || lower === "tw") return "Taiwan";
  if (lower === "영국" || lower === "uk" || lower === "united kingdom" || lower === "gb") return "United Kingdom";
  if (lower === "독일" || lower === "germany" || lower === "de") return "Germany";
  if (lower === "프랑스" || lower === "france" || lower === "fr") return "France";
  if (lower === "베트남" || lower === "vietnam" || lower === "vn") return "Vietnam";
  if (lower === "싱가포르" || lower === "singapore" || lower === "sg") return "Singapore";
  if (lower === "태국" || lower === "thailand" || lower === "th") return "Thailand";
  if (lower === "호주" || lower === "australia" || lower === "au") return "Australia";
  if (lower === "캐나다" || lower === "canada" || lower === "ca") return "Canada";
  if (lower === "이탈리아" || lower === "italy" || lower === "it") return "Italy";
  if (lower === "스페인" || lower === "spain" || lower === "es") return "Spain";
  if (lower === "스위스" || lower === "switzerland" || lower === "ch") return "Switzerland";

  const found = ALL_COUNTRIES_RAW.find(
    (c) => c.code.toLowerCase() === lower || c.name.toLowerCase() === lower
  );
  if (found) return found.name;

  return trimmed;
}

