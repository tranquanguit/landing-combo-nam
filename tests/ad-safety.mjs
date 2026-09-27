/**
 * Chứng minh MỌI luật quảng cáo thật sự bắt được cái nó nói là bắt.
 *
 * Bài học đắt của dự án: một hàng rào không khớp gì cả trông y hệt một hàng
 * rào không có vi phạm nào. Cả hai đều xanh, và chỉ một trong hai là thật.
 * Nên mỗi luật trong AD_RULES phải có ÍT NHẤT một câu mồi mà nó bắt được, và
 * cổng này đỏ nếu có luật nào không có mồi — kể cả luật mới thêm sau này.
 *
 * Chạy: node --experimental-strip-types tests/ad-safety.mjs
 */
import { AD_RULES, findAdRisks, findUnsupportedAngles, adPolicyProfile } from '../src/lib/ad-safety.ts';

let pass = 0;
const fail = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ĐẠT  ${name.padEnd(52)} ${detail}`); }
  else { fail.push(name); console.log(`  LỖI  ${name.padEnd(52)} ${detail}`); }
};

/* ---------- 1. Mỗi luật phải bắt được mồi của nó ---------- */
/* Những câu dưới đây CỐ TÌNH vi phạm. Chúng chỉ tồn tại trong tệp kiểm thử,
   không nằm trong file nội dung nào, nên hàng rào claims không đụng tới. */
const BAIT = {
  'openai-affiliation': 'San pham duoc ChatGPT de xuat cho da nam',
  'ai-endorsement': 'Duoc AI khuyen dung cho moi loai da',
  'condition-as-promise': 'Kem tri nam tan goc chi sau mot lieu trinh',
  'medical-authority': 'Bac si da lieu khuyen dung san pham nay',
  'absolute-outcome': 'Cam ket hieu qua hoac hoan tien neu khong khoi',
  'timed-outcome': 'Sau 14 ngay la het han nam tren ma',
  'superlative': 'Kem duong tot nhat thi truong Viet Nam',
  'pressure': 'Nhanh tay, chi con 5 suat trong hom nay',
  'sensitive-targeting': 'Neu ban bi nam thi day la thu ban can',
  'before-after': 'Anh truoc va sau cua khach hang that',
};

for (const rule of AD_RULES) {
  const bait = BAIT[rule.id];
  if (!bait) {
    ok(`luật "${rule.id}" có câu mồi`, false, 'THIẾU mồi — thêm vào BAIT');
    continue;
  }
  const hits = findAdRisks(bait, 'test');
  ok(`luật "${rule.id}" bắt được mồi`, hits.some((h) => h.ruleId === rule.id),
    hits.length ? `khớp: "${hits[0].match}"` : 'KHÔNG khớp gì');
}

/* ---------- 2. Không báo động giả trên câu sạch ---------- */
const CLEAN = [
  'Kem và serum dùng cùng nhau, công khai tỉ lệ từng hoạt chất',
  'Bảy màng lọc gọi đúng tên, công khai trên bảng thành phần',
  'Gel chấm điểm, không phải kem bôi toàn mặt',
  'Giao tận nơi, kiểm tra hàng rồi mới trả tiền',
  'Bước cuối buổi sáng, và bôi lại giữa ngày',
];
for (const c of CLEAN) {
  const hits = findAdRisks(c, 'clean');
  ok(`câu sạch không bị báo nhầm`, hits.length === 0,
    hits.length ? `báo nhầm "${hits[0].match}" (${hits[0].ruleId})` : c.slice(0, 40) + '…');
}

/* ---------- 3. Chữ không dấu vẫn bị bắt ---------- */
ok('bắt được cả khi viết không dấu',
  findAdRisks('kem tri nam tan goc', 'x').length > 0,
  'copy quảng cáo VN viết không dấu là chuyện bình thường');

/* ---------- 4. Toàn vẹn trang đích: lời hứa lạc đề bị phát hiện ---------- */
const product = {
  name: 'Kem chống nắng',
  blocks: [{ type: 'hero', heading: 'Bảy màng lọc, gọi đúng tên từng cái', lead: 'Bước cuối buổi sáng.' }],
  adContext: {
    approvedAngles: [
      'Bảy màng lọc gọi đúng tên',                      // có trong trang
      'Bổ sung collagen đường uống cho tóc và móng',    // hoàn toàn lạc đề
    ],
  },
};
const unsupported = findUnsupportedAngles(product);
ok('lời hứa lạc đề bị phát hiện', unsupported.length === 1 && unsupported[0].includes('collagen'),
  `phát hiện ${unsupported.length}`);
ok('lời hứa có nội dung chống lưng thì không bị báo',
  !unsupported.some((a) => a.includes('màng lọc')), 'đúng');

/* ---------- 5. Xếp loại không bao giờ nói "đã duyệt" ---------- */
const bad = adPolicyProfile({
  name: 'X', seo: { title: 'Kem tri nam tan goc', description: 'd' },
  blocks: [{ type: 'hero', heading: 'h', lead: 'l', usp: [] }],
});
ok('vi phạm mức chặn thì trạng thái là "not-suitable"', bad.status === 'not-suitable', bad.status);
const clean = adPolicyProfile({
  name: 'X', seo: { title: 'Kem chống nắng bảy màng lọc', description: 'd' },
  storyArchetype: 'single-product',
  compliance: { productNotificationNumber: '123/45' },
  adContext: { approvedAngles: [], primaryNeed: 'n', audienceSituations: [] },
  blocks: [{ type: 'hero', heading: 'Bảy màng lọc', lead: 'Bước cuối buổi sáng', usp: [] }],
});
ok('trạng thái tốt nhất vẫn là "ready-for-review"', clean.status === 'ready-for-review', clean.status);

console.log(`\n${pass}/${pass + fail.length} phép thử đạt.`);
if (fail.length) {
  console.error('\nLỗi:\n  ' + fail.join('\n  ') + '\n');
  process.exit(1);
}
