// A small unified diff (longest common subsequence on lines), enough to show a merchant what a
// draft change does before it's applied.

export function unifiedDiff(filename: string, before: string, after: string, context = 3): string {
  if (before === after) return '';
  const a = before.split('\n');
  const b = after.split('\n');
  // LCS table, trimmed to the changed middle so large files stay cheap.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const lcs: number[][] = Array.from({ length: midA.length + 1 }, () => new Array<number>(midB.length + 1).fill(0));
  for (let i = midA.length - 1; i >= 0; i--) for (let j = midB.length - 1; j >= 0; j--) lcs[i]![j] = midA[i] === midB[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const ops: { op: ' ' | '-' | '+'; line: string }[] = a.slice(0, start).map((line) => ({ op: ' ', line }));
  let i = 0;
  let j = 0;
  while (i < midA.length || j < midB.length) {
    if (i < midA.length && j < midB.length && midA[i] === midB[j]) {
      ops.push({ op: ' ', line: midA[i]! });
      i++;
      j++;
    } else if (j < midB.length && (i >= midA.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      ops.push({ op: '+', line: midB[j++]! });
    } else {
      ops.push({ op: '-', line: midA[i++]! });
    }
  }
  for (const line of a.slice(endA)) ops.push({ op: ' ', line });

  // Group into hunks with context.
  const out = [`--- a/${filename}`, `+++ b/${filename}`];
  let k = 0;
  let lineA = 1;
  let lineB = 1;
  while (k < ops.length) {
    if (ops[k]!.op === ' ') {
      k++;
      lineA++;
      lineB++;
      continue;
    }
    const from = Math.max(0, k - context);
    let to = k;
    let quiet = 0;
    while (to < ops.length && quiet <= context * 2) {
      quiet = ops[to]!.op === ' ' ? quiet + 1 : 0;
      to++;
    }
    to = Math.min(ops.length, to - Math.max(0, quiet - context));
    const hunk = ops.slice(from, to);
    const startA = lineA - (k - from);
    const startB = lineB - (k - from);
    const countA = hunk.filter((o) => o.op !== '+').length;
    const countB = hunk.filter((o) => o.op !== '-').length;
    out.push(`@@ -${startA},${countA} +${startB},${countB} @@`, ...hunk.map((o) => `${o.op}${o.line}`));
    for (const o of ops.slice(k, to)) {
      if (o.op !== '+') lineA++;
      if (o.op !== '-') lineB++;
    }
    k = to;
  }
  return out.join('\n');
}
