const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { WORDS } = require("../data/words.js");
const { SITE, build } = require("../scripts/build-pages.js");

const ROOT = path.join(__dirname, "..");
const files = build();

test("言葉ごとのページ・sitemap・トップの検索向け情報が最新（古ければ node scripts/build-pages.js）", () => {
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(ROOT, p);
    assert.ok(fs.existsSync(full), `${p} がない`);
    assert.equal(fs.readFileSync(full, "utf8"), content, `${p} が古い`);
  }
  for (const dir of ["w", "en/w"]) {
    for (const id of fs.readdirSync(path.join(ROOT, dir))) {
      if (id === "index.html") continue;
      assert.ok(WORDS.some((w) => w.id === id), `${dir}/${id} はもう無い語のページ`);
    }
  }
});

test("どの語にも日本語と英語のページがあり、sitemap に載っている", () => {
  const sitemap = files["sitemap.xml"];
  for (const w of WORDS) {
    for (const p of [`w/${w.id}/`, `en/w/${w.id}/`]) {
      assert.ok(files[`${p}index.html`], `${p} がない`);
      assert.ok(sitemap.includes(`<loc>${SITE}/${p}</loc>`), `${p} が sitemap にない`);
    }
  }
});

test("ページごとに題名・説明・正規 URL がそろい、題名は重ならない", () => {
  const titles = new Set();
  for (const [p, html] of Object.entries(files)) {
    if (!p.endsWith(".html")) continue;
    const title = html.match(/<title>([^<]+)<\/title>/);
    assert.ok(title, `${p} に title がない`);
    assert.ok(!titles.has(title[1]), `題名が重なっている: ${title[1]}`);
    titles.add(title[1]);
    assert.match(html, /<meta name="description" content="[^"]{20,}">/, `${p} の description`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/);
    assert.ok(canonical, `${p} に canonical がない`);
    const expected = `${SITE}/${p.replace(/index\.html$/, "")}`;
    assert.equal(canonical[1], expected, `${p} の canonical`);
  }
});
