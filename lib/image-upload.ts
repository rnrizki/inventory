// Utility to process, resize, auto-orient and optimize uploaded image files for storage
export async function fileToOptimizedDataUrl(file: File, maxDim = 1200, quality = 0.85): Promise<string> {
  const allowed = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif',
    'image/bmp',
  ];

  if (!allowed.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported image format. Allowed formats: PNG, JPG, JPEG, WEBP, GIF, SVG, AVIF, BMP.');
  }

  // SVG or small GIF: keep as-is to preserve vector or animation
  if (file.type === 'image/svg+xml' || (file.type === 'image/gif' && file.size < 500 * 1024)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Modern browsers: use createImageBitmap with imageOrientation: 'from-image'
  // to ensure EXIF orientation from smartphones is strictly preserved and applied.
  if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
    try {
      // @ts-ignore imageOrientation is supported in modern browsers
      const bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
      let width = bitmap.width;
      let height = bitmap.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        return canvas.toDataURL('image/jpeg', quality);
      }
    } catch (err) {
      console.warn('createImageBitmap failed, falling back to FileReader + Image:', err);
    }
  }

  // Fallback using FileReader and Image element
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, quality));
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Rotates an image (data URL or loaded image URL) by a specified number of degrees (e.g. 90, 180, 270, -90).
 * Returns the resulting base64 JPEG data URL.
 */
export function rotateImageDataUrl(source: string, degrees: number = 90): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const normalizedDegrees = ((degrees % 360) + 360) % 360;
      const is90or270 = normalizedDegrees === 90 || normalizedDegrees === 270;

      const canvas = document.createElement('canvas');
      canvas.width = is90or270 ? img.height : img.width;
      canvas.height = is90or270 ? img.width : img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(source);
        return;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((normalizedDegrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Failed to load image for rotation'));
    img.src = source;
  });
}
