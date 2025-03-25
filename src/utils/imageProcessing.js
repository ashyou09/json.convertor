export const preprocessImage = async (imageData, options = {}) => {
  const {
    contrast = 1.2,
    brightness = 1.0,
    grayscale = true,
    sharpen = true,
    quality = 1.0
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    img.src = imageData;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Apply image processing
      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale if needed
        if (grayscale) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        
        // Apply contrast
        if (contrast !== 1.0) {
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          for (let j = 0; j < 3; j++) {
            data[i + j] = factor * (data[i + j] - 128) + 128;
          }
        }
        
        // Apply brightness
        if (brightness !== 1.0) {
          for (let j = 0; j < 3; j++) {
            data[i + j] *= brightness;
          }
        }
      }
      
      // Apply sharpening if needed
      if (sharpen) {
        const sharpenKernel = [
          0, -1, 0,
          -1, 5, -1,
          0, -1, 0
        ];
        applyConvolution(imageData, sharpenKernel);
      }
      
      // Put processed data back
      ctx.putImageData(imageData, 0, 0);
      
      // Return processed image
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

const applyConvolution = (imageData, kernel) => {
  const side = Math.round(Math.sqrt(kernel.length));
  const halfSide = Math.floor(side / 2);
  const src = imageData.data;
  const sw = imageData.width;
  const sh = imageData.height;
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');
  const output = tmpCtx.createImageData(sw, sh);
  const dst = output.data;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const sy = y;
      const sx = x;
      const dstOff = (y * sw + x) * 4;
      let r = 0, g = 0, b = 0;

      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = sy + cy - halfSide;
          const scx = sx + cx - halfSide;

          if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
            const srcOff = (scy * sw + scx) * 4;
            const wt = kernel[cy * side + cx];
            r += src[srcOff] * wt;
            g += src[srcOff + 1] * wt;
            b += src[srcOff + 2] * wt;
          }
        }
      }

      dst[dstOff] = Math.min(Math.max(r, 0), 255);
      dst[dstOff + 1] = Math.min(Math.max(g, 0), 255);
      dst[dstOff + 2] = Math.min(Math.max(b, 0), 255);
      dst[dstOff + 3] = src[dstOff + 3];
    }
  }

  return output;
};

export const getImageQualityScore = (imageData) => {
  const img = new Image();
  img.src = imageData;
  
  return new Promise((resolve) => {
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Calculate basic image quality metrics
      let brightness = 0;
      let contrast = 0;
      let sharpness = 0;
      
      // Calculate average brightness
      for (let i = 0; i < data.length; i += 4) {
        brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      brightness /= (data.length / 4);
      
      // Calculate contrast
      let variance = 0;
      for (let i = 0; i < data.length; i += 4) {
        const pixel = (data[i] + data[i + 1] + data[i + 2]) / 3;
        variance += Math.pow(pixel - brightness, 2);
      }
      contrast = Math.sqrt(variance / (data.length / 4));
      
      // Calculate sharpness using Laplacian
      const laplacian = [
        -1, -1, -1,
        -1,  8, -1,
        -1, -1, -1
      ];
      const edges = applyConvolution(imageData, laplacian);
      let edgeStrength = 0;
      for (let i = 0; i < edges.data.length; i += 4) {
        edgeStrength += edges.data[i];
      }
      sharpness = edgeStrength / (edges.data.length / 4);
      
      resolve({
        brightness: brightness / 255,
        contrast: contrast / 255,
        sharpness: sharpness / 255,
        overall: (brightness + contrast + sharpness) / (3 * 255)
      });
    };
  });
}; 