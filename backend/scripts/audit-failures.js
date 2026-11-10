const fs = require('fs');

const path = 'C:/Users/shiva/.gemini/antigravity/brain/220becd2-eb14-4d22-88bb-02e1dfcd6add/scratch/backend-tests-sequential.log';
const raw = fs.readFileSync(path, 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
const lines = raw.split('\n');

const byFile = {};
let currentFile = 'unknown';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/(?:FAIL|❯)\s+(tests\/[^\s]+\.test\.ts)/);
  if (m) currentFile = m[1];
  if (line.match(/^\s*×\s+/)) {
    if (!byFile[currentFile]) byFile[currentFile] = [];
    byFile[currentFile].push({
      test: line.trim(),
      reason: (lines[i + 1] || '').trim()
    });
  }
}

for (const [f, errs] of Object.entries(byFile)) {
  console.log(`\n=== ${f} (${errs.length} failures) ===`);
  errs.forEach((e, idx) => {
    console.log(`  ${idx + 1}. ${e.test}`);
    console.log(`     -> ${e.reason}`);
  });
}
