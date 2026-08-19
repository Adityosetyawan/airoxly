/**
 * Photo compression helper.
 *
 * Standardises every captured / imported photo to keep DB + backup size small:
 *   - Max width 1024px (preserves aspect ratio)
 *   - JPEG quality 0.5
 *
 * Web fallback: Uses <canvas> to resize/re-encode.
 * Native fallback: Uses expo-image-manipulator (fast, GPU-accelerated).
 */
import { Platform } from "react-native";

export const PHOTO_MAX_WIDTH = 1024;
export const PHOTO_JPEG_QUALITY = 0.5;

async function _compressWeb(dataUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(1, PHOTO_MAX_WIDTH / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUri);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Gagal decode gambar"));
    img.src = dataUri;
  });
}

async function _compressNative(dataUri: string): Promise<string> {
  const ImageManipulator = await import("expo-image-manipulator");
  const result = await ImageManipulator.manipulateAsync(
    dataUri,
    [{ resize: { width: PHOTO_MAX_WIDTH } }],
    {
      compress: PHOTO_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (result.base64) return `data:image/jpeg;base64,${result.base64}`;
  return result.uri || dataUri;
}

/**
 * Compress a photo to <= 1024px width + JPEG q=0.5. Returns the same value
 * on error so the UI never blocks on compression failure.
 */
export async function compressPhoto(dataUri: string | null | undefined): Promise<string | null> {
  if (!dataUri) return null;
  try {
    if (Platform.OS === "web") return await _compressWeb(dataUri);
    return await _compressNative(dataUri);
  } catch {
    // Fail-open: keep the original photo rather than lose the capture.
    return dataUri;
  }
}

/** Approximate byte size of a base64 payload. */
export function approxDataUriBytes(dataUri: string | null | undefined): number {
  if (!dataUri) return 0;
  const idx = dataUri.indexOf(",");
  const b64 = idx >= 0 ? dataUri.slice(idx + 1) : dataUri;
  // Every 4 base64 chars ≈ 3 bytes
  const padding = (b64.match(/=+$/) || [""])[0].length;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}
