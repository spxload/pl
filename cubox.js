(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload'; 
    var GITHUB_REPO = 'pl'; 
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox'; 
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    
    // Ссылка на JSON (CDN)
    var MANIFEST_URL = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json';
    // База для плагинов
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

    // Чтение JSON (Простой метод)
    function fetchManifest(callback) {
        var url = MANIFEST_URL + '?t=' + Date.now();
        
        console.log('[Cubox] Loading manifest:', url);

        Lampa.Network.silent(url, function(data) {
            try {
                // Если пришло строкой - парсим, если объектом - берем так
                var json = (typeof data === 'string') ? JSON.parse(data) : data;
                
                if (Array.isArray(json)) {
                    callback(json);
                } else {
                    console.error('[Cubox] JSON is not array');
                    callback([]);
                }
            } catch (e) { 
                console.error('[Cubox] JSON Error:', e);
                Lampa.Noty.show('Ошибка структуры plugins.json');
            }
        }, function(a, c) {
            console.warn('[Cubox] CDN Fail, trying Raw fallback...');
            // Если CDN не сработал (редко), пробуем Raw
            var rawUrl = 'https://raw.githubusercontent.com/' + GITHUB_USER + '/' + GITHUB_REPO + '/' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
            
            Lampa.Network.silent(rawUrl, function(d) {
                try {
                    var j = (typeof d === 'string') ? JSON.parse(d) : d;
                    callback(j);
                } catch(e) { callback([]); }
            }, function() {
                Lampa.Noty.show('Не удалось загрузить каталог');
            });
        });
    }

    // Меню (Без data-component)
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
                        subtitle: statusText + '<span style="opacity:0.7"> • ' + p.version + '</span><div style="opacity:0.6;font-size:0.9em;margin-top:2px">' + p.description + '</div>',
                        icon: iconHtml,
                        file: p.file,
                        enabled: isEnabled
                    });
                });
            } else {
                items.push({
                    title: 'Список пуст',
                    subtitle: 'Проверьте файл plugins.json',
                    icon: '<div style="width:20px;height:20px;border-radius:50%;background:#aaa"></div>',
                    file: 'none',
                    enabled: false
                });
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
