#!/usr/bin/env node
// Runtime guard: ensure the active Node.js version is compatible with Next.js 14.
// Next.js 14 requires Node >= 18.17.0. Running it on Node 12/14/16 (or older)
// produces a cryptic "SyntaxError: Unexpected token '?'" because those versions
// do not support optional chaining (?.) / nullish coalescing (??) used in the
// compiled Next.js output. This script fails fast with a clear, actionable error.

var MIN_MAJOR = 18;
var MIN_MINOR = 17;
var MIN_PATCH = 0;
var RECOMMENDED_MAJOR = 20;

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

// Detect whether nvm is available on this machine (it is a shell function,
// so the most reliable signal is the NVM_DIR environment variable it sets).
function hasNvm() {
  return !!(process.env.NVM_DIR || process.env.NVM_HOME);
}

if (isTooOld()) {
  var line = '------------------------------------------------------------';
  var msg = '\n' + line + '\n';
  msg += '\u274c  Node.js v' + version + ' is too old for this project.\n';
  msg += line + '\n';
  msg += '   Next.js 14 requires Node >= ' + MIN_MAJOR + '.' + MIN_MINOR + '.' + MIN_PATCH + '.\n';
  msg += '   Running an old Node causes:\n';
  msg += '     SyntaxError: Unexpected token \'?\'\n\n';
  msg += '   Pick ONE of the options below to install a modern Node, then retry.\n\n';

  if (hasNvm()) {
    msg += '   Option A - nvm (detected):\n';
    msg += '     nvm install ' + RECOMMENDED_MAJOR + '\n';
    msg += '     nvm use ' + RECOMMENDED_MAJOR + '\n';
    msg += '     npm install\n';
    msg += '     npm run dev\n\n';
    msg += '   Option B - NodeSource apt (system-wide, no nvm):\n';
  } else {
    msg += '   nvm is NOT installed here. Recommended: Option B (NodeSource apt).\n\n';
    msg += '   Option A - install nvm first, then use it:\n';
    msg += '     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash\n';
    msg += '     # close & reopen the terminal (or: source ~/.bashrc), then:\n';
    msg += '     nvm install ' + RECOMMENDED_MAJOR + '\n';
    msg += '     nvm use ' + RECOMMENDED_MAJOR + '\n\n';
    msg += '   Option B - NodeSource apt (system-wide, recommended):\n';
  }
  msg += '     curl -fsSL https://deb.nodesource.com/setup_' + RECOMMENDED_MAJOR + '.x | sudo -E bash -\n';
  msg += '     sudo apt-get install -y nodejs\n';
  msg += '     # verify:\n';
  msg += '     node -v   # should print v' + RECOMMENDED_MAJOR + '.x.x\n';
  msg += '     # then in the project folder:\n';
  msg += '     npm install\n';
  msg += '     npm run dev\n\n';

  process.stderr.write(msg);
  process.exit(1);
}
