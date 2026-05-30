const fs = require('fs');

const polyfill = `const origInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
Object.defineProperty(Element.prototype, 'innerHTML', {
  set(value) {
    if (this.innerHTML !== String(value)) {
      origInnerHTML.call(this, value);
    }
  }
});\n`;

for (let file of ['public/index.html', 'public/server.html']) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('origInnerHTML')) {
    code = code.replace(/<script>/, "<script>\n" + polyfill);
    fs.writeFileSync(file, code);
    console.log("Patched " + file);
  }
}
