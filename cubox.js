(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v2.4'; 
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;
    var lastFocused = null;

    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?v=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        document.body.appendChild(script);
    }

    function startPlugins() {
        Object.keys(enabledPlugins).forEach(function (file) {
            if (enabledPlugins[file]) loadPlugin(file);
        });
    }

    function fetchManifest(callback) {
        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();
        fetch(apiUrl).then(res => res.json()).then(data => {
            if (data && data.content) {
                try {
                    var jsonString = decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, ''))));
                    callback(JSON.parse(jsonString));
                } catch (e) { callback([]); }
            } else { callback([]); }
        }).catch(() => {
            var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
            fetch(cdnUrl).then(r => r.json()).then(callback).catch(() => callback([]));
        });
    }

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
                <div class="settings-folder__name">Cubox Store</div>
                <div class="settings-folder__descr">${CUBOX_VERSION}</div>
            </div>
        `);

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'main') {
                var timer = setInterval(function () {
                    var scrollLayer = $('.settings__content .scroll__content');
                    if (scrollLayer.length) {
                        clearInterval(timer);
                        scrollLayer.find('.cubox-menu-item').remove();
                        var first = scrollLayer.find('.settings-folder').first();

                        field.off('hover:enter click').on('hover:enter click', function () {
                            lastFocused = $(this);
                            openCustomModal();
                        });

                        if (first.length) first.before(field);
                        else scrollLayer.append(field);
                        
                        Lampa.Controller.enable('content');
                    }
                }, 50);
            }
        });
    }

    function openCustomModal() {
        Lampa.Loading.start(function () { Lampa.Loading.stop(); });

        fetchManifest(function (plugins) {
            Lampa.Loading.stop();

            var html = $(`<div>
                <div class="cubox-header" style="padding: 15px 20px; font-size: 1.5em; font-weight: bold; border-bottom: 2px solid rgba(255,255,255,0.05); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Cubox Store</span>
                    <span style="font-size: 0.6em; opacity: 0.5; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${CUBOX_VERSION}</span>
                </div>
                <div class="cubox-list" style="padding: 0 10px;"></div>
            </div>`);

            var list = html.find('.cubox-list');

            if (Array.isArray(plugins) && plugins.length > 0) {
                plugins.forEach(function (p) {
                    var isEnabled = enabledPlugins[p.file] === true;
                    var statusColor = '#4bbc16';
                    
                    var item = $(`
                        <div class="selector" style="display: flex; align-items: center; padding: 12px; margin-bottom: 5px; background: rgba(255,255,255,0.05); border-radius: 8px; transition: background 0.2s;">
                            <div class="status-icon" style="width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${statusColor}; background: ${isEnabled ? statusColor : 'transparent'}; margin-right: 15px; opacity: ${isEnabled ? '1' : '0.3'}; box-shadow: ${isEnabled ? '0 0 10px ' + statusColor : 'none'}; flex-shrink: 0;"></div>
                            <div style="flex-grow: 1;">
                                <div style="font-size: 1.1em; font-weight: 500; margin-bottom: 3px;">${p.name}</div>
                                <div style="font-size: 0.8em; opacity: 0.6;">v${p.version} • ${p.description}</div>
                            </div>
                        </div>
                    `);

                    item.on('hover:enter click', function () {
                        enabledPlugins[p.file] = !enabledPlugins[p.file];
                        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                        needReload = true;

                        var newStatus = enabledPlugins[p.file];
                        var icon = $(this).find('.status-icon');
                        icon.css({
                            'background': newStatus ? statusColor : 'transparent',
                            'opacity': newStatus ? '1' : '0.3',
                            'box-shadow': newStatus ? '0 0 10px ' + statusColor : 'none'
                        });
                    });

                    list.append(item);
                });
            } else {
                list.append('<div style="padding: 20px; opacity: 0.5; text-align: center;">Список плагинов пуст</div>');
            }

            // Навигация 3.0: просто открываем модалку.
            // НЕ используем Controller.add, чтобы не конфликтовать с MaskHelper
            Lampa.Modal.open({
                title: '',
                html: html,
                size: 'medium',
                mask: true,
                onBack: function () {
                    // Просто закрываем
                    Lampa.Modal.close();
                    
                    if (needReload) {
                        Lampa.Noty.show('Применение изменений...');
                        setTimeout(function () { window.location.reload(); }, 1000);
                    } else {
                        // Важно: в 3.0 навигация сама должна вернуться.
                        // Мы только восстанавливаем фокус, если он потерялся.
                        if (lastFocused && lastFocused.length) {
                            setTimeout(function(){
                                // Явно переводим фокус на Settings
                                Lampa.Controller.toggle('content'); 
                                Lampa.Controller.collectionFocus(lastFocused[0], $('.settings__content .scroll__content'));
                            }, 200); // Чуть больший таймаут для ТВ
                        }
                    }
                }
            });
        });
    }

    if (window.appready) { addMenu(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { addMenu(); startPlugins(); } }); }
})();
