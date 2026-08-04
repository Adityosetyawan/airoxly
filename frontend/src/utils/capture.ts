import { Platform, Linking } from "react-native";
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
 * Simplified WhatsApp receipt flow used when a transaction has a Kartu Undian.
 *
 * The receipt text now already contains the lottery ticket numbers, so we do
 * NOT need to force the image into the same WA message. Instead we:
 *
 *   1. Capture the Kartu Undian PNG and save it to the device gallery (silent).
 *   2. Open wa.me/<PHONE>?text=<receipt> directly to the customer's saved
 *      number — Sales only needs to press Send.
 *
 * The saved image sits in the gallery. If Sales wants to ALSO send the visual
 * ticket card, they can tap the separate "Kirim Kartu Undian" button which
 * opens the native share sheet on just the image.
 *
 * On web, MediaLibrary is unavailable; we trigger a browser download so the
 * PNG lands in the user's Downloads folder, then open wa.me.
 */
export async function sendReceiptToWhatsApp(
  shotRef: ShotRef,
  nativeId: string,
  filename: string,
  phone: string,
  receiptText: string,
): Promise<{ savedToGallery: boolean }> {
  const digits = (phone || "").replace(/[^\d]/g, "");
  if (!digits) throw new Error("Nomor WA pelanggan kosong");
  const n = digits.startsWith("0")
    ? "62" + digits.slice(1)
    : digits.startsWith("62")
    ? digits
    : digits;

  let savedToGallery = false;

  if (Platform.OS === "web") {
    try {
      const dataUrl = await captureImage(shotRef, nativeId, filename);
      webDownload(dataUrl, filename);
      savedToGallery = true;
    } catch {}
  } else {
    try {
      let perm = await MediaLibrary.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) {
        perm = await MediaLibrary.requestPermissionsAsync();
      }
      const uri = await captureRef(shotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        fileName: filename,
      });
      if (perm.granted) {
        try {
          await MediaLibrary.saveToLibraryAsync(uri);
          savedToGallery = true;
        } catch {}
      }
    } catch {}
  }

  // Open WhatsApp deep-link directly to customer's number with pre-filled text
  const encoded = encodeURIComponent(receiptText);
  const url = `https://wa.me/${n}?text=${encoded}`;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.open(url, "_blank");
    return { savedToGallery };
  }

  const supported = await Linking.canOpenURL(url);
  if (!supported) throw new Error("Tidak bisa membuka WhatsApp");
  await Linking.openURL(url);
  return { savedToGallery };
}
