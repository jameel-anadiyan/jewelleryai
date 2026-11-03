import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { StudioJob, Variation } from '../types';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCardFilename(sku: string, index: number, name: string): string {
  const cleanSku = (sku || 'SWA').replace(/[^\w-]/g, '');
  const nn = String(index).padStart(2, '0');
  const slug = slugify(name) || 'design';
  return `${cleanSku}_${nn}_${slug}.png`;
}

// Convert base64 data to Blob
export function base64ToBlob(base64Data: string, contentType = 'image/png'): Blob {
  // Strip data URL header if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export function downloadSinglePng(variation: Variation, sku: string): void {
  if (!variation.imageBase64) return;
  const filename = getCardFilename(sku, variation.index, variation.name);
  const blob = base64ToBlob(variation.imageBase64);
  saveAs(blob, filename);
}

export async function downloadZip(job: StudioJob, onlyStarred = false): Promise<number> {
  const zip = new JSZip();
  const variationsToInclude = onlyStarred
    ? job.variations.filter((v) => v.isStarred && v.imageBase64)
    : job.variations.filter((v) => v.imageBase64);

  if (variationsToInclude.length === 0) {
    return 0;
  }

  // 1. Add images
  for (const v of variationsToInclude) {
    if (v.imageBase64) {
      const filename = getCardFilename(job.sku, v.index, v.name);
      const cleanB64 = v.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      zip.file(filename, cleanB64, { base64: true });
    }
  }

  // 2. Generate CSV
  const csvHeaders = ['number', 'name', 'description', 'motif_treatment', 'stone_count', 'stone_layout', 'setting', 'size_mm', 'gold_vs_original', 'starred'];
  const csvRows = variationsToInclude.map((v) => {
    return [
      v.index,
      `"${v.name.replace(/"/g, '""')}"`,
      `"${v.description.replace(/"/g, '""')}"`,
      `"${(v.motifTreatment || '').replace(/"/g, '""')}"`,
      v.stoneCount,
      `"${v.stoneLayout.replace(/"/g, '""')}"`,
      `"${v.setting.replace(/"/g, '""')}"`,
      `"${v.sizeMm.replace(/"/g, '""')}"`,
      `"${v.goldVsOriginal.replace(/"/g, '""')}"`,
      v.isStarred ? 'true' : 'false',
    ].join(',');
  });
  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
  zip.file('variations.csv', csvContent);

  // 3. Generate JSON
  const jsonContent = JSON.stringify(
    {
      sku: job.sku,
      diamondCount: job.diamondCount,
      countFor: job.countFor,
      original: job.original,
      variations: variationsToInclude.map(({ imageBase64, ...rest }) => rest),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
  zip.file('variations.json', jsonContent);

  // 4. Generate and download zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const skuTag = (job.sku || 'SWA').replace(/[^\w-]/g, '');
  const zipName = onlyStarred
    ? `${skuTag}_starred_variations.zip`
    : `${skuTag}_all_variations.zip`;
  saveAs(blob, zipName);

  return variationsToInclude.length;
}
