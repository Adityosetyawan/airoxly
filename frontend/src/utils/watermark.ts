/**
 * addWatermark — overlay timestamp text on a data-URI image (client-side canvas).
 * Works on RN Web (uses browser canvas). Returns new data URI with watermark burned in.
 * Falls back gracefully by returning the original data URI when canvas isn't available.
 */
export async function addWatermarkTimestamp(
  dataUri: string,
  extra?: string,
): Promise<string> {
  if (typeof document === "undefined") return dataUri;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded: HTMLImageElement = await new Promise((res, rej) => {
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = dataUri;
    });
    const w = loaded.naturalWidth || 800;
    const h = loaded.naturalHeight || 600;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUri;
    ctx.drawImage(loaded, 0, 0, w, h);
    // Timestamp text
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const label = extra ? `${extra} · ${ts}` : ts;
    // Font sized to image height for consistency
    const fontSize = Math.max(18, Math.floor(h * 0.038));
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, Roboto, sans-serif`;
    const padX = Math.floor(fontSize * 0.6);
    const padY = Math.floor(fontSize * 0.4);
    const metrics = ctx.measureText(label);
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize + padY * 2;
    // Bottom-right, semi-transparent black background
    const x = w - boxW - 12;
    const y = h - boxH - 12;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    ctx.fillText(label, x + padX, y + padY);
    // Export as JPEG (smaller payload than PNG)
    return canvas.toDataURL("image/jpeg", 0.75);
  } catch (e) {
    // Fail-safe: return original
    return dataUri;
  }
}
