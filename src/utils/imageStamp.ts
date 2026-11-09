export interface StampDimensionOptions {
  height?: number | string;
  width?: number | string;
  masterMm?: string;
  sizeMm?: string;
}

/**
 * Resolves height and width into clean formatted specification text.
 */
export function resolveDimensionText(params?: StampDimensionOptions | string): {
  heightText: string;
  widthText: string;
  combinedText: string;
} | null {
  if (!params) return null;

  if (typeof params === 'string') {
    params = { masterMm: params };
  }

  let h = params.height !== undefined && params.height !== '' ? String(params.height).trim() : '';
  let w = params.width !== undefined && params.width !== '' ? String(params.width).trim() : '';

  // If not passed directly as separate fields, parse from masterMm
  if ((!h || !w) && params.masterMm) {
    const raw = params.masterMm.trim();
    // Matches: 4.9 x 2.6 or 4.9 * 2.6 or 4.9 , 2.6 or H: 4.9 W: 2.6
    const match = raw.match(/([\d.]+)\s*(?:[x×*,|]|by)\s*([\d.]+)/i);
    if (match) {
      h = h || match[1];
      w = w || match[2];
    } else {
      const singleMatch = raw.match(/([\d.]+)/);
      if (singleMatch) {
        h = h || singleMatch[1];
      }
    }
  }

  // Fallback to variation sizeMm (e.g. "4.9 x 2.6" or "16 x 6")
  if ((!h || !w) && params.sizeMm) {
    const match = params.sizeMm.match(/([\d.]+)\s*[x×*]\s*([\d.]+)/i);
    if (match) {
      h = h || match[1];
      w = w || match[2];
    }
  }

  if (!h && !w && params.masterMm) {
    return {
      heightText: '',
      widthText: '',
      combinedText: params.masterMm.trim(),
    };
  }

  if (h && w) {
    const cleanH = h.replace(/mm/gi, '').trim();
    const cleanW = w.replace(/mm/gi, '').trim();
    return {
      heightText: `${cleanH} mm`,
      widthText: `${cleanW} mm`,
      combinedText: `H: ${cleanH} mm   ×   W: ${cleanW} mm`,
    };
  }

  if (h) {
    const cleanH = h.replace(/mm/gi, '').trim();
    return {
      heightText: `${cleanH} mm`,
      widthText: '',
      combinedText: `H: ${cleanH} mm`,
    };
  }

  return null;
}

/**
 * Draws the actual design head width and height directly onto the jewellery sketch image.
 * Uses a bold, prominent "little big" luxury specification badge in the bottom area.
 * Bakes the dimensions into the picture canvas without modifying AI prompts.
 */
export async function stampMasterMmOnImage(
  imageBase64: string,
  options?: StampDimensionOptions | string
): Promise<string> {
  const resolved = resolveDimensionText(options);
  if (!resolved || !resolved.combinedText) {
    return imageBase64;
  }

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

        // Prominent "Little Big" typography scaled to image canvas (38px on 1024x1024)
        const fontSize = Math.max(28, Math.round(canvas.width * 0.036)); // ~37px on 1024x1024
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

        const displayLabel = resolved.combinedText;
        const textMetrics = ctx.measureText(displayLabel);
        const textWidth = textMetrics.width;

        const padX = Math.round(fontSize * 0.85); // ~32px
        const padY = Math.round(fontSize * 0.5);  // ~19px
        const badgeWidth = textWidth + padX * 2;
        const badgeHeight = fontSize + padY * 2;

        // Position: Bottom-Left with luxury margin
        const margin = Math.round(canvas.width * 0.04); // ~40px from bottom & left
        const x = margin;
        const y = canvas.height - margin - badgeHeight;
        const radius = 14;

        ctx.save();

        // Luxury dark pill badge with soft drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = 'rgba(10, 11, 16, 0.90)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, badgeWidth, badgeHeight, radius);
        } else {
          ctx.rect(x, y, badgeWidth, badgeHeight);
        }
        ctx.fill();

        // Golden metallic border
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.90)';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Render dimension text with gold labels and crisp white values
        ctx.textBaseline = 'middle';
        const startY = y + badgeHeight / 2 + 1;

        if (resolved.heightText && resolved.widthText) {
          // Draw segmented text: H: [height]  ×  W: [width]
          let currentX = x + padX;

          // H: (Gold)
          ctx.fillStyle = '#F5D061';
          ctx.fillText('H: ', currentX, startY);
          currentX += ctx.measureText('H: ').width;

          // height value (White)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(resolved.heightText, currentX, startY);
          currentX += ctx.measureText(resolved.heightText).width;

          // × (Gold / Muted)
          ctx.fillStyle = 'rgba(212, 175, 55, 0.7)';
          const separator = '   ×   ';
          ctx.fillText(separator, currentX, startY);
          currentX += ctx.measureText(separator).width;

          // W: (Gold)
          ctx.fillStyle = '#F5D061';
          ctx.fillText('W: ', currentX, startY);
          currentX += ctx.measureText('W: ').width;

          // width value (White)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(resolved.widthText, currentX, startY);
        } else {
          // Single dimension text in crisp white
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(displayLabel, x + padX, startY);
        }

        ctx.restore();

        // Export as base64 PNG string (without prefix)
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
