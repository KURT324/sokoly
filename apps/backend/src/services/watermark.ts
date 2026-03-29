import sharp from 'sharp';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fs from 'fs/promises';

function buildWatermarkText(fullName: string, watermarkId: string): string {
  const now = new Date();
  const date = now.toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return `${fullName} | ${watermarkId} | ${date}`;
}

export async function applyImageWatermark(
  filePath: string,
  fullName: string,
  watermarkId: string
): Promise<Buffer> {
  const text = buildWatermarkText(fullName, watermarkId);
  const image = sharp(filePath);
  const meta = await image.metadata();
  const width = meta.width ?? 800;
  const height = meta.height ?? 600;

  // Build SVG overlay with repeated diagonal text
  const fontSize = Math.max(14, Math.round(width / 40));
  const lines: string[] = [];
  const step = fontSize * 5;

  for (let y = -height; y < height * 2; y += step) {
    for (let x = -width; x < width * 2; x += step * 3) {
      lines.push(
        `<text x="${x}" y="${y}" fill="rgba(180,0,0,0.30)" font-size="${fontSize}" ` +
        `font-family="sans-serif" transform="rotate(-35,${x},${y})">${text}</text>`
      );
    }
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${lines.join('\n')}
  </svg>`;

  return image
    .composite([{ input: Buffer.from(svg), gravity: 'northwest' }])
    .toBuffer();
}

export async function applyPdfWatermark(
  filePath: string,
  fullName: string,
  watermarkId: string
): Promise<Buffer> {
  const text = buildWatermarkText(fullName, watermarkId);
  const existingBytes = await fs.readFile(filePath);
  const pdfDoc = await PDFDocument.load(existingBytes);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = 11;
    const step = 80;

    for (let y = 0; y < height + step; y += step) {
      for (let x = -width / 2; x < width + step; x += step * 4) {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          color: rgb(0.7, 0, 0),
          opacity: 0.3,
          rotate: degrees(-35),
        });
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
