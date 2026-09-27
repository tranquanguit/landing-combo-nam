/**
 * Cổng LCP + CLS trên khung nhìn đầu, 4G mô phỏng, DPR2.
 *
 * Repo đã có cổng INP (tests/inp.mjs) và cổng byte (check-budget), nhưng
 * chưa có cổng nào gác LCP hay CLS. Vòng QA vừa rồi thêm CTA trong thân
 * trang, một khối chọn mới, và một cột bám khi cuộn — đúng ba thứ có khả
 * năng gây dịch chuyển bố cục. Đo thì CLS = 0, nhưng "đo một lần thấy ổn"
 * không phải là một cổng.
 *
 * Ngưỡng lấy theo mốc "tốt" của Core Web Vitals: LCP <= 2500ms, CLS <= 0.1.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
const ROOT=process.cwd();
const { launchBrowser } = await import('../tests/_launch.mjs');
const require=createRequire(import.meta.url);const { chromium }=require('playwright');
const PORT=8991;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
const pages=createServer((q,r)=>{let rel=decodeURIComponent(new URL(q.url,'http://x').pathname);
 if(!extname(rel))rel=join(rel,'index.html');const f=join(ROOT,'dist',rel);
 if(!existsSync(f)){r.writeHead(404);r.end('x');return;}
 r.writeHead(200,{'Content-Type':MIME[extname(f)]??'application/octet-stream'});r.end(readFileSync(f));});
await new Promise(r=>pages.listen(PORT,r));
const b=await launchBrowser(chromium,{headless:true});
console.log('\n══ Hiệu năng khung nhìn đầu — 390x844, mạng 4G mô phỏng ══\n');
const results = [];
for(const route of ['/combo-nam/','/nam-tham/','/']){
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const page=await ctx.newPage();
  const cdp=await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:70,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
  await page.goto(`http://localhost:${PORT}${route}`,{waitUntil:'load',timeout:45000});
  await page.waitForTimeout(2500);
  const m=await page.evaluate(()=>new Promise(res=>{
    let lcp=0,cls=0;
    try{new PerformanceObserver(l=>{for(const e of l.getEntries())lcp=Math.max(lcp,e.startTime);}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
    try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch{}
    setTimeout(()=>{
      const nav=performance.getEntriesByType('navigation')[0]||{};
      const fcp=(performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime||0;
      res({lcp:Math.round(lcp),cls:+cls.toFixed(4),fcp:Math.round(fcp),
        dom:Math.round(nav.domContentLoadedEventEnd||0),
        imgs:document.images.length,
        docH:document.documentElement.scrollHeight});
    },900);
  }));
  results.push({route, ...m});
  console.log(`${route.padEnd(14)} LCP ${String(m.lcp+'ms').padStart(7)} · CLS ${String(m.cls).padStart(6)} · FCP ${String(m.fcp+'ms').padStart(6)} · ${m.imgs} ảnh · trang cao ${m.docH}px`);
  await ctx.close();
}

await b.close(); pages.close();

const LCP_MAX = 2500, CLS_MAX = 0.1;
const bad = results.filter((r) => r.lcp > LCP_MAX || r.cls > CLS_MAX);
console.log();
for (const r of results) {
  const okk = r.lcp <= LCP_MAX && r.cls <= CLS_MAX;
  console.log('  ' + (okk ? 'ĐẠT ' : 'TRƯỢT') + '  ' + r.route.padEnd(16) + 'LCP ' + r.lcp + 'ms/' + LCP_MAX + ' · CLS ' + r.cls + '/' + CLS_MAX);
}
console.log(String.fromCharCode(10) + '  ' + (results.length - bad.length) + '/' + results.length + ' trang đạt.' + String.fromCharCode(10));
if (bad.length) process.exit(1);
