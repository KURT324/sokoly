import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_DIMENSION = 1920;
const QUALITY = 85;
const PNG_CONVERT_THRESHOLD = 500 * 1024; // 500 KB

/**
 * Compress/resize an image file in-place if needed.
 *
 * Rules:
 * - If neither side exceeds 1920px AND size ≤ 500 KB (for PNG) → skip entirely
 * - If PNG > 500 KB → convert to JPEG at quality 85 (smaller file, same visual quality)
 * - If longest side > 1920px → resize proportionally, keep original format at quality 85
 *
 * Returns the final absolute path (may differ from input if PNG→JPEG)
 * and the resulting file size in bytes.
 * Non-image files are returned unchanged.
 */
export async function processImageFile(
  filePath: string,
): Promise<{ outputPath: string; sizeBytes: number }> {
  const ext = path.extname(filePath).toLowerCase();

  if (!IMAGE_EXTS.has(ext)) {
    const stat = await fs.stat(filePath);
    return { outputPath: filePath, sizeBytes: stat.size };
  }

  const [meta, stat] = await Promise.all([
    sharp(filePath).metadata(),
    fs.stat(filePath),
  ]);

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const longSide = Math.max(w, h);
  const size = stat.size;
  const isPng = ext === '.png';

  const needsResize = longSide > MAX_DIMENSION;
  const needsPngConvert = isPng && size > PNG_CONVERT_THRESHOLD;

  if (!needsResize && !needsPngConvert) {
    return { outputPath: filePath, sizeBytes: size };
  }

  // Output format: PNG > 500 KB → JPEG; everything else keeps its format
  const outputExt = needsPngConvert ? '.jpg' : ext;
  const outputPath =
    outputExt !== ext ? filePath.slice(0, -ext.length) + outputExt : filePath;

  let pipeline = sharp(filePath);

  if (needsResize) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (outputExt === '.webp') {
    pipeline = pipeline.webp({ quality: QUALITY });
  } else if (outputExt === '.png') {
    pipeline = pipeline.png({ quality: QUALITY });
  } else {
    // .jpg / .jpeg, and PNG→JPEG conversions
    pipeline = pipeline.jpeg({ quality: QUALITY });
  }

  const buf = await pipeline.toBuffer();
  await fs.writeFile(outputPath, buf);

  if (outputPath !== filePath) {
    await fs.unlink(filePath).catch(() => {});
  }

  return { outputPath, sizeBytes: buf.byteLength };
}
