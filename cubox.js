(function () {
    'use strict';

    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v3.5';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';

    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;

    // --- Стили для кружков (чтобы было красиво внутри настроек) ---
    function ensureStyle() {
        if (document.getElementById('cubox-native-style')) return;
        var style = document.createElement('style');
        style.id = 'cubox-native-style';
        style.innerHTML = `
            .cubox-status-circle {
                width: 14px;
                height: 14px;
                min-width: 14px;
                border-radius: 50%;
                margin-right: 15px;
                display: inline-block;
                position: relative;
                top: 2px;
                transition: all 0.2s;
            }
            .cubox-status-on {
                background: #4bbc16;
                box-shadow: 0 0 8px #4bbc16;
            }
            .cubox-status-off {
                background: transparent;
                border: 2px solid rgba(255,255,255,0.3);
            }
            .settings-param.selector:hover .cubox-status-off,
            .settings-param.selector.focus .cubox-status-off {
                border-color: rgba(255,255,255,0.7);
            }
        `;
        document.body.appendChild(style);
    }

    // --- Загрузчик скриптов ---
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

    // --- Загрузка манифеста (списка плагинов) ---
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

    // --- Основная логика интеграции в настройки ---
    function init() {
        ensureStyle();

        // 1. Регистрируем компонент "Cubox Store" в системе настроек Лампы
        Lampa.SettingsApi.addComponent({
            component: 'cubox_store_native',
            name: 'Cubox Store',
            icon: '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
        });

        // 2. Слушаем события открытия настроек
        Lampa.Settings.listener.follow('open', function (e) {
            
            // Если открылось ГЛАВНОЕ меню -> переносим кнопку наверх и добавляем версию
            if (e.name == 'main') {
                setTimeout(function() {
                    var btn = $('.settings__content .settings-folder[data-component="cubox_store_native"]');
                    if (btn.length) {
                        // Переносим наверх
                        $('.settings__content .scroll__content').prepend(btn);
                        // Дописываем версию
                        btn.find('.settings-folder__descr').text(CUBOX_VERSION);
                    }
                }, 20);
            }

            // Если открылся НАШ раздел -> рисуем список
            if (e.name == 'cubox_store_native') {
                var container = e.body; // Это правая часть окна настроек
                container.empty();

                // Создаем скролл-контейнер (как в родных настройках)
                var scroll = $('<div class="scroll scroll--nofade"><div class="scroll__content" style="padding:1.5em 0;"></div></div>');
                var content = scroll.find('.scroll__content');

                // Показываем загрузку
                var loader = $('<div class="settings-param__name" style="padding:20px; text-align:center;">Загрузка...</div>');
                content.append(loader);
                container.append(scroll);

                fetchManifest(function (plugins) {
                    loader.remove();
                    
                    if (!plugins || !plugins.length) {
                        content.append('<div class="settings-param__name" style="padding:20px;">Ошибка загрузки или список пуст</div>');
                        return;
                    }

                    plugins.forEach(function (p) {
                        var isEnabled = enabledPlugins[p.file] === true;

                        // Верстка элемента "Настроек" (как Interface/Player и т.д.)
                        var item = $(`
                            <div class="settings-param selector" data-file="${p.file}">
                                <div class="settings-param__name" style="display:flex; align-items:center;">
                                    <div class="cubox-status-circle ${isEnabled ? 'cubox-status-on' : 'cubox-status-off'}"></div>
                                    <span>${p.name}</span>
                                </div>
                                <div class="settings-param__descr">v${p.version} • ${p.description}</div>
                            </div>
                        `);

                        // Логика клика
                        item.on('hover:enter click', function () {
                            enabledPlugins[p.file] = !enabledPlugins[p.file];
                            Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                            needReload = true; // Ставим флаг, что нужна перезагрузка

                            // Обновляем визуал кружка мгновенно
                            var circle = $(this).find('.cubox-status-circle');
                            if (enabledPlugins[p.file]) {
                                circle.removeClass('cubox-status-off').addClass('cubox-status-on');
                            } else {
                                circle.removeClass('cubox-status-on').addClass('cubox-status-off');
                            }
                        });

                        content.append(item);
                    });

                    // --- ВАЖНО: Перехват управления для кнопки "Назад" ---
                    // Лампа по умолчанию при 'back' просто вернет в меню.
                    // Нам нужно проверить needReload.
                    
                    Lampa.Controller.add('cubox_list_ctrl', {
                        toggle: function () {
                            // Собираем элементы для навигации
                            Lampa.Controller.collectionSet(scroll);
                            Lampa.Controller.collectionFocus(false, scroll);
                        },
                        up: function () { Lampa.Navigator.move('up'); },
                        down: function () { Lampa.Navigator.move('down'); },
                        left: function () { Lampa.Navigator.move('left'); },
                        right: function () { Lampa.Navigator.move('right'); },
                        back: function () {
                            if (needReload) {
                                Lampa.Noty.show('Применение изменений...');
                                setTimeout(function() { window.location.reload(); }, 500);
                            } else {
                                // Если ничего не меняли - возвращаемся в главное меню настроек
                                Lampa.Settings.main();
                            }
                        }
                    });
                    
                    // Активируем наш контроллер
                    Lampa.Controller.toggle('cubox_list_ctrl');
                });
            }
        });
    }

    if (window.appready) { init(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { init(); startPlugins(); } }); }

})();
