"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import jsQR from "jsqr";
import { WeeklyCheckItemState } from "@/lib/retailer/weekly-check-types";
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
  ) => Promise<{ success: boolean; error?: string }> | void;
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

/**
 * Neutral product image component that guarantees no broken or unrelated commercial images
 */
function SafeProductThumbnail({
  src,
  alt,
  sku,
  sizeClass = "w-full h-full",
}: {
  src: string | null;
  alt: string;
  sku: string;
  sizeClass?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`${sizeClass} flex flex-col items-center justify-center bg-zinc-800 text-zinc-400 p-1.5 rounded-xl`}>
        <svg className="w-6 h-6 text-zinc-500 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <span className="text-[9px] font-mono text-zinc-400 truncate max-w-full text-center leading-tight">
          {sku}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={`${sizeClass} object-contain`}
    />
  );
}

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
  const barcodeDetectorRef = useRef<any>(null);
  const isProcessingFrameRef = useRef(false);

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Last scanned info for unassigned or invalid state
  const [lastScannedPayload, setLastScannedPayload] = useState<string>("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Uncounted & Product Search Drawer
  const [showProductDrawer, setShowProductDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"uncounted" | "all">("uncounted");
  const [drawerSearch, setDrawerSearch] = useState("");

  // Manual input fallback toggle
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState("");

  // Uncounted count
  const uncountedCount = useMemo(() => {
    return items.filter((it) => !currentCounts[it.productId]?.isCounted).length;
  }, [items, currentCounts]);

  // Drawer filtered list
  const drawerFilteredItems = useMemo(() => {
    let list = items;
    if (drawerTab === "uncounted") {
      list = list.filter((it) => !currentCounts[it.productId]?.isCounted);
    }
    if (!drawerSearch.trim()) return list;
    const q = drawerSearch.toLowerCase().trim();
    return list.filter(
      (it) =>
        it.productName.toLowerCase().includes(q) ||
        (it.productNameEn && it.productNameEn.toLowerCase().includes(q)) ||
        it.sku.toLowerCase().includes(q) ||
        it.brandName.toLowerCase().includes(q)
    );
  }, [items, currentCounts, drawerTab, drawerSearch]);

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

  // Handle scanned raw payload with native & fallback parsing
  const handlePayloadDetected = useCallback(
    (payload: string) => {
      if (!payload || !payload.trim()) return;

      const trimmed = payload.trim();
      setLastScannedPayload(trimmed);
      setSaveError(null);

      // Haptic feedback if supported
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(50);
        }
      } catch {
        // ignore
      }

      // Parse canonical product QR (handles URL, UUID, or SKU)
      const parsed = parseKSelectProductQr(trimmed);

      // Multi-layer product matching:
      let found: WeeklyCheckItemState | null = null;

      // 1. By canonical UUID if present
      if (parsed.productId) {
        found =
          items.find(
            (it) => it.productId.toLowerCase() === parsed.productId!.toLowerCase()
          ) || null;
      }

      // 2. By SKU if parsed or raw SKU matches
      if (!found && parsed.sku) {
        const targetSku = parsed.sku.toLowerCase();
        found =
          items.find(
            (it) =>
              it.sku.toLowerCase() === targetSku ||
              (it as any).manufactureSku?.toLowerCase() === targetSku
          ) || null;
      }

      // 3. By raw string match against items
      if (!found) {
        const normTrimmed = trimmed.toLowerCase();
        found =
          items.find(
            (it) =>
              it.productId.toLowerCase() === normTrimmed ||
              it.sku.toLowerCase() === normTrimmed ||
              (it as any).manufactureSku?.toLowerCase() === normTrimmed ||
              (it.productName && it.productName.toLowerCase() === normTrimmed)
          ) || null;
      }

      if (found) {
        // Check existing count for recount flow
        const existingCount = currentCounts[found.productId];
        const isCounted = Boolean(existingCount?.isCounted);
        const countVal = isCounted ? existingCount!.remainingQty : 0;
        const notesVal = existingCount?.notes || "";

        setMatchedItem(found);
        setInputQty(countVal);
        setInputNotes(notesVal);
        setIsAlreadyCounted(isCounted);
        setScanStatus("product_found");
        setShowProductDrawer(false);

        setTimeout(() => {
          if (scanInputRef.current) {
            scanInputRef.current.focus();
            scanInputRef.current.select();
          }
        }, 100);
      } else if (parsed.productId && parsed.isValid) {
        // Valid K SELECT product QR, but not assigned to this store
        setMatchedItem(null);
        setScanStatus("product_not_in_store");
      } else {
        // Invalid or unrecognized QR/barcode
        setMatchedItem(null);
        setScanStatus("invalid_qr");
      }
    },
    [items, currentCounts]
  );

  // Resume scanning loop
  const resumeScanning = useCallback(() => {
    setMatchedItem(null);
    setInputQty(0);
    setInputNotes("");
    setSaveError(null);
    setScanStatus("scanning");
  }, []);

  // Save current item count and scan next product
  const handleSaveAndScanNext = useCallback(async () => {
    if (!matchedItem || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    const savedName = matchedItem.productName;
    const savedQty = inputQty;

    try {
      const res = await onSaveItemCount(matchedItem.productId, inputQty, inputNotes, true);
      if (res && res.success === false) {
        setSaveError(res.error || "Failed to save item count. Please try again.");
        setIsSaving(false);
        return;
      }

      setSuccessToast(`✓ Saved to Cloud — ${savedName} (Qty: ${savedQty})`);
      setTimeout(() => {
        setSuccessToast(null);
      }, 3500);

      resumeScanning();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save item count.");
    } finally {
      setIsSaving(false);
    }
  }, [matchedItem, inputQty, inputNotes, isSaving, onSaveItemCount, resumeScanning]);

  // Save current item count and close scanner (return to list)
  const handleSaveAndReturn = useCallback(async () => {
    if (matchedItem && !isSaving) {
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await onSaveItemCount(matchedItem.productId, inputQty, inputNotes, true);
        if (res && res.success === false) {
          setSaveError(res.error || "Failed to save item count.");
          setIsSaving(false);
          return;
        }
      } catch (err: any) {
        setSaveError(err?.message || "Failed to save item count.");
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }
    stopCamera();
    onClose();
  }, [matchedItem, inputQty, inputNotes, isSaving, onSaveItemCount, stopCamera, onClose]);

  // Manual input submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    handlePayloadDetected(manualText.trim());
    setManualText("");
    setShowManualInput(false);
  };

  // Direct selection of an item from uncounted/search drawer
  const handleSelectDrawerItem = (item: WeeklyCheckItemState) => {
    const existingCount = currentCounts[item.productId];
    const isCounted = Boolean(existingCount?.isCounted);
    const countVal = isCounted ? existingCount!.remainingQty : 0;
    const notesVal = existingCount?.notes || "";

    setMatchedItem(item);
    setInputQty(countVal);
    setInputNotes(notesVal);
    setIsAlreadyCounted(isCounted);
    setScanStatus("product_found");
    setShowProductDrawer(false);

    setTimeout(() => {
      if (scanInputRef.current) {
        scanInputRef.current.focus();
        scanInputRef.current.select();
      }
    }, 100);
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

        // Apply continuous autofocus constraints for crisp mobile barcode detection
        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps: any = track.getCapabilities ? track.getCapabilities() : {};
          setHasTorch(Boolean(caps.torch));

          if ((track as any).applyConstraints) {
            try {
              await (track as any).applyConstraints({
                advanced: [{ focusMode: "continuous" } as any],
              });
            } catch {
              // ignore if continuous focus unsupported
            }
          }
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
          setErrorMessage(
            "Camera permission was denied. Please allow camera access in your browser settings to scan price tags."
          );
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

  // Frame processing loop using native BarcodeDetector with jsQR fallback
  useEffect(() => {
    if (scanStatus !== "scanning" || !isOpen) return;

    let active = true;

    // Initialize native BarcodeDetector if available (Chromium/Android Chrome)
    if (typeof window !== "undefined" && "BarcodeDetector" in window && !barcodeDetectorRef.current) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
        });
      } catch (err) {
        console.warn("Native BarcodeDetector initialization fallback:", err);
      }
    }

    const scanFrame = async () => {
      if (!active || scanStatus !== "scanning") return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= video.HAVE_CURRENT_DATA && !isProcessingFrameRef.current) {
        isProcessingFrameRef.current = true;

        try {
          let detectedValue: string | null = null;

          // 1. Hardware-accelerated Native BarcodeDetector (Android Chrome primary)
          if (barcodeDetectorRef.current) {
            try {
              const barcodes = await barcodeDetectorRef.current.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedValue = barcodes[0].rawValue;
              }
            } catch {
              // ignore and fall back to jsQR
            }
          }

          // 2. High-speed bounded jsQR Fallback (iOS Safari / desktop fallback)
          if (!detectedValue && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
            // Downscale analysis canvas to max 512px on longer dimension (runs in <10ms)
            const maxDim = 512;
            const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
            const targetWidth = Math.round(video.videoWidth * scale);
            const targetHeight = Math.round(video.videoHeight * scale);

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
              canvas.width = targetWidth;
              canvas.height = targetHeight;
            }

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
              const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

              const code = jsQR(imageData.data, targetWidth, targetHeight, {
                inversionAttempts: "dontInvert",
              });

              if (code && code.data) {
                detectedValue = code.data;
              }
            }
          }

          if (detectedValue) {
            handlePayloadDetected(detectedValue);
            return; // Pause scanning while user inputs quantity
          }
        } finally {
          isProcessingFrameRef.current = false;
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
            <span className="text-zinc-400 text-[10px]">
              {uncountedCount} uncounted / {items.length} total
            </span>
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

      {/* Toast Notification */}
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
              Align Shelf Price Tag QR within frame
            </p>
          </div>
        )}

        {/* Permission Denied / Unsupported State */}
        {(scanStatus === "permission_denied" || scanStatus === "unsupported") && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-md">
            <div className="max-w-xs w-full text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-3xl flex items-center justify-center mx-auto">
                📷
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Camera Unavailable</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {errorMessage || "Unable to access device camera."}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductDrawer(true)}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer shadow-md"
                >
                  📋 View & Count Store Products
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all cursor-pointer"
                >
                  Enter SKU Manually
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="w-full py-2 px-4 rounded-xl text-xs text-zinc-500 hover:text-white transition-colors"
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
                This is a valid K SELECT product QR, but it is not currently assigned to{" "}
                <strong className="text-white">{storeName}</strong>.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={resumeScanning}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-lg transition-all cursor-pointer"
                >
                  Scan Next Product 📷
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="py-3 px-4 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
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
              <h4 className="text-sm font-bold text-white">Unrecognized QR or Barcode</h4>
              <p className="text-xs text-rose-200/80">
                The scanned code does not match any product in this store.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={resumeScanning}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                >
                  Scan Again
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductDrawer(true)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
                >
                  Select from List
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
            {/* Recount Notice Banner if previously counted */}
            {isAlreadyCounted && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-3">
                <span className="text-xl">🔄</span>
                <div className="flex-1 text-xs">
                  <div className="font-bold text-amber-300">Recounting Product</div>
                  <div className="text-[11px] text-amber-200/80">
                    Previously saved count: <strong className="text-white">{inputQty} units</strong>. Update below if needed.
                  </div>
                </div>
              </div>
            )}

            {/* Header / Product summary */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                <SafeProductThumbnail
                  src={matchedItem.thumbnailUrl}
                  alt={matchedItem.productName}
                  sku={matchedItem.sku}
                  sizeClass="w-full h-full"
                />
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

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 mt-1">
                  <span>
                    Prev:{" "}
                    <strong className="text-zinc-200">
                      {matchedItem.previousReportedQty !== null
                        ? `${matchedItem.previousReportedQty} u`
                        : "Baseline"}
                    </strong>
                  </span>
                  {Boolean(matchedItem.deliveredSincePrevious && matchedItem.deliveredSincePrevious > 0) && (
                    <span className="text-emerald-400 font-semibold">
                      • +{matchedItem.deliveredSincePrevious} Delivered
                    </span>
                  )}
                  {Boolean(matchedItem.incomingQty && matchedItem.incomingQty > 0) && (
                    <span className="text-amber-400 font-semibold">
                      • 🚚 {matchedItem.incomingQty} In-Transit
                    </span>
                  )}
                  {isAlreadyCounted ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 text-[10px]">
                      Counted ({inputQty})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold text-[10px]">
                      Uncounted
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
                  pattern="[0-9]*"
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

              {/* Explicit Quick "0 - Out of Stock" Button */}
              <button
                type="button"
                onClick={() => setInputQty(0)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  inputQty === 0
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-850"
                }`}
              >
                0 — Out of Stock
              </button>

              {/* Optional Item Note */}
              <input
                type="text"
                placeholder="Optional note (e.g., tester bottle, 1 damaged)"
                value={inputNotes}
                onChange={(e) => setInputNotes(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />

              {/* Server Save Error Alert */}
              {saveError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200">
                  <div className="font-bold flex items-center justify-between">
                    <span>Save Failed</span>
                    <button type="button" onClick={() => setSaveError(null)}>
                      ✕
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px]">{saveError}</p>
                </div>
              )}
            </div>

            {/* Fast Action Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAndScanNext}
                className="w-full py-4 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Saving to Cloud...</span>
                  </>
                ) : (
                  <span>
                    {isAlreadyCounted
                      ? "Update Count & Scan Next 📷"
                      : "Save & Scan Next Product 📷"}
                  </span>
                )}
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAndReturn}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all cursor-pointer text-center disabled:opacity-50"
              >
                {isSaving
                  ? "Saving..."
                  : isAlreadyCounted
                  ? "Update & Return to Product List"
                  : "Save & Return to Product List"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Quick Actions (when scanning) */}
      {scanStatus === "scanning" && (
        <div className="relative z-30 p-4 pb-safe flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDrawerTab("uncounted");
              setShowProductDrawer(true);
            }}
            className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-full backdrop-blur-md border border-indigo-400/40 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <span>📋</span>
            <span>Uncounted ({uncountedCount} left)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDrawerTab("all");
              setShowProductDrawer(true);
            }}
            className="text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900/90 px-3.5 py-2.5 rounded-full backdrop-blur-md border border-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>🔍</span>
            <span>Search SKU</span>
          </button>
        </div>
      )}

      {/* Uncounted & Product Search Drawer (Slide-up Sheet) */}
      {showProductDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-lg mx-auto bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-6 duration-200 pb-safe">
            {/* Drawer Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Store Inventory Products</h3>
                <p className="text-[11px] text-zinc-400">
                  Select any product to enter count without scanning
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductDrawer(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setDrawerTab("uncounted")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  drawerTab === "uncounted"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Uncounted ({uncountedCount})
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab("all")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  drawerTab === "all"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                All Products ({items.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search product name, brand, or SKU..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                className="w-full text-xs p-3 pl-9 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute left-3 top-3 text-zinc-500 text-xs">🔍</span>
              {drawerSearch && (
                <button
                  type="button"
                  onClick={() => setDrawerSearch("")}
                  className="absolute right-3 top-3 text-zinc-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] pr-1">
              {drawerFilteredItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  {drawerTab === "uncounted"
                    ? "All products in this store have been counted! 🎉"
                    : "No matching products found."}
                </div>
              ) : (
                drawerFilteredItems.map((item) => {
                  const state = currentCounts[item.productId];
                  const isCounted = Boolean(state?.isCounted);

                  return (
                    <div
                      key={item.productId}
                      onClick={() => handleSelectDrawerItem(item)}
                      className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-indigo-500/60 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                        <SafeProductThumbnail
                          src={item.thumbnailUrl}
                          alt={item.productName}
                          sku={item.sku}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-indigo-400 truncate">
                            {item.brandName}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-[10px] font-mono text-zinc-400 truncate">
                            {item.sku}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white truncate mt-0.5 group-hover:text-indigo-300">
                          {item.productName}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Prev: {item.previousReportedQty !== null ? `${item.previousReportedQty} u` : "Baseline"}
                          {Boolean(item.deliveredSincePrevious && item.deliveredSincePrevious > 0) && (
                            <span className="text-emerald-400 ml-1.5">+{item.deliveredSincePrevious} Deliv</span>
                          )}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isCounted ? (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                            Counted ({state.remainingQty})
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold group-hover:bg-indigo-500 transition-colors">
                            Count →
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowProductDrawer(false);
                  setShowManualInput(true);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                ⌨️ Type Custom URL / SKU
              </button>
              <button
                type="button"
                onClick={() => setShowProductDrawer(false)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Input Fallback Modal */}
      {showManualInput && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
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
    </div>
  );
}
