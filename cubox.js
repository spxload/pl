(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload'; 
    var GITHUB_REPO = 'pl'; 
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox'; 
    var CUBOX_VERSION = 'v4.0';
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false; 

    // Загрузка плагинов
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

    // Получение списка
    function fetchManifest(callback) {
        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();
        fetch(apiUrl).then(res => res.json()).then(data => {
            if (data && data.content) {
                try {
                    var jsonString = decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, ''))));
                    callback(JSON.parse(jsonString));
                } catch (e) { callback([]); }
            } else { callback([]); }
        }).catch(err => {
            var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
            fetch(cdnUrl).then(r=>r.json()).then(callback).catch(()=>callback([]));
        });
    }

    // Интеграция в настройки через API
    function addSettingsComponent() {
        // 1. Создаем компонент
        Lampa.SettingsApi.addComponent({
            component: 'cubox_store',
            name: 'Cubox',
            icon: '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
        });

        // 2. Добавляем параметры (плагины)
        // Но так как список динамический, мы будем его грузить при открытии
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'cubox_store') {
                e.body.empty(); // Очищаем старое
                
                var scroll = e.body.find('.scroll__content');
                if(!scroll.length) {
                     scroll = $('<div class="scroll__content"></div>');
                     e.body.append(scroll);
                }

                // Заголовок с версией
                Lampa.SettingsApi.addParam(scroll, {
                    param: { name: 'cubox_ver', type: 'title' },
                    field: { name: 'Cubox Store', description: CUBOX_VERSION },
                    onChange: function(){}
                });

                Lampa.Loading.start(function(){ Lampa.Loading.stop(); });

                fetchManifest(function(plugins) {
                    Lampa.Loading.stop();
                    
                    if (Array.isArray(plugins) && plugins.length > 0) {
                        plugins.forEach(function(p) {
                            var isEnabled = enabledPlugins[p.file] === true;
                            
                            // Добавляем переключатель для каждого плагина
                            Lampa.SettingsApi.addParam(scroll, {
                                param: { 
                                    name: 'cubox_plugin_' + p.file, 
                                    type: 'trigger', 
                                    default: isEnabled 
                                },
                                field: { 
                                    name: p.name, 
                                    description: p.version + ' - ' + p.description 
                                },
                                onChange: function(value) {
                                    enabledPlugins[p.file] = value;
                                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                                    needReload = true;
                                }
                            });
                        });
                    } else {
                        Lampa.SettingsApi.addParam(scroll, {
                            param: { name: 'cubox_empty', type: 'title' },
                            field: { name: 'Нет плагинов', description: 'Список пуст или ошибка сети' }
                        });
                    }

                    // Кнопка перезагрузки, если были изменения
                    Lampa.SettingsApi.addParam(scroll, {
                        param: { name: 'cubox_reload', type: 'button' },
                        field: { name: 'Применить изменения', description: 'Перезагрузить приложение' },
                        onChange: function() {
                            window.location.reload();
                        }
                    });
                });
            }
        });
    }

    if (window.appready) { addSettingsComponent(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { addSettingsComponent(); startPlugins(); } }); }
})();
