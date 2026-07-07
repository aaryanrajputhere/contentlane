import 'dotenv/config';

console.log('Lean rewrite worker started. No background queue is required.');
setInterval(() => undefined, 60_000);
