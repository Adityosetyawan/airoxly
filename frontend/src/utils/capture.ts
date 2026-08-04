import { Platform } from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";

type ShotRef = React.RefObject<ViewShot | null>;

/**
 * Capture the wrapped view as a PNG. Returns a file URI on native, or a base64
 * data URL on web.
 */
async function captureImage(
  shotRef: ShotRef,
  nativeId: string,
  filename: string,
): Promise<string> {
  if (Platform.OS === "web") {
    if (typeof document === "undefined") throw new Error("DOM unavailable");
    const el = document.getElementById(nativeId) as HTMLElement | null;
    if (!el) throw new Error("Konten belum siap");
    // Dynamic import so it isn't bundled on native
    const htmlToImage = await import("html-to-image");
    return await htmlToImage.toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });
  }
  if (!shotRef.current) throw new Error("View belum siap");
  return await captureRef(shotRef, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    fileName: filename,
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function webDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function webShare(dataUrl: string, filename: string, title: string): Promise<boolean> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], filename.endsWith(".png") ? filename : `${filename}.png`, {
      type: "image/png",
    });
    // @ts-ignore - navigator.canShare/share may not exist on all browsers
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // @ts-ignore
      await navigator.share({ files: [file], title });
      return true;
    }
  } catch {
    // fall through to download
  }
  return false;
}

/**
 * Save the wrapped view as PNG:
 * - Native: saves to device photo gallery via MediaLibrary
 * - Web: triggers a browser download
 */
export async function saveShot(
  shotRef: ShotRef,
  nativeId: string,
  filename: string,
): Promise<void> {
  if (Platform.OS === "web") {
    const dataUrl = await captureImage(shotRef, nativeId, filename);
    webDownload(dataUrl, filename);
    return;
  }
  let perm = await MediaLibrary.getPermissionsAsync();
  if (!perm.granted) {
    if (!perm.canAskAgain) throw new Error("Izin galeri ditolak. Buka Settings untuk aktifkan.");
    perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) throw new Error("Izin galeri diperlukan untuk menyimpan gambar");
  }
  const uri = await captureImage(shotRef, nativeId, filename);
  await MediaLibrary.saveToLibraryAsync(uri);
}

/**
 * Share the wrapped view as PNG:
 * - Native: opens native share sheet via expo-sharing
 * - Web: tries navigator.share (falls back to download)
 */
export async function shareShot(
  shotRef: ShotRef,
  nativeId: string,
  filename: string,
  title: string,
): Promise<void> {
  const uriOrData = await captureImage(shotRef, nativeId, filename);
  if (Platform.OS === "web") {
    const shared = await webShare(uriOrData, filename, title);
    if (!shared) webDownload(uriOrData, filename);
    return;
  }
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error("Fitur share tidak tersedia di device ini");
  await Sharing.shareAsync(uriOrData, { mimeType: "image/png", dialogTitle: title });
}

/**
 * Share both an image (captured PNG of the wrapped view) AND a text message together.
 *
 * - Web with navigator.share supporting files+text: single OS share sheet with both.
 * - Web fallback: download PNG + copy text to clipboard + open WhatsApp deep-link.
 * - Native: copy text to clipboard, open native share sheet with the PNG. User pastes the
 *   text as WhatsApp caption. Returns a hint flag so caller can show a toast.
 *
 * Returns:
 *   { mode: "combined" }  → image and text delivered together (best case)
 *   { mode: "image+clipboard" } → image shared, text copied to clipboard
 */
export async function shareShotWithText(
  shotRef: ShotRef,
  nativeId: string,
  filename: string,
  title: string,
  text: string,
): Promise<{ mode: "combined" | "image+clipboard" }> {
  const uriOrData = await captureImage(shotRef, nativeId, filename);
  if (Platform.OS === "web") {
    try {
      const blob = dataUrlToBlob(uriOrData);
      const file = new File([blob], filename.endsWith(".png") ? filename : `${filename}.png`, {
        type: "image/png",
      });
      // @ts-ignore
      if (navigator.canShare && navigator.canShare({ files: [file], text })) {
        // @ts-ignore
        await navigator.share({ files: [file], text, title });
        return { mode: "combined" };
      }
    } catch {
      // fall through
    }
    // Fallback: download + clipboard + open wa.me
    webDownload(uriOrData, filename);
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(text);
    } catch {
      try {
        if (typeof navigator !== "undefined" && (navigator as any).clipboard) {
          await (navigator as any).clipboard.writeText(text);
        }
      } catch {}
    }
    return { mode: "image+clipboard" };
  }
  // Native: copy text to clipboard, then open share sheet with the file
  const Clipboard = await import("expo-clipboard");
  await Clipboard.setStringAsync(text);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error("Fitur share tidak tersedia di device ini");
  await Sharing.shareAsync(uriOrData, { mimeType: "image/png", dialogTitle: title });
  return { mode: "image+clipboard" };
}
