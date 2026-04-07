import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const DEFAULT_OPTIONS = {
  maxDimension: 1920,
  quality: 85,
  convertPngToJpeg: true,
  pngConvertThreshold: 500 * 1024, // 500 KB
};

/** High-fidelity preset for card images and student annotations */
export const CARD_IMAGE_OPTIONS = {
  maxDimension: 3840,
  quality: 95,
  convertPngToJpeg: false,
  pngConvertThreshold: Infinity,
};

export async function processImageFile(
  filePath: string,
  options: Partial<typeof DEFAULT_OPTIONS> = {},
): Promise<{ outputPath: string; sizeBytes: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
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

  const needsResize = longSide > opts.maxDimension;
  const needsPngConvert = opts.convertPngToJpeg && isPng && size > opts.pngConvertThreshold;

  if (!needsResize && !needsPngConvert) {
    return { outputPath: filePath, sizeBytes: size };
  }

  // Output format: PNG over threshold → JPEG; everything else keeps its format
  const outputExt = needsPngConvert ? '.jpg' : ext;
  const outputPath =
    outputExt !== ext ? filePath.slice(0, -ext.length) + outputExt : filePath;

  let pipeline = sharp(filePath);

  if (needsResize) {
    pipeline = pipeline.resize({
      width: opts.maxDimension,
      height: opts.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (outputExt === '.webp') {
    pipeline = pipeline.webp({ quality: opts.quality });
  } else if (outputExt === '.png') {
    pipeline = pipeline.png({ quality: opts.quality });
  } else {
    pipeline = pipeline.jpeg({ quality: opts.quality });
  }

  const buf = await pipeline.toBuffer();
  await fs.writeFile(outputPath, buf);

  if (outputPath !== filePath) {
    await fs.unlink(filePath).catch(() => {});
  }

  return { outputPath, sizeBytes: buf.byteLength };
}
