/**
 * Extract dominant colors from an image URL using canvas pixel sampling.
 * Returns an array of hex color strings sorted by frequency.
 * Filters out near-black, near-white, and very desaturated colors.
 */
export async function extractColorsFromImage(imageUrl: string, maxColors = 5): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 100; // downsample for speed
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve([]); return; }

      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      // Bucket colors (quantize to reduce noise)
      const buckets = new Map<string, number>();
      for (let i = 0; i < data.length; i += 4) {
        const r = Math.round(data[i] / 16) * 16;
        const g = Math.round(data[i + 1] / 16) * 16;
        const b = Math.round(data[i + 2] / 16) * 16;
        const a = data[i + 3];
        if (a < 128) continue; // skip transparent

        // Skip near-black and near-white
        const brightness = (r + g + b) / 3;
        if (brightness < 30 || brightness > 235) continue;

        // Skip very desaturated (grayscale)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (saturation < 0.15) continue;

        const key = `${r},${g},${b}`;
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      // Sort by frequency
      const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);

      // Convert to hex, deduplicate similar colors
      const results: string[] = [];
      for (const [key] of sorted) {
        if (results.length >= maxColors) break;
        const [r, g, b] = key.split(',').map(Number);
        const hex = '#' + [r, g, b].map(c => Math.min(255, c).toString(16).padStart(2, '0')).join('');
        
        // Check if too similar to existing results
        const tooSimilar = results.some(existing => {
          const [er, eg, eb] = [
            parseInt(existing.slice(1, 3), 16),
            parseInt(existing.slice(3, 5), 16),
            parseInt(existing.slice(5, 7), 16),
          ];
          return Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb) < 80;
        });
        if (!tooSimilar) results.push(hex);
      }

      resolve(results);
    };
    img.onerror = () => resolve([]);
    img.src = imageUrl;
  });
}

/** Determine if image is essentially monochrome (black & white / grayscale) */
export async function isMonochromeImage(imageUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 80;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(false); return; }

      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      let colorPixels = 0;
      let totalPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // skip transparent
        totalPixels++;
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (saturation > 0.15) colorPixels++;
      }

      // If less than 10% of pixels are colorful, it's monochrome
      resolve(totalPixels === 0 ? true : (colorPixels / totalPixels) < 0.1);
    };
    img.onerror = () => resolve(false);
    img.src = imageUrl;
  });
}

/** Generate a palette suggestion from extracted colors */
export function buildPaletteFromColors(colors: string[]): { bg: string; accent: string; text: string } | null {
  if (colors.length === 0) return null;
  
  // Use darkest color as bg, brightest as accent, white text
  const withBrightness = colors.map(hex => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { hex, brightness: (r * 299 + g * 587 + b * 114) / 1000 };
  }).sort((a, b) => a.brightness - b.brightness);

  const darkest = withBrightness[0];
  const brightest = withBrightness[withBrightness.length - 1];

  // If only 1 color, use it as accent on dark bg
  if (colors.length === 1) {
    return { bg: '#0A0A1A', accent: colors[0], text: '#FFFFFF' };
  }

  // Dark bg + bright accent
  if (darkest.brightness < 100) {
    return { bg: darkest.hex, accent: brightest.hex, text: '#FFFFFF' };
  }

  // Light palette: light bg + dark accent, always ensure readable text
  return { bg: brightest.hex, accent: darkest.hex, text: darkest.brightness < 40 ? darkest.hex : '#1A1A1A' };
}
