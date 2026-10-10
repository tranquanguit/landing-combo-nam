/**
 * Lệnh vận hành CSDL nội dung.
 *
 *   node --import ./scripts/shim/register.mjs server/cli.ts <lệnh>
 *
 *   migrate                    áp db/pg/*.sql
 *   import [--only-new]        nạp nội dung + ảnh đang có trong src/ vào CSDL. Mặc định GHI ĐÈ bản trùng mã;
 *                              --only-new chỉ thêm cái chưa có (dùng khi phát hành bản code mới)
 *   export [--out <thư mục>]   ghi CSDL ra cây src/ (mặc định: thư mục hiện tại) — kéo nội dung
 *                              đang chạy thật về repo để commit
 *   validate                   kiểm mọi nội dung trong CSDL bằng schema, in lỗi tiếng Việt
 *   user <tên> [admin|editor]  tạo / đặt lại mật khẩu; mật khẩu đọc từ biến ADMIN_PASSWORD
 *   publish                    xuất bản một lần (như nút trên trang quản trị)
 */
import { join, resolve } from 'node:path';
import { connect, migrate } from './lib/db.ts';
import { importFromFiles, exportToFiles, validate } from './lib/content.ts';
import { createUser } from './lib/auth.ts';
import { publish } from './lib/publish.ts';

const ROOT = process.cwd();
const [cmd, ...args] = process.argv.slice(2);
const sql = await connect();
await migrate(sql, join(ROOT, 'db/pg'), console.log);
let code = 0;
try {
  if (cmd === 'migrate') console.log('xong');
  else if (cmd === 'import') console.log(await importFromFiles(sql, ROOT, 'cli', args.includes('--only-new')));
  else if (cmd === 'export') {
    const i = args.indexOf('--out');
    console.log(await exportToFiles(sql, i >= 0 ? resolve(args[i + 1]) : ROOT));
  } else if (cmd === 'validate') {
    const rows = (await sql.query<any>('SELECT collection, entry_id, data FROM content_entries ORDER BY 1, 2')).rows;
    let bad = 0;
    for (const r of rows) {
      const issues = await validate(ROOT, r.collection, r.data);
      if (issues.length) { bad++; console.log(`✗ ${r.collection}/${r.entry_id}`); for (const x of issues) console.log(`    ${x.path}: ${x.message}`); }
    }
    console.log(`${rows.length - bad}/${rows.length} hợp lệ`);
    code = bad ? 1 : 0;
  } else if (cmd === 'user') {
    const [name, role = 'editor'] = args;
    const pw = process.env.ADMIN_PASSWORD;
    if (!name || !pw) throw new Error('Dùng: ADMIN_PASSWORD=... cli.ts user <tên> [admin|editor]');
    await createUser(sql, name.toLowerCase(), pw, role === 'admin' ? 'admin' : 'editor');
    console.log(`đã lưu tài khoản ${name} (${role})`);
  } else if (cmd === 'publish') {
    const r = await publish(sql, ROOT, 'cli');
    console.log(r.log); code = r.ok ? 0 : 1;
  } else {
    console.log('Lệnh: migrate | import [--only-new] | export [--out dir] | validate | user <tên> [admin|editor] | publish');
    code = cmd ? 1 : 0;
  }
} catch (e) { console.error((e as Error).message); code = 1; }
await sql.close();
process.exit(code);
