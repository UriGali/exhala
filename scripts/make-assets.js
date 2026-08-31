const fs = require('fs')
const path = require('path')

const iconPath = path.join(__dirname, '..', 'public', 'icon.png')
const iconBase64 = fs.readFileSync(iconPath).toString('base64')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 80" width="340" height="80">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&amp;display=swap');
      .logo-text { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; font-size: 38px; fill: #0d2818; letter-spacing: -0.8px; }
      .logo-tag { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; font-size: 10px; fill: #2d6a4f; letter-spacing: 2.5px; }
    </style>
  </defs>
  <image href="data:image/png;base64,${iconBase64}" x="10" y="6" width="68" height="68" />
  <text x="92" y="49" class="logo-text">exhala</text>
  <text x="94" y="64" class="logo-tag">RESPIRA Y FLORECE</text>
</svg>`

fs.writeFileSync(path.join(__dirname, '..', 'public', 'logo-wordmark.svg'), svg)
console.log('Created public/logo-wordmark.svg')
