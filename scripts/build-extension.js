const fs = require('fs-extra')
const path = require('path')
const webpack = require('webpack')
const webpackConfig = require('../webpack.config.js')

async function buildExtension() {
  const distDir = path.join(__dirname, '../dist')
  const publicDir = path.join(__dirname, '../public')

  try {
    // Clean dist directory
    await fs.emptyDir(distDir)

    // Create icons directory
    await fs.ensureDir(path.join(distDir, 'icons'))

    // Copy manifest and other static files
    await fs.copy(path.join(publicDir, 'manifest.json'), path.join(distDir, 'manifest.json'))
    await fs.copy(path.join(publicDir, 'background.js'), path.join(distDir, 'background.js'))
    await fs.copy(path.join(publicDir, 'content.js'), path.join(distDir, 'content.js'))
    await fs.copy(path.join(publicDir, 'content.css'), path.join(distDir, 'content.css'))
    await fs.copy(path.join(publicDir, 'models'), path.join(distDir, 'models'))
    await fs.copy(path.join(publicDir, 'icons'), path.join(distDir, 'icons'))

    // Create popup.html
    const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EcoChoice</title>
  <link href="popup.css" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script src="popup.js"></script>
</body>
</html>`

    await fs.writeFile(path.join(distDir, 'popup.html'), popupHtml)

    // Run webpack
    await new Promise((resolve, reject) => {
      webpack(webpackConfig, (err, stats) => {
        if (err || stats.hasErrors()) {
          console.error('Webpack build failed:', err || stats.toString())
          reject(err || new Error('Webpack build failed'))
        } else {
          console.log('Webpack build completed:', stats.toString())
          resolve()
        }
      })
    })

    console.log('Extension built successfully!')
  } catch (error) {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

buildExtension() 