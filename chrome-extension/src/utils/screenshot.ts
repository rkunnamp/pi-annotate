import type { Screenshot } from "../types";

/**
 * Capture the visible viewport via background script
 */
export async function captureViewport(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response.dataUrl);
        } else {
          reject(new Error(response?.error || "Screenshot failed"));
        }
      }
    );
  });
}

/**
 * Crop a screenshot to a specific region
 * @param dataUrl - Base64 PNG data URL
 * @param rect - Crop rectangle (in CSS pixels, relative to viewport)
 * @param devicePixelRatio - Window.devicePixelRatio for HiDPI displays
 */
export async function cropScreenshot(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  devicePixelRatio: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Scale coordinates for HiDPI
      const scale = devicePixelRatio;
      const sx = Math.round(rect.x * scale);
      const sy = Math.round(rect.y * scale);
      const sw = Math.round(rect.width * scale);
      const sh = Math.round(rect.height * scale);

      // Clamp to image bounds
      const clampedSx = Math.max(0, Math.min(sx, img.width - 1));
      const clampedSy = Math.max(0, Math.min(sy, img.height - 1));
      const clampedSw = Math.min(sw, img.width - clampedSx);
      const clampedSh = Math.min(sh, img.height - clampedSy);

      if (clampedSw <= 0 || clampedSh <= 0) {
        reject(new Error("Invalid crop region"));
        return;
      }

      // Output at original CSS pixel size (not scaled)
      canvas.width = rect.width;
      canvas.height = rect.height;

      ctx.drawImage(
        img,
        clampedSx, clampedSy, clampedSw, clampedSh,  // Source
        0, 0, rect.width, rect.height                  // Destination
      );

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load screenshot for cropping"));
    img.src = dataUrl;
  });
}

/**
 * Create a Screenshot object from a data URL
 */
export async function createScreenshot(
  dataUrl: string,
  type: Screenshot["type"]
): Promise<Screenshot> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        dataUrl,
        width: img.width,
        height: img.height,
        type,
        timestamp: Date.now(),
      });
    };
    img.onerror = () => reject(new Error("Failed to load screenshot"));
    img.src = dataUrl;
  });
}

/**
 * Capture a specific element by its bounding box
 */
export async function captureElement(
  boundingBox: { x: number; y: number; width: number; height: number }
): Promise<Screenshot> {
  const fullCapture = await captureViewport();
  const croppedUrl = await cropScreenshot(
    fullCapture,
    boundingBox,
    window.devicePixelRatio
  );
  return createScreenshot(croppedUrl, "element");
}

/**
 * Capture an area selected by the user
 */
export async function captureArea(
  rect: { x: number; y: number; width: number; height: number }
): Promise<Screenshot> {
  const fullCapture = await captureViewport();
  const croppedUrl = await cropScreenshot(
    fullCapture,
    rect,
    window.devicePixelRatio
  );
  return createScreenshot(croppedUrl, "area");
}

/**
 * Capture the full visible viewport
 */
export async function captureFullViewport(): Promise<Screenshot> {
  const dataUrl = await captureViewport();
  return createScreenshot(dataUrl, "viewport");
}
