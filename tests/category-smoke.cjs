const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, '../web/index.html'),
  'utf8'
);

const dom = new JSDOM(html, {
  url: 'http://localhost:3000'
});

const document = dom.window.document;

const scripts = [
  '/app.js',
  '/categories.js'
];

for (const src of scripts) {
  if (!document.querySelector(`script[src="${src}"]`)) {
    throw new Error(`Missing script: ${src}`);
  }
}

for (const stylesheet of ['/style.css', '/phase2.css', '/categories.css']) {
  if (!document.querySelector(`link[href="${stylesheet}"]`)) {
    throw new Error(`Missing stylesheet: ${stylesheet}`);
  }
}

console.log('PASS: Category assets are correctly linked');
dom.window.close();
