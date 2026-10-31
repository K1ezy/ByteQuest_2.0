// Client-side avatar processing: center-crop to a square, downscale, and
// re-encode so any photo the user picks becomes a small square image that fits
// comfortably under the server's 1 MB avatar limit. No dependencies — just a
// canvas. Returns a Blob ready to upload.

export interface CropCompressOptions {
  /** Output edge length in pixels (square). */
  size?: number;
  /** Preferred output type; falls back to JPEG when WebP is unsupported. */
  type?: "image/webp" | "image/jpeg";
  quality?: number;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read. Try a PNG, JPEG or WebP file."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function cropCompressImage(file: Blob, options: CropCompressOptions = {}): Promise<Blob> {
  const size = options.size ?? 256;
  const quality = options.quality ?? 0.85;
  const img = await loadImage(file);

  const edge = Math.min(img.naturalWidth, img.naturalHeight);
  if (!edge) throw new Error("That image appears to be empty.");
  const sx = (img.naturalWidth - edge) / 2;
  const sy = (img.naturalHeight - edge) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, edge, edge, 0, 0, size, size);

  const preferred = options.type ?? "image/webp";
  let blob = await canvasToBlob(canvas, preferred, quality);
  // Some browsers silently fall back to PNG when WebP is unsupported; force JPEG then.
  if (!blob || (preferred === "image/webp" && blob.type !== "image/webp")) {
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }
  if (!blob) throw new Error("The image could not be processed.");
  return blob;
}
