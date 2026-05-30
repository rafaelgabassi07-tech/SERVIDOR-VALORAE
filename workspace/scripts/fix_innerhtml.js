const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');
code = code.replace(/\$\('([^']+)'\)\.innerHTML *=/g, "setHtml('$1', ");
// But I also have to add a closing parenthesis `)` for each replacement.
// wait, that's exactly why Regex replacement of just the LHS doesn't work!
