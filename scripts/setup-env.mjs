import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function mergeEnvironmentFile(target, example, replacements = {}) {
  const template = readFileSync(example, 'utf8');
  if (!existsSync(target)) {
    let contents = template;
    for (const [search, replacement] of Object.entries(replacements)) contents = contents.replaceAll(search, replacement);
    writeFileSync(target, contents, { mode: 0o600 });
    console.log(`Created ${target}.`);
    return;
  }

  let contents = readFileSync(target, 'utf8');
  for (const [search, replacement] of Object.entries(replacements)) contents = contents.replaceAll(search, replacement);
  const existingKeys = new Set(contents.split(/\r?\n/).map(line => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1]).filter(Boolean));
  const missingLines = template.split(/\r?\n/).filter(line => {
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    return key && !existingKeys.has(key);
  }).map(line => {
    let updated = line;
    for (const [search, replacement] of Object.entries(replacements)) updated = updated.replaceAll(search, replacement);
    return updated;
  });

  if (missingLines.length > 0) {
    contents = `${contents.trimEnd()}\n\n# Added by npm run env:setup\n${missingLines.join('\n')}\n`;
    console.log(`Added ${missingLines.length} missing variable(s) to ${target}.`);
  } else {
    console.log(`Preserved ${target}; all documented variables are present.`);
  }
  writeFileSync(target, contents, { mode: 0o600 });
}

const secret = randomBytes(32).toString('hex');
mergeEnvironmentFile('backend/.env', 'backend/.env.example', { 'replace-with-at-least-32-random-characters': secret });
mergeEnvironmentFile('frontend/.env', 'frontend/.env.example');
