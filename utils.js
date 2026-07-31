/**
 * utils.js
 * ブラウザ(script タグ)・Node.js(require)の両方から使える共通ユーティリティ。
 * app.js / build.js / nav.js / sidebar.js で共有する。
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        Object.assign(root, factory());
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // data.csv の取得結果をキャッシュし、同一ページ内での重複リクエストを防ぐ。
    // app.js / nav.js / sidebar.js は同じページで個別に data.csv を必要とするため、
    // ここに集約して通信を1回にまとめる(相対パスの表記ゆれは絶対URLに正規化してキーにする)。
    var _csvFetchCache = {};
    function fetchCsvText(path) {
        var key = new URL(path, location.href).href;
        if (!_csvFetchCache[key]) {
            _csvFetchCache[key] = fetch(path).then(function (res) {
                if (!res.ok) throw new Error('CSVの取得に失敗しました: ' + path);
                return res.text();
            });
        }
        return _csvFetchCache[key];
    }

    // RFC4180準拠の簡易CSV行パーサ(クォート内のカンマ・エスケープされた"を正しく扱う)
    function parseCSVLine(line) {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (inQuotes) {
                if (c === '"') {
                    if (line[i + 1] === '"') { cur += '"'; i++; }
                    else { inQuotes = false; }
                } else {
                    cur += c;
                }
            } else {
                if (c === '"') inQuotes = true;
                else if (c === ',') { result.push(cur); cur = ''; }
                else cur += c;
            }
        }
        result.push(cur);
        return result;
    }

    return { escapeHtml, parseCSVLine, fetchCsvText };
});
