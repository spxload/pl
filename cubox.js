(function () {
    'use strict';

    // ==========================================
    // НОВЫЕ НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload'; 
    var GITHUB_REPO = 'pl'; 
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox'; 
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false; 

    // Загрузка плагина
    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?t=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        document.body.appendChild(script);
    }
    
    // Старт
    function startPlugins() {
        Object.keys(enabledPlugins).forEach(function(file) {
            if (enabledPlugins[file]) loadPlugin(file);
        });
    }

    // Чтение JSON через API
    function fetchManifest(callback) {
        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();
        
        Lampa.Network.silent(apiUrl, function(data) {
            try {
                if (data && data.content) {
                    var jsonString = decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, ''))));
                    callback(JSON.parse(jsonString));
                } else { callback([]); }
            } catch (e) { callback([]); }
        }, function() { callback([]); });
    }

    // Меню (Без data-component, чтобы не было ошибок)
    function addMenu() {
        var field = $(`
            <div class="settings-folder selector cubox-menu-item">
                <div class="settings-folder__icon">
                    <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                </div>
                <div class="settings-folder__name">Cubox</div>
                <div class="settings-folder__descr">Store</div>
            </div>
        `);
        
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'main') {
                var timer = setInterval(function() {
                    var scrollLayer = $('.settings__content .scroll__content');
                    if (scrollLayer.length) {
                        clearInterval(timer);
                        scrollLayer.find('.cubox-menu-item').remove();
                        var first = scrollLayer.find('.settings-folder').first();
                        field.off('hover:enter click').on('hover:enter click', openStore);
                        if (first.length) first.before(field);
                        else scrollLayer.append(field);
                    }
                }, 50);
            }
        });
    }

    function openStore() {
        Lampa.Loading.start(function(){ Lampa.Loading.stop(); });
        fetchManifest(function(plugins) {
            Lampa.Loading.stop();
            var items = [];
            if (Array.isArray(plugins) && plugins.length > 0) {
                plugins.forEach(function(p) {
                    var isEnabled = enabledPlugins[p.file] === true;
                    var statusText = isEnabled ? '<span style="color:#4bbc16;font-weight:bold">ВКЛЮЧЕНО</span>' : '<span style="color:#aaa">Выключено</span>';
                    var iconHtml = isEnabled ? 
                        '<div style="width:16px;height:16px;background:#4bbc16;border-radius:50%;box-shadow:0 0 10px #4bbc16"></div>' : 
                        '<div style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-radius:50%"></div>';
                    items.push({
                        title: p.name,
                        subtitle: statusText + '<span style="opacity:0.7"> • v' + p.version + '</span><div style="opacity:0.6;font-size:0.9em;margin-top:2px">' + p.description + '</div>',
                        icon: iconHtml,
                        file: p.file,
                        enabled: isEnabled
                    });
                });
            } else {
                items.push({ title: 'Нет доступных плагинов', subtitle: 'Проверьте репозиторий spxload/pl', icon: '<div style="width:20px;height:20px;border-radius:50%;background:#aaa"></div>', file: 'none', enabled: false });
            }
            Lampa.Select.show({
                title: 'Cubox Store',
                items: items,
                onSelect: function(item) {
                    if (item.file === 'none') return;
                    enabledPlugins[item.file] = !item.enabled;
                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                    needReload = true;
                    setTimeout(openStore, 50);
                },
                onBack: function() {
                    if (needReload) {
                        Lampa.Noty.show('Перезагрузка...');
                        setTimeout(function(){ window.location.reload(); }, 1000);
                    } else Lampa.Controller.toggle('settings_component');
                }
            });
        });
    }

    if (window.appready) { addMenu(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { addMenu(); startPlugins(); } }); }
})();
