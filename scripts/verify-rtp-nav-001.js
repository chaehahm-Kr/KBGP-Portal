const assert = require('assert');

// Read files as text and verify exports / objects
const fs = require('fs');

const enFile = fs.readFileSync('./lib/i18n/dictionaries/en.ts', 'utf8');
const koFile = fs.readFileSync('./lib/i18n/dictionaries/ko.ts', 'utf8');
const typesFile = fs.readFileSync('./lib/i18n/types.ts', 'utf8');
const navFile = fs.readFileSync('./lib/retailer/navigation.ts', 'utf8');
const sidebarFile = fs.readFileSync('./components/retailer/retailer-sidebar.tsx', 'utf8');
const headerFile = fs.readFileSync('./components/retailer/retailer-header.tsx', 'utf8');

console.log('--- 1. Testing Dictionary & Types ---');
assert(typesFile.includes('helpSupport: string;'), 'types.ts must define helpSupport');
assert(enFile.includes('helpSupport: "Help & Support"'), 'en.ts must define Help & Support');
assert(koFile.includes('helpSupport: "도움말 및 지원"'), 'ko.ts must define 도움말 및 지원');
assert(enFile.includes('helpCenter: "Help Center"'), 'en.ts must define Help Center');
assert(koFile.includes('helpCenter: "도움말 센터"'), 'ko.ts must define 도움말 센터');
assert(enFile.includes('support: "Support"'), 'en.ts must define Support');
assert(koFile.includes('support: "문의 지원"'), 'ko.ts must define 문의 지원');
console.log('✅ Dictionary & Types assertions passed.');

console.log('--- 2. Testing Retailer Navigation Structure ---');
assert(navFile.includes('key: "helpSupport"'), 'navigation.ts must contain helpSupport parent item');
assert(navFile.includes('key: "helpCenter"'), 'navigation.ts must contain helpCenter sub-item');
assert(navFile.includes('key: "support"'), 'navigation.ts must contain support sub-item');
assert(!navFile.includes('key: "askKSelect",\n    name: "Ask K SELECT",\n    href: "/help/ask",\n    icon: "sparkles",'), 'navigation.ts must NOT have askKSelect as standalone top-level sidebar item');
console.log('✅ Navigation structure assertions passed.');

console.log('--- 3. Testing Sidebar & Header SubItems Rendering ---');
assert(sidebarFile.includes('item.subItems'), 'retailer-sidebar.tsx must handle subItems');
assert(sidebarFile.includes('openSections'), 'retailer-sidebar.tsx must manage open/collapsed state');
assert(headerFile.includes('item.subItems'), 'retailer-header.tsx must handle subItems');
assert(headerFile.includes('openSections'), 'retailer-header.tsx must manage open/collapsed state for mobile drawer');
console.log('✅ Sidebar & Header assertions passed.');

console.log('\n🎉 ALL RTP-NAV-001 VALIDATIONS PASSED!');
