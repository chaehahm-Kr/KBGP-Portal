import "server-only";
import crypto from "crypto";
import dns from "dns";
import https from "https";
import net from "net";
import { BULK_MEDIA_MAX_IMAGE_BYTES } from "@/lib/product/bulk-import-types";
import {
  inspectDownloadedImageBytes,
  isPublicIpAddress,
  isSafePublicHostname,
  validateHttpsMediaUrlSyntax,
  type VerifiedImageMime,
} from "@/lib/product/bulk-media-url-utils";

const MAX_REDIRECT_HOPS = 3;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 8_000;

export type VerifiedImageDownloadResult =
  | {
      ok: true;
      buffer: Buffer;
      mime: VerifiedImageMime;
      extension: "jpg" | "png" | "webp";
      sha256: string;
      finalUrl: string;
    }
  | {
      ok: false;
      errorReason: string;
      correctiveGuidance: string;
    };

async function resolveVerifiedPublicAddress(
  hostname: string
): Promise<{ address: string; family: 4 | 6 }> {
  const cleanHost = hostname.replace(/^\[|\]$/g, "").trim();
  const ipVer = net.isIP(cleanHost);
  if (ipVer === 4 || ipVer === 6) {
    if (!isPublicIpAddress(cleanHost)) {
      throw new Error("SSRF_BLOCKED_IP");
    }
    return { address: cleanHost, family: ipVer };
  }

  if (!isSafePublicHostname(cleanHost)) {
    throw new Error("SSRF_BLOCKED_HOST");
  }

  let records: dns.LookupAddress[];
  try {
    records = await dns.promises.lookup(cleanHost, { all: true, verbatim: true });
  } catch {
    throw new Error("DNS_LOOKUP_FAILED");
  }

  if (!records || records.length === 0) {
    throw new Error("DNS_LOOKUP_FAILED");
  }

  // Every resolved A/AAAA record must be a public IP (blocks dual-record DNS rebinding tricks)
  for (const rec of records) {
    if (!isPublicIpAddress(rec.address)) {
      throw new Error("SSRF_BLOCKED_IP");
    }
  }

  const chosen = records.find((r) => r.family === 4) || records[0];
  return {
    address: chosen.address,
    family: chosen.family === 6 ? 6 : 4,
  };
}

interface SingleHopFetchOutcome {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

function fetchSingleHttpsHop(
  targetUrl: URL,
  verifiedIp: { address: string; family: 4 | 6 },
  remainingTimeoutMs: number
): Promise<SingleHopFetchOutcome> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    };

    const port = targetUrl.port ? Number(targetUrl.port) : 443;
    const sniServername =
      net.isIP(targetUrl.hostname.replace(/^\[|\]$/g, "")) === 0
        ? targetUrl.hostname
        : undefined;

    const req = https.request(
      {
        protocol: "https:",
        hostname: targetUrl.hostname,
        port,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: "GET",
        servername: sniServername,
        timeout: remainingTimeoutMs,
        headers: {
          Accept: "image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.1",
          "User-Agent": "KSN-BrandPortal-MediaImporter/1.0",
          "Accept-Encoding": "identity",
        },
        // Pin socket connection to the already-verified public IP address (prevents TOCTOU DNS rebinding)
        lookup: (_hostname, opts: any, cb: any) => {
          const callback = typeof opts === "function" ? opts : cb;
          const wantsAll = typeof opts === "object" && opts !== null && Boolean(opts.all);
          if (wantsAll) {
            callback(null, [{ address: verifiedIp.address, family: verifiedIp.family }]);
          } else {
            callback(null, verifiedIp.address, verifiedIp.family);
          }
        },
      },
      (res) => {
        const statusCode = res.statusCode ?? 0;

        // If redirect, drain and return immediately without buffering body
        if (statusCode >= 300 && statusCode < 400) {
          res.resume();
          settled = true;
          clearTimeout(timer);
          resolve({
            statusCode,
            headers: res.headers,
            body: Buffer.alloc(0),
          });
          return;
        }

        // Check Content-Length header upfront before reading stream
        const contentLengthRaw = res.headers["content-length"];
        const declaredLen =
          typeof contentLengthRaw === "string" ? Number(contentLengthRaw) : NaN;
        if (Number.isFinite(declaredLen) && declaredLen > BULK_MEDIA_MAX_IMAGE_BYTES) {
          res.destroy();
          finishError(new Error("IMAGE_TOO_LARGE"));
          return;
        }

        const chunks: Buffer[] = [];
        let receivedBytes = 0;

        res.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.byteLength;
          if (receivedBytes > BULK_MEDIA_MAX_IMAGE_BYTES) {
            res.destroy();
            req.destroy();
            finishError(new Error("IMAGE_TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });

        res.on("end", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({
            statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks, receivedBytes),
          });
        });

        res.on("error", (err) => {
          finishError(err);
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy(new Error("DOWNLOAD_TIMEOUT"));
      finishError(new Error("DOWNLOAD_TIMEOUT"));
    }, remainingTimeoutMs);

    req.on("timeout", () => {
      req.destroy(new Error("DOWNLOAD_TIMEOUT"));
      finishError(new Error("DOWNLOAD_TIMEOUT"));
    });

    req.on("error", (err) => {
      finishError(err);
    });

    req.end();
  });
}

export async function downloadVerifiedProductImage(
  rawUrl: string
): Promise<VerifiedImageDownloadResult> {
  const initialSyntax = validateHttpsMediaUrlSyntax(rawUrl, "image");
  if (!initialSyntax.valid || !initialSyntax.normalizedUrl) {
    return {
      ok: false,
      errorReason: initialSyntax.errorReason || "올바르지 않은 이미지 URL입니다.",
      correctiveGuidance:
        initialSyntax.correctiveGuidance || "https://로 시작하는 직접 이미지 URL을 입력해 주세요.",
    };
  }

  let currentUrlStr = initialSyntax.normalizedUrl;
  const deadline = Date.now() + IMAGE_DOWNLOAD_TIMEOUT_MS;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 250) {
      return {
        ok: false,
        errorReason: "이미지 다운로드 제한 시간(8초)을 초과했습니다.",
        correctiveGuidance: "응답 속도가 정상적인 CDN/직접 이미지 URL을 사용하거나 잠시 후 재시도해 주세요.",
      };
    }

    const hopSyntax = validateHttpsMediaUrlSyntax(currentUrlStr, "image");
    if (!hopSyntax.valid || !hopSyntax.normalizedUrl) {
      return {
        ok: false,
        errorReason:
          hop === 0
            ? hopSyntax.errorReason || "유효하지 않은 이미지 URL입니다."
            : `리다이렉트 대상 URL이 보안/형식 검증에서 차단되었습니다 (${hopSyntax.errorReason || "비허용 대상"}).`,
        correctiveGuidance:
          hopSyntax.correctiveGuidance ||
          "내부망이나 HTTP로 리다이렉트되지 않는 직접 HTTPS 이미지 URL을 입력해 주세요.",
      };
    }

    const parsedHopUrl = new URL(hopSyntax.normalizedUrl);
    let verifiedIp: { address: string; family: 4 | 6 };
    try {
      verifiedIp = await resolveVerifiedPublicAddress(parsedHopUrl.hostname);
    } catch (err: any) {
      const code = err?.message || "";
      if (code === "SSRF_BLOCKED_IP" || code === "SSRF_BLOCKED_HOST") {
        return {
          ok: false,
          errorReason: "내부망/사설 IP 또는 비공개 호스트로의 접근이 차단되었습니다 (SSRF 보호).",
          correctiveGuidance: "외부 공인 네트워크에서 제공되는 HTTPS 이미지 URL을 입력해 주세요.",
        };
      }
      return {
        ok: false,
        errorReason: `이미지 서버 도메인(${parsedHopUrl.hostname})을 찾을 수 없습니다.`,
        correctiveGuidance: "도메인 오타 또는 만료된 링크가 아닌지 확인해 주세요.",
      };
    }

    let outcome: SingleHopFetchOutcome;
    try {
      outcome = await fetchSingleHttpsHop(parsedHopUrl, verifiedIp, remainingMs);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg === "IMAGE_TOO_LARGE") {
        return {
          ok: false,
          errorReason: "이미지 파일 용량이 최대 허용 한도(10MB)를 초과했습니다.",
          correctiveGuidance: "10MB 이하로 최적화된 JPG, PNG, WEBP 이미지를 사용해 주세요.",
        };
      }
      if (msg === "DOWNLOAD_TIMEOUT") {
        return {
          ok: false,
          errorReason: "이미지 서버 응답 시간이 초과되었습니다 (최대 8초).",
          correctiveGuidance: "접속 가능한 직접 이미지 URL인지 확인하거나 잠시 후 재시도해 주세요.",
        };
      }
      return {
        ok: false,
        errorReason: `이미지 다운로드 중 네트워크/TLS 오류가 발생했습니다 (${msg.slice(0, 80) || "연결 실패"}).`,
        correctiveGuidance: "유효한 SSL 인증서를 사용하는 공개 HTTPS 이미지 URL인지 확인해 주세요.",
      };
    }

    if ([301, 302, 303, 307, 308].includes(outcome.statusCode)) {
      if (hop >= MAX_REDIRECT_HOPS) {
        return {
          ok: false,
          errorReason: `리다이렉트 횟수가 최대 허용치(${MAX_REDIRECT_HOPS}회)를 초과했습니다.`,
          correctiveGuidance: "복잡한 단축 링크 대신 최종 원본 이미지의 직접 HTTPS URL을 입력해 주세요.",
        };
      }
      const locationHeader = outcome.headers["location"];
      const locationStr = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
      if (!locationStr || !locationStr.trim()) {
        return {
          ok: false,
          errorReason: `이미지 서버가 위치(Location) 없는 리다이렉트(HTTP ${outcome.statusCode})를 반환했습니다.`,
          correctiveGuidance: "직접 다운로드 가능한 원본 이미지 URL을 입력해 주세요.",
        };
      }
      try {
        currentUrlStr = new URL(locationStr.trim(), parsedHopUrl).toString();
      } catch {
        return {
          ok: false,
          errorReason: "리다이렉트 대상 URL 형식이 올바르지 않습니다.",
          correctiveGuidance: "원본 이미지 직접 HTTPS URL을 입력해 주세요.",
        };
      }
      continue;
    }

    if (outcome.statusCode < 200 || outcome.statusCode >= 300) {
      return {
        ok: false,
        errorReason:
          outcome.statusCode === 404 || outcome.statusCode === 410
            ? `이미지 URL을 찾을 수 없거나 만료되었습니다 (HTTP ${outcome.statusCode}).`
            : outcome.statusCode === 401 || outcome.statusCode === 403
            ? `이미지 URL 접근 권한이 거부되었습니다 (HTTP ${outcome.statusCode} — 비공개/만료 링크).`
            : `이미지 서버가 오류 상태를 반환했습니다 (HTTP ${outcome.statusCode}).`,
        correctiveGuidance:
          "로그인 없이 외부에서 직접 다운로드 가능한 공개(또는 유효한 서명) HTTPS 이미지 URL을 입력해 주세요.",
      };
    }

    const contentTypeHeader = Array.isArray(outcome.headers["content-type"])
      ? outcome.headers["content-type"][0]
      : outcome.headers["content-type"];

    const inspected = inspectDownloadedImageBytes(outcome.body, contentTypeHeader);
    if (!inspected.ok) {
      return {
        ok: false,
        errorReason: inspected.errorReason,
        correctiveGuidance: inspected.correctiveGuidance,
      };
    }

    const sha256 = crypto.createHash("sha256").update(outcome.body).digest("hex");

    return {
      ok: true,
      buffer: outcome.body,
      mime: inspected.mime,
      extension: inspected.extension,
      sha256,
      finalUrl: parsedHopUrl.toString(),
    };
  }

  return {
    ok: false,
    errorReason: "이미지 리다이렉트 한도를 초과했습니다.",
    correctiveGuidance: "원본 이미지 직접 HTTPS URL을 입력해 주세요.",
  };
}
