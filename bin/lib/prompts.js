export async function askYesNo(question, defaultYes = true) {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const answer = await new Promise(resolve => rl.question(question + suffix, resolve));
  rl.close();
  const normalized = (answer || '').trim().toLowerCase();
  if (!normalized) return defaultYes;
  return ['y', 'yes'].includes(normalized);
}

