import React, { useEffect, useRef, useState } from 'react';
import { OrderRecord, QrValidationResult } from '../types';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Keyboard,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';

interface NestyQrScannerModalProps {
  isOpen: boolean;
  isLoadingValidation: boolean;
  scanResult: QrValidationResult | null;
  onScanSubmitted: (rawValue: string) => void;
  onClearResult: () => void;
  onOpenOrderDetails: (order: OrderRecord) => void;
  onClose: () => void;
}

export const NestyQrScannerModal: React.FC<NestyQrScannerModalProps> = ({
  isOpen,
  isLoadingValidation,
  scanResult,
  onScanSubmitted,
  onClearResult,
  onOpenOrderDetails,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isCameraLoading, setIsCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isOpen || isManualMode || scanResult || isLoadingValidation) {
      return;
    }

    let activeStream: MediaStream | null = null;
    let detectorInterval: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;

    async function startCamera() {
      setIsCameraLoading(true);
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsCameraLoading(false);
        setCameraError(
          'Browser camera API is unavailable in this context. Please use Manual Code Entry or the Quick Scan Presets below.'
        );
        return;
      }

      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });

        if (isCancelled) {
          activeStream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          await videoRef.current.play().catch(() => {});
        }
        setIsCameraLoading(false);

        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
        if (BarcodeDetectorClass && videoRef.current) {
          const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
          detectorInterval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                onScanSubmitted(barcodes[0].rawValue);
              }
            } catch {
              // Ignore frame detection errors
            }
          }, 600);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setIsCameraLoading(false);
          const msg = err instanceof Error ? err.message : 'Permission denied or no camera found';
          setCameraError(
            `Camera access unavailable (${msg}). You can retry camera access or enter a code manually below.`
          );
        }
      }
    }

    startCamera();

    return () => {
      isCancelled = true;
      if (detectorInterval) clearInterval(detectorInterval);
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, isManualMode, scanResult, isLoadingValidation, retryCount, onScanSubmitted]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      data-testid="qr_scanner_modal_backdrop"
      className="fixed inset-0 z-40 bg-black/65 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="qr_scanner_modal_card"
        className="w-full max-w-md bg-nesty-creamSurface border-2 border-nesty-gold rounded-[28px] shadow-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-nesty-burgundy border border-nesty-gold flex items-center justify-center text-nesty-cream">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-nesty-burgundy">Nesty QR Scanner</h2>
              <p className="text-xs text-nesty-textSecondary">
                Verify counter stations, promo coupons & order refs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close_qr_scanner_button"
            className="p-2 rounded-xl text-nesty-burgundy hover:bg-nesty-creamElevated"
            aria-label="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <hr className="border-nesty-creamBorder my-3.5" />

        <div className="bg-nesty-goldLight/70 border border-nesty-gold rounded-xl p-2.5 flex items-center gap-2.5 text-xs text-nesty-textPrimary">
          <ShieldCheck className="w-4 h-4 text-nesty-burgundy shrink-0" />
          <span>
            Scanned QR values are validated safely on the backend. Scanning never marks an unpaid
            order as paid.
          </span>
        </div>

        <div className="mt-3.5">
          {isLoadingValidation ? (
            <div className="h-48 rounded-2xl bg-nesty-creamElevated border border-nesty-gold flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-nesty-burgundy border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-nesty-burgundy">
                Validating scanned QR payload with server...
              </span>
            </div>
          ) : scanResult ? (
            <div
              data-testid={scanResult.valid ? 'qr_scan_success_card' : 'qr_scan_invalid_card'}
              className={`rounded-2xl p-5 border-2 text-center ${
                scanResult.valid
                  ? 'bg-nesty-successBg border-nesty-success'
                  : 'bg-nesty-errorBg border-nesty-error'
              }`}
            >
              {scanResult.valid ? (
                <CheckCircle2 className="w-11 h-11 text-nesty-success mx-auto" />
              ) : (
                <AlertCircle className="w-11 h-11 text-nesty-error mx-auto" />
              )}
              <h3
                className={`mt-2.5 text-base font-extrabold ${
                  scanResult.valid ? 'text-nesty-success' : 'text-nesty-error'
                }`}
              >
                {scanResult.title}
              </h3>
              <p className="mt-1.5 text-xs text-nesty-textPrimary">{scanResult.subtitle}</p>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={onClearResult}
                  data-testid="scan_another_qr_button"
                  className="flex-1 py-2.5 px-3 rounded-xl border border-nesty-gold bg-nesty-creamSurface text-nesty-burgundy font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-nesty-creamElevated"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Scan Again
                </button>
                {scanResult.order && (
                  <button
                    onClick={() => {
                      const ord = scanResult.order!;
                      onClose();
                      onOpenOrderDetails(ord);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-bold text-xs hover:bg-nesty-burgundyDark"
                  >
                    View Order
                  </button>
                )}
              </div>
            </div>
          ) : !isManualMode ? (
            <div>
              {cameraError ? (
                <div
                  data-testid="qr_camera_error_card"
                  className="rounded-2xl p-4 bg-nesty-errorBg border border-nesty-error/60 text-center"
                >
                  <Camera className="w-9 h-9 text-nesty-burgundy mx-auto" />
                  <h3 className="mt-2 text-sm font-extrabold text-nesty-burgundy">
                    Camera Feed Unavailable
                  </h3>
                  <p className="mt-1 text-xs text-nesty-textSecondary">{cameraError}</p>
                  <div className="mt-3.5 flex gap-2">
                    <button
                      onClick={() => setRetryCount((c) => c + 1)}
                      data-testid="retry_camera_button"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-bold text-xs flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                    </button>
                    <button
                      onClick={() => setIsManualMode(true)}
                      data-testid="switch_to_manual_entry_button"
                      className="flex-1 py-2.5 px-3 rounded-xl border border-nesty-gold bg-nesty-creamSurface text-nesty-burgundy font-bold text-xs"
                    >
                      Manual Entry
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  data-testid="qr_camera_preview_box"
                  className="relative h-56 w-full rounded-2xl bg-black border-2 border-nesty-gold overflow-hidden flex items-center justify-center"
                >
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute w-40 h-40 border-4 border-nesty-gold rounded-2xl pointer-events-none" />
                  {isCameraLoading && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                      <div className="w-7 h-7 border-2 border-nesty-gold border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold text-nesty-cream">Starting Camera...</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3">
                <div className="text-[11px] font-bold text-nesty-textSecondary mb-1.5">
                  Quick Scan Presets (Test Camera QR Payloads):
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => onScanSubmitted('NST-8492')}
                    data-testid="scan_preset_order_button"
                    className="py-2 px-2 rounded-lg border border-nesty-gold bg-nesty-cream text-nesty-burgundy font-bold text-[11px] hover:bg-nesty-goldLight"
                  >
                    Sample Order
                  </button>
                  <button
                    onClick={() => onScanSubmitted('COUPON:NESTY20')}
                    data-testid="scan_preset_coupon_button"
                    className="py-2 px-2 rounded-lg border border-nesty-gold bg-nesty-cream text-nesty-burgundy font-bold text-[11px] hover:bg-nesty-goldLight"
                  >
                    NESTY20
                  </button>
                  <button
                    onClick={() => onScanSubmitted('RANDOM_UNSUPPORTED_QR_999')}
                    data-testid="scan_preset_invalid_button"
                    className="py-2 px-2 rounded-lg border border-nesty-error/50 bg-nesty-errorBg text-nesty-error font-bold text-[11px]"
                  >
                    Invalid QR
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div data-testid="qr_manual_entry_section" className="space-y-3">
              <label className="block text-xs font-bold text-nesty-textPrimary">
                Enter QR Code, Order ID, or Promo Code:
              </label>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. NST-8492, NESTY-COUNTER-CB, or NESTY20"
                data-testid="qr_manual_code_input"
                className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-gold text-sm focus:outline-none focus:border-nesty-burgundy"
              />
              <button
                onClick={() => onScanSubmitted(manualInput)}
                data-testid="qr_manual_validate_button"
                className="w-full py-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-sm hover:bg-nesty-burgundyDark transition"
              >
                Validate Code
              </button>
            </div>
          )}
        </div>

        <hr className="border-nesty-creamBorder my-3.5" />

        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setIsManualMode(!isManualMode);
              onClearResult();
            }}
            data-testid="toggle_scanner_mode_button"
            className="py-2 px-3.5 rounded-xl border border-nesty-gold bg-nesty-cream text-nesty-burgundy font-bold text-xs flex items-center gap-1.5 hover:bg-nesty-creamElevated"
          >
            {isManualMode ? (
              <>
                <Camera className="w-4 h-4" /> Switch to Camera
              </>
            ) : (
              <>
                <Keyboard className="w-4 h-4" /> Enter Code Manually
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-nesty-creamElevated text-nesty-textPrimary font-bold text-xs hover:bg-nesty-creamBorder"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
