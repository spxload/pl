(function () {
    'use strict';

    // --- CSS ---
    var style = document.createElement('style');
    style.innerHTML = `
        .cubox-select-icon {
            width: 14px !important;
            height: 14px !important;
            min-width: 14px !important;
            min-height: 14px !important;
            border-radius: 50% !important;
            margin-right: 12px !important;
            margin-left: 0 !important;
            flex-shrink: 0 !important;
            display: inline-block !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
            overflow: visible !important;
        }
        .cubox-select-item {
            display: flex !important;
            align-items: center !important;
            width: 100% !important;
            overflow: visible !important;
            padding-left: 0 !important;
        }
        .cubox-store-item {
            overflow: visible !important;
            padding-left: 12px !important;
        }
        .settings-param.cubox-store-item {
            overflow: visible !important;
            padding-left: 12px !important;
        }
        .cubox-select-text {
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            font-size: 1.1em !important;
        }
        .cubox-store-item .cubox-modal-item__content {
            flex: 1;
            min-width: 0;
        }

        /* Обёртки для правой части с иконкой ! */
        .cubox-select-item-with-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        .cubox-select-main {
            display: flex;
            align-items: center;
            flex: 1;
            min-width: 0;
        }
        .cubox-select-right {
            display: flex;
            align-items: center;
            margin-left: 8px;
        }

        /* Иконка с восклицательным знаком */
        .cubox-info-icon {
            width: 18px;
            height: 18px;
            min-width: 18px;
            min-height: 18px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.7);
            color: #fff;
            font-size: 12px;
            line-height: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 8px;
            flex-shrink: 0;
            opacity: 0.8;
        }
        .cubox-info-icon span {
            transform: translateY(-0.5px);
        }
        .cubox-info-icon--active {
            border-color: #ffcc33;
            box-shadow: 0 0 8px rgba(255, 204, 51, 0.8);
            opacity: 1;
        }

        /* Внутренности модалки описания */
        .cubox-plugin-details {
            max-height: 70vh;
            overflow-y: auto;
        }
        .cubox-plugin-details .settings-param__name {
            font-weight: 500;
        }
        .cubox-plugin-details img {
            max-width: 100%;
            border-radius: 8px;
            margin-top: 0.5em;
        }
    `;
    document.head.appendChild(style);

    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v4.0';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = {};
    var needReload = false;

    function initEnabledPlugins() {
        try {
            if (typeof Lampa !== 'undefined' && Lampa.Storage) {
                var stored = Lampa.Storage.get(STORAGE_KEY, '{}');
                enabledPlugins = (typeof stored === 'object') ? stored : JSON.parse(stored);
            }
        } catch (e) {
            console.error('Cubox Store: Error loading enabled plugins', e);
            enabledPlugins = {};
        }
    }

    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?t=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        document.body.appendChild(script);
    }

    function startPlugins() {
        if (!enabledPlugins || typeof enabledPlugins !== 'object') {
            enabledPlugins = {};
            return;
        }
        try {
            Object.keys(enabledPlugins).forEach(function (file) {
                if (file && enabledPlugins[file] === true) {
                    loadPlugin(file);
                }
            });
        } catch (e) {
            console.error('Cubox Store: Error starting plugins', e);
        }
    }

    function fetchManifest(callback) {
        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();
        fetch(apiUrl)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var json = JSON.parse(decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, '')))));
                callback(json);
            })
            .catch(function () {
                var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
                fetch(cdnUrl).then(function (r) { return r.json(); }).then(callback).catch(function () { callback([]); });
            });
    }

    // --- ЛОГИКА ОТРИСОВКИ cubox_store ---
    function registerStoreComponent() {
        if (!Lampa.Settings || !Lampa.Settings.listener) return;

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name !== 'cubox_store') return;

            e.body.find('.settings__title').text('Cubox Store');

            var scroll = e.body.find('.scroll');
            var scrollContent = e.body.find('.scroll__content');

            scrollContent.html('<div class="settings-param"><div class="settings-param__name">Загрузка...</div></div>');

            fetchManifest(function (plugins) {
                if (!enabledPlugins || typeof enabledPlugins !== 'object') {
                    initEnabledPlugins();
                }

                scrollContent.empty();

                if (Array.isArray(plugins) && plugins.length > 0) {
                    plugins.forEach(function (p) {
                        if (!p || !p.file) return;

                        var isEnabled = enabledPlugins[p.file] === true;
                        var statusColor = '#4bbc16';
                        var hasInfo = p.description || p.long_description || p.features || p.image;

                        var circle = isEnabled
                            ? '<div class="cubox-select-icon" style="background:' + statusColor + '; box-shadow:0 0 6px ' + statusColor + '; border:none;"></div>'
                            : '<div class="cubox-select-icon" style="border:2px solid rgba(255,255,255,0.3);"></div>';

                        var infoIconHtml = hasInfo
                            ? '<div class="cubox-info-icon cubox-info-icon--active" data-plugin-info="' + p.file + '"><span>!</span></div>'
                            : '';

                        var item = $('<div class="settings-param selector cubox-store-item"></div>');
                        item.html(
                            '<div class="cubox-select-item-with-info">' +
                                '<div class="cubox-select-main">' +
                                    circle +
                                    '<div class="cubox-modal-item__content">' +
                                        '<div class="settings-param__name cubox-select-text">' + p.name + '</div>' +
                                        '<div class="settings-param__descr">v' + p.version + ' • ' + (p.description || '') + '</div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="cubox-select-right">' +
                                    infoIconHtml +
                                '</div>' +
                            '</div>'
                        );

                        item.data('plugin-file', p.file);
                        item.data('plugin-enabled', isEnabled);
                        item.data('plugin-data', p);

                        // Тоггл включения/выключения по клику по строке
                        item.on('hover:enter click', function (evt) {
                            // Если кликнули по иконке "!", не трогаем состояние плагина
                            if ($(evt.target).closest('.cubox-info-icon').length) return;

                            try {
                                var pluginFile = p.file;
                                if (!pluginFile || pluginFile === 'none') return;

                                if (!enabledPlugins || typeof enabledPlugins !== 'object') {
                                    initEnabledPlugins();
                                }

                                var currentEnabled = enabledPlugins[pluginFile] === true;
                                enabledPlugins[pluginFile] = !currentEnabled;

                                try {
                                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                                } catch (e) {
                                    console.error('Cubox Store: Error saving plugin state', e);
                                }

                                needReload = true;
                                item.data('plugin-enabled', enabledPlugins[pluginFile]);

                                var newCircle = enabledPlugins[pluginFile]
                                    ? '<div class="cubox-select-icon" style="background:' + statusColor + '; box-shadow:0 0 6px ' + statusColor + '; border:none;"></div>'
                                    : '<div class="cubox-select-icon" style="border:2px solid rgba(255,255,255,0.3);"></div>';

                                item.find('.cubox-select-icon').replaceWith(newCircle);

                                Lampa.Noty.show('Изменения применятся после перезагрузки');
                            } catch (e) {
                                console.error('Cubox Store: Error toggle plugin', e);
                            }
                        });

                        scrollContent.append(item);
                    });
                } else {
                    scrollContent.html('<div class="settings-param"><div class="settings-param__name">Нет плагинов</div></div>');
                }

                // Обработчик на иконку "!"
                scrollContent
                    .off('hover:enter.cubox-info click.cubox-info')
                    .on('hover:enter.cubox-info click.cubox-info', '.cubox-info-icon', function (evt) {
                        evt.stopPropagation();

                        var icon = $(this);
                        var item = icon.closest('.cubox-store-item');
                        var pdata = item.data('plugin-data') || {};

                        var descHtml =
                            '<div class="cubox-plugin-details">' +
                                '<div class="settings-param">' +
                                    '<div class="settings-param__name">' + (pdata.name || 'Плагин') + '</div>' +
                                    '<div class="settings-param__descr">Версия: v' + (pdata.version || '—') + '</div>' +
                                '</div>' +
                                (pdata.description
                                    ? '<div class="settings-param">' +
                                        '<div class="settings-param__name">Кратко</div>' +
                                        '<div class="settings-param__descr">' + pdata.description + '</div>' +
                                    '</div>'
                                    : '') +
                                (pdata.long_description
                                    ? '<div class="settings-param">' +
                                        '<div class="settings-param__name">Описание</div>' +
                                        '<div class="settings-param__descr">' + pdata.long_description + '</div>' +
                                    '</div>'
                                    : '') +
                                (pdata.features
                                    ? '<div class="settings-param">' +
                                        '<div class="settings-param__name">Особенности</div>' +
                                        '<div class="settings-param__descr">' + pdata.features + '</div>' +
                                    '</div>'
                                    : '') +
                                (pdata.image
                                    ? '<div class="settings-param">' +
                                        '<div class="settings-param__name">Скриншот</div>' +
                                        '<div class="settings-param__descr">' +
                                            '<img src="' + pdata.image + '">' +
                                        '</div>' +
                                    '</div>'
                                    : '') +
                            '</div>';

                        if (typeof Lampa !== 'undefined' && Lampa.Modal && Lampa.Modal.open) {
                            // ВАЖНО: Lampa.Modal сама ведёт стек, после закрытия вернёт фокус в cubox_store
                            Lampa.Modal.open({
                                title: pdata.name || 'Информация о плагине',
                                html: $(descHtml),
                                size: 'small',
                                align: 'center',
                                mask: true,
                                onBack: function () {
                                    Lampa.Modal.close();
                                }
                            });
                        }
                    });

                // Навигация пульта по списку плагинов
                try {
                    Lampa.Controller.collectionSet(scrollContent);
                    var first = scrollContent.find('.selector').first();
                    if (first.length) {
                        Lampa.Controller.collectionFocus(first, scrollContent);
                    }
                } catch (e2) {
                    console.error('Cubox Store: navigation error', e2);
                }
            });
        });
    }

    // --- Пункт в меню настроек ---
    function addMenu() {
        if (!Lampa.Settings || !Lampa.Settings.listener) return;

        var field = $(
            '<div class="settings-folder selector cubox-menu-item">' +
                '<div class="settings-folder__icon">' +
                    '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>' +
                        '<polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>' +
                        '<line x1="12" y1="22.08" x2="12" y2="12"></line>' +
                    '</svg>' +
                '</div>' +
                '<div class="settings-folder__name">Cubox Store</div>' +
                '<div class="settings-folder__descr">' + CUBOX_VERSION + '</div>' +
            '</div>'
        );

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name !== 'main') return;

            var timer = setInterval(function () {
                var scrollLayer = $('.settings__content .scroll__content');
                if (scrollLayer.length) {
                    clearInterval(timer);

                    scrollLayer.find('.cubox-menu-item').remove();
                    var first = scrollLayer.find('.settings-folder').first();

                    field.off('hover:enter click').on('hover:enter click', function () {
                        Lampa.Settings.create('cubox_store', {
                            onBack: function () {
                                if (needReload) {
                                    Lampa.Noty.show('Перезагрузка...');
                                    setTimeout(function () { window.location.reload(); }, 1000);
                                } else {
                                    Lampa.Settings.create('main');
                                }
                            }
                        });
                    });

                    if (first.length) first.before(field);
                    else scrollLayer.append(field);

                    try {
                        Lampa.Controller.collectionSet(scrollLayer);
                    } catch (e2) {
                        console.error('Cubox Store: settings nav error', e2);
                    }
                }
            }, 50);
        });
    }

    function init() {
        initEnabledPlugins();
        registerStoreComponent();
        addMenu();
        startPlugins();
    }

    if (window.appready) init();
    else {
        if (typeof Lampa !== 'undefined' && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) {
                if (e && e.type === 'ready') init();
            });
        } else {
            var checkLampa = setInterval(function () {
                if (typeof Lampa !== 'undefined' && Lampa.Listener) {
                    clearInterval(checkLampa);
                    Lampa.Listener.follow('app', function (e) {
                        if (e && e.type === 'ready') init();
                    });
                }
            }, 100);
            setTimeout(function () { clearInterval(checkLampa); }, 10000);
        }
    }
})();
