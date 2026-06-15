let allShops = [];
let filteredShops = [];
let activeTag = null;
let activeSearch = '';
let currentPage = 1;
const itemsPerPage = 10;

// ─── ユーティリティ ───────────────────────────────────────────

/** HTMLエスケープ（XSS対策） */
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** URLの安全性チェック（javascript: スキーム等を排除） */
function safeUrl(url) {
    if (!url) return '#';
    // javascript: / vbscript: などの危険なスキームを拒否、相対パスは通過させる
    if (/^(javascript|vbscript|data):/i.test(url.trim())) return '#';
    return url;
}

// ─── 初期化 ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('area')) {
        activeSearch = urlParams.get('area');
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = activeSearch;
        }
    }

    fetch('data.csv')
        .then(response => {
            if (!response.ok) throw new Error('CSVの取得に失敗しました');
            return response.text();
        })
        .then(csvText => {
            parseCSV(csvText);
            applyFilters();
            renderPage(currentPage);
            const countEl = document.getElementById('total-count');
            if (countEl) countEl.textContent = allShops.length;
        })
        .catch(error => {
            console.error(error);
            document.getElementById('shop-list').innerHTML = '<p class="error">データの読み込み中にエラーが発生しました。</p>';
        });
});

// ─── CSVパース ────────────────────────────────────────────────

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    lines.shift();

    allShops = lines.map(line => {
        const parts = line.split(',');
        return {
            id: parts[0],
            area: parts[1],
            name: parts[2],
            subtitle: parts[3],
            otoshi: parts[4],
            happyhour: parts[5],
            set: parts[6],
            budget: parts[7],
            persons: parts[8],
            smoke: parts[9],
            tags: parts[10] ? parts[10].split(' ') : [],
            visitDate: parts[11],
            updateDate: parts[12],
            img: parts[13],
            url: parts[14]
        };
    });
}

// ─── レンダリング ─────────────────────────────────────────────

function renderPage(page) {
    const container = document.getElementById('shop-list');
    container.innerHTML = '';

    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredShops.slice(start, end);

    if (pageItems.length === 0) {
        container.innerHTML = '<p>表示する記事がありません。</p>';
        renderPagination();
        return;
    }

    pageItems.forEach(shop => {
        // タグ要素をDOM操作で生成（onclick属性インジェクション対策）
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        shop.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag' + (tag === activeTag ? ' tag-active' : '');
            span.textContent = tag;
            span.addEventListener('click', () => filterByTag(tag));
            tagsContainer.appendChild(span);
        });

        // カード本体はエスケープ済みの値のみ埋め込む
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML = `
            <div class="shop-card-main">
                <div class="shop-image">
                    <img src="images/${escapeHtml(shop.img)}" alt="${escapeHtml(shop.name)}" loading="lazy">
                </div>
                <div class="shop-details">
                    <a href="${escapeHtml(safeUrl(shop.url))}" class="shop-title">【${escapeHtml(shop.area)}】${escapeHtml(shop.name)}</a>
                    <div class="shop-subtitle">${escapeHtml(shop.subtitle)}</div>
                    <div class="price-grid">
                        <div class="price-item"><span class="label"><i class="mdi mdi-silverware-variant"></i> お通し</span>${escapeHtml(shop.otoshi)}</div>
                        <div class="price-item"><span class="label"><i class="mdi mdi-clock-fast"></i> ハッピーアワー</span>${escapeHtml(shop.happyhour)}</div>
                        <div class="price-item"><span class="label"><i class="mdi mdi-food-fork-drink"></i> せんべろセット</span>${escapeHtml(shop.set)}</div>
                        <div class="price-item"><span class="label"><i class="mdi mdi-currency-jpy"></i> 予算</span>${escapeHtml(shop.budget)}</div>
                        <div class="price-item"><span class="label"><i class="mdi mdi-account-group"></i> 推奨人数</span>${escapeHtml(shop.persons)}</div>
                        <div class="price-item"><span class="label"><i class="mdi mdi-smoking"></i> 喫煙</span>${escapeHtml(shop.smoke)}</div>
                    </div>
                </div>
            </div>
            <div class="shop-card-footer">
                <div class="dates">
                    <span>最終訪問日：${escapeHtml(shop.visitDate)}</span>
                    <span>最終更新日：${escapeHtml(shop.updateDate)}</span>
                </div>
            </div>
        `;

        // タグコンテナをカードフッターの先頭に挿入
        const footer = card.querySelector('.shop-card-footer');
        footer.insertBefore(tagsContainer, footer.firstChild);

        container.appendChild(card);
    });

    renderPagination();
}

// ─── フィルター ───────────────────────────────────────────────

function applyFilters() {
    filteredShops = allShops.filter(shop => {
        const matchesTag = !activeTag || shop.tags.includes(activeTag);
        const q = activeSearch.trim().toLowerCase();
        const matchesSearch = !q ||
            shop.name.toLowerCase().includes(q) ||
            shop.area.toLowerCase().includes(q) ||
            shop.subtitle.toLowerCase().includes(q) ||
            shop.tags.some(tag => tag.toLowerCase().includes(q));
        return matchesTag && matchesSearch;
    });
}

function filterBySearch(value) {
    activeSearch = value;
    currentPage = 1;
    applyFilters();
    renderPage(currentPage);
    renderActiveTagBanner();
}

function filterByTag(tag) {
    activeTag = (activeTag === tag) ? null : tag;
    currentPage = 1;
    applyFilters();
    renderPage(currentPage);
    renderActiveTagBanner();
}

// index.html の oninput から参照するためグローバルに公開
window.filterBySearch = filterBySearch;

function renderActiveTagBanner() {
    let banner = document.getElementById('active-tag-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'active-tag-banner';
        const shopList = document.getElementById('shop-list');
        shopList.parentNode.insertBefore(banner, shopList);
    }
    if (activeTag) {
        // テキストノードとボタンをDOM操作で生成（XSS対策）
        banner.innerHTML = '';
        const label = document.createElement('span');
        label.textContent = `「${activeTag}」で絞り込み中`;
        const btn = document.createElement('button');
        btn.className = 'clear-filter-btn';
        btn.textContent = '✕ 解除';
        btn.addEventListener('click', () => filterByTag(activeTag));
        banner.appendChild(label);
        banner.appendChild(btn);
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

// ─── ページネーション ─────────────────────────────────────────

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredShops.length / itemsPerPage);

    // DOM操作で生成（onclick属性を避ける）
    pagination.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = '＜ 前の10件';
    prevBtn.setAttribute('aria-label', '前のページへ');
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => changePage(currentPage - 1));

    const info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = `${currentPage} / ${totalPages}`;
    info.setAttribute('aria-live', 'polite');

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = '次の10件 ＞';
    nextBtn.setAttribute('aria-label', '次のページへ');
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    nextBtn.addEventListener('click', () => changePage(currentPage + 1));

    pagination.appendChild(prevBtn);
    pagination.appendChild(info);
    pagination.appendChild(nextBtn);
}

function changePage(page) {
    currentPage = page;
    renderPage(currentPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
