/**
 * sidebar.js
 * 全ページ共通のサイドバーを生成します。
 * <aside class="sidebar" id="common-sidebar"></aside> を配置したページで動作します。
 */
(function () {
    // ルートパスの基準（index.htmlは"./"、shops/XXX.html・guide/XXX.htmlは"../"）
    const base = (function () {
        const path = location.pathname;
        // サブディレクトリ以下のページなら一段上へ
        if (path.includes('/shops/') || path.includes('/guide/')) return '../';
        return './';
    })();

    /**
     * エリア文字列（例: "大阪/梅田", "北海道/旭川"）から
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
            <ul class="area-list" style="margin-bottom: 15px;">
                <li><a href="${base}index.html"><i class="mdi mdi-chevron-right"></i>すべて</a></li>
            </ul>
        `;
        Object.keys(groups).forEach(region => {
            html += `<h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: var(--label-color);">${region}</h4>`;
            html += `<ul class="area-list" style="margin-bottom: 15px;">`;
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
            <div class="sidebar-widget widget-guide">
                <h3 class="widget-title"><i class="mdi mdi-help-circle-outline"></i> はじめての方へ</h3>
                <p class="column-text">
                    このサイトは、大阪を中心とした激安居酒屋やコストパフォーマンスに優れた居酒屋を実際に足を運んで紹介するデータベースサイトです。
                    初めてご覧の方は、ぜひ以下のガイドをご一読ください。
                </p>
                <ul class="guide-list">
                    <li><a href="${base}guide/about.html"><i class="mdi mdi-chevron-right"></i>このサイトについて</a></li>
                    <li><a href="${base}guide/howto.html"><i class="mdi mdi-chevron-right"></i>各項目の見方・選定基準</a></li>
                    <li><a href="${base}guide/tips.html"><i class="mdi mdi-chevron-right"></i>せんべろ・激安居酒屋の楽しみ方</a></li>
                </ul>
            </div>

            <div class="sidebar-widget">
                <h3 class="widget-title"><i class="mdi mdi-map-marker-outline"></i> エリアから探す</h3>
                ${areaLinksHtml}
            </div>

            <div class="sidebar-widget widget-column">
                <h3 class="widget-title"><i class="mdi mdi-lightbulb-outline"></i> せんべろ豆知識</h3>
                <p class="column-text">
                    「せんべろ」とは、1,000円でべろべろに酔える飲み屋のこと。
                    大阪は全国でも屈指のせんべろ天国で、天満・新世界・京橋などのディープなエリアに名店が集中しています。
                </p>
                <p class="column-text">
                    ハッピーアワーをうまく使えば、さらにお得に楽しめますよ！
                </p>
            </div>

            <div class="sidebar-widget widget-about">
                <h3 class="widget-title"><i class="mdi mdi-information-outline"></i> このサイトについて</h3>
                <p class="column-text">
                    大阪を中心に、実際に足を運んで確認した激安居酒屋やコストパフォーマンスに優れた居酒屋をまとめているデータベースサイトです。
                    情報は随時更新中。お気に入りの店を見つけてください！
                </p>
                <div class="about-stats">
                    <div class="stat-item">
                        <span class="stat-num" id="total-count">${shopCount !== null ? shopCount : '—'}</span>
                        <span class="stat-label">掲載店舗数</span>
                    </div>
                </div>
            </div>
        `;
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

                // 簡易パース（area列 = index 1）
                const shops = lines.slice(1).map(line => {
                    const parts = line.split(',');
                    return { area: parts[1] || '' };
                });

                const groups = groupAreas(shops);
                const areaLinksHtml = buildAreaLinks(groups);
                sidebar.innerHTML = buildSidebar(count, areaLinksHtml);
            })
            .catch(() => {
                sidebar.innerHTML = buildSidebar(null, `
                    <ul class="area-list">
                        <li><a href="${base}index.html"><i class="mdi mdi-chevron-right"></i>すべて</a></li>
                    </ul>
                `);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
