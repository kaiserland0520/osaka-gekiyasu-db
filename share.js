/**
 * share.js
 * 共有ボタン(X / Facebook / LINE / Bluesky / Threads / URLコピー)の処理。
 * index.html と shops/template.html(から生成される各店舗ページ)の両方から読み込む。
 */

function openShareUrl(url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function shareX(e) {
    e.preventDefault();
    const url = encodeURIComponent(location.href);
    const text = encodeURIComponent(document.title);
    openShareUrl(`https://twitter.com/intent/tweet?url=${url}&text=${text}`);
}

function shareFacebook(e) {
    e.preventDefault();
    const url = encodeURIComponent(location.href);
    openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
}

function shareLine(e) {
    e.preventDefault();
    const url = encodeURIComponent(location.href);
    const text = encodeURIComponent(document.title);
    openShareUrl(`https://social-plugins.line.me/lineit/share?url=${url}&text=${text}`);
}

function shareBluesky(e) {
    e.preventDefault();
    const text = encodeURIComponent(document.title + ' ' + location.href);
    openShareUrl(`https://bsky.app/intent/compose?text=${text}`);
}

function shareThreads(e) {
    e.preventDefault();
    const url = encodeURIComponent(location.href);
    openShareUrl(`https://www.threads.net/intent/post?text=${url}`);
}

async function copyUrl(e) {
    e.preventDefault();
    try {
        await navigator.clipboard.writeText(location.href);
        const btn = e.currentTarget;
        const span = btn.querySelector('span');
        const orig = span.textContent;
        span.textContent = 'コピーしました！';
        btn.classList.add('copied');
        setTimeout(() => { span.textContent = orig; btn.classList.remove('copied'); }, 2000);
    } catch (_) {
        prompt('以下のURLをコピーしてください', location.href);
    }
}

// グローバル公開(HTML の onclick から参照)
window.shareX = shareX;
window.shareFacebook = shareFacebook;
window.shareLine = shareLine;
window.shareBluesky = shareBluesky;
window.shareThreads = shareThreads;
window.copyUrl = copyUrl;
