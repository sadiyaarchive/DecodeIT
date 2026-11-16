// The design the feedback is about. It is a required input: feedback cannot be interpreted well
// without seeing what it refers to. It comes either from a frame selected in Figma or from a
// screenshot. This module describes it and checks screenshots; it never looks inside the image.

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MIN_IMAGE_SIDE = 32;

export interface DesignInput {
  kind: 'figma-frame' | 'screenshot';
  /** The frame's name in Figma, or the screenshot's file name. */
  name: string;
  /** Size of the design: the frame's size in Figma, or the image's size in pixels. */
  width: number;
  height: number;
  /** The image a future multimodal provider would look at. The demo never reads it. */
  image: Blob;
}

export type FileCheck = { ok: true } | { ok: false; reason: string };

const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Checks that need only the file's declared type and size, not its contents. */
export function checkImageMeta(file: { name: string; type: string; size: number }): FileCheck {
  if (/\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type)) {
    return { ok: false, reason: "HEIC images can't be read here. Export the design as a PNG or JPG." };
  }
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "That file isn't supported. Use a PNG, JPG or WebP image." };
  }
  if (file.size === 0) return { ok: false, reason: 'That file is empty.' };
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: `That image is ${formatMb(file.size)}. The limit is ${formatMb(MAX_IMAGE_BYTES)}.` };
  }
  return { ok: true };
}

export type LoadedImage = { ok: true; width: number; height: number; url: string } | { ok: false; reason: string };

/** Full check of a screenshot: declared type and size, then whether the browser can actually decode it. */
export async function loadScreenshot(file: File): Promise<LoadedImage> {
  const meta = checkImageMeta(file);
  if (!meta.ok) return meta;
  const url = URL.createObjectURL(file);
  try {
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
    if (Math.min(width, height) < MIN_IMAGE_SIDE) {
      URL.revokeObjectURL(url);
      return { ok: false, reason: `That image is too small to show a design. Each side needs at least ${MIN_IMAGE_SIDE} px.` };
    }
    return { ok: true, width, height, url };
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, reason: "That image couldn't be read. Try exporting it again." };
  }
}

/** One line for facts and summaries, e.g. `Figma frame "Home", 390 × 844`. */
export function describeDesign(d: Pick<DesignInput, 'kind' | 'name' | 'width' | 'height'>): string {
  const what = d.kind === 'figma-frame' ? 'Figma frame' : 'Screenshot';
  return `${what} "${d.name}", ${Math.round(d.width)} × ${Math.round(d.height)}`;
}
