#!/usr/bin/env node
// Runtime guard: ensure the active Node.js version is compatible with Next.js 14.
// Next.js 14 requires Node >= 18.17.0. Running it on Node 12/14/16 (or older)
// produces a cryptic "SyntaxError: Unexpected token '?'" because those versions
// do not support optional chaining (?.) / nullish coalescing (??) used in the
// compiled Next.js output. This script fails fast with a clear, actionable error.

const MIN_MAJOR = 18;
const MIN_MINOR = 17;
const MIN_PATCH = 0;

var version = process.versions.node;
var parts = version.split('.');
var major = parseInt(parts[0], 10);
var minor = parseInt(parts[1], 10);
var patch = parseInt(parts[2], 10);

function isTooOld() {
  if (major < MIN_MAJOR) return true;
  if (major > MIN_MAJOR) return false;
  if (minor < MIN_MINOR) return true;
  if (minor > MIN_MINOR) return false;
  return patch < MIN_PATCH;
}

if (isTooOld()) {
  process.stderr.write(
    '\n\u274c Node.js v' + version + ' is too old for this project.\n' +
    '   Next.js 14 requires Node >= ' + MIN_MAJOR + '.' + MIN_MINOR + '.' + MIN_PATCH + '.\n' +
    '   Running an old Node causes: SyntaxError: Unexpected token \'?\'\n\n' +
    '   Fix with nvm:\n' +
    '     nvm install 18\n' +
    '     nvm use 18\n\n' +
    '   Then retry: npm run dev\n\n'
  );
  process.exit(1);
}