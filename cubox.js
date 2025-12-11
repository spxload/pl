(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v2.3';
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');

    // Загрузка
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

    // API
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

    // --- ГЛАВНАЯ МАГИЯ: Использование Settings API ---
    function init() {
        // 1. Регистрируем компонент "cubox_store"
        // Лампа сама добавит кнопку в меню и обработает переход в этот раздел
        Lampa.SettingsApi.addComponent({
            component: 'cubox_store',
            name: 'Cubox Store',
            icon: '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
        });

        // 2. Слушаем открытие этого компонента
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'cubox_store') {
                e.body.empty(); // Чистим экран

                var scroll = e.body.find('.scroll__content');
                if (!scroll.length) {
                    scroll = $('<div class="scroll__content"></div>');
                    e.body.append(scroll);
                }

                // Заголовок
                Lampa.SettingsApi.addParam(scroll, {
                    param: { name: 'title', type: 'title' },
                    field: { name: 'Cubox Store', description: 'Версия ' + CUBOX_VERSION },
                    onChange: function(){}
                });

                Lampa.Loading.start(function(){ Lampa.Loading.stop(); });

                fetchManifest(function(plugins) {
                    Lampa.Loading.stop();

                    if (Array.isArray(plugins) && plugins.length > 0) {
                        plugins.forEach(function(p) {
                            var isEnabled = enabledPlugins[p.file] === true;

                            // Добавляем каждый плагин как переключатель
                            Lampa.SettingsApi.addParam(scroll, {
                                param: { 
                                    name: p.file, 
                                    type: 'trigger', // Стандартный переключатель (ВКЛ/ВЫКЛ)
                                    default: isEnabled 
                                },
                                field: { 
                                    name: p.name, 
                                    description: p.version + ' • ' + p.description 
                                },
                                onChange: function(value) {
                                    enabledPlugins[p.file] = value;
                                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                                    
                                    // Показываем кнопку перезагрузки, если что-то изменили
                                    var reloadBtn = scroll.find('.reload-btn');
                                    if(reloadBtn.length) reloadBtn.removeClass('hide');
                                }
                            });
                        });

                        // Кнопка перезагрузки (скрыта по умолчанию)
                        var btnHtml = $(`<div class="selector reload-btn hide" style="text-align: center; color: #f44336; margin-top: 20px;">Перезагрузить приложение</div>`);
                        btnHtml.on('hover:enter click', function() { window.location.reload(); });
                        scroll.append(btnHtml);

                    } else {
                        scroll.append('<div style="padding: 20px; opacity: 0.5;">Нет доступных плагинов</div>');
                    }
                });
            }
        });
    }

    if (window.appready) { init(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { init(); startPlugins(); } }); }
})();
