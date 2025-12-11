(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v2.1'; // Версия магазина
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;
    var last_focused = null;

    // Загрузка плагина (с кэш-бастером)
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

    // Запрос манифеста
    function fetchManifest(callback) {
        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();
        
        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                if (data && data.content) {
                    try {
                        var jsonString = decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, ''))));
                        callback(JSON.parse(jsonString));
                    } catch (e) { callback([]); }
                } else { callback([]); }
            })
            .catch(err => {
                var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
                fetch(cdnUrl).then(r => r.json()).then(callback).catch(() => callback([]));
            });
    }

    // Вставка кнопки в меню (как и было)
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
                            last_focused = $(this); // Запоминаем кнопку
                            openStore();
                        });

                        if (first.length) first.before(field);
                        else scrollLayer.append(field);
                        
                        // Обновляем контроллер, чтобы пульт увидел кнопку
                        Lampa.Controller.enable('content');
                    }
                }, 50);
            }
        });
    }

    // Открытие магазина (ИСПРАВЛЕНО)
    function openStore() {
        Lampa.Loading.start(function () { Lampa.Loading.stop(); });

        fetchManifest(function (plugins) {
            Lampa.Loading.stop();

            var items = [];

            // Добавляем заголовок как первый элемент (неактивный)
            items.push({
                title: 'Cubox Store ' + CUBOX_VERSION,
                subtitle: 'Управление плагинами',
                icon: '<div style="opacity:0"></div>', // пустышка
                file: 'header',
                enabled: false
            });

            if (Array.isArray(plugins) && plugins.length > 0) {
                plugins.forEach(function (p) {
                    var isEnabled = enabledPlugins[p.file] === true;
                    var statusColor = isEnabled ? '#4bbc16' : '#fff';
                    
                    var iconHtml = isEnabled ?
                        '<div style="width:14px;height:14px;background:#4bbc16;border-radius:50%;box-shadow:0 0 8px #4bbc16"></div>' :
                        '<div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-radius:50%"></div>';

                    items.push({
                        title: p.name,
                        subtitle: '<span style="opacity: 0.7">' + p.version + '</span> • ' + p.description,
                        icon: iconHtml,
                        file: p.file,
                        enabled: isEnabled,
                        selected: isEnabled // Для галочки справа (если стиль Select поддерживает)
                    });
                });
            } else {
                items.push({ title: 'Нет плагинов', subtitle: 'Список пуст', icon: '', file: 'none' });
            }

            // ИСПОЛЬЗУЕМ Lampa.Select.show, НО С ПРАВИЛЬНЫМ ВЫХОДОМ
            Lampa.Select.show({
                title: 'Cubox Store',
                items: items,
                onSelect: function (item) {
                    if (item.file === 'header' || item.file === 'none') return;

                    enabledPlugins[item.file] = !item.enabled;
                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                    needReload = true;
                    
                    // Перерисовываем меню без закрытия
                    setTimeout(openStore, 10);
                },
                onBack: function () {
                    // 1. Закрываем Select
                    Lampa.Controller.toggle('settings_component');

                    // 2. Если нужны действия после закрытия
                    if (needReload) {
                        Lampa.Noty.show('Применение изменений...');
                        setTimeout(function () { window.location.reload(); }, 1000);
                    } else {
                        // 3. ВОССТАНАВЛИВАЕМ ФОКУС (Критично для Android TV)
                        if (last_focused) {
                            // Небольшая задержка, чтобы UI успел обновиться
                            setTimeout(function() {
                                Lampa.Controller.collectionFocus(last_focused[0], $('.settings__content .scroll__content'));
                            }, 50);
                        }
                    }
                }
            });
        });
    }

    if (window.appready) { addMenu(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { addMenu(); startPlugins(); } }); }
})();
