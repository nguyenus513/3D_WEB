const { execFileSync } = require('child_process');

const legacyPattern = "\\.from\\('(master_orders|order_parent|order_child|order_files|custom_orders|print_orders|payment)'\\)|db\\.collection\\('(master_orders|order_parent|order_child|order_files|custom_orders|print_orders|payment)'\\)";
const allowed = new Set([
  'src/app/api/orders/master/route.ts',
  'src/app/api/payments/cart/route.ts',
  'src/app/api/webhooks/qr/route.ts',
  'src/services/OrderArchiver.ts',
  'src/lib/storage/migrate-to-drive.ts',
]);

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

let output = '';
try {
  output = execFileSync('rg', ['-n', legacyPattern, 'src', '-S'], { encoding: 'utf8' });
} catch (error) {
  if (error.status === 1) {
    console.log(JSON.stringify({ ok: true, legacyRuntimeRefs: [] }, null, 2));
    process.exit(0);
  }
  throw error;
}

const refs = output.trim().split(/\r?\n/).filter(Boolean).map((line) => {
  const [file, lineNumber, ...rest] = line.split(':');
  return { file: normalizePath(file), line: Number(lineNumber), text: rest.join(':').trim() };
});
const blocking = refs.filter((ref) => !allowed.has(ref.file));

console.log(JSON.stringify({ ok: blocking.length === 0, legacyRuntimeRefs: refs, blocking }, null, 2));
if (blocking.length > 0) process.exit(1);
