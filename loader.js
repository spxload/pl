(function () {
    'use strict';
    
    // --- НАСТРОЙКИ ---
    var GITHUB_USER = 'endLoads';
    var GITHUB_REPO = 'pl-lm';
    var CORE_FILE = 'cubox.js'; 
    // -----------------

    console.log('[Loader] Requesting fresh core via API...');

    // Используем API. Оно отдает JSON, но контент внутри закодирован в Base64.
    // API практически не кэшируется по сравнению с Raw/CDN.
    var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + CORE_FILE + '?ref=main&_t=' + Date.now();

    Lampa.Network.silent(apiUrl, function(data) {
        if (data && data.content) {
            try {
                // Декодируем Base64 (встроенная функция браузера или Лампы)
                // atob работает с латиницей, для кириллицы нужен фикс
                var code = decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, ''))));
                
                // Запускаем код
                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.innerHTML = code;
                document.body.appendChild(script);
                
                console.log('[Loader] Core updated & started successfully!');
                Lampa.Noty.show('Cubox: Core Updated');
            } catch (e) {
                console.error('[Loader] Decode error:', e);
                // Если не вышло через API, пробуем запасной вариант (CDN)
                loadFallback();
            }
        } else {
            loadFallback();
        }
    }, function() {
        console.error('[Loader] API Fail');
        loadFallback();
    });

    function loadFallback() {
        console.log('[Loader] Using CDN fallback...');
        var url = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@main/' + CORE_FILE + '?t=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        document.body.appendChild(script);
    }

})();
