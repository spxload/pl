(function () {
    'use strict';

    // =============================================================
    // 1. CSS СТИЛИ (Как в присланном файле - жестко фиксируем вид)
    // =============================================================
    var style = document.createElement('style');
    style.innerHTML = `
        .cubox-item {
            display: flex !important;
            align-items: center !important;
            padding: 16px 20px !important;
            border-bottom: 1px solid rgba(255,255,255,0.05) !important;
            cursor: pointer !important;
            position: relative !important;
        }
        .cubox-icon {
            width: 14px !important;
            height: 14px !important;
            min-width: 14px !important;
            border-radius: 50% !important;
            margin-right: 15px !important;
            flex-shrink: 0 !important;
            transition: all 0.2s ease-out !important;
        }
        .cubox-content {
            flex-grow: 1 !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
        }
        .cubox-title {
            font-size: 1.1em !important;
            font-weight: 500 !important;
            color: #fff !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            line-height: 1.2 !important;
        }
        .cubox-descr {
            font-size: 0.85em !important;
            opacity: 0.6 !important;
            margin-top: 4px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        /* Анимация нажатия как в нативных настройках */
        .cubox-item.focus {
            background-color: rgba(255, 255, 255, 0.1) !important;
            transform: scale(1.01) !important;
        }
    `;
    document.head.appendChild(style);

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload'; 
    var GITHUB_REPO = 'pl'; 
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox'; 
    var CUBOX_VERSION = 'v6.0';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;

    // --- Логика загрузки ---
    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?t=' + Date.now();
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

    // ==========================================
    // ГЛАВНАЯ ЛОГИКА ИНТЕРФЕЙСА
    // ==========================================
    function init() {
        // 1. Создаем компонент (Нативный способ)
        Lampa.SettingsApi.addComponent({
            component: 'cubox_store',
            name: 'Cubox', // Просто имя, версию добавим скриптом
            icon: '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
        });

        // 2. Слушаем события
        Lampa.Settings.listener.follow('open', function (e) {
            
            // --- ЭТАП 1: Меню настроек (Перенос кнопки вверх) ---
            if (e.name == 'main') {
                var timer = setInterval(function() {
                    // Ищем нашу кнопку
                    var btn = $('.settings__content .settings-folder[data-component="cubox_store"]');
                    if (btn.length) {
                        clearInterval(timer);
                        
                        // ПЕРЕНОСИМ НАВЕРХ
                        var container = $('.settings__content .scroll__content');
                        if (container.length) container.prepend(btn);
                        
                        // ДОБАВЛЯЕМ ВЕРСИЮ В ОПИСАНИЕ
                        var descr = btn.find('.settings-folder__descr');
                        if (descr.length) descr.text(CUBOX_VERSION);
                        else btn.find('.settings-folder__name').after('<div class="settings-folder__descr">' + CUBOX_VERSION + '</div>');
                        
                        // Обновляем навигацию
                        Lampa.Controller.enable('content');
                    }
                }, 20);
            }

            // --- ЭТАП 2: Внутри Cubox (Отрисовка списка) ---
            if (e.name == 'cubox_store') {
                e.body.empty();
                
                // Создаем скролл-контейнер
                var scroll = $('<div class="scroll__content"></div>');
                
                // Красивый заголовок
                scroll.append(`
                    <div class="settings-param__name" style="padding: 20px 20px 10px; font-size: 1.5em; font-weight: bold;">
                        Магазин <span style="font-size: 0.6em; opacity: 0.5; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${CUBOX_VERSION}</span>
                    </div>
                `);

                e.body.append(scroll);
                Lampa.Loading.start(function(){ Lampa.Loading.stop() });

                fetchManifest(function(plugins) {
                    Lampa.Loading.stop();

                    if (Array.isArray(plugins) && plugins.length > 0) {
                        plugins.forEach(function(p) {
                            var isEnabled = enabledPlugins[p.file] === true;
                            var statusColor = '#4bbc16';

                            // --- ГЕНЕРАЦИЯ HTML ---
                            // Используем класс 'selector' - это ключевой момент для навигации Лампы
                            // Используем классы 'cubox-*' из CSS выше для стиля
                            
                            var iconStyle = isEnabled ? 
                                `background:${statusColor}; box-shadow:0 0 8px ${statusColor}; border:2px solid ${statusColor}; opacity:1;` : 
                                `background:transparent; border:2px solid rgba(255,255,255,0.3); opacity:0.3;`;

                            var item = $(`
                                <div class="cubox-item selector">
                                    <div class="cubox-icon" style="${iconStyle}"></div>
                                    <div class="cubox-content">
                                        <div class="cubox-title">${p.name}</div>
                                        <div class="cubox-descr">v${p.version} • ${p.description}</div>
                                    </div>
                                </div>
                            `);

                            // Клик
                            item.on('hover:enter click', function() {
                                enabledPlugins[p.file] = !enabledPlugins[p.file];
                                Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                                needReload = true;

                                // Мгновенное обновление визуала без мерцания
                                var newState = enabledPlugins[p.file];
                                var newStyle = newState ? 
                                    `background:${statusColor}; box-shadow:0 0 8px ${statusColor}; border:2px solid ${statusColor}; opacity:1;` : 
                                    `background:transparent; border:2px solid rgba(255,255,255,0.3); opacity:0.3;`;
                                
                                $(this).find('.cubox-icon').attr('style', newStyle);
                                
                                // Показываем кнопку релоада
                                $('.cubox-reload-btn').fadeIn();
                            });

                            scroll.append(item);
                        });

                        // Кнопка релоада
                        var reloadBtn = $(`
                            <div class="cubox-item selector cubox-reload-btn" style="display:none; justify-content:center; margin-top:20px; border-bottom:none;">
                                <div style="color:#f44336; font-weight:bold;">Нажмите для перезагрузки</div>
                            </div>
                        `);
                        reloadBtn.on('hover:enter click', function() { window.location.reload(); });
                        scroll.append(reloadBtn);

                    } else {
                        scroll.append('<div style="padding:20px; opacity:0.5;">Список пуст</div>');
                    }
                    
                    // Важно: Сообщаем контроллеру, что контент готов
                    Lampa.Controller.enable('content');
                });
            }
        });
    }

    if (window.appready) { init(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { init(); startPlugins(); } }); }
})();
