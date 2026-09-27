/**
 * Compresses an image File or base64 DataURL to an optimized JPEG format.
 * Reduces 5-15MB phone camera photos to ~100-250KB while retaining high visual clarity.
 * This prevents browser localStorage QuotaExceededError and eliminates network timeouts.
 */
export async function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.8
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
        // Fallback to original
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

      // Draw background white in case of transparent png
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Export as compressed JPEG
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };

    img.onload = handleLoad;

    img.onerror = () => {
      // Fallback
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
