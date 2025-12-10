(function () {
    'use strict';
    
    // --- НОВЫЕ НАСТРОЙКИ ---
    var GITHUB_USER = 'spxload';    // Новый логин
    var GITHUB_REPO = 'pl';         // Новый репозиторий
    var CORE_FILE = 'cubox.js';     // Файл ядра в корне репо
    // -----------------------

    console.log('[Loader] Requesting fresh core via API...');
    var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + CORE_FILE + '?ref=main&_t=' + Date.now();

    Lampa.Network.silent(apiUrl, function(data) {
        if (data && data.content) {
            try {
                var code = decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, ''))));
                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.innerHTML = code;
                document.body.appendChild(script);
                console.log('[Loader] Core updated from spxload/pl');
            } catch (e) {
                console.error('[Loader] Decode error:', e);
                loadFallback();
            }
        } else { loadFallback(); }
    }, function() { loadFallback(); });

    function loadFallback() {
        var url = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@main/' + CORE_FILE + '?t=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        document.body.appendChild(script);
    }
})();
