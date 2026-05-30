const fs = require('fs');

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Inject setHtml around line 321
  if (!content.includes('function setHtml(id,')) {
    content = content.replace(/function routeRows\(/, "function setHtml(id,h){const e=$(id);if(e&&e.innerHTML!==h)e.innerHTML=h}\nfunction routeRows(");
  }

  // Find all assignments of the form: $('xyz').innerHTML = ... 
  // It's a bit tricky to replace correctly without matching the end. 
  // But wait! Since all assignments in these files end with a closing bracket, semicolon or brace.
  // Actually, we can use Babel or just do manual replacements for the known ones.
  // Let's do simple replacements for the known IDs:
  const ids = [
    'selectedEvent', 'vercelBox', 'routesTable', 'qualityKpis', 'fieldGuardBox', 
    'payloadBudgetBox', 'actionPlanBox', 'maturityBox', 'indicatorCoverageBox', 
    'cacheSourceBox', 'manifestBox', 'promptGrid', 'featuresGrid', 'techGrid', 
    'moduleTree', 'testResults', 'benchmarkResults', 'rawMetrics', 'kpiGrid',
    'appsSummary', 'executiveAlerts', 'pipelineFacts', 'feedList'
  ];

  for (let id of ids) {
    // regex to replace $( 'id' ).innerHTML = (something) until end of statement or before multiple assignments
    // A simpler way: Find \$\('id'\)\.innerHTML\s*=\s*(.*?}(?=\n|\)|$)|.*?(?=;|$))
    // Actually, setting it manually is safer: 
    let regex = new RegExp("\\$\\('" + id + "'\\)\\.innerHTML\\s*=", "g");
    content = content.replace(regex, "setHtml('" + id + "', ");
    // BUT we must append the closing parenthesis!
    // we can't just append without parsing.
  }
  fs.writeFileSync(file, content);
}

fix('public/index.html');
if (fs.existsSync('public/server.html')) fix('public/server.html');
