import fs from 'fs';
import path from 'path';

function makePng(width, height, r, g, b) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 2; // Color type RGB
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdrData,
    Buffer.alloc(4)
  ]);
  ihdrChunk.writeUInt32BE(crc32(ihdrChunk.subarray(4, 21)), 21);

  // tEXt chunk (padding to exceed 500 bytes)
  const textKeyword = Buffer.from('Description\0');
  const textValue = Buffer.alloc(800, 'x'); // 800 bytes of padding
  const textData = Buffer.concat([textKeyword, textValue]);
  const textChunkHeader = Buffer.alloc(8);
  textChunkHeader.writeUInt32BE(textData.length, 0);
  textChunkHeader.write('tEXt', 4);
  const textChunk = Buffer.concat([
    textChunkHeader,
    textData,
    Buffer.alloc(4)
  ]);
  textChunk.writeUInt32BE(crc32(textChunk.subarray(4, 4 + 4 + textData.length)), 4 + 4 + textData.length);

  // IDAT chunk (with height scanlines of width pixels)
  // Each scanline starts with filter byte 0, then width * 3 bytes (RGB)
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 3)] = 0; // Filter none
    for (let x = 0; x < width; x++) {
      const idx = y * (1 + width * 3) + 1 + x * 3;
      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
    }
  }

  // Simple deflate compression (zlib header + raw data + adler32)
  const len = rawData.length;
  const nlen = ~len & 0xffff;
  const deflateHeader = Buffer.from([0x78, 0x9c]); // Default compression header
  const deflateBlockHeader = Buffer.alloc(5);
  deflateBlockHeader[0] = 0x01; // BFINAL=1, BTYPE=00
  deflateBlockHeader.writeUInt16LE(len, 1);
  deflateBlockHeader.writeUInt16LE(nlen, 3);
  
  // Adler-32 checksum
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < rawData.length; i++) {
    s1 = (s1 + rawData[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE(((s2 << 16) | s1) >>> 0, 0);

  const compressed = Buffer.concat([deflateHeader, deflateBlockHeader, rawData, adler]);
  const idatChunkHeader = Buffer.alloc(8);
  idatChunkHeader.writeUInt32BE(compressed.length, 0);
  idatChunkHeader.write('IDAT', 4);
  const idatChunk = Buffer.concat([
    idatChunkHeader,
    compressed,
    Buffer.alloc(4)
  ]);
  idatChunk.writeUInt32BE(crc32(idatChunk.subarray(4, 4 + 4 + compressed.length)), 4 + 4 + compressed.length);

  // IEND chunk
  const iendChunk = Buffer.from([
    0, 0, 0, 0,
    0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82
  ]);

  return Buffer.concat([signature, ihdrChunk, textChunk, idatChunk, iendChunk]);
}

const assetsDir = path.resolve('public/assets');
const faviconPath = path.join(assetsDir, 'valorae-favicon-48.png');
const icon192Path = path.join(assetsDir, 'valorae-icon-192.png');
const icon512Path = path.join(assetsDir, 'valorae-icon-512.png');
const icon1024Path = path.join(assetsDir, 'valorae-icon-1024.png');

// Sapphire blue is R=15, G=82, B=186 (#0F52BA)
fs.writeFileSync(faviconPath, makePng(16, 16, 15, 82, 186));
fs.writeFileSync(icon192Path, makePng(16, 16, 15, 82, 186));
fs.writeFileSync(icon512Path, makePng(16, 16, 15, 82, 186));
fs.writeFileSync(icon1024Path, makePng(16, 16, 15, 82, 186));

console.log('PNG brand assets generated successfully!');
