/**
 * sidebar.js
 * 全ページ共通のサイドバーを生成します。
 * <aside class="sidebar" id="common-sidebar"></aside> を配置したページで動作します。
 */
(function () {
    // ルートパスの基準(index.htmlは"./"、shops/XXX.html・guide/XXX.htmlは"../")
    const base = (function () {
        const path = location.pathname;
        // サブディレクトリ以下のページなら一段上へ
        if (path.includes('/shops/') || path.includes('/guide/')) return '../';
        return './';
    })();

    /**
     * エリア文字列(例: "大阪/梅田", "北海道/旭川")から
     * 地方グループ → エリア名 の構造に変換する
     * 返り値: { "大阪": ["梅田", "難波", ...], "北海道": ["旭川"] }
     */
    function groupAreas(shops) {
        const groups = {};
        shops.forEach(shop => {
            const parts = shop.area.split('/');
            const region = parts[0];
            const area   = parts[1] || parts[0]; // "/" がない場合はそのまま
            if (!groups[region]) groups[region] = new Set();
            groups[region].add(area);
        });
        // Set → Array に変換
        const result = {};
        Object.keys(groups).forEach(region => {
            result[region] = Array.from(groups[region]);
        });
        return result;
    }

    function buildAreaLinks(groups) {
        let html = `
            <ul class="area-list">
                <li><a href="${base}index.html"><i class="mdi mdi-view-list"></i>すべて</a></li>
            </ul>
        `;
        Object.keys(groups).forEach(region => {
            html += `<h4 class="area-region-label">${region}</h4>`;
            html += `<ul class="area-list">`;
            groups[region].forEach(area => {
                const query = encodeURIComponent(area);
                html += `<li><a href="${base}index.html?area=${query}"><i class="mdi mdi-chevron-right"></i>${area}</a></li>`;
            });
            html += `</ul>`;
        });
        return html;
    }

    function buildSidebar(shopCount, areaLinksHtml) {
        return `
            <div class="sidebar-widget widget-about">
                <h3 class="widget-title"><i class="mdi mdi-information-outline"></i> このサイトについて</h3>
                <p class="column-text">
                    大阪を中心に、実際に足を運んで確認した激安居酒屋やコストパフォーマンスに優れた居酒屋をまとめているデータベースサイトです。
                    情報は随時更新中。お気に入りの店を見つけてください！
                </p>
                <ul class="guide-list">
                    <li><a href="${base}guide/about.html"><i class="mdi mdi-chevron-right"></i>このサイトについて</a></li>
                    <li><a href="${base}guide/howto.html"><i class="mdi mdi-chevron-right"></i>このサイトの使い方・各項目の解説</a></li>
                    <li><a href="${base}guide/contact.html"><i class="mdi mdi-chevron-right"></i>お問い合わせ</a></li>
                </ul>
                <div class="about-stats">
                    <div class="stat-item">
                        <span class="stat-num" id="total-count">${shopCount !== null ? shopCount : '—'}</span>
                        <span class="stat-label">掲載店舗数</span>
                    </div>
                </div>
            </div>

            <div class="sidebar-widget">
                <h3 class="widget-title"><i class="mdi mdi-map-marker-outline"></i> エリアから探す</h3>
                ${areaLinksHtml}
            </div>

            <div class="sidebar-widget widget-column">
                <h3 class="widget-title"><i class="mdi mdi-lightbulb-outline"></i> 安く飲むための豆知識</h3>
                <p class="column-text">
                    「せんべろ」とは、1,000円でべろべろに酔える飲み屋のこと。
                </p>
                <p class="column-text">
                    「ハッピーアワー」は開店直後や夕方など特定の時間帯にドリンクやフードが割引・お得になるサービス。
                </p>
                <p class="column-text">
                    「立ち飲み」は椅子のない立ったまま飲むスタイルの店で、その分価格が安く回転も早いのが特徴。
                </p>
                <ul class="guide-list guide-list-column">
                    <li><a href="${base}guide/tips.html"><i class="mdi mdi-chevron-right"></i>せんべろ・激安居酒屋の楽しみ方</a></li>
                </ul>
            </div>

            <div class="sidebar-widget widget-twitter">
                <h3 class="widget-title"><i class="mdi mdi-twitter"></i> 最新ツイート</h3>
                <a class="twitter-timeline" data-height="400" data-theme="light" href="https://twitter.com/x_kaiserland_x?ref_src=twsrc%5Etfw">Tweets by @x_kaiserland_x</a>
            </div>
        `;
    }

    // Twitter(X)埋め込みウィジェット用スクリプトを読み込み、タイムラインを描画する
    function loadTwitterTimeline() {
        if (window.twttr && window.twttr.widgets) {
            window.twttr.widgets.load();
            return;
        }
        if (document.getElementById('twitter-wjs')) return;
        const script = document.createElement('script');
        script.id = 'twitter-wjs';
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        document.body.appendChild(script);
    }

    function init() {
        const sidebar = document.getElementById('common-sidebar');
        if (!sidebar) return;

        // CSVから店舗数とエリア一覧を取得してサイドバーを描画
        fetch(base + 'data.csv')
            .then(r => r.text())
            .then(csv => {
                const lines = csv.trim().split('\n');
                const count = lines.length - 1; // ヘッダー除く

                // 簡易パース(area列 = index 1)
                const shops = lines.slice(1).map(line => {
                    const parts = line.split(',');
                    return { area: parts[1] || '' };
                });

                const groups = groupAreas(shops);
                const areaLinksHtml = buildAreaLinks(groups);
                sidebar.innerHTML = buildSidebar(count, areaLinksHtml);
                loadTwitterTimeline();
            })
            .catch(() => {
                sidebar.innerHTML = buildSidebar(null, `
                    <ul class="area-list">
                        <li><a href="${base}index.html"><i class="mdi mdi-view-list"></i>すべて</a></li>
                    </ul>
                `);
                loadTwitterTimeline();
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
