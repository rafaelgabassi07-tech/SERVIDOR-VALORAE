import http from 'http';
import cp from 'child_process';
const server = cp.spawn('npm', ['start']);
setTimeout(async () => {
    for (const url of [
        'http://localhost:3000/api/v1/asset?ticker=WEGE3&complete=1',
        'http://localhost:3000/api/v1/asset?ticker=PETR4&complete=1',
        'http://localhost:3000/api/v1/asset?ticker=VALE3&complete=1',
        'http://localhost:3000/api/v1/asset?ticker=KNRI11&complete=1',
        'http://localhost:3000/api/integration/manifest',
        'http://localhost:3000/api/ready'
    ]) {
        console.log('Fetching', url);
        try {
            const res = await fetch(url);
            console.log(res.status);
        } catch (e) {
            console.error(e.message);
        }
    }
    server.kill();
    process.exit(0);
}, 3000);
