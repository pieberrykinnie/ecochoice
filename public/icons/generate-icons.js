const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

// Generate a green square with "EC" text as a Buffer
async function generateIcon(size) {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#16a34a"/>
    <text x="50%" y="50%" font-family="Arial" font-size="${size/3}" 
      fill="white" text-anchor="middle" dominant-baseline="middle">EC</text>
  </svg>`

  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

// Generate icons for different sizes
async function generateIcons() {
  const sizes = [16, 32, 48, 128]
  
  try {
    for (const size of sizes) {
      const iconBuffer = await generateIcon(size)
      const fileName = path.join(__dirname, `icon${size}.png`)
      await fs.promises.writeFile(fileName, iconBuffer)
      console.log(`Generated ${fileName}`)
    }
  } catch (error) {
    console.error('Error generating icons:', error)
    process.exit(1)
  }
}

generateIcons() 