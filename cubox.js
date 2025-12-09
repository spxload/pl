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
    
    // ВАЖНО: Используем CDN для JSON (чтобы не было ошибки загрузки)
    var MANIFEST_URL = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json';
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

    // Чтение JSON через CDN
    function fetchManifest(callback) {
        var url = MANIFEST_URL + '?t=' + Date.now();
        
        Lampa.Network.silent(url, function(data) {
            try {
                // Если пришел строкой - парсим
                var json = (typeof data === 'string') ? JSON.parse(data) : data;
                callback(json);
            } catch (e) { 
                console.error(e);
                Lampa.Noty.show('Cubox: Ошибка структуры JSON'); 
            }
        }, function(a, c) {
            // Если CDN не сработал (файла нет), пробуем Raw как запасной вариант
            console.warn('CDN Fail, trying Raw...');
            var rawUrl = 'https://raw.githubusercontent.com/' + GITHUB_USER + '/' + GITHUB_REPO + '/' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
            
            Lampa.Network.silent(rawUrl, function(d) {
                try {
                    var j = (typeof d === 'string') ? JSON.parse(d) : d;
                    callback(j);
                } catch(e) { Lampa.Noty.show('Cubox: Файл plugins.json не найден'); }
            }, function() {
                Lampa.Noty.show('Cubox: Каталог пуст или недоступен');
            });
        });
    }

    // Меню
    function addMenu() {
        // Убрал data-component="cubox_core", чтобы не было ошибки Template not found
        var field = $(`
            <div class="settings-folder selector" data-component="cubox_store">
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
                        var first = scrollLayer.find('.settings-folder').first();
                        if (first.length) first.before(field);
                        else scrollLayer.append(field);
                        
                        field.on('hover:enter', openStore);
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
            
            plugins.forEach(function(p) {
                var isEnabled = enabledPlugins[p.file] === true;
                
                var statusText = isEnabled ? '<span style="color:#4bbc16;font-weight:bold">ВКЛЮЧЕНО</span>' : '<span style="color:#aaa">Выключено</span>';
                var versionInfo = '<span style="opacity:0.7"> • v' + p.version + '</span>';
                var descInfo = '<div style="opacity:0.6;font-size:0.9em;margin-top:2px">' + p.description + '</div>';

                var iconHtml = isEnabled ? 
                    '<div style="width:16px;height:16px;background:#4bbc16;border-radius:50%;box-shadow:0 0 10px #4bbc16"></div>' : 
                    '<div style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-radius:50%"></div>';

                items.push({
                    title: p.name,
                    subtitle: statusText + versionInfo + descInfo,
                    icon: iconHtml,
                    file: p.file,
                    enabled: isEnabled
                });
            });

            if (items.length === 0) {
                 Lampa.Noty.show('Каталог пуст. Добавьте плагины в репо.');
                 return;
            }

            Lampa.Select.show({
                title: 'Cubox Store',
                items: items,
                onSelect: function(item) {
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
