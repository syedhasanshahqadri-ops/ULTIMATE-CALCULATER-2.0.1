# Markly v2

Files: index.html, styles.css, report.js, app.js, sw.js, manifest.json, icons/, server.js, package.json

## Local chalane ka tareeqa (PC par)
1. Node.js 18+ install karein (https://nodejs.org).
2. Is folder mein terminal/CMD kholein.
3. `node server.js`
4. Browser mein http://localhost:3000 kholein.

## Phone par test (same WiFi)
PC ka IP dekhein (`ipconfig`), phir phone mein http://PC-IP:3000 kholein.
Install button ke liye https zaroori hai, isliye asli install ke liye hosting (Render / GitHub Pages) use karein.

## Hosting
- Poori app (frontend + backend) Render.com par: Build command khali, Start command `node server.js`.
- Sirf frontend GitHub Pages par: app.js mein `API_BASE` ko apne backend ke URL par set karein.

## Zaroori note
Har bar files change karein to sw.js mein `VERSION` ka number badal dein, warna purani files cache se aati rahengi.
