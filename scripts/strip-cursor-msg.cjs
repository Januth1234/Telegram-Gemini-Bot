const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const lines = [];
rl.on('line', (line) => {
  if (!/^\s*Co-authored-by:\s*Cursor\s*</.test(line) && !/^\s*Made-with:\s*Cursor\s*$/.test(line)) {
    lines.push(line);
  }
});
rl.on('close', () => {
  process.stdout.write(lines.join('\n') + (lines.length ? '\n' : ''));
});
