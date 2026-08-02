export interface MockCompany {
  id: string;
  name: string;
  type: string;
  country: string;
  contactName: string;
  email: string;
  phone: string;
  brandsCount: number;
  productsCount: number;
  appStatus: string;
  partnerStatus: string;
  accountOwner: string;
  lastContact: string;
}

export interface MockBrand {
  id: string;
  companyId: string;
  name: string;
  category: string;
  isActive: boolean;
}

export interface MockProduct {
  id: string;
  name: string;
  brand: string;
  company: string;
  category: string;
  sku: string;
  upc: string;
  msrp: number;
  cost: number;
  complianceStatus: "Compliant" | "Pending" | "Review Required";
  sampleStatus: "Received" | "Requested" | "Not Sent";
  retailStatus: "Active" | "Testing" | "None";
  amazonStatus: "Live" | "Launching" | "None";
}

export interface MockStore {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  manager: string;
  phone: string;
  activeProducts: number;
  salesStatus: string;
}

export interface MockPlacement {
  id: string;
  storeName: string;
  module: string;
  shelf: string;
  productName: string;
  sku: string;
  currentInventory: number;
  weeklySales: number;
  status: string;
}

export interface MockSample {
  id: string;
  company: string;
  brand: string;
  product: string;
  quantity: number;
  requestedDate: string;
  evaluator: string;
  status: string;
  score: number;
}

export interface MockTask {
  id: string;
  title: string;
  owner: string;
  company: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Not Started" | "In Progress" | "Completed" | "Waiting";
  dueDate: string;
}

export const mockCompanies: MockCompany[] = [
  { id: "c-1", name: "올리브씨앤씨", type: "Brand Owner", country: "South Korea", contactName: "김민준", email: "mj.kim@olivecnc.co.kr", phone: "010-1234-5678", brandsCount: 2, productsCount: 8, appStatus: "Approved", partnerStatus: "Active", accountOwner: "Sarah Woo", lastContact: "2026-07-28" },
  { id: "c-2", name: "아모레퍼시픽 글로벌", type: "Manufacturer", country: "South Korea", contactName: "박지성", email: "js.park@amore.com", phone: "010-2345-6789", brandsCount: 4, productsCount: 15, appStatus: "Approved", partnerStatus: "Active", accountOwner: "Alex Kim", lastContact: "2026-07-30" },
  { id: "c-3", name: "비투링크 코스메틱", type: "Distributor", country: "South Korea", contactName: "이서현", email: "sh.lee@b2link.co.kr", phone: "010-3456-7890", brandsCount: 1, productsCount: 5, appStatus: "Under Review", partnerStatus: "Pending", accountOwner: "Sarah Woo", lastContact: "2026-08-01" },
  { id: "c-4", name: "스킨푸드 재팬", type: "Exporter", country: "South Korea", contactName: "최영희", email: "yh.choi@skinfood.co.kr", phone: "010-4567-8901", brandsCount: 1, productsCount: 6, appStatus: "Approved", partnerStatus: "Active", accountOwner: "Alex Kim", lastContact: "2026-07-15" },
  { id: "c-5", name: "하루하루원더", type: "Brand Owner", country: "South Korea", contactName: "정우성", email: "ws.jung@haruharu.com", phone: "010-5678-9012", brandsCount: 1, productsCount: 4, appStatus: "Approved", partnerStatus: "Active", accountOwner: "Sarah Woo", lastContact: "2026-07-29" },
  { id: "c-6", name: "이즈앤트리", type: "Brand Owner", country: "South Korea", contactName: "한지민", email: "jm.han@isntree.com", phone: "010-6789-0123", brandsCount: 1, productsCount: 7, appStatus: "On Hold", partnerStatus: "Inactive", accountOwner: "Alex Kim", lastContact: "2026-07-20" },
  { id: "c-7", name: "코스알엑스 인터내셔널", type: "Brand Owner", country: "South Korea", contactName: "강하늘", email: "hn.kang@cosrx.co.kr", phone: "010-7890-1234", brandsCount: 2, productsCount: 10, appStatus: "Approved", partnerStatus: "Active", accountOwner: "Sarah Woo", lastContact: "2026-07-31" },
  { id: "c-8", name: "코스맥스 이노베이션", type: "Manufacturer", country: "South Korea", contactName: "임윤아", email: "ya.lim@cosmax.com", phone: "010-8901-2345", brandsCount: 0, productsCount: 0, appStatus: "None", partnerStatus: "Active", accountOwner: "Alex Kim", lastContact: "2026-07-25" },
  { id: "c-9", name: "클리오 글로벌", type: "Brand Owner", country: "South Korea", contactName: "송중기", email: "jk.song@clio.co.kr", phone: "010-9012-3456", brandsCount: 3, productsCount: 12, appStatus: "Approved", partnerStatus: "Active", accountOwner: "Sarah Woo", lastContact: "2026-07-28" },
  { id: "c-10", name: "조선미녀", type: "Brand Owner", country: "South Korea", contactName: "이정재", email: "jj.lee@joseon.co.kr", phone: "010-0123-4567", brandsCount: 1, productsCount: 5, appStatus: "Approved", partnerStatus: "Active", accountOwner: "Alex Kim", lastContact: "2026-08-01" }
];

export const mockBrands: MockBrand[] = [
  { id: "b-1", companyId: "c-1", name: "믹순 (Mixsoon)", category: "Skincare", isActive: true },
  { id: "b-2", companyId: "c-1", name: "마녀공장 (Manyo)", category: "Cleanser", isActive: true },
  { id: "b-3", companyId: "c-2", name: "설화수 (Sulwhasoo)", category: "Premium Skincare", isActive: true },
  { id: "b-4", companyId: "c-2", name: "라네즈 (Laneige)", category: "Moisturizer", isActive: true },
  { id: "b-5", companyId: "c-3", name: "아비브 (Abib)", category: "Acne patch", isActive: true },
  { id: "b-6", companyId: "c-5", name: "하루하루 (Haruharu Wonder)", category: "Toner", isActive: true },
  { id: "b-7", companyId: "c-7", name: "코스알엑스 (COSRX)", category: "Serum", isActive: true },
  { id: "b-8", companyId: "c-9", name: "페리페라 (Peripera)", category: "Makeup", isActive: true },
  { id: "b-9", companyId: "c-10", name: "조선미녀 (Beauty of Joseon)", category: "Sunscreen", isActive: true }
];

export const mockProducts: MockProduct[] = [
  { id: "p-1", name: "콩 에센스 (Bean Essence)", brand: "믹순 (Mixsoon)", company: "올리브씨앤씨", category: "Serum", sku: "MS-BE-50", upc: "880912345001", msrp: 35.00, cost: 12.00, complianceStatus: "Compliant", sampleStatus: "Received", retailStatus: "Active", amazonStatus: "Live" },
  { id: "p-2", name: "갈락토미 나이아신 에센스", brand: "마녀공장 (Manyo)", company: "올리브씨앤씨", category: "Serum", sku: "MY-GN-50", upc: "880912345002", msrp: 28.00, cost: 9.50, complianceStatus: "Compliant", sampleStatus: "Received", retailStatus: "Active", amazonStatus: "Live" },
  { id: "p-3", name: "맑은 쌀 선크림 (Relief Sun)", brand: "조선미녀 (Beauty of Joseon)", company: "조선미녀", category: "Sunscreen", sku: "BJ-RS-50", upc: "880912345003", msrp: 18.00, cost: 6.00, complianceStatus: "Compliant", sampleStatus: "Received", retailStatus: "Active", amazonStatus: "Live" },
  { id: "p-4", name: "어성초 스팟 패드 (Heartleaf Pad)", brand: "아비브 (Abib)", company: "비투링크 코스메틱", category: "Acne patch", sku: "AB-HP-75", upc: "880912345004", msrp: 24.00, cost: 8.00, complianceStatus: "Pending", sampleStatus: "Requested", retailStatus: "None", amazonStatus: "Launching" },
  { id: "p-5", name: "블랙티 시너지 토너", brand: "하루하루 (Haruharu Wonder)", company: "하루하루하루", category: "Toner", sku: "HW-BT-150", upc: "880912345005", msrp: 22.00, cost: 7.20, complianceStatus: "Compliant", sampleStatus: "Received", retailStatus: "Testing", amazonStatus: "Live" },
  { id: "p-6", name: "립 틴트 인크 (Ink Velvet)", brand: "페리페라 (Peripera)", company: "클리오 글로벌", category: "Makeup", sku: "PP-IV-04", upc: "880912345006", msrp: 12.00, cost: 3.80, complianceStatus: "Compliant", sampleStatus: "Received", retailStatus: "Active", amazonStatus: "Live" },
  { id: "p-7", name: "워터 슬리핑 마스크", brand: "라네즈 (Laneige)", company: "아모레퍼시픽 글로벌", category: "Moisturizer", sku: "LN-WS-70", upc: "880912345007", msrp: 32.00, cost: 11.00, complianceStatus: "Compliant", sampleStatus: "Received", retailStatus: "Active", amazonStatus: "Live" },
  { id: "p-8", name: "윤조 에센스 (First Care)", brand: "설화수 (Sulwhasoo)", company: "아모레퍼시픽 글로벌", category: "Skincare", sku: "SH-FC-90", upc: "880912345008", msrp: 89.00, cost: 32.00, complianceStatus: "Review Required", sampleStatus: "Not Sent", retailStatus: "None", amazonStatus: "None" }
];

export const mockStores: MockStore[] = [
  { id: "s-1", name: "올리브영 명동 플래그십", type: "Chain Beauty Supply", address: "서울특별시 중구 명동길 53", city: "Seoul", state: "Seoul", zip: "04538", manager: "최은아", phone: "02-123-4567", activeProducts: 12, salesStatus: "Excellent" },
  { id: "s-2", name: "시코르 강남역점", type: "Specialty Retailer", address: "서울특별시 서초구 강남대로 441", city: "Seoul", state: "Seoul", zip: "06613", manager: "정은지", phone: "02-234-5678", activeProducts: 8, salesStatus: "Good" },
  { id: "s-3", name: "NYC Beauty Hub", type: "Independent Beauty Supply", address: "35 W 32nd St", city: "New York", state: "NY", zip: "10001", manager: "Jennifer Lee", phone: "+1 212-555-0199", activeProducts: 5, salesStatus: "Monitor" },
  { id: "s-4", name: "LA K-Beauty Plaza", type: "Independent Beauty Supply", address: "3250 W Olympic Blvd", city: "Los Angeles", state: "CA", zip: "90006", manager: "Michael Choi", phone: "+1 213-555-0210", activeProducts: 6, salesStatus: "Excellent" }
];

export const mockPlacements: MockPlacement[] = [
  { id: "pl-1", storeName: "LA K-Beauty Plaza", module: "4 ft K-Beauty Shelf", shelf: "Top Shelf", productName: "맑은 쌀 선크림", sku: "BJ-RS-50", currentInventory: 45, weeklySales: 15, status: "Active" },
  { id: "pl-2", storeName: "LA K-Beauty Plaza", module: "4 ft K-Beauty Shelf", shelf: "Eye-level Shelf", productName: "콩 에센스", sku: "MS-BE-50", currentInventory: 20, weeklySales: 8, status: "Active" },
  { id: "pl-3", storeName: "NYC Beauty Hub", module: "Endcap Display", shelf: "Middle Shelf", productName: "립 틴트 인크", sku: "PP-IV-04", currentInventory: 120, weeklySales: 32, status: "Active" },
  { id: "pl-4", storeName: "시코르 강남역점", module: "8 ft Skincare Display", shelf: "Eye-level Shelf", productName: "워터 슬리핑 마스크", sku: "LN-WS-70", currentInventory: 15, weeklySales: 4, status: "Swap Required" }
];

export const mockSamples: MockSample[] = [
  { id: "smp-1", company: "올리브씨앤씨", brand: "믹순 (Mixsoon)", product: "콩 에센스", quantity: 5, requestedDate: "2026-07-20", evaluator: "Alex Kim", status: "Approved", score: 9.2 },
  { id: "smp-2", company: "조선미녀", brand: "조선미녀", product: "맑은 쌀 선크림", quantity: 10, requestedDate: "2026-07-22", evaluator: "Sarah Woo", status: "Approved", score: 9.5 },
  { id: "smp-3", company: "비투링크 코스메틱", brand: "아비브 (Abib)", product: "어성초 스팟 패드", quantity: 3, requestedDate: "2026-07-28", evaluator: "Alex Kim", status: "Under Evaluation", score: 7.8 }
];

export const mockTasks: MockTask[] = [
  { id: "t-1", title: "어성초 스팟 패드 통관 서류 검토", owner: "Alex Kim", company: "비투링크 코스메틱", priority: "High", status: "In Progress", dueDate: "2026-08-03" },
  { id: "t-2", title: "맑은 쌀 선크림 뉴욕 매장 입고 확인", owner: "Sarah Woo", company: "조선미녀", priority: "Medium", status: "Not Started", dueDate: "2026-08-05" },
  { id: "t-3", title: "아모레퍼시픽 신규 윤조에센스 미팅 준비", owner: "Alex Kim", company: "아모레퍼시픽 글로벌", priority: "Urgent", status: "Waiting", dueDate: "2026-08-02" },
  { id: "t-4", title: "하루하루원더 토너 아마존 리스팅 수정", owner: "Sarah Woo", company: "하루하루원더", priority: "Low", status: "Completed", dueDate: "2026-07-31" }
];

export const mockSalesData = {
  monthlyNetSales: [
    { month: "Jan", retail: 12000, amazon: 8000, total: 20000 },
    { month: "Feb", retail: 15000, amazon: 9500, total: 24500 },
    { month: "Mar", retail: 18000, amazon: 11000, total: 29000 },
    { month: "Apr", retail: 22000, amazon: 13000, total: 35000 },
    { month: "May", retail: 26000, amazon: 16500, total: 42500 },
    { month: "Jun", retail: 31000, amazon: 21000, total: 52000 },
    { month: "Jul", retail: 39000, amazon: 28000, total: 67000 }
  ]
};
