import { parseDimensions } from './dimensionCalculator';

export interface StampDimensionOptions {
  masterMm?: string;
  masterHeight?: number | string;
  masterWidth?: number | string;
  actualHeight?: number | string;
  actualWidth?: number | string;
  actualText?: string;
  // Backward compatibility aliases
  height?: number | string;
  width?: number | string;
  sizeMm?: string;
}

/**
 * Resolves formatted Master and Actual dimension strings.
 */
export function resolveStampText(options?: StampDimensionOptions | string): {
  masterText: string;
  actualText: string;
} | null {
  if (!options) return null;

  if (typeof options === 'string') {
    options = { masterMm: options };
  }

  const mH = options.masterHeight ?? options.height;
  const mW = options.masterWidth ?? options.width;
  const { height: parsedMH, width: parsedMW } = parseDimensions(options.masterMm, mH, mW);

  let masterText = '';
  if (parsedMH && parsedMW) {
    masterText = `${parsedMH} × ${parsedMW} mm`;
  } else if (parsedMH) {
    masterText = `${parsedMH} mm`;
  } else if (options.masterMm && options.masterMm.trim()) {
    masterText = options.masterMm.trim();
  }

  let actualText = options.actualText || '';
  if (!actualText && options.actualHeight && options.actualWidth) {
    actualText = `${options.actualHeight} × ${options.actualWidth} mm`;
  } else if (!actualText && options.actualHeight) {
    actualText = `${options.actualHeight} mm`;
  } else if (!actualText && options.sizeMm) {
    const { height: sH, width: sW } = parseDimensions(options.sizeMm);
    if (sH && sW) {
      actualText = `${sH} × ${sW} mm`;
    } else {
      actualText = options.sizeMm.trim();
    }
  }

  // If both are identical and only one was specified, show that one
  if (!masterText && !actualText) {
    return null;
  }

  return {
    masterText,
    actualText,
  };
}

/**
 * Stamps the Master MM (reference provided by user) and Actual Size (calculated from generated design)
 * directly onto the jewellery sketch image canvas in a bold, prominent luxury badge.
 *
 * Prompt integrity: AI generation prompt is NEVER modified with dimension text.
 */
export async function stampMasterMmOnImage(
  imageBase64: string,
  options?: StampDimensionOptions | string
): Promise<string> {
  const resolved = resolveStampText(options);
  if (!resolved) {
    return imageBase64;
  }

  const { masterText, actualText } = resolved;
  const hasBoth = Boolean(masterText && actualText && masterText !== actualText);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 1024;
        canvas.height = img.height || 1024;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(imageBase64);
          return;
        }

        // Draw original generated jewellery sketch
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Prominent "Little Big" typography scaled to image canvas
        const fontSize = hasBoth
          ? Math.max(24, Math.round(canvas.width * 0.028)) // ~29px on 1024x1024 for two-line layout
          : Math.max(28, Math.round(canvas.width * 0.035)); // ~36px for single line

        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

        const lineHeight = Math.round(fontSize * 1.35);
        const padX = Math.round(fontSize * 0.85);
        const padY = Math.round(fontSize * 0.55);

        let badgeWidth = 0;
        let badgeHeight = 0;

        if (hasBoth) {
          const l1LabelW = ctx.measureText('MASTER: ').width;
          const l1ValW = ctx.measureText(masterText).width;
          const l2LabelW = ctx.measureText('ACTUAL: ').width;
          const l2ValW = ctx.measureText(actualText).width;

          const maxLineW = Math.max(l1LabelW + l1ValW, l2LabelW + l2ValW);
          badgeWidth = maxLineW + padX * 2;
          badgeHeight = fontSize + lineHeight + padY * 2;
        } else {
          const singleText = masterText ? `MASTER: ${masterText}` : `ACTUAL: ${actualText}`;
          const textW = ctx.measureText(singleText).width;
          badgeWidth = textW + padX * 2;
          badgeHeight = fontSize + padY * 2;
        }

        // Position: Bottom-Left with luxury margin
        const margin = Math.round(canvas.width * 0.038);
        const x = margin;
        const y = canvas.height - margin - badgeHeight;
        const radius = 14;

        ctx.save();

        // Dark luxury obsidian pill background with soft drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.70)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = 'rgba(10, 11, 16, 0.92)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, badgeWidth, badgeHeight, radius);
        } else {
          ctx.rect(x, y, badgeWidth, badgeHeight);
        }
        ctx.fill();

        // Golden metallic border
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.92)';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.textBaseline = 'middle';

        if (hasBoth) {
          // Row 1: MASTER: [masterText]
          const row1Y = y + padY + fontSize * 0.5;
          let curX1 = x + padX;

          ctx.fillStyle = '#F5D061'; // Gold
          ctx.fillText('MASTER: ', curX1, row1Y);
          curX1 += ctx.measureText('MASTER: ').width;

          ctx.fillStyle = '#FFFFFF'; // White
          ctx.fillText(masterText, curX1, row1Y);

          // Row 2: ACTUAL: [actualText]
          const row2Y = row1Y + lineHeight;
          let curX2 = x + padX;

          ctx.fillStyle = '#F5D061'; // Gold
          ctx.fillText('ACTUAL: ', curX2, row2Y);
          curX2 += ctx.measureText('ACTUAL: ').width;

          ctx.fillStyle = '#FFFFFF'; // White
          ctx.fillText(actualText, curX2, row2Y);
        } else {
          // Single row
          const singleY = y + badgeHeight / 2 + 1;
          let curX = x + padX;

          const label = masterText ? 'MASTER: ' : 'ACTUAL: ';
          const val = masterText || actualText;

          ctx.fillStyle = '#F5D061';
          ctx.fillText(label, curX, singleY);
          curX += ctx.measureText(label).width;

          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(val, curX, singleY);
        }

        ctx.restore();

        // Export as base64 PNG string
        const dataUrl = canvas.toDataURL('image/png');
        const cleanB64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        resolve(cleanB64);
      } catch (err) {
        console.warn('Failed to stamp dimensions on image:', err);
        resolve(imageBase64);
      }
    };

    img.onerror = () => {
      resolve(imageBase64);
    };

    const cleanInput = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    img.src = `data:image/png;base64,${cleanInput}`;
  });
}
