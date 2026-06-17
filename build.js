/**
 * build.js
 *
 * 使い方:
 *   node build.js
 *
 * 動作:
 *   1. data.csv を読み込む
 *   2. shops/template.html をテンプレートとして読み込む
 *   3. content/{id}.json があれば固有コンテンツ（トピックス・注文例・写真等）を差し込む
 *   4. shops/{id}.html として出力する
 *
 * ディレクトリ構成（前提）:
 *   project/
 *   ├── build.js
 *   ├── data.csv
 *   ├── index.html
 *   ├── style.css
 *   ├── app.js
 *   ├── sidebar.js
 *   ├── content/           ← 店舗ごとの固有コンテンツ（JSONファイル）
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

// ─── パス設定 ────────────────────────────────────────────────
const CSV_PATH      = path.join(__dirname, 'data.csv');
const TEMPLATE_PATH = path.join(__dirname, 'shops', 'template.html');
const CONTENT_DIR   = path.join(__dirname, 'content');
const OUTPUT_DIR    = path.join(__dirname, 'shops');

// ─── CSVパーサー ─────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h.trim()] = (values[i] || '').trim(); });
        return obj;
    });
}

// ─── コンテンツHTMLビルダー ───────────────────────────────────

/** 店舗リンクテーブルを生成 */
function buildLinksTable(links) {
    if (!links) {
        return `<p style="color:#999;">準備中</p>`;
    }
    const rows = [
        links.hp        ? `                        <tr><th>公式HP</th><td><a href="${links.hp}" target="_blank" rel="noopener noreferrer">公式サイト</a></td></tr>` : '',
        links.instagram ? `                        <tr><th>Instagram</th><td><a href="${links.instagram}" target="_blank" rel="noopener noreferrer">公式Instagram</a></td></tr>` : '',
        links.twitter   ? `                        <tr><th>X(Twitter)</th><td><a href="${links.twitter}" target="_blank" rel="noopener noreferrer">公式X(Twitter)</a></td></tr>` : '',
    ].filter(Boolean).join('\n');

    if (!rows) return `<p style="color:#999;">準備中</p>`;
    return `<table class="shop-info-table">\n                        <tbody>\n${rows}\n                        </tbody>\n                    </table>`;
}

/** Google Mapのiframeを生成 */
function buildMap(mapSrc) {
    if (!mapSrc) {
        return `<p style="color:#999;">準備中</p>`;
    }
    return `<iframe src="${mapSrc}" width="100%" height="300" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;
}


/** トピックスのul>liを生成 */
function buildTopics(topics) {
    if (!topics || topics.length === 0) {
        return `<p style="color:#999;">準備中</p>`;
    }
    const items = topics.map(t => `                    <li>${t}</li>`).join('\n');
    return `<ul style="margin-left: 0;">\n${items}\n                    </ul>`;
}

/** 注文例のリストを生成 */
function buildOrders(orders) {
    if (!orders || orders.length === 0) {
        return `<p style="color:#999;">準備中</p>`;
    }
    const items = orders.map(order => {
        const subItems = order.items.map(item => `                        <li>${item}</li>`).join('\n');
        return `                    <li style="margin-bottom: 10px;">
                        <div><span class="price-tag">合計金額：${order.total}</span></div>
                        <ul class="order-sublist">
${subItems}
                        </ul>
                    </li>`;
    }).join('\n');
    return `<ul style="margin-left: 0;">\n${items}\n                    </ul>`;
}

/** 写真リストを生成 */
function buildPhotos(photos) {
    if (!photos || photos.length === 0) {
        return `<p style="color:#999;">準備中</p>`;
    }
    const figures = photos.map(photo => `                    <li>
                        <figure style="margin: 0 0 20px 0;">
                            <img src="${photo.src}" alt="${photo.caption}">
                            <figcaption style="margin-top: 5px; font-size: 0.9em;">${photo.caption}</figcaption>
                        </figure>
                    </li>`).join('\n');
    return `<ul class="photo-list">\n${figures}\n                    </ul>`;
}

// ─── テンプレート置換 ─────────────────────────────────────────
function render(template, shop, content) {
    const fullName  = `【${shop.area}】${shop.name}`;
    const areaShort = shop.area.split('/').pop();

    // CSVから埋め込む値
    const replacements = {
        '{{ID}}':          shop.id,
        '{{FULL_NAME}}':   fullName,
        '{{AREA}}':        shop.area,
        '{{AREA_SHORT}}':  areaShort,
        '{{NAME}}':        shop.name,
        '{{SUBTITLE}}':    shop.subtitle,
        '{{OTOSHI}}':      shop.otoshi,
        '{{HAPPYHOUR}}':   shop.happyhour,
        '{{SET}}':         shop.set,
        '{{BUDGET}}':      shop.budget,
        '{{PERSONS}}':     shop.persons,
        '{{SMOKE}}':       shop.smoke,
        '{{VISIT_DATE}}':  shop.visitDate,
        '{{UPDATE_DATE}}': shop.updateDate,
        '{{IMG}}':         shop.img,
        '{{URL}}':         shop.url,
        '{{TAGS}}':        (shop.tags || '').split(' ').filter(Boolean).map(t => `<span class="tag">${t}</span>`).join(''),
        // JSONから埋め込む値（ファイルがなければ「準備中」）
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

    let count = 0;
    shops.forEach(shop => {
        if (!shop.id) return;

        // content/{id}.json があれば読み込む、なければ null
        const contentPath = path.join(CONTENT_DIR, `${shop.id}.json`);
        let content = null;
        if (fs.existsSync(contentPath)) {
            content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
            console.log(`[OK] ${shop.id}.html（コンテンツあり）`);
        } else {
            console.log(`[--] ${shop.id}.html（content/${shop.id}.json なし → 準備中で生成）`);
        }

        const html    = render(template, shop, content);
        const outPath = path.join(OUTPUT_DIR, `${shop.id}.html`);
        fs.writeFileSync(outPath, html, 'utf-8');
        count++;
    });

    console.log(`\n✅ ${count}件のHTMLを生成しました。`);
}

main();
