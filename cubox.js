(function () {
    'use strict';

    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v5.0';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;

    // --- ЗАГРУЗКА ---
    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?t=' + Date.now();
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
        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                var json = JSON.parse(decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, '')))));
                callback(json);
            })
            .catch(() => {
                var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
                fetch(cdnUrl).then(r => r.json()).then(callback).catch(() => callback([]));
            });
    }

    // --- ИНИЦИАЛИЗАЦИЯ ---
    function init() {
        // 1. Создаем компонент официально (чтобы работала навигация)
        Lampa.SettingsApi.addComponent({
            component: 'cubox_store',
            name: 'Cubox Store', // Имя пока простое, версию добавим потом
            icon: '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
        });

        // 2. ХАК: Переносим кнопку наверх и добавляем версию
        Lampa.Settings.listener.follow('open', function (e) {
            // Когда открывается ГЛАВНОЕ меню настроек
            if (e.name == 'main') {
                var timer = setInterval(function() {
                    // Ищем нашу кнопку по названию компонента (Lampa добавляет data-component)
                    var btn = $('.settings__content .settings-folder[data-component="cubox_store"]');
                    
                    if (btn.length) {
                        clearInterval(timer);
                        
                        // 2.1 Переносим в начало списка
                        var container = $('.settings__content .scroll__content');
                        if (container.length) {
                            container.prepend(btn);
                        }
                        
                        // 2.2 Добавляем версию (если еще нет)
                        var descr = btn.find('.settings-folder__descr');
                        if (descr.text().indexOf(CUBOX_VERSION) === -1) {
                            // Если есть описание - заменяем, если нет - создаем
                            if (descr.length) descr.text(CUBOX_VERSION);
                            else btn.find('.settings-folder__name').after('<div class="settings-folder__descr">' + CUBOX_VERSION + '</div>');
                        }
                        
                        // Обновляем навигацию пульта, так как порядок изменился
                        Lampa.Controller.enable('content');
                    }
                }, 50);
            }
            
            // 3. ОТРИСОВКА ВНУТРЕННОСТЕЙ (Когда нажали на кнопку)
            if (e.name == 'cubox_store') {
                e.body.empty();

                var scroll = e.body.find('.scroll__content');
                if (!scroll.length) {
                    scroll = $('<div class="scroll__content"></div>');
                    e.body.append(scroll);
                }

                // Красивый заголовок внутри
                var title = $(`
                    <div class="settings-param__name" style="padding: 20px 20px 10px; font-size: 1.5em; font-weight: bold;">
                        Cubox Store <span style="font-size: 0.6em; opacity: 0.5; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${CUBOX_VERSION}</span>
                    </div>
                `);
                scroll.append(title);

                Lampa.Loading.start(function () { Lampa.Loading.stop(); });

                fetchManifest(function (plugins) {
                    Lampa.Loading.stop();

                    if (Array.isArray(plugins) && plugins.length > 0) {
                        plugins.forEach(function (p) {
                            var isEnabled = enabledPlugins[p.file] === true;
                            var statusColor = '#4bbc16';

                            // Нативный элемент списка (чтобы не глючило выделение)
                            // Используем стандартные классы, но с нашей иконкой
                            var item = $(`
                                <div class="settings-param selector" style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; transition: background 0.2s;">
                                    <div class="status-icon" style="width: 14px; height: 14px; min-width: 14px; border-radius: 50%; border: 2px solid ${statusColor}; background: ${isEnabled ? statusColor : 'transparent'}; margin-right: 15px; opacity: ${isEnabled ? '1' : '0.3'}; box-shadow: ${isEnabled ? '0 0 8px ' + statusColor : 'none'}; flex-shrink: 0; transition: all 0.2s;"></div>
                                    <div class="settings-param__body" style="flex-grow: 1; overflow: hidden;">
                                        <div class="settings-param__name" style="font-size: 1.1em; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
                                        <div class="settings-param__descr" style="font-size: 0.8em; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">v${p.version} • ${p.description}</div>
                                    </div>
                                </div>
                            `);

                            item.on('hover:enter click', function () {
                                enabledPlugins[p.file] = !enabledPlugins[p.file];
                                Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                                needReload = true;

                                var newState = enabledPlugins[p.file];
                                var icon = $(this).find('.status-icon');
                                icon.css({
                                    'background': newState ? statusColor : 'transparent',
                                    'opacity': newState ? '1' : '0.3',
                                    'box-shadow': newState ? '0 0 8px ' + statusColor : 'none'
                                });

                                $('.reload-btn').fadeIn();
                            });

                            scroll.append(item);
                        });

                        var reloadBtn = $(`
                            <div class="settings-param selector reload-btn" style="display: none; padding: 15px 20px; color: #f44336; font-weight: bold; text-align: center; margin-top: 20px;">
                                Применить изменения (Перезагрузить)
                            </div>
                        `);
                        reloadBtn.on('hover:enter click', function () { window.location.reload(); });
                        scroll.append(reloadBtn);

                    } else {
                        scroll.append('<div style="padding: 20px; opacity: 0.5;">Список пуст или ошибка загрузки</div>');
                    }
                    
                    // Обновляем контроллер, чтобы можно было скроллить
                    Lampa.Controller.enable('content');
                });
            }
        });
    }

    if (window.appready) { init(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { init(); startPlugins(); } }); }
})();
