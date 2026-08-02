/**
 * Client-side image compression and file size validation utility.
 */
export function compressImageIfNeeded(file: File, maxSizeBytes: number = 10 * 1024 * 1024): Promise<File> {
  return new Promise((resolve) => {
    // Only compress image files
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    // If the file is already under the max size, we can upload it as-is.
    // However, if it's an image, compressing it a bit is usually a good idea
    // to save bandwidth, but let's strictly respect: "10MB 이하이면 그냥 올려 준다"
    if (file.size <= maxSizeBytes) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Downscale image dimensions if it's too large (max 2048px on the longest edge)
        const MAX_DIM = 2048;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Progressively reduce JPEG/WEBP quality until the file is under the limit
        let quality = 0.9;
        const mimeType = file.type === "image/png" ? "image/jpeg" : file.type; // PNGs don't support quality compression in canvas, convert to JPEG if over limit

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              if (blob.size <= maxSizeBytes || quality <= 0.1) {
                const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : "";
                let newName = file.name;
                if (file.type === "image/png") {
                  newName = file.name.replace(/\.png$/i, ".jpg");
                }
                const compressedFile = new File([blob], newName, {
                  type: mimeType,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                quality -= 0.15;
                tryCompress();
              }
            },
            mimeType,
            quality
          );
        };

        tryCompress();
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}
