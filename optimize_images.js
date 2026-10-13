import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imagesDir = path.join(__dirname, 'public', 'images');
const distImagesDir = path.join(__dirname, 'dist', 'images');

async function optimizeImages() {
  const files = ['egg-puff.jpg', 'chicken-puff.jpg', 'veg-puff.jpg', 'samosa.jpg'];
  console.log('Optimizing food images...');

  for (const file of files) {
    const srcPath = path.join(imagesDir, file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`File not found: ${srcPath}`);
      continue;
    }

    const baseName = path.basename(file, path.extname(file));
    const webpPath = path.join(imagesDir, `${baseName}.webp`);
    
    // Resize to max 600px width/height (food cards are ~300-400px on screens)
    // Quality 82 for crisp food details with small file size (~15-25 KB)
    const originalBuffer = fs.readFileSync(srcPath);
    console.log(`Original ${file}: ${(originalBuffer.length / 1024).toFixed(1)} KB`);

    await sharp(originalBuffer)
      .resize({ width: 640, height: 480, fit: 'cover' })
      .webp({ quality: 82, effort: 6 })
      .toFile(webpPath);

    const webpBuffer = fs.readFileSync(webpPath);
    console.log(`Optimized ${baseName}.webp: ${(webpBuffer.length / 1024).toFixed(1)} KB (Saved: ${(((originalBuffer.length - webpBuffer.length) / originalBuffer.length) * 100).toFixed(1)}%)`);

    // Also mirror to dist/images if dist exists
    if (fs.existsSync(distImagesDir)) {
      fs.copyFileSync(webpPath, path.join(distImagesDir, `${baseName}.webp`));
    }
  }

  console.log('Image optimization complete!');
}

optimizeImages().catch(console.error);
