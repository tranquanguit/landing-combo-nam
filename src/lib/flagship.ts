/**
 * Dữ liệu dẫn xuất cho bản trình bày `flagship`.
 *
 * Không có nội dung nào sống ở đây. Mọi con số đi ra từ file nội dung — đúng
 * quy tắc của site: cái nào có số thì ghi số, không có thì bỏ số ra. Hàm này
 * chỉ TÁCH con số khỏi tên hoạt chất để đặt nó ở cỡ hiển thị; nếu tên không
 * mang số nào thì trả `value: null` và component không vẽ ô số.
 */

export interface Dose {
  /** Tên hoạt chất, đã bỏ phần nồng độ: "Tranexamic Acid". */
  name: string;
  /** Chuỗi số đúng như in: "3", "1000", "0,5". Không tự quy đổi đơn vị. */
  value: string | null;
  /** "%" hoặc "ppm"… đúng như in. */
  unit: string | null;
}

const DOSE = /(\d+(?:[.,]\d+)?)\s*(%|ppm|mg\/g|mg|IU)/i;

export function splitDose(label: string): Dose {
  const m = label.match(DOSE);
  if (!m) return { name: label.trim(), value: null, unit: null };
  const name = (label.slice(0, m.index) + label.slice((m.index ?? 0) + m[0].length))
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { name, value: m[1], unit: m[2] };
}

/**
 * Gom hoạt chất theo sản phẩm chứa nó, giữ thứ tự khai trong file.
 * Cùng quy tắc với khối `ingredients` chuẩn.
 */
export function groupRows<T extends { inProduct?: string }>(rows: T[]) {
  const out: { label: string | null; rows: T[] }[] = [];
  for (const r of rows) {
    const label = r.inProduct ?? null;
    const last = out[out.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else out.push({ label, rows: [r] });
  }
  return out;
}

/**
 * Những con số đặt lên sân khấu hero: hoạt chất ĐẦU TIÊN có nồng độ của mỗi
 * sản phẩm trong bộ — thứ tự khai trong bảng thành phần chính là thứ tự ưu
 * tiên mà người biên tập đã chọn. Không có bảng thì không có con số nào.
 */
export function heroDoses(product: any, perGroup = 1) {
  const ing = product.blocks.find((b: any) => b.type === 'ingredients');
  if (!ing) return [];
  return groupRows(ing.rows as any[]).flatMap((g) =>
    g.rows
      .map((r: any) => ({ ...splitDose(r.name), product: g.label }))
      .filter((d) => d.value)
      .slice(0, perGroup),
  );
}
