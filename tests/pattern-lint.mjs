/**
 * Cổng chặn một lỗi đã tái diễn BỐN lần trong dự án này.
 *
 * `\b` trong JavaScript chỉ nhận ký tự từ ASCII, nên nó không tạo biên từ cạnh
 * chữ có dấu tiếng Việt: `/\b(bác sĩ)\b/` chưa bao giờ khớp (vòng 10),
 * `(?!\s*phụ nữ\b)` tự vô hiệu (vòng 16), và `/\b(trị|điều trị|…)/` khiến nhánh
 * "điều trị" không bao giờ khớp — chỉ khớp nhờ nhánh ngắn "trị" ăn may, và vỡ
 * hẳn khi chữ bị giãn cách (vòng 18).
 *
 * Luật: `\b` không được đứng cạnh ký tự ngoài ASCII. Dùng `(?<![\p{L}])` và
 * `(?![\p{L}])` thay thế.
 */
import { FORBIDDEN } from '../src/lib/claims-lexicon.ts';

const offenders = [];
for (const r of FORBIDDEN) {
  const src = r.pattern.source;
  /* Đoạn mà mỗi \b đang canh: nếu nó là nhóm `(a|b|c)` thì lấy cả nhóm, vì
     mẫu hay viết `\b(trị|điều trị|…)` — nhánh đầu là ASCII còn nhánh sau có
     dấu, và chỉ nhánh có dấu mới hỏng. */
  const guarded = (str) => {
    // Không phải nhóm: chỉ xét tới hết token liền kề (dừng ở \d, \s, | hoặc ')').
    if (str[0] !== '(') return str.split(/[|)]|\\/)[0];
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(' && str[i - 1] !== '\\') depth++;
      else if (str[i] === ')' && str[i - 1] !== '\\') {
        depth--;
        if (depth === 0) return str.slice(0, i + 1);
      }
    }
    return str;
  };
  const hasNonAscii = (str) => [...str].some((c) => c.charCodeAt(0) > 127);

  for (const m of src.matchAll(/\\b/g)) {
    const i = m.index ?? 0;
    const after = guarded(src.slice(i + 2));
    const beforeChunk = src.slice(Math.max(0, i - 14), i);
    const beforeWord = beforeChunk.split(/[|(\s]/).pop() ?? '';
    if (hasNonAscii(after) || hasNonAscii(beforeWord)) {
      offenders.push(src.slice(Math.max(0, i - 24), i + 30));
    }
  }
}

if (offenders.length) {
  console.error('  \\b đứng cạnh ký tự có dấu — mẫu này sẽ không bao giờ khớp:');
  for (const o of offenders) console.error(`    …${o}…`);
  process.exit(1);
}
console.log(`  ${FORBIDDEN.length}/${FORBIDDEN.length} mẫu không dùng \\b cạnh ký tự có dấu`);
