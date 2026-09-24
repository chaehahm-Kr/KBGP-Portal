"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { WeeklyCheckItemState } from "@/lib/retailer/weekly-check";
import { parseKSelectProductQr } from "@/lib/product/qr";

interface WeeklyCheckScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WeeklyCheckItemState[];
  currentCounts: Record<string, { remainingQty: number; isCounted: boolean; notes: string }>;
  onSaveItemCount: (
    productId: string,
    remainingQty: number,
    notes: string,
    andSaveDraft?: boolean
  ) => void;
  storeName: string;
}

type ScanStatus =
  | "initializing"
  | "permission_denied"
  | "unsupported"
  | "scanning"
  | "product_found"
  | "product_not_in_store"
  | "invalid_qr";

export function WeeklyCheckScannerModal({
  isOpen,
  onClose,
  items,
  currentCounts,
  onSaveItemCount,
  storeName,
}: WeeklyCheckScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const [scanStatus, setScanStatus] = useState<ScanStatus>("initializing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Active matched product state
  const [matchedItem, setMatchedItem] = useState<WeeklyCheckItemState | null>(null);
  const [inputQty, setInputQty] = useState<number>(0);
  const [inputNotes, setInputNotes] = useState<string>("");
  const [isAlreadyCounted, setIsAlreadyCounted] = useState(false);

  // Last scanned info for unassigned or invalid state
  const [lastScannedPayload, setLastScannedPayload] = useState<string>("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Manual input fallback toggle
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState("");

  // Stop media stream and cancel animation frames
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Toggle Torch/Flashlight
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      // Ignore if unsupported
    }
  }, [torchOn]);

  // Switch rear/front camera
  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  // Handle scanned raw payload
  const handlePayloadDetected = useCallback(
    (payload: string) => {
      if (!payload || !payload.trim()) return;

      const trimmed = payload.trim();
      setLastScannedPayload(trimmed);

      // Haptic feedback & audio chime if supported
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(40);
        }
      } catch {
        // ignore
      }

      // Parse canonical product QR
      const parsed = parseKSelectProductQr(trimmed);

      if (parsed.isValid && parsed.productId) {
        // Look up product in current store assortment
        const found = items.find(
          (it) => it.productId.toLowerCase() === parsed.productId!.toLowerCase()
        );

        if (found) {
          const existingCount = currentCounts[found.productId];
          const countVal =
            existingCount && existingCount.isCounted
              ? existingCount.remainingQty
              : 0;
          const notesVal = existingCount?.notes || "";

          setMatchedItem(found);
          setInputQty(countVal);
          setInputNotes(notesVal);
          setIsAlreadyCounted(Boolean(existingCount?.isCounted));
          setScanStatus("product_found");

          setTimeout(() => {
            if (scanInputRef.current) {
              scanInputRef.current.focus();
              scanInputRef.current.select();
            }
          }, 100);
        } else {
          // Valid K SELECT product QR, but not assigned to this store
          setMatchedItem(null);
          setScanStatus("product_not_in_store");
        }
      } else {
        // Check if manual SKU or ID match against store items
        const foundBySku = items.find(
          (it) =>
            it.sku.toLowerCase() === trimmed.toLowerCase() ||
            it.productId.toLowerCase() === trimmed.toLowerCase() ||
            (it.productName && it.productName.toLowerCase().includes(trimmed.toLowerCase()))
        );

        if (foundBySku) {
          const existingCount = currentCounts[foundBySku.productId];
          const countVal =
            existingCount && existingCount.isCounted
              ? existingCount.remainingQty
              : 0;
          const notesVal = existingCount?.notes || "";

          setMatchedItem(foundBySku);
          setInputQty(countVal);
          setInputNotes(notesVal);
          setIsAlreadyCounted(Boolean(existingCount?.isCounted));
          setScanStatus("product_found");
        } else {
          setMatchedItem(null);
          setScanStatus("invalid_qr");
        }
      }
    },
    [items, currentCounts]
  );

  // Resume scanning loop
  const resumeScanning = useCallback(() => {
    setMatchedItem(null);
    setInputQty(0);
    setInputNotes("");
    setScanStatus("scanning");
  }, []);

  // Save current item count and scan next product
  const handleSaveAndScanNext = useCallback(() => {
    if (!matchedItem) return;

    const savedName = matchedItem.productName;
    const savedQty = inputQty;

    onSaveItemCount(matchedItem.productId, inputQty, inputNotes, true);

    setSuccessToast(`✓ ${savedName} saved — Remaining Qty: ${savedQty}`);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3000);

    resumeScanning();
  }, [matchedItem, inputQty, inputNotes, onSaveItemCount, resumeScanning]);

  // Save current item count and close scanner (return to list)
  const handleSaveAndReturn = useCallback(() => {
    if (matchedItem) {
      onSaveItemCount(matchedItem.productId, inputQty, inputNotes, true);
    }
    stopCamera();
    onClose();
  }, [matchedItem, inputQty, inputNotes, onSaveItemCount, stopCamera, onClose]);

  // Manual input submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    handlePayloadDetected(manualText.trim());
    setManualText("");
    setShowManualInput(false);
  };

  // Start Camera Stream & Frame Analysis Loop
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;

    async function startCamera() {
      stopCamera();
      setScanStatus("initializing");
      setErrorMessage(null);

      if (!navigator?.mediaDevices?.getUserMedia) {
        setScanStatus("unsupported");
        setErrorMessage("Camera access is not supported on this device or browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Check torch capability
        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps: any = track.getCapabilities ? track.getCapabilities() : {};
          setHasTorch(Boolean(caps.torch));
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true"); // Crucial for iOS Safari
          await videoRef.current.play();
        }

        setScanStatus("scanning");
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (!isMounted) return;

        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError" ||
          err.message?.includes("Permission denied")
        ) {
          setScanStatus("permission_denied");
          setErrorMessage("Camera permission was denied. Please allow camera access in your browser settings to scan price tags.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setScanStatus("unsupported");
          setErrorMessage("No camera device was detected on this device.");
        } else {
          setScanStatus("unsupported");
          setErrorMessage(err.message || "Failed to initialize camera.");
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, facingMode, stopCamera]);

  // Frame processing loop using jsQR
  useEffect(() => {
    if (scanStatus !== "scanning" || !isOpen) return;

    let active = true;

    const scanFrame = () => {
      if (!active || scanStatus !== "scanning") return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= video.HAVE_CURRENT_DATA) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });

          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);

            // Fast decode with jsQR
            const code = jsQR(imageData.data, width, height, {
              inversionAttempts: "dontInvert",
            });

            if (code && code.data) {
              handlePayloadDetected(code.data);
              return; // Pause loop
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [scanStatus, isOpen, handlePayloadDetected]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden touch-none select-none">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 pt-safe bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-10 h-10 rounded-full bg-zinc-900/80 backdrop-blur-md text-white flex items-center justify-center text-lg font-bold active:scale-95 transition-all shadow-md cursor-pointer"
            aria-label="Close scanner"
          >
            ✕
          </button>
          <div className="text-white text-xs">
            <span className="font-bold block">{storeName}</span>
            <span className="text-zinc-400 text-[10px]">Fast Count Scanner</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Torch toggle */}
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center text-base transition-all active:scale-95 cursor-pointer ${
                torchOn ? "bg-amber-400 text-black shadow-lg" : "bg-zinc-900/80 text-white"
              }`}
              aria-label="Toggle Flashlight"
            >
              🔦
            </button>
          )}

          {/* Camera flip toggle */}
          <button
            type="button"
            onClick={toggleFacingMode}
            className="w-10 h-10 rounded-full bg-zinc-900/80 backdrop-blur-md text-white flex items-center justify-center text-base active:scale-95 transition-all shadow-md cursor-pointer"
            aria-label="Switch Camera"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Toast Notification (e.g. "✓ Aloe Gel saved — Remaining Qty: 8") */}
      {successToast && (
        <div className="absolute top-16 inset-x-4 z-40 flex justify-center animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-xl flex items-center gap-2 border border-emerald-400/30 max-w-md text-center">
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {/* Camera Viewport Area */}
      <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            scanStatus === "scanning" || scanStatus === "product_found"
              ? "opacity-100"
              : "opacity-30"
          }`}
        />

        {/* Viewfinder Target Frame (when actively scanning) */}
        {scanStatus === "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
              {/* Corner target guides */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-xl" />

              {/* Scanning laser line animation */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse shadow-[0_0_8px_#818cf8]" />
            </div>

            <p className="mt-6 text-xs font-semibold text-white/90 bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-md shadow-sm">
              Align K SELECT Product QR within frame
            </p>
          </div>
        )}

        {/* Permission Denied / Error State */}
        {(scanStatus === "permission_denied" || scanStatus === "unsupported") && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-md">
            <div className="max-w-xs w-full text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-3xl flex items-center justify-center mx-auto">
                📷
              </div>
              <h3 className="text-base font-bold text-white">Camera Access Required</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {errorMessage ||
                  "Please enable camera permissions in your browser or switch to manual product list."}
              </p>
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer"
                >
                  Enter SKU or QR Manually
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all cursor-pointer"
                >
                  Return to Product List
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Not In Store State */}
        {scanStatus === "product_not_in_store" && (
          <div className="absolute inset-x-4 bottom-8 z-30 animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="rounded-3xl bg-zinc-900/95 border border-amber-500/40 p-6 text-center space-y-3 shadow-2xl backdrop-blur-xl max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl mx-auto border border-amber-500/20">
                ⚠️
              </div>
              <h4 className="text-sm font-bold text-white">Product Not Assigned</h4>
              <p className="text-xs text-amber-200/80">
                This is a valid K SELECT product QR, but it is not assigned to{" "}
                <strong className="text-white">{storeName}</strong>.
              </p>
              <button
                type="button"
                onClick={resumeScanning}
                className="w-full py-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-lg transition-all cursor-pointer"
              >
                Scan Next Product 📷
              </button>
            </div>
          </div>
        )}

        {/* Invalid QR State */}
        {scanStatus === "invalid_qr" && (
          <div className="absolute inset-x-4 bottom-8 z-30 animate-in fade-in slide-in-from-bottom-6 duration-200">
            <div className="rounded-3xl bg-zinc-900/95 border border-rose-500/40 p-6 text-center space-y-3 shadow-2xl backdrop-blur-xl max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center text-2xl mx-auto border border-rose-500/20">
                ❌
              </div>
              <h4 className="text-sm font-bold text-white">Invalid QR Code</h4>
              <p className="text-xs text-rose-200/80">
                Not a valid K SELECT product QR code or unrecognized SKU.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={resumeScanning}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                >
                  Type SKU
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MATCHED PRODUCT COUNT ENTRY SHEET (BOTTOM OVERLAY) */}
      {scanStatus === "product_found" && matchedItem && (
        <div className="relative z-40 bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 pb-safe">
          <div className="max-w-md mx-auto space-y-4">
            {/* Header / Product summary */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                {matchedItem.thumbnailUrl ? (
                  <img
                    src={matchedItem.thumbnailUrl}
                    alt={matchedItem.productName}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-zinc-500">No Img</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {matchedItem.brandName}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-[10px] font-mono text-zinc-400 truncate">
                    {matchedItem.sku}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white truncate mt-0.5">
                  {matchedItem.productName}
                </h3>

                <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1">
                  <span>
                    Prev:{" "}
                    <strong className="text-zinc-200">
                      {matchedItem.previousReportedQty !== null
                        ? `${matchedItem.previousReportedQty} u`
                        : "Baseline"}
                    </strong>
                  </span>
                  {isAlreadyCounted && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 text-[10px]">
                      Already Counted ({inputQty})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Remaining Qty Stepper & Numeric Input */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300 uppercase tracking-wider text-[11px]">
                  Remaining Quantity
                </span>
                <span className="text-[11px] text-zinc-500">Shelf & Backroom</span>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setInputQty((prev) => Math.max(0, prev - 1))}
                  className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 text-xl font-bold text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-md"
                  aria-label="Decrease quantity"
                >
                  −
                </button>

                <input
                  ref={scanInputRef}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={inputQty}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setInputQty(isNaN(v) ? 0 : Math.max(0, v));
                  }}
                  className="w-28 h-14 text-center text-3xl font-extrabold bg-zinc-900 border-2 border-indigo-500 rounded-2xl text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
                />

                <button
                  type="button"
                  onClick={() => setInputQty((prev) => prev + 1)}
                  className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 text-xl font-bold text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-md"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              {/* Optional Item Note */}
              <input
                type="text"
                placeholder="Optional note (e.g., tester bottle, 1 damaged)"
                value={inputNotes}
                onChange={(e) => setInputNotes(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Fast Action Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveAndScanNext}
                className="w-full py-4 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Save & Scan Next Product 📷</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndReturn}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all cursor-pointer text-center"
              >
                Save & Return to Product List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Input Fallback Drawer / Modal */}
      {showManualInput && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Manual Product Search</h3>
              <button
                type="button"
                onClick={() => setShowManualInput(false)}
                className="text-zinc-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Paste Product URL or type SKU..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="w-full text-xs p-3.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualText.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white disabled:opacity-50"
                >
                  Find & Count
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Manual Fallback Trigger (when scanning) */}
      {scanStatus === "scanning" && (
        <div className="relative z-30 p-4 pb-safe flex justify-center">
          <button
            type="button"
            onClick={() => setShowManualInput(true)}
            className="text-[11px] font-semibold text-zinc-400 hover:text-white bg-black/60 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 active:scale-95 transition-all cursor-pointer"
          >
            ⌨️ Having trouble scanning? Type SKU / URL
          </button>
        </div>
      )}
    </div>
  );
}
