(function () {
    'use strict';
    
    // --- НАСТРОЙКИ ---
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var CORE_FILE = 'cubox.js'; 
    // -----------------

    // Грузим через CDN (обход блокировок)
    var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + CORE_FILE;
    var timestamp = new Date().getTime();
    var url = cdnUrl + '?t=' + timestamp;

    console.log('[Loader] Loading Core:', url);

    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.async = true;
    
    script.onerror = function() {
        console.error('[Loader] Failed to load Core! Check if cubox.js is in the root of the repo.');
    };

    document.body.appendChild(script);

})();
