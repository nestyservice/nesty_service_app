import fs from 'fs';
import path from 'path';

const images = [
  {
    name: 'samosa.jpg',
    url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'veg-puff.jpg',
    url: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'egg-puff.jpg',
    url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'chicken-puff.jpg',
    url: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80',
  },
];

const destDir = path.resolve('public/images');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

async function run() {
  for (const img of images) {
    try {
      console.log(`Downloading ${img.name}...`);
      const res = await fetch(img.url);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(path.join(destDir, img.name), buffer);
        console.log(`Saved ${img.name} (${buffer.length} bytes)`);
      } else {
        console.error(`Failed ${img.name}: status ${res.status}`);
      }
    } catch (e) {
      console.error(`Error downloading ${img.name}:`, e.message);
    }
  }
}

run();
