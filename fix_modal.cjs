const fs = require('fs');

function update(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // We need to clean up whatever the bad bash script did.
  // Wait, if bash threw "command not found", it means it evaluated it as empty strings. Let's see if the file is syntax correct currently.
}

update('public/index.html');
update('public/server.html');
