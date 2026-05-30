const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><p id="test">Hello</p>`);
const window = dom.window;
const document = window.document;

const Element = window.Element;
const origHtml = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
let setCount = 0;
Object.defineProperty(Element.prototype, 'innerHTML', {
  set: function(val) {
    if (this.innerHTML !== val) {
      setCount++;
      origHtml.set.call(this, val);
    }
  },
  get: function() { return origHtml.get.call(this); }
});

const p = document.getElementById("test");
p.innerHTML = "Hello";
console.log("Set strict equals:", setCount);
p.innerHTML = "World";
console.log("Set different:", setCount);
