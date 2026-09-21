/**
 * Sinh docs/truong-du-lieu.md từ chính schema Zod.
 *
 * Kiểm định lần 10 đóng vai người biên tập không biết code: README bảo "điền
 * các trường bắt buộc" nhưng KHÔNG chỗ nào trong repo liệt kê chúng. Họ mất ba
 * vòng build-lỗi mới qua được. Tài liệu viết tay sẽ lệch khỏi schema sau vài
 * vòng; sinh tự động thì không.
 */
import { writeFileSync } from 'node:fs';
import { collections } from '../src/content.config.ts';

const product = collections.products.schema;

/** Mô tả ngắn gọn một schema Zod. */
function describe(def, depth = 0) {
  const t = def?._zod?.def ?? def?._def ?? {};
  const type = t.type ?? t.typeName;
  switch (type) {
    case 'object': {
      const shape = typeof t.shape === 'function' ? t.shape() : t.shape;
      return { kind: 'object', fields: shape ?? {} };
    }
    case 'array': return { kind: 'array', of: describe(t.element ?? t.type, depth + 1) };
    case 'optional': case 'nullable': return { ...describe(t.innerType, depth), optional: true };
    case 'default': return { ...describe(t.innerType, depth), optional: true, hasDefault: true };
    case 'union': return { kind: 'union', options: (t.options ?? []).map((o) => describe(o, depth + 1)) };
    case 'enum': return { kind: 'enum', values: Object.values(t.entries ?? t.values ?? {}) };
    case 'literal': return { kind: 'literal', value: (t.values ?? [t.value])[0] };
    case 'pipe': return describe(t.out ?? t.in, depth);
    default: return { kind: type ?? 'unknown' };
  }
}

const label = (d) => {
  if (d.kind === 'enum') return `một trong: ${d.values.map((v) => `\`${v}\``).join(', ')}`;
  if (d.kind === 'literal') return `\`"${d.value}"\``;
  if (d.kind === 'array') {
    if (d.of.kind === 'union') return 'danh sách khối — xem mục "Các loại khối" bên dưới';
    return `danh sách ${label(d.of)}`;
  }
  if (d.kind === 'object') return 'nhóm trường';
  if (d.kind === 'union') return d.options.map(label).join(' hoặc ');
  return { string: 'chữ', number: 'số', boolean: 'đúng/sai' }[d.kind] ?? d.kind;
};

/* Bung cả nhóm trường lồng nhau.
   Kiểm định lần 11: `compliance` — nhóm bắt buộc theo Nghị định 342/2025 — chỉ
   hiện một dòng "nhóm trường", nên người biên tập chỉ tạo được sản phẩm nhờ
   thư mục mẫu chứa sẵn, không nhờ tài liệu. */
const rows = [];
const top = describe(product);
const walk = (fields, prefix = '', depth = 0) => {
  for (const [name, field] of Object.entries(fields)) {
    const d = describe(field);
    const path = prefix ? `${prefix}.${name}` : name;
    rows.push({ name: path, type: label(d), required: !d.optional, hasDefault: !!d.hasDefault, depth });
    if (d.kind === 'object' && depth < 2) walk(d.fields, path, depth + 1);
    if (d.kind === 'array' && d.of.kind === 'object' && depth < 2) walk(d.of.fields, `${path}[]`, depth + 1);
  }
};
walk(top.fields);

const blockTypes = [];
const blocksField = describe(top.fields.blocks);
if (blocksField.kind === 'array' && blocksField.of.kind === 'union') {
  for (const opt of blocksField.of.options) {
    if (opt.kind !== 'object') continue;
    const typeField = describe(opt.fields.type);
    const fields = Object.entries(opt.fields)
      .filter(([n]) => n !== 'type')
      .map(([n, f]) => {
        const d = describe(f);
        return `${n}${d.optional ? '' : ' *'}`;
      });
    blockTypes.push({ type: typeField.value ?? '?', fields });
  }
}

const md = `# Các trường trong file sản phẩm

**File này được sinh tự động** bằng \`node scripts/gen-field-docs.mjs\` từ
\`src/content.config.ts\`. Đừng sửa tay — sửa schema rồi chạy lại.

Dấu \`*\` = bắt buộc.

## Trường ở cấp sản phẩm

| Trường | Kiểu | Bắt buộc |
|---|---|---|
${rows.map((r) => `| ${'&nbsp;'.repeat(r.depth * 4)}\`${r.name}\` | ${r.type} | ${r.required ? '**có**' : r.hasDefault ? 'không (có sẵn mặc định)' : 'không'} |`).join('\n')}

## Các loại khối dùng trong \`blocks\`

Mỗi khối là một mục trong mảng \`blocks\`, thứ tự trong mảng chính là thứ tự
hiển thị trên trang. Mỗi khối phải có \`"type"\`.

${blockTypes.map((b) => `### \`${b.type}\`\n\n${b.fields.map((f) => `- \`${f}\``).join('\n')}`).join('\n\n')}

## Những điều máy sẽ chặn bạn (và vì sao)

- **Viết số tiền trực tiếp** trong bất kỳ câu chữ nào. Dùng \`{{price}}\`,
  \`{{compareAtPrice}}\`, \`{{save}}\` — trang tự thay bằng giá thật, nên giá không
  bao giờ lệch giữa các chỗ.
- **Tuyên bố bị cấm với mỹ phẩm** (trị/chữa bệnh, cam kết kết quả, so sánh với
  laser, danh nghĩa bác sĩ…). Thông báo lỗi nêu rõ nên viết thế nào thay thế.
  Áp dụng cả khi bạn gõ **không dấu**.
- **Tên, tuổi, số điện thoại, email của khách hàng** ở ngoài khối có cổng đồng ý.
  Lời chứng phải nằm trong khối \`testimonials\` kèm \`consent\`.
- **Ảnh sai đường dẫn**, **neo \`#...\` trỏ tới khối không tồn tại**, **hai khối
  trùng \`id\`**, **thiếu khối \`order\`**, **hai gói cùng \`recommended\`**.
- **Gõ sai tên trường** (\`headding\` thay vì \`heading\`) — máy chỉ đích danh.

Kích thước ảnh **không cần khai**: đặt file vào \`src/assets/images/\` là xong,
máy tự đọc số pixel. Ảnh người thật chưa có văn bản đồng ý thì để trong
\`src/media-gated/\` và đặt \`consent.obtained: false\`.
`;

writeFileSync('docs/truong-du-lieu.md', md);
console.log(`  ok  docs/truong-du-lieu.md — ${rows.length} trường cấp sản phẩm, ${blockTypes.length} loại khối`);
