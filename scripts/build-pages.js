// 検索エンジンと SNS のために、言葉ごとの静的なページと sitemap.xml・robots.txt を作る。
// アプリ本体は #w-<id> のようなハッシュで画面を切り替えるので、検索エンジンからは
// トップの2ページ（日本語・英語）しか見えない。そこで語ごとに中身の入った HTML を書き出しておく。
//
//   node scripts/build-pages.js   … 書き出す
//
// data/words.js・data/words.en.js を直したら必ず実行すること（test/pages.test.js が古いままだと失敗する）。
const fs = require("fs");
const path = require("path");
const { GENRES, WORDS } = require("../data/words.js");
const { WORDS: EN_WORDS, GENRES: GENRES_EN } = require("../data/words.en.js");
const { dateForIndex } = require("../js/daily.js");
const { textHtml, termHtml } = require("../js/phrase.js");

// 公開している URL（末尾のスラッシュなし）。独自ドメインに移したらここを書き換えて再実行する
const SITE = "https://nichinichikoregengaku.akm7339gil.workers.dev";

const ROOT = path.join(__dirname, "..");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = (p) => SITE + "/" + p;

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// 言語ごとの文言
const LANGS = {
  ja: {
    dir: "",
    site: "日々是衒学",
    siteHtml: '日々是衒学<span class="appbar-reading">にちにちこれげんがく</span>',
    tagline: "毎日ひとつ、知ると世界の見え方が少し変わる言葉を。",
    plain: (s) => esc(s),
    termHtml: (s) => termHtml(s),
    textHtml: (s) => textHtml(s),
    genre: (g) => g,
    title: (w) => `${w.term}とは？ 意味と由来｜日々是衒学`,
    when: (n, d) => `第${n}日（${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日・${WEEKDAYS[d.getDay()]}）の言葉`,
    labels: ["ひとことで", "由来", "見え方が変わるところ", "使ってみる"],
    genreLabel: (g) => `ジャンル：${g}`,
    flex: (s) => `「${s.replace(/。$/, "")}」`,
    back: "ことば帳",
    cta: "日々是衒学では、こんな言葉が毎日ひとつ届きます。",
    ctaButton: "今日の言葉を見る",
    prev: "前の言葉",
    next: "次の言葉",
    other: { href: "en/", label: "Read in English", lang: "en" },
    tabs: ["今日", "これまで", "ことば帳"],
    tabsLabel: "画面の切り替え",
    neighbors: "前後の言葉",
    indexTitle: (n) => `ことば帳：全${n}語の一覧｜日々是衒学`,
    indexHeading: "ことば帳",
    indexLead: (n) => `「日々是衒学」でこれまでに、そしてこれから登場する全${n}語。ジャンルごとに並べています。`,
    fonts:
      "https://fonts.googleapis.com/css2?family=EB+Garamond:ital@1&family=Shippori+Mincho:wght@500;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap",
    locale: "ja_JP",
  },
  en: {
    dir: "en/",
    site: "Know-It-All Daily",
    siteHtml: "Know-It-All Daily",
    tagline: "One word a day for the gloriously pedantic.",
    plain: (s) => esc(s),
    termHtml: (s) => esc(s),
    textHtml: (s) => esc(s),
    genre: (g) => GENRES_EN[g] || g,
    title: (w) => `${w.term}: meaning and origin | Know-It-All Daily`,
    when: (n, d) => `Word of the day for ${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} (Day ${n})`,
    labels: ["In short", "The story", "The lens", "Drop it casually"],
    genreLabel: (g) => `Category: ${g}`,
    flex: (s) => `“${s}”`,
    back: "Lexicon",
    cta: "Know-It-All Daily brings you one word like this every day.",
    ctaButton: "See today’s word",
    prev: "Previous word",
    next: "Next word",
    other: { href: "", label: "日本語で読む", lang: "ja" },
    tabs: ["Today", "So far", "Lexicon"],
    tabsLabel: "Sections",
    neighbors: "More words",
    indexTitle: (n) => `Lexicon: all ${n} words | Know-It-All Daily`,
    indexHeading: "Lexicon",
    indexLead: (n) => `All ${n} words on Know-It-All Daily, past and upcoming, grouped by category.`,
    fonts:
      "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,500;0,600;0,700;1,400&family=Shippori+Mincho:wght@700;800&display=swap",
    locale: "en_US",
  },
};

// 言語ごとの語（英語は日本語版の id と genre を引き継ぐ）
function wordsFor(lang) {
  if (lang === "ja") return WORDS;
  return WORDS.map((w) => ({ ...EN_WORDS[w.id], id: w.id, genre: w.genre }));
}

// 検索結果に出る説明は、長すぎると途中で切られるので短めに整える
function description(text, max) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/[、。,.\s]+$/, "") + "…";
}

function head({ lang, title, desc, canonical, alternates, depth, type, jsonld }) {
  const L = LANGS[lang];
  const up = "../".repeat(depth);
  const alt = alternates
    .map(([hl, href]) => `<link rel="alternate" hreflang="${hl}" href="${href}">`)
    .join("\n");
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${alt}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(L.site)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${L.locale}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#e6eae6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101418" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${up}icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="${up}icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${L.fonts}">
<link rel="stylesheet" href="${up}style.css">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>
</head>`;
}

function tabbar(lang, app) {
  const L = LANGS[lang];
  const icons = [
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v3.5h3.5"/><path d="M12 8v4.5l3 1.8"/>',
    '<path d="M6.5 3H19v15H6.5a2 2 0 0 0 0 4H19"/><path d="M4.5 20V5a2 2 0 0 1 2-2"/>',
  ];
  const hrefs = ["#today", "#history", "#words"];
  const tabs = L.tabs
    .map(
      (label, i) => `      <a class="tab" href="${app}${hrefs[i]}"${i === 2 ? ' aria-current="page"' : ""}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${icons[i]}</svg>
        <span>${label}</span>
      </a>`
    )
    .join("\n");
  return `  <nav class="tabbar" aria-label="${L.tabsLabel}">
    <div class="tabbar-inner">
${tabs}
    </div>
  </nav>`;
}

// 見出し語が長いときは、一番長い文節が一行に収まるまで字を小さくする（アプリの fitTerm と同じ）
const FIT_TERM = `<script>
(function () {
  var el = document.querySelector(".term");
  function fit() {
    if (!el || !el.offsetWidth) return;
    el.style.fontSize = "";
    el.classList.remove("squeezed");
    var size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && size > 18) { size -= 1; el.style.fontSize = size + "px"; }
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add("squeezed");
  }
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  addEventListener("resize", fit);
})();
</script>`;

function wordPage(lang, words, i) {
  const L = LANGS[lang];
  const w = words[i];
  const genre = L.genre(w.genre);
  const path_ = `${L.dir}w/${w.id}/`;
  const otherDir = lang === "ja" ? "en/" : "";
  const desc = description(w.gist, lang === "ja" ? 110 : 155);
  const title = L.title(w);
  const app = "../../"; // 言語ごとのアプリのトップ
  const prev = words[(i - 1 + words.length) % words.length];
  const next = words[(i + 1) % words.length];
  const seal = w.genre
    .split("・")
    .map((part) => `<span class="seal-col">${esc([...part].join("\n"))}</span>`)
    .join("");
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        "@id": url(path_) + "#term",
        name: w.term,
        ...(w.original ? { alternateName: w.original } : {}),
        description: w.gist,
        url: url(path_),
        inLanguage: lang,
        inDefinedTermSet: { "@type": "DefinedTermSet", name: L.site, url: url(L.dir) },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: L.site, item: url(L.dir) },
          { "@type": "ListItem", position: 2, name: L.back, item: url(`${L.dir}w/`) },
          { "@type": "ListItem", position: 3, name: w.term, item: url(path_) },
        ],
      },
    ],
  };
  const row = (word, label) => `      <li><a class="row" href="../${word.id}/">
        <span class="row-main"><span class="row-date">${label}</span><span class="row-term jp">${L.termHtml(word.term)}</span></span>
      </a></li>`;

  return `${head({
    lang,
    title,
    desc,
    canonical: url(path_),
    alternates: [
      ["ja", url(`w/${w.id}/`)],
      ["en", url(`en/w/${w.id}/`)],
      ["x-default", url(`en/w/${w.id}/`)],
    ],
    depth: lang === "ja" ? 2 : 3,
    type: "article",
    jsonld,
  })}
<body>
<div class="app" lang="${lang}">
  <header class="appbar">
    <a class="appbar-back" href="../">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      <span>${L.back}</span>
    </a>
    <a class="appbar-title" href="${app}">${L.siteHtml}</a>
  </header>

  <main class="view">
    <p class="detail-when">${L.when(i + 1, dateForIndex(i))}</p>

    <article class="card">
      <div class="card-head">
        <div class="headword">
          <h1 class="term jp">${L.termHtml(w.term)}</h1>
${w.reading ? `          <p class="reading">${esc(w.reading)}</p>\n` : ""}${w.original ? `          <p class="original"${lang === "ja" ? ' lang="en"' : ""}>${esc(w.original)}</p>\n` : ""}${lang === "en" ? `          <p class="genre-name">${esc(genre)}</p>\n` : ""}        </div>
        <p class="seal"><span class="sr-only">${esc(L.genreLabel(genre))}</span><span class="seal-cols" aria-hidden="true">${seal}</span></p>
      </div>
      <section class="gist-block">
        <h2 class="label">${L.labels[0]}</h2>
        <p class="gist jp">${L.textHtml(w.gist)}</p>
      </section>
      <section class="block">
        <h2 class="label">${L.labels[1]}</h2>
        <p class="jp">${L.textHtml(w.story)}</p>
      </section>
      <section class="block">
        <h2 class="label">${L.labels[2]}</h2>
        <p class="jp">${L.textHtml(w.lens)}</p>
      </section>
      <section class="block flex-block">
        <h2 class="label">${L.labels[3]}</h2>
        <p class="flex-line jp">${L.textHtml(L.flex(w.flex))}</p>
      </section>
    </article>

    <section class="page-cta">
      <p class="jp">${L.textHtml(L.cta)}</p>
      <a class="pill-btn" href="${app}">${L.ctaButton}</a>
    </section>

    <h2 class="label page-neighbors">${L.neighbors}</h2>
    <ol class="list">
${row(prev, L.prev)}
${row(next, L.next)}
    </ol>

    <p class="lang-switch"><a href="${lang === "ja" ? "../../" : "../../../"}${otherDir}w/${w.id}/" lang="${L.other.lang}">${L.other.label}</a></p>
  </main>

${tabbar(lang, app)}
</div>
${FIT_TERM}
</body>
</html>
`;
}

function indexPage(lang, words) {
  const L = LANGS[lang];
  const path_ = `${L.dir}w/`;
  const sections = GENRES.map((g) => {
    const items = words
      .filter((w) => w.genre === g)
      .map(
        (w) => `      <li><a class="row" href="${w.id}/">
        <span class="row-main"><span class="row-term jp">${L.termHtml(w.term)}</span><span class="row-gist jp">${L.textHtml(w.gist)}</span></span>
      </a></li>`
      )
      .join("\n");
    return `    <h2 class="label page-genre">${esc(L.genre(g))}</h2>
    <ol class="list">
${items}
    </ol>`;
  }).join("\n\n");
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: L.site,
    description: L.tagline,
    url: url(path_),
    inLanguage: lang,
    hasDefinedTerm: words.map((w) => ({ "@type": "DefinedTerm", name: w.term, url: url(`${path_}${w.id}/`) })),
  };
  return `${head({
    lang,
    title: L.indexTitle(words.length),
    desc: L.indexLead(words.length),
    canonical: url(path_),
    alternates: [
      ["ja", url("w/")],
      ["en", url("en/w/")],
      ["x-default", url("en/w/")],
    ],
    depth: lang === "ja" ? 1 : 2,
    type: "website",
    jsonld,
  })}
<body>
<div class="app" lang="${lang}">
  <header class="appbar">
    <a class="appbar-title" href="../">${L.siteHtml}</a>
  </header>

  <main class="view">
    <h1 class="view-title">${L.indexHeading}</h1>
    <p class="view-lead jp">${L.textHtml(L.indexLead(words.length))}</p>

${sections}

    <p class="lang-switch"><a href="${lang === "ja" ? "../en/w/" : "../../w/"}" lang="${L.other.lang}">${L.other.label}</a></p>
  </main>

${tabbar(lang, "../")}
</div>
</body>
</html>
`;
}

function sitemap() {
  const entry = (ja, en) =>
    [ja, en]
      .map(
        (loc) => `  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="ja" href="${ja}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>
  </url>`
      )
      .join("\n");
  const urls = [
    entry(url(""), url("en/")),
    entry(url("w/"), url("en/w/")),
    ...WORDS.map((w) => entry(url(`w/${w.id}/`), url(`en/w/${w.id}/`))),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}

function robots() {
  return `User-agent: *
Allow: /

Sitemap: ${url("sitemap.xml")}
`;
}

// アプリのトップ（index.html・en/index.html）の <!-- seo:start --> から <!-- seo:end --> までに入れる、検索と SNS 向けの情報
function appHead(lang) {
  const L = LANGS[lang];
  const self = url(L.dir);
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: L.site,
    alternateName: lang === "ja" ? "にちにちこれげんがく" : undefined,
    description: L.tagline,
    url: self,
    inLanguage: lang,
  };
  return `<!-- seo:start -->
<link rel="canonical" href="${self}">
<link rel="alternate" hreflang="ja" href="${url("")}">
<link rel="alternate" hreflang="en" href="${url("en/")}">
<link rel="alternate" hreflang="x-default" href="${url("en/")}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(L.site)}">
<meta property="og:title" content="${esc(L.site)}">
<meta property="og:description" content="${esc(L.tagline)}">
<meta property="og:url" content="${self}">
<meta property="og:locale" content="${L.locale}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<!-- seo:end -->`;
}

function withAppHead(file, lang) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  return html.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, appHead(lang));
}

// 書き出すファイルの一覧（パス → 中身）。テストからも使う
function build() {
  const files = {};
  for (const lang of ["ja", "en"]) {
    const L = LANGS[lang];
    const words = wordsFor(lang);
    files[`${L.dir}w/index.html`] = indexPage(lang, words);
    words.forEach((w, i) => {
      files[`${L.dir}w/${w.id}/index.html`] = wordPage(lang, words, i);
    });
  }
  files["index.html"] = withAppHead("index.html", "ja");
  files["en/index.html"] = withAppHead("en/index.html", "en");
  files["sitemap.xml"] = sitemap();
  files["robots.txt"] = robots();
  return files;
}

module.exports = { SITE, build };

if (require.main === module) {
  // 消えた語のページが残らないよう、w/ と en/w/ は作り直す
  for (const dir of ["w", "en/w"]) fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });
  const files = build();
  for (const [p, content] of Object.entries(files)) {
    const full = path.join(ROOT, p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  console.log(`${Object.keys(files).length} ファイルを書き出しました`);
}
