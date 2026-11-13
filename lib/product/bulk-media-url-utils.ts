import net from "net";
import { BULK_MEDIA_MAX_IMAGE_BYTES } from "@/lib/product/bulk-import-types";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".lan",
  ".corp",
  ".intranet",
];

const DISALLOWED_IMAGE_EXTENSIONS = new Set([
  ".svg",
  ".gif",
  ".bmp",
  ".ico",
  ".tif",
  ".tiff",
  ".avif",
  ".heic",
  ".heif",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".exe",
  ".msi",
  ".dll",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".bin",
  ".apk",
  ".dmg",
  ".js",
  ".mjs",
  ".cjs",
  ".html",
  ".htm",
  ".php",
  ".jsp",
  ".asp",
  ".aspx",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
]);

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    acc = (acc * 256) + n;
  }
  return acc >>> 0;
}

function inCidrV4(ipNum: number, baseIp: string, prefixBits: number): boolean {
  const baseNum = ipv4ToUint32(baseIp);
  if (baseNum === null) return false;
  const mask = prefixBits === 0 ? 0 : (~((1 << (32 - prefixBits)) - 1)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

export function isPublicIpv4(ip: string): boolean {
  const ipNum = ipv4ToUint32(ip);
  if (ipNum === null) return false;

  const blockedRanges: [string, number][] = [
    ["0.0.0.0", 8],          // Current network
    ["10.0.0.0", 8],         // Private RFC 1918
    ["100.64.0.0", 10],      // CGNAT RFC 6598
    ["127.0.0.0", 8],        // Loopback
    ["169.254.0.0", 16],     // Link-local & Cloud Metadata (169.254.169.254)
    ["172.16.0.0", 12],      // Private RFC 1918
    ["192.0.0.0", 24],       // IETF protocol assignments
    ["192.0.2.0", 24],       // TEST-NET-1
    ["192.88.99.0", 24],     // 6to4 relay anycast
    ["192.168.0.0", 16],     // Private RFC 1918
    ["198.18.0.0", 15],      // Network benchmark tests
    ["198.51.100.0", 24],    // TEST-NET-2
    ["203.0.113.0", 24],     // TEST-NET-3
    ["224.0.0.0", 4],        // Multicast
    ["240.0.0.0", 4],        // Reserved / Broadcast
  ];

  for (const [base, prefix] of blockedRanges) {
    if (inCidrV4(ipNum, base, prefix)) {
      return false;
    }
  }
  return true;
}

function expandIpv6Hextets(rawIp: string): number[] | null {
  // Strip zone index if present (e.g. fe80::1%eth0)
  const ip = rawIp.split("%")[0].trim().toLowerCase();
  if (!ip) return null;

  // Handle embedded IPv4 tail (e.g. ::ffff:127.0.0.1)
  let work = ip;
  const lastColon = work.lastIndexOf(":");
  if (lastColon !== -1 && work.slice(lastColon + 1).includes(".")) {
    const v4Part = work.slice(lastColon + 1);
    const v4Num = ipv4ToUint32(v4Part);
    if (v4Num === null) return null;
    const hi = ((v4Num >>> 16) & 0xffff).toString(16);
    const lo = (v4Num & 0xffff).toString(16);
    work = `${work.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const doubleColonParts = work.split("::");
  if (doubleColonParts.length > 2) return null;

  const parseGroup = (segment: string): number[] | null => {
    if (!segment) return [];
    const tokens = segment.split(":");
    const out: number[] = [];
    for (const t of tokens) {
      if (!/^[0-9a-f]{1,4}$/.test(t)) return null;
      out.push(parseInt(t, 16));
    }
    return out;
  };

  if (doubleColonParts.length === 1) {
    const full = parseGroup(doubleColonParts[0]);
    return full && full.length === 8 ? full : null;
  }

  const left = parseGroup(doubleColonParts[0]);
  const right = parseGroup(doubleColonParts[1]);
  if (!left || !right) return null;
  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;

  return [...left, ...new Array(missing).fill(0), ...right];
}

export function isPublicIpv6(ip: string): boolean {
  const hextets = expandIpv6Hextets(ip);
  if (!hextets) return false;

  const isAllZeroPrefix = (count: number) => hextets.slice(0, count).every((h) => h === 0);

  // :: (unspecified) or ::1 (loopback)
  if (isAllZeroPrefix(7) && (hextets[7] === 0 || hextets[7] === 1)) {
    return false;
  }

  // IPv4-mapped ::ffff:x.x.x.x or IPv4-compatible ::x.x.x.x
  if (isAllZeroPrefix(5) && (hextets[5] === 0xffff || hextets[5] === 0)) {
    const a = (hextets[6] >>> 8) & 0xff;
    const b = hextets[6] & 0xff;
    const c = (hextets[7] >>> 8) & 0xff;
    const d = hextets[7] & 0xff;
    return isPublicIpv4(`${a}.${b}.${c}.${d}`);
  }

  // NAT64 64:ff9b::/96 and 64:ff9b:1::/48
  if (hextets[0] === 0x0064 && hextets[1] === 0xff9b) {
    return false;
  }

  // Discard-only 100::/64
  if (hextets[0] === 0x0100 && hextets[1] === 0 && hextets[2] === 0 && hextets[3] === 0) {
    return false;
  }

  // Documentation 2001:db8::/32
  if (hextets[0] === 0x2001 && hextets[1] === 0x0db8) {
    return false;
  }

  // 6to4 2002::/16 — inspect embedded IPv4 in hextets[1..2]
  if (hextets[0] === 0x2002) {
    const a = (hextets[1] >>> 8) & 0xff;
    const b = hextets[1] & 0xff;
    const c = (hextets[2] >>> 8) & 0xff;
    const d = hextets[2] & 0xff;
    return isPublicIpv4(`${a}.${b}.${c}.${d}`);
  }

  // Unique Local fc00::/7 (fc00..fdff)
  if ((hextets[0] & 0xfe00) === 0xfc00) {
    return false;
  }

  // Link-Local fe80::/10 and deprecated Site-Local fec0::/10
  if ((hextets[0] & 0xffc0) === 0xfe80 || (hextets[0] & 0xffc0) === 0xfec0) {
    return false;
  }

  // Multicast ff00::/8
  if ((hextets[0] & 0xff00) === 0xff00) {
    return false;
  }

  return true;
}

export function isPublicIpAddress(ip: string): boolean {
  const cleaned = ip.replace(/^\[|\]$/g, "").trim();
  const ver = net.isIP(cleaned);
  if (ver === 4) return isPublicIpv4(cleaned);
  if (ver === 6) return isPublicIpv6(cleaned);
  return false;
}

export function isSafePublicHostname(rawHost: string): boolean {
  const host = rawHost.replace(/^\[|\]$/g, "").trim().toLowerCase().replace(/\.$/, "");
  if (!host) return false;

  if (BLOCKED_HOSTNAMES.has(host)) return false;
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (host.endsWith(suffix)) return false;
  }

  // Reject single-label internal hostnames (e.g. "redis", "db", "intranet")
  if (net.isIP(host) === 0 && !host.includes(".")) {
    return false;
  }

  // Block numeric/octal/hex IPv4 obfuscations such as https://2130706433/ or https://0x7f000001/
  if (/^(?:0x[0-9a-f]+|\d+)$/i.test(host)) {
    return false;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion !== 0) {
    return isPublicIpAddress(host);
  }

  return true;
}

export interface MediaUrlSyntaxValidation {
  valid: boolean;
  normalizedUrl?: string;
  errorReason?: string;
  correctiveGuidance?: string;
}

export function validateHttpsMediaUrlSyntax(
  rawUrl: string,
  kind: "image" | "video"
): MediaUrlSyntaxValidation {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: true };
  }

  if (trimmed.length > 2048) {
    return {
      valid: false,
      errorReason: "URL 길이가 최대 허용 한도(2,048자)를 초과했습니다.",
      correctiveGuidance: "유효한 직접 HTTPS URL(2,048자 이하)을 입력해 주세요.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      errorReason: `올바르지 않은 URL 형식입니다 ("${trimmed.slice(0, 80)}").`,
      correctiveGuidance: "https://로 시작하는 전체 URL을 입력해 주세요.",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      errorReason: `보안상 HTTPS(https://) URL만 허용됩니다 (입력 프로토콜: "${parsed.protocol}").`,
      correctiveGuidance: "http:// 또는 기타 스킴 대신 https://로 시작하는 보안 URL을 입력해 주세요.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      errorReason: "계정 인증 정보(username:password@)가 포함된 URL은 허용되지 않습니다.",
      correctiveGuidance: "인증 정보가 포함되지 않은 공개 또는 서명된 HTTPS URL을 사용해 주세요.",
    };
  }

  if (!isSafePublicHostname(parsed.hostname)) {
    return {
      valid: false,
      errorReason: "내부망/사설 IP 또는 로컬 호스트 주소는 보안 정책(SSRF 보호)에 의해 차단됩니다.",
      correctiveGuidance: "외부에서 접근 가능한 공인 HTTPS 도메인 URL을 입력해 주세요.",
    };
  }

  if (kind === "image") {
    const pathnameLower = parsed.pathname.toLowerCase();
    const lastSegment = pathnameLower.split("/").pop() || "";
    const dotIdx = lastSegment.lastIndexOf(".");
    if (dotIdx > 0) {
      const ext = lastSegment.slice(dotIdx);
      if (DISALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        return {
          valid: false,
          errorReason: `지원하지 않는 이미지 파일 확장자입니다 ("${ext}"). JPG, PNG, WEBP 형식만 지원합니다.`,
          correctiveGuidance: ".jpg, .jpeg, .png, .webp 형식의 직접 이미지 다운로드 URL을 입력해 주세요.",
        };
      }
    }
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
  };
}

export type VerifiedImageMime = "image/jpeg" | "image/png" | "image/webp";

export type ImagePayloadInspectionResult =
  | {
      ok: true;
      mime: VerifiedImageMime;
      extension: "jpg" | "png" | "webp";
    }
  | {
      ok: false;
      errorReason: string;
      correctiveGuidance: string;
    };

export function inspectDownloadedImageBytes(
  bytes: Uint8Array,
  contentTypeHeader?: string | null
): ImagePayloadInspectionResult {
  if (bytes.byteLength === 0) {
    return {
      ok: false,
      errorReason: "다운로드된 이미지 파일이 비어 있습니다 (0 bytes).",
      correctiveGuidance: "실제 이미지 데이터가 반환되는 직접 이미지 URL인지 확인해 주세요.",
    };
  }

  if (bytes.byteLength > BULK_MEDIA_MAX_IMAGE_BYTES) {
    return {
      ok: false,
      errorReason: "이미지 크기가 허용 한도(10MB)를 초과했습니다.",
      correctiveGuidance: "10MB 이하의 JPG, PNG, WEBP 이미지 URL을 사용해 주세요.",
    };
  }

  if (bytes.byteLength < 12) {
    return {
      ok: false,
      errorReason: "유효한 이미지 헤더를 확인할 수 없는 손상되었거나 너무 작은 데이터입니다.",
      correctiveGuidance: "정상적인 JPG, PNG, WEBP 원본 이미지 URL을 입력해 주세요.",
    };
  }

  // Explicitly detect disguised executable / archive / HTML / script payloads
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return {
      ok: false,
      errorReason: "실행 파일(PE/EXE) 시그니처가 감지되어 보안 정책에 의해 차단되었습니다.",
      correctiveGuidance: "실제 JPG, PNG, WEBP 이미지 파일만 등록할 수 있습니다.",
    };
  }
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return {
      ok: false,
      errorReason: "실행 바이너리(ELF) 시그니처가 감지되어 보안 정책에 의해 차단되었습니다.",
      correctiveGuidance: "실제 JPG, PNG, WEBP 이미지 파일만 등록할 수 있습니다.",
    };
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return {
      ok: false,
      errorReason: "압축 아카이브(ZIP) 형식이 감지되어 이미지로 등록할 수 없습니다.",
      correctiveGuidance: "압축 파일이 아닌 개별 JPG, PNG, WEBP 이미지 URL을 입력해 주세요.",
    };
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return {
      ok: false,
      errorReason: "PDF 문서가 감지되었습니다. 상품 이미지는 JPG, PNG, WEBP 형식만 허용됩니다.",
      correctiveGuidance: "문서가 아닌 JPG, PNG, WEBP 이미지 URL을 입력해 주세요.",
    };
  }

  const headAscii = Buffer.from(bytes.subarray(0, Math.min(bytes.byteLength, 64)))
    .toString("utf8")
    .trimStart()
    .toLowerCase();
  if (
    headAscii.startsWith("<!doctype") ||
    headAscii.startsWith("<html") ||
    headAscii.startsWith("<svg") ||
    headAscii.startsWith("<?xml") ||
    headAscii.startsWith("<script") ||
    headAscii.startsWith("#!")
  ) {
    return {
      ok: false,
      errorReason:
        headAscii.startsWith("<svg") || headAscii.includes("<svg")
          ? "SVG 벡터 파일은 보안상 지원하지 않습니다 (JPG, PNG, WEBP만 가능)."
          : "이미지 파일이 아닌 웹페이지(HTML/XML/스크립트) 응답이 반환되었습니다.",
      correctiveGuidance:
        "웹페이지 공유 링크(예: Google Drive 뷰어 페이지) 대신 원본 이미지 직접 다운로드 URL을 입력해 주세요.",
    };
  }

  // Authoritative magic-byte verification matching lib/files/validate.ts
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ok: true, mime: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { ok: true, mime: "image/png", extension: "png" };
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ok: true, mime: "image/webp", extension: "webp" };
  }

  const ctHint = contentTypeHeader ? ` (응답 Content-Type: ${contentTypeHeader.split(";")[0].trim()})` : "";
  return {
    ok: false,
    errorReason: `지원하지 않는 이미지 형식이거나 손상된 파일입니다${ctHint}. JPG, PNG, WEBP만 지원합니다.`,
    correctiveGuidance: "파일 내용이 실제 JPG, PNG, WEBP 형식인 직접 다운로드 URL을 입력해 주세요.",
  };
}
