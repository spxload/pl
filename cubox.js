(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload'; 
    var GITHUB_REPO = 'pl'; 
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox'; 
    var CUBOX_VERSION = 'v3.5'; // ВЕРСИЯ МАГАЗИНА
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false; 

    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?v=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        document.body.appendChild(script);
    }
    
    function startPlugins() {
        Object.keys(enabledPlugins).forEach(function(file) {
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
                } catch (e) { throw new Error('Decode Error'); }
            } else { throw new Error('No content'); }
        }).catch(err => {
            var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
            fetch(cdnUrl).then(r=>r.json()).then(callback).catch(()=>callback([]));
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
                        
                        field.off('hover:enter click').on('hover:enter click', openCustomModal);

                        if (first.length) first.before(field);
                        else scrollLayer.append(field);
                        Lampa.Controller.enable('content'); 
                    }
                }, 50);
            }
        });
    }

    // Полностью кастомная модалка (без Lampa.Select)
    // Это исключает любые конфликты с историей и зацикливанием
    function openCustomModal() {
        Lampa.Loading.start(function(){ Lampa.Loading.stop(); });

        fetchManifest(function(plugins) {
            Lampa.Loading.stop();
            
            // Заголовок с версией
            var html = $(`<div>
                <div class="cubox-header" style="padding: 15px 20px; font-size: 1.5em; font-weight: bold; border-bottom: 2px solid rgba(255,255,255,0.1); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Cubox Store</span>
                    <span style="font-size: 0.6em; opacity: 0.5; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${CUBOX_VERSION}</span>
                </div>
                <div class="cubox-list" style="padding: 0 10px;"></div>
            </div>`);

            var list = html.find('.cubox-list');

            if (Array.isArray(plugins) && plugins.length > 0) {
                plugins.forEach(function(p) {
                    var isEnabled = enabledPlugins[p.file] === true;
                    var statusColor = isEnabled ? '#4bbc16' : '#fff';
                    var statusOpacity = isEnabled ? '1' : '0.3';
                    
                    var item = $(`
                        <div class="selector" style="display: flex; align-items: center; padding: 12px; margin-bottom: 5px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${statusColor}; background: ${isEnabled ? statusColor : 'transparent'}; margin-right: 15px; opacity: ${statusOpacity}; flex-shrink: 0;"></div>
                            <div style="flex-grow: 1;">
                                <div style="font-size: 1.1em; margin-bottom: 3px;">${p.name}</div>
                                <div style="font-size: 0.8em; opacity: 0.7;">v${p.version} • ${p.description}</div>
                            </div>
                        </div>
                    `);

                    item.on('hover:enter click', function() {
                        enabledPlugins[p.file] = !enabledPlugins[p.file];
                        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                        needReload = true;
                        
                        // Мгновенное обновление UI без перерисовки всего окна
                        var newEnabled = enabledPlugins[p.file];
                        var circle = $(this).find('div').first();
                        var newColor = newEnabled ? '#4bbc16' : '#fff';
                        circle.css({
                            'border-color': newColor,
                            'background': newEnabled ? newColor : 'transparent',
                            'opacity': newEnabled ? '1' : '0.3'
                        });
                    });

                    list.append(item);
                });
            } else {
                list.append('<div style="padding: 20px; opacity: 0.5;">Список плагинов пуст</div>');
            }

            Lampa.Modal.open({
                title: '',
                html: html,
                size: 'medium',
                mask: true,
                onBack: function() {
                    Lampa.Modal.close();
                    
                    if (needReload) {
                        Lampa.Noty.show('Перезагрузка...');
                        setTimeout(function(){ window.location.reload(); }, 1000);
                    } else {
                        // Возврат в настройки без конфликтов
                        Lampa.Controller.toggle('content');
                    }
                }
            });
        });
    }

    if (window.appready) { addMenu(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { addMenu(); startPlugins(); } }); }
})();
