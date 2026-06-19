/**
 * nav.js
 * 全ページ共通のグローバルナビゲーションを生成します。
 * <nav class="global-nav" id="global-nav"></nav> を配置したページで動作します。
 */
(function () {
    // ルートパスの基準
    const base = (function () {
        const path = location.pathname;
        if (path.includes('/shops/') || path.includes('/guide/')) return '../';
        return './';
    })();

    // 現在ページのパスに応じてアクティブクラスを付与
    function isActive(href) {
        const current = location.pathname.replace(/\/$/, '/index.html');
        const target  = href.replace(/^\.\//, '/').replace(/^\.\.\//, '/');
        return current.endsWith(target.replace(/^\//, '')) ? ' nav-active' : '';
    }

    function buildNav(areaGroups) {
        // エリアのドロップダウン項目
        let areaItems = `<li><a href="${base}index.html"><i class="mdi mdi-view-list"></i>すべて</a></li>`;
        Object.keys(areaGroups).forEach(region => {
            areaGroups[region].forEach(area => {
                const q = encodeURIComponent(area);
                areaItems += `<li><a href="${base}index.html?area=${q}"><i class="mdi mdi-chevron-right"></i>${area}</a></li>`;
            });
        });

        const navHtml = `
            <div class="global-nav-inner">
                <ul class="nav-links">
                    <li>
                        <a href="${base}index.html" class="${isActive(base + 'index.html')}">
                            <i class="mdi mdi-home-outline"></i>トップ
                        </a>
                    </li>
                    <li class="nav-dropdown">
                        <a href="${base}index.html" class="${isActive(base + 'index.html')}">
                            <i class="mdi mdi-map-marker-outline"></i>エリアから探す
                        </a>
                        <ul class="nav-dropdown-menu">
                            ${areaItems}
                        </ul>
                    </li>
                    <li>
                        <a href="${base}guide/about.html" class="${isActive(base + 'guide/about.html')}">
                            <i class="mdi mdi-information-outline"></i>このサイトについて
                        </a>
                    </li>
                    <li>
                        <a href="${base}guide/howto.html" class="${isActive(base + 'guide/howto.html')}">
                            <i class="mdi mdi-help-circle-outline"></i>使い方
                        </a>
                    </li>
                    <li>
                        <a href="${base}guide/contact.html" class="${isActive(base + 'guide/contact.html')}">
                            <i class="mdi mdi-email-outline"></i>お問い合わせ
                        </a>
                    </li>
                </ul>
                <button class="nav-hamburger" id="nav-hamburger" aria-label="メニューを開く">
                    <i class="mdi mdi-menu"></i>
                </button>
            </div>

            <!-- モバイル用オーバーレイ -->
            <div class="nav-mobile-overlay" id="nav-overlay"></div>

            <!-- モバイル用ドロワー -->
            <div class="nav-mobile-drawer" id="nav-drawer">
                <div class="nav-mobile-header">
                    <span><i class="mdi mdi-menu"></i> メニュー</span>
                    <button class="nav-mobile-close" id="nav-close" aria-label="メニューを閉じる">&times;</button>
                </div>
                <ul class="nav-mobile-links">
                    <li><a href="${base}index.html"><i class="mdi mdi-home-outline"></i>トップ(すべて)</a></li>
                    <li><span class="nav-section-label">エリアから探す</span></li>
                    ${buildMobileAreaItems(areaGroups)}
                    <li><span class="nav-section-label">ガイド</span></li>
                    <li><a href="${base}guide/about.html"><i class="mdi mdi-information-outline"></i>このサイトについて</a></li>
                    <li><a href="${base}guide/howto.html"><i class="mdi mdi-help-circle-outline"></i>このサイトの使い方</a></li>
                    <li><a href="${base}guide/contact.html"><i class="mdi mdi-email-outline"></i>お問い合わせ</a></li>
                </ul>
            </div>
        `;
        return navHtml;
    }

    function buildMobileAreaItems(areaGroups) {
        let html = '';
        Object.keys(areaGroups).forEach(region => {
            areaGroups[region].forEach(area => {
                const q = encodeURIComponent(area);
                html += `<li><a href="${base}index.html?area=${q}"><i class="mdi mdi-map-marker-outline"></i>${area}</a></li>`;
            });
        });
        return html;
    }

    function groupAreas(shops) {
        const groups = {};
        shops.forEach(shop => {
            const parts = shop.area.split('/');
            const region = parts[0];
            const area   = parts[1] || parts[0];
            if (!groups[region]) groups[region] = new Set();
            groups[region].add(area);
        });
        const result = {};
        Object.keys(groups).forEach(r => { result[r] = Array.from(groups[r]); });
        return result;
    }

    function bindEvents() {
        const hamburger = document.getElementById('nav-hamburger');
        const overlay   = document.getElementById('nav-overlay');
        const drawer    = document.getElementById('nav-drawer');
        const closeBtn  = document.getElementById('nav-close');

        function openDrawer() {
            drawer.classList.add('open');
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        function closeDrawer() {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }

        if (hamburger) hamburger.addEventListener('click', openDrawer);
        if (overlay)   overlay.addEventListener('click', closeDrawer);
        if (closeBtn)  closeBtn.addEventListener('click', closeDrawer);

        // ESCキーで閉じる
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeDrawer();
        });
    }

    function init() {
        const nav = document.getElementById('global-nav');
        if (!nav) return;

        fetch(base + 'data.csv')
            .then(r => r.text())
            .then(csv => {
                const lines = csv.trim().split('\n').slice(1);
                const shops = lines.map(line => {
                    const parts = line.split(',');
                    return { area: parts[1] || '' };
                });
                const groups = groupAreas(shops);
                nav.innerHTML = buildNav(groups);
                bindEvents();
            })
            .catch(() => {
                nav.innerHTML = buildNav({});
                bindEvents();
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
