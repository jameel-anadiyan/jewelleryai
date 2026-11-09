/**
 * Stretches or renders the Master MM directly within the jewellery sketch image as clean,
 * elegant specification text on a subtle luxury pill badge.
 * This bakes the MM into the picture canvas itself without modifying or polluting AI prompts.
 */
export async function stampMasterMmOnImage(
  imageBase64: string,
  masterMm?: string
): Promise<string> {
  if (!masterMm || !masterMm.trim()) {
    return imageBase64;
  }

  const mmText = masterMm.trim();

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

        // Typography settings scaled to image resolution
        const fontSize = Math.max(20, Math.round(canvas.width * 0.024)); // ~25px on 1024x1024
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

        const displayLabel = mmText.toLowerCase().includes('mm') ? mmText : `${mmText} mm`;
        const textMetrics = ctx.measureText(displayLabel);
        const textWidth = textMetrics.width;

        const padX = fontSize * 0.7;
        const padY = fontSize * 0.4;
        const badgeWidth = textWidth + padX * 2;
        const badgeHeight = fontSize + padY * 2;

        // Position: Bottom-Left with luxury margin
        const margin = Math.round(canvas.width * 0.035); // ~36px from bottom & left
        const x = margin;
        const y = canvas.height - margin - badgeHeight;
        const radius = 10;

        ctx.save();

        // Subtle dark translucent pill background with soft shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = 'rgba(12, 13, 18, 0.85)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, badgeWidth, badgeHeight, radius);
        } else {
          ctx.rect(x, y, badgeWidth, badgeHeight);
        }
        ctx.fill();

        // Reset shadow for border
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.75)'; // Soft gold border
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw dimension text in bright crisp text
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayLabel, x + padX, y + badgeHeight / 2 + 1);

        ctx.restore();

        // Export as base64 PNG string (without prefix)
        const dataUrl = canvas.toDataURL('image/png');
        const cleanB64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        resolve(cleanB64);
      } catch (err) {
        console.warn('Failed to stamp Master MM on image:', err);
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

