/**
 * Demiryolu Saha Fotoğrafı Damgalama (Watermark) ve Sıkıştırma Modülü
 */

export interface RailwayWatermarkOptions {
  title?: string;
  kmValue?: string;
  lineName?: string;
  category?: string; // 'crossing' | 'culvert' | 'switch' | 'km_marker' etc.
  organization?: string; // Örn: TCDD 712 YOL BAKIM ŞEFLİĞİ
  dateTime?: string; // Boş bırakılırsa anlık tarih/saat
  coords?: { lat: number; lng: number };
  extraDetails?: string; // Hemzemin geçit tipi, kaplama cinsi veya menfez ebadı
}

function drawRailwayWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: RailwayWatermarkOptions
) {
  const org = options.organization || 'TCDD 712 YOL BAKIM ŞEFLİĞİ';
  const line = options.lineName ? `Hat: ${options.lineName}` : 'Hat: Eskişehir - Konya';
  
  // Format title & category badge
  let categoryPrefix = '';
  if (options.category === 'crossing') {
    categoryPrefix = '🚧 HEMZEMİN GEÇİT: ';
  } else if (options.category === 'culvert') {
    categoryPrefix = '🧱 MENFEZ: ';
  } else if (options.category === 'switch') {
    categoryPrefix = '🔀 MAKAS: ';
  }

  const titleText = `${categoryPrefix}${options.title || ''}`;
  const kmText = options.kmValue ? `KM: ${options.kmValue}` : '';
  const lineAndKm = [line, kmText].filter(Boolean).join(' | ');

  const now = options.dateTime || new Date().toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const coordText = options.coords ? `Konum: ${options.coords.lat.toFixed(5)}, ${options.coords.lng.toFixed(5)}` : '';

  // Build the lines for the banner
  const lines: { text: string; type: 'header' | 'title' | 'meta' | 'extra' }[] = [
    { text: `📍 ${org}`, type: 'header' },
    { text: titleText ? `${titleText} — ${lineAndKm}` : lineAndKm, type: 'title' },
  ];

  if (options.extraDetails) {
    lines.push({ text: `⚙️ ${options.extraDetails}`, type: 'extra' });
  }

  lines.push({ text: `📅 ${now}${coordText ? ` | ${coordText}` : ''}`, type: 'meta' });

  // Calculate proportional font sizing based on image dimensions
  const baseSize = Math.max(12, Math.round(width * 0.022));
  const padding = Math.round(baseSize * 1.2);
  const lineHeight = Math.round(baseSize * 1.4);

  const bannerHeight = (lines.length * lineHeight) + (padding * 2);

  // Bottom semi-transparent dark gradient overlay
  const grad = ctx.createLinearGradient(0, height - bannerHeight - 20, 0, height);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.3, 'rgba(15, 23, 42, 0.82)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, height - bannerHeight - 20, width, bannerHeight + 20);

  // Top accent bar (TCDD warning amber/red stripe)
  ctx.fillStyle = options.category === 'crossing' ? '#f59e0b' : '#38bdf8';
  ctx.fillRect(0, height - bannerHeight, width, Math.max(3, Math.round(baseSize * 0.22)));

  // Text settings
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  lines.forEach((item, idx) => {
    const yPos = height - bannerHeight + padding + (idx * lineHeight) + (lineHeight / 2);
    
    // Draw subtle text shadow for high outdoor contrast
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    if (item.type === 'header') {
      ctx.font = `bold ${Math.round(baseSize * 1.15)}px 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = '#38bdf8'; // Sky blue for header
    } else if (item.type === 'title') {
      ctx.font = `bold ${baseSize}px 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = '#ffffff'; // White for title & KM
    } else if (item.type === 'extra') {
      ctx.font = `600 ${Math.round(baseSize * 0.9)}px 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = '#fde047'; // Yellow accent for crossing & technical details
    } else {
      ctx.font = `normal ${Math.round(baseSize * 0.85)}px 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = '#cbd5e1'; // Muted slate for date & coords
    }

    ctx.fillText(item.text, padding * 1.5, yPos);
  });

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Compresses an image File or base64 DataURL to an optimized JPEG format.
 * Automatically stamps official TCDD Railway watermark on the image.
 */
export async function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.82,
  watermark?: RailwayWatermarkOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const handleLoad = () => {
      let { width, height } = img;

      // Calculate aspect ratio preserving dimensions
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        if (typeof fileOrDataUrl === 'string') {
          resolve(fileOrDataUrl);
        } else {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileOrDataUrl);
        }
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw background white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Apply Railway Field Watermark if requested
      if (watermark) {
        drawRailwayWatermark(ctx, canvas.width, canvas.height, watermark);
      }

      // Export as compressed JPEG
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onload = handleLoad;

    img.onerror = () => {
      if (typeof fileOrDataUrl === 'string') {
        resolve(fileOrDataUrl);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrDataUrl);
      }
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
