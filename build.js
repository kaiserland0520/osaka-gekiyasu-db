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

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 店舗リンクテーブルを生成 */
function buildLinksTable(links) {
    if (!links) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    const rows = [
        links.hp        ? `                        <tr><th>公式HP</th><td><a href="${escapeHtml(links.hp)}" target="_blank" rel="noopener noreferrer">公式サイト</a></td></tr>` : '',
        links.instagram ? `                        <tr><th>Instagram</th><td><a href="${escapeHtml(links.instagram)}" target="_blank" rel="noopener noreferrer">公式Instagram</a></td></tr>` : '',
        links.twitter   ? `                        <tr><th>X(Twitter)</th><td><a href="${escapeHtml(links.twitter)}" target="_blank" rel="noopener noreferrer">公式X(Twitter)</a></td></tr>` : '',
    ].filter(Boolean).join('\n');

    if (!rows) return `<p class="placeholder-text">準備中</p>`;
    return `<table class="shop-info-table">\n                        <tbody>\n${rows}\n                        </tbody>\n                    </table>`;
}

/** Google Mapのiframeを生成 */
function buildMap(mapSrc) {
    if (!mapSrc) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    return `<iframe src="${escapeHtml(mapSrc)}" width="100%" height="300" class="map-iframe" allowfullscreen="" loading="lazy" title="店舗の地図"></iframe>`;
}


/** トピックスのul>liを生成 */
function buildTopics(topics) {
    if (!topics || topics.length === 0) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    const items = topics.map(t => `                    <li>${escapeHtml(t)}</li>`).join('\n');
    return `<ul>\n${items}\n                    </ul>`;
}

/** 注文例のリストを生成 */
function buildOrders(orders) {
    if (!orders || orders.length === 0) {
        return `<p class="placeholder-text">準備中</p>`;
    }
    const blocks = orders.map(order => {
        // 各アイテムを「商品名(単価)×数量　※備考」の形式でパースしてテーブル行に変換
        // パターン例:
        //   "お通し(418円)×7人"
        //   "2時間飲み放題(438円)×7人　※LINEクーポン当選価格"
        //   "うずらの醬油漬け(429円)"  ← 数量なし
        const rows = order.items.map(item => {
            // 備考(全角スペース＋※)を分離
            const noteSplit = item.split(/[\u3000\s]※/);
            const main = noteSplit[0].trim();
            const note = noteSplit[1] ? noteSplit[1].trim() : '';

            // 単価部分 (xxx) を分離
            const priceMatch = main.match(/^(.*?)\(([^)]+)\)(.*)$/);
            if (priceMatch) {
                const name  = escapeHtml(priceMatch[1].trim());
                const price = escapeHtml(priceMatch[2].trim());
                const qty   = priceMatch[3].replace(/^×/, '').trim();
                const noteHtml = note ? `<br><span class="order-note">※${escapeHtml(note)}</span>` : '';
                const qtyCell  = escapeHtml(qty || '1');
                return `                        <tr><td class="order-name">${name}${noteHtml}</td><td class="order-price">${price}</td><td class="order-qty">${qtyCell}</td></tr>`;
            }
            // パターン不一致はそのまま全幅で表示
            return `                        <tr><td class="order-name" colspan="3">${escapeHtml(item)}</td></tr>`;
        }).join('\n');

        return `                    <div class="order-block">
                        <div class="order-total"><span class="price-tag">合計金額：${escapeHtml(order.total)}</span></div>
                        <table class="order-table">
                            <thead>
                                <tr>
                                    <th class="order-name">メニュー</th>
                                    <th class="order-price">金額(円)</th>
                                    <th class="order-qty">数量</th>
                                </tr>
                            </thead>
                            <tbody>
${rows}
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
function render(template, shop, content) {
    const fullName  = `【${shop.area}】${shop.name}`;
    const areaShort = shop.area.split('/').pop();

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
