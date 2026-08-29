/**
 * build.js
 *
 * 使い方:
 *   node build.js
 *
 * 動作:
 *   1. data.csv を読み込む
 *   2. shops/template.html をテンプレートとして読み込む
 *   3. content/{id}.json があれば固有コンテンツ(トピックス・注文例・写真等)を差し込む
 *   4. shops/{id}.html として出力する
 *
 * ディレクトリ構成(前提):
 *   project/
 *   ├── build.js
 *   ├── data.csv
 *   ├── index.html
 *   ├── style.css
 *   ├── app.js
 *   ├── sidebar.js
 *   ├── content/           ← 店舗ごとの固有コンテンツ(JSONファイル)
 *   │   ├── 001.json
 *   │   ├── 002.json
 *   │   └── ...
 *   └── shops/
 *       ├── template.html  ← 編集用テンプレート
 *       ├── 001.html       ← ビルド生成物
 *       └── ...
 */

const fs   = require('fs');
const path = require('path');
const { escapeHtml, parseCSVLine } = require('./utils.js');

// ─── パス設定 ────────────────────────────────────────────────
const CSV_PATH      = path.join(__dirname, 'data.csv');
const TEMPLATE_PATH = path.join(__dirname, 'shops', 'template.html');
const CONTENT_DIR   = path.join(__dirname, 'content');
const OUTPUT_DIR    = path.join(__dirname, 'shops');

// shop.id はファイル名・パスの一部として使うため、英数字・ハイフン・アンダースコアのみ許可する
const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;

// href / iframe src に埋め込むURLのスキームを検証する。
// javascript: / vbscript: / data: などの危険なスキームは無効化する(app.js の safeUrl と同等)。
function safeUrl(url) {
    if (!url) return '';
    if (/^\s*(javascript|vbscript|data):/i.test(url)) return '';
    return url;
}

// ─── サイト公開URL・SEO用ファイル ─────────────────────────────
// sitemap.xml / robots.txt に使う本番の公開URL(末尾スラッシュなし)。CNAME と一致させること。
const SITE_URL     = 'https://osaka-gekiyasu-db.com';
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');
const ROBOTS_PATH  = path.join(__dirname, 'robots.txt');

// クローラーが辿るべき固定ページ(トップページ + ガイド類)
const STATIC_PAGES = [
    '',                    // トップページ (= SITE_URL/)
    'guide/about.html',
    'guide/howto.html',
    'guide/tips.html',
    'guide/contact.html',
];

// "2026/07/04" → "2026-07-04"(sitemap の lastmod 用 W3C日付)。不正な値は空文字。
function toIsoDate(s) {
    const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec((s || '').trim());
    if (!m) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
}

// sitemap.xml を生成する。shopEntries = [{ url, lastmod }]
function writeSitemap(shopEntries) {
    // 全ページの最終更新日の最大値をトップ・ガイドの lastmod に使う
    const latest = shopEntries
        .map(e => e.lastmod)
        .filter(Boolean)
        .sort()
        .pop() || '';

    const urlTag = (loc, lastmod) =>
        `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`;

    const staticUrls = STATIC_PAGES.map(p => urlTag(`${SITE_URL}/${p}`, latest));
    const shopUrls   = shopEntries.map(e => urlTag(`${SITE_URL}/${e.url}`, e.lastmod));

    const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        [...staticUrls, ...shopUrls].join('\n') +
        `\n</urlset>\n`;

    fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
    console.log(`[OK] sitemap.xml(${STATIC_PAGES.length + shopEntries.length}URL)`);
}

// robots.txt を生成する(全許可 + sitemap の場所を明示)
function writeRobots() {
    const txt = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
    fs.writeFileSync(ROBOTS_PATH, txt, 'utf-8');
    console.log('[OK] robots.txt');
}

// ─── CSVパーサー ─────────────────────────────────────────────

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h.trim()] = (values[i] || '').trim(); });
        return obj;
    });
}

// ─── コンテンツHTMLビルダー ───────────────────────────────────

/** 店舗リンクテーブルを生成 */
function buildLinksTable(links) {
    if (!links) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    const hp        = safeUrl(links.hp);
    const instagram = safeUrl(links.instagram);
    const twitter   = safeUrl(links.twitter);
    const rows = [
        hp        ? `                        <tr><th>公式HP</th><td><a href="${escapeHtml(hp)}" target="_blank" rel="noopener noreferrer">公式サイト</a></td></tr>` : '',
        instagram ? `                        <tr><th>Instagram</th><td><a href="${escapeHtml(instagram)}" target="_blank" rel="noopener noreferrer">公式Instagram</a></td></tr>` : '',
        twitter   ? `                        <tr><th>X(Twitter)</th><td><a href="${escapeHtml(twitter)}" target="_blank" rel="noopener noreferrer">公式X(Twitter)</a></td></tr>` : '',
    ].filter(Boolean).join('\n');

    if (!rows) return `<p class="placeholder-text">準備中</p>`;
    return `<table class="shop-info-table">\n                        <tbody>\n${rows}\n                        </tbody>\n                    </table>`;
}

/** 閉店時の案内バナーを生成 */
function buildClosedNotice(status) {
    if (status !== '閉店') return '';
    return `<div class="closed-notice"><i class="mdi mdi-store-off-outline"></i> この店舗は閉店しました。掲載内容は営業当時の情報です。</div>`;
}

/** Google MapのiframeのsrcからGPS座標を抽出する(pbパラメータの !2d{経度}!3d{緯度} 形式)。取得できなければ null */
function extractGeoFromMapSrc(mapSrc) {
    if (!mapSrc) return null;
    const m = /!2d(-?[\d.]+)!3d(-?[\d.]+)/.exec(mapSrc);
    if (!m) return null;
    return {
        '@type': 'GeoCoordinates',
        latitude:  parseFloat(m[2]),
        longitude: parseFloat(m[1]),
    };
}

/** 店舗ページ用の構造化データ(JSON-LD)を生成する。
 *  掲載済みの情報(店名・エリア・予算・地図座標)のみを使い、評価やレビュー・営業時間など
 *  当サイトが保持していない情報は出力しない(Googleの構造化データガイドライン違反を避けるため)。
 *  閉店した店舗は営業中の飲食店として誤解を招くため出力しない。 */
function buildStructuredData(shop, content) {
    if (shop.status === '閉店') return '';

    const areaParts = shop.area.split('/');
    const addressLocality = areaParts.length > 1 ? areaParts[1] : areaParts[0];

    const data = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: shop.name,
        image: `${SITE_URL}/images/${shop.img}`,
        url: `${SITE_URL}/${shop.url}`,
        description: shop.subtitle,
        servesCuisine: 'Japanese',
        priceRange: shop.budget,
        address: {
            '@type': 'PostalAddress',
            addressLocality,
            addressCountry: 'JP',
        },
    };

    const geo = extractGeoFromMapSrc(content && content.mapSrc);
    if (geo) data.geo = geo;

    // </script> によるタグの早期終了を防ぐため "<" をエスケープする
    const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
    return `<script type="application/ld+json">\n${json}\n    </script>`;
}

/** 前後の店舗ページへのナビゲーションボタンを生成。shop が null の場合(先頭/末尾)は空文字を返す */
function buildShopNavLink(shop, direction) {
    if (!shop) return '';
    const dirHtml = direction === 'prev'
        ? `<i class="mdi mdi-chevron-left"></i>前の店舗`
        : `次の店舗<i class="mdi mdi-chevron-right"></i>`;
    return `<a href="${escapeHtml(shop.id)}.html" class="page-btn shop-pager-btn shop-pager-${direction}" title="${escapeHtml(shop.name)}">` +
           `<span class="shop-pager-dir">${dirHtml}</span>` +
           `<span class="shop-pager-name">${escapeHtml(shop.name)}</span>` +
           `</a>`;
}

/** Google Mapのiframeを生成 */
function buildMap(mapSrc) {
    const src = safeUrl(mapSrc);
    if (!src) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    return `<iframe src="${escapeHtml(src)}" width="100%" height="300" class="map-iframe" allowfullscreen="" loading="lazy" title="店舗の地図"></iframe>`;
}


/** トピックスのul>liを生成。各項目は { text, strike } 形式(旧形式の文字列も許容)。
 *  strike が true の項目は、情報が古くなったが削除はしない意図で取り消し線表示にする。 */
function buildTopics(topics) {
    if (!topics || topics.length === 0) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    const items = topics.map(t => {
        const item = typeof t === 'string' ? { text: t, strike: false } : t;
        const cls  = item.strike ? ' class="topic-strike"' : '';
        return `                    <li${cls}>${escapeHtml(item.text)}</li>`;
    }).join('\n');
    return `<ul>\n${items}\n                    </ul>`;
}

/** 注文例のリストを生成 */
/** 注文例1件分(合計金額欄)のテキストを生成。金額・人数・注釈をまとめて1行にする */
function buildOrderTotalText(order) {
    let text = escapeHtml(order.amount || '');
    if (order.persons) text += `(${escapeHtml(order.persons)})`;
    if (order.note)    text += `　※${escapeHtml(order.note)}`;
    return text;
}

/** 注文例1件分(明細行)のHTMLを生成。各アイテムは { name, price, qty, note } の構造化データ */
function buildOrderItemRows(items) {
    return (items || []).map(item => {
        const name     = escapeHtml(item.name || '');
        const price    = escapeHtml(item.price || '');
        const qtyCell  = escapeHtml(item.qty || '1');
        const noteHtml = item.note ? `<br><span class="order-note">※${escapeHtml(item.note)}</span>` : '';
        return `                        <tr><td class="order-name">${name}${noteHtml}</td><td class="order-price">${price}</td><td class="order-qty">${qtyCell}</td></tr>`;
    }).join('\n');
}

function buildOrders(orders) {
    if (!orders || orders.length === 0) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    const blocks = orders.map(order => {
        return `                    <div class="order-block">
                        <div class="order-total"><span class="price-tag">合計金額：${buildOrderTotalText(order)}</span></div>
                        <table class="order-table">
                            <thead>
                                <tr>
                                    <th class="order-name">メニュー</th>
                                    <th class="order-price">金額(円)</th>
                                    <th class="order-qty">数量</th>
                                </tr>
                            </thead>
                            <tbody>
${buildOrderItemRows(order.items)}
                            </tbody>
                        </table>
                    </div>`;
    }).join('\n');
    return blocks;
}

/** 写真リストを生成(ギャラリー形式：メイン表示エリア＋サムネイル横並び) */
function buildPhotos(photos) {
    if (!photos || photos.length === 0) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    const firstPhoto = photos[0];
    const thumbs = photos.map((photo, i) => {
        const activeClass = i === 0 ? ' active' : '';
        return `                    <li class="${activeClass.trim()}" data-src="${escapeHtml(photo.src)}" data-caption="${escapeHtml(photo.caption)}">
                        <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}" loading="lazy">
                    </li>`;
    }).join('\n');

    return `                    <div class="photo-gallery">
                        <ul class="photo-gallery-thumbs" id="photo-thumbs">
${thumbs}
                        </ul>
                        <p class="photo-gallery-caption" id="photo-main-caption">${escapeHtml(firstPhoto.caption)}</p>
                        <div class="photo-gallery-main" id="photo-main">
                            <img src="${escapeHtml(firstPhoto.src)}" alt="${escapeHtml(firstPhoto.caption)}" id="photo-main-img">
                        </div>
                    </div>
                    <script>
                    (function() {
                        var mainImg     = document.getElementById('photo-main-img');
                        var mainCaption = document.getElementById('photo-main-caption');
                        var thumbs      = document.getElementById('photo-thumbs');
                        if (!thumbs) return;
                        thumbs.addEventListener('click', function(e) {
                            var li = e.target.closest('li[data-src]');
                            if (!li) return;
                            mainImg.src          = li.dataset.src;
                            mainImg.alt          = li.dataset.caption;
                            mainCaption.textContent = li.dataset.caption;
                            thumbs.querySelectorAll('li').forEach(function(el) { el.classList.remove('active'); });
                            li.classList.add('active');
                        });
                    })();
                    </script>`;
}

// ─── テンプレート置換 ─────────────────────────────────────────
function render(template, shop, content, prevShop, nextShop) {
    const fullName  = `【${shop.area}】${shop.name}`;
    // area は "地方/エリア" の2階層を想定。3階層以上は地方名(先頭)を除いた残りを連結する。
    const areaParts = shop.area.split('/');
    const areaShort  = areaParts.length > 1 ? areaParts.slice(1).join('/') : areaParts[0];

    // CSVから埋め込む値
    const replacements = {
        '{{ID}}':          escapeHtml(shop.id),
        '{{FULL_NAME}}':   escapeHtml(fullName),
        '{{AREA}}':        escapeHtml(shop.area),
        '{{AREA_SHORT}}':  escapeHtml(areaShort),
        '{{NAME}}':        escapeHtml(shop.name),
        '{{SUBTITLE}}':    escapeHtml(shop.subtitle),
        '{{OTOSHI}}':      escapeHtml(shop.otoshi),
        '{{HAPPYHOUR}}':   escapeHtml(shop.happyhour),
        '{{SET}}':         escapeHtml(shop.set),
        '{{BUDGET}}':      escapeHtml(shop.budget),
        '{{PERSONS}}':     escapeHtml(shop.persons),
        '{{SMOKE}}':       escapeHtml(shop.smoke),
        '{{VISIT_DATE}}':  escapeHtml(shop.visitDate),
        '{{UPDATE_DATE}}': escapeHtml(shop.updateDate),
        '{{IMG}}':         escapeHtml(shop.img),
        '{{URL}}':         escapeHtml(shop.url),
        '{{STATUS_BANNER}}': buildClosedNotice(shop.status),
        '{{STRUCTURED_DATA}}': buildStructuredData(shop, content),
        '{{PREV_LINK}}':   buildShopNavLink(prevShop, 'prev'),
        '{{NEXT_LINK}}':   buildShopNavLink(nextShop, 'next'),
        '{{TAGS}}':        (shop.tags || '').split(' ').filter(Boolean).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(''),
        // JSONから埋め込む値(ファイルがなければ「準備中」)
        '{{LINKS_TABLE}}': buildLinksTable(content && content.links),
        '{{MAP}}':         buildMap(content && content.mapSrc),
        '{{TOPICS}}':      buildTopics(content && content.topics),
        '{{ORDERS}}':      buildOrders(content && content.orders),
        '{{PHOTOS}}':      buildPhotos(content && content.photos),
    };

    let html = template;
    for (const [placeholder, value] of Object.entries(replacements)) {
        html = html.split(placeholder).join(value);
    }
    return html;
}

// ─── メイン処理 ───────────────────────────────────────────────
function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`[ERROR] CSVが見つかりません: ${CSV_PATH}`);
        process.exit(1);
    }
    const shops = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));

    if (!fs.existsSync(TEMPLATE_PATH)) {
        console.error(`[ERROR] テンプレートが見つかりません: ${TEMPLATE_PATH}`);
        process.exit(1);
    }
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // id が有効な店舗のみを対象とする。data.csv の並び順 = サイト上の表示順(新着順)であり、
    // 「前の店舗」「次の店舗」ナビゲーションもこの並び順に基づく。
    const validShops = shops.filter(shop => {
        if (!shop.id) return false;
        if (!SAFE_ID_RE.test(shop.id)) {
            console.error(`[ERROR] 不正なidのためスキップします(英数字・ハイフン・アンダースコアのみ許可): "${shop.id}"`);
            return false;
        }
        return true;
    });

    let count = 0;
    const sitemapEntries = []; // sitemap.xml 用(生成に成功した店舗のみ)
    validShops.forEach((shop, i) => {
        const prevShop = i > 0 ? validShops[i - 1] : null;
        const nextShop = i < validShops.length - 1 ? validShops[i + 1] : null;

        // content/{id}.json があれば読み込む、なければ null
        const contentPath = path.join(CONTENT_DIR, `${shop.id}.json`);
        let content = null;
        if (fs.existsSync(contentPath)) {
            try {
                content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
                console.log(`[OK] ${shop.id}.html(コンテンツあり)`);
            } catch (err) {
                console.error(`[ERROR] content/${shop.id}.json の解析に失敗しました。このファイルをスキップして「準備中」で生成します: ${err.message}`);
                content = null;
            }
        } else {
            console.log(`[--] ${shop.id}.html(content/${shop.id}.json なし → 準備中で生成)`);
        }

        const html    = render(template, shop, content, prevShop, nextShop);
        const outPath = path.join(OUTPUT_DIR, `${shop.id}.html`);
        fs.writeFileSync(outPath, html, 'utf-8');
        count++;

        // sitemap 用エントリ。url列があればそれを、無ければ shops/{id}.html を使う
        const relUrl = (shop.url && shop.url.trim()) || `shops/${shop.id}.html`;
        sitemapEntries.push({ url: relUrl, lastmod: toIsoDate(shop.updateDate) });
    });

    // SEO用ファイルを生成
    writeSitemap(sitemapEntries);
    writeRobots();

    console.log(`\n✅ ${count}件のHTMLを生成しました。`);
}

main();
