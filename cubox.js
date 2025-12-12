(function () {
    'use strict';

    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v3.4.2';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';

    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;
    var manifestCache = null;

    function ensureStyle() {
        if (document.getElementById('cubox-store-style')) return;

        var css = `
            /* кружок включения */
            .cubox-toggle {
                width: 14px !important;
                height: 14px !important;
                min-width: 14px !important;
                border-radius: 50% !important;
                margin-right: 12px !important;
                display: inline-block !important;
                vertical-align: middle !important;
                box-sizing: border-box !important;
                flex-shrink: 0 !important;
                transition: all .2s ease !important;
            }
            .cubox-toggle--on {
                background: #4bbc16 !important;
                border: 2px solid #4bbc16 !important;
                box-shadow: 0 0 8px rgba(75,188,22,.85) !important;
            }
            .cubox-toggle--off {
                background: transparent !important;
                border: 2px solid rgba(255,255,255,.28) !important;
                box-shadow: none !important;
            }

            /* строка плагина */
            .cubox-plugin-row {
                display: flex !important;
                align-items: center !important;
                width: 100% !important;
            }
            .cubox-plugin-name {
                flex: 1 !important;
                min-width: 0 !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            /* описание плагина */
            .settings-param__descr.cubox-plugin-descr {
                margin-top: 0 !important;
                padding-left: 26px !important;
                opacity: 0.6 !important;
            }
        `;

        var style = document.createElement('style');
        style.id = 'cubox-store-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

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
        if (manifestCache) {
            callback(manifestCache);
            return;
        }

        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();

        fetch(apiUrl)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var json = JSON.parse(decodeURIComponent(escape(window.atob((data.content || '').replace(/\s/g, '')))));
                manifestCache = json;
                callback(json);
            })
            .catch(function () {
                var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
                fetch(cdnUrl).then(function (r) { return r.json(); }).then(function (json) {
                    manifestCache = json;
                    callback(json);
                }).catch(function () {
                    callback([]);
                });
            });
    }

    function togglePlugin(file, currentState) {
        enabledPlugins[file] = !currentState;
        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
        needReload = true;

        // обновляем UI кружка
        var row = $('[data-cubox-file="' + file + '"]');
        if (row.length) {
            var circle = row.find('.cubox-toggle');
            circle.toggleClass('cubox-toggle--on', enabledPlugins[file]);
            circle.toggleClass('cubox-toggle--off', !enabledPlugins[file]);
        }
    }

    function renderPluginParam(plugin) {
        var isEnabled = enabledPlugins[plugin.file] === true;

        var circle = $('<span class="cubox-toggle"></span>');
        circle.toggleClass('cubox-toggle--on', isEnabled);
        circle.toggleClass('cubox-toggle--off', !isEnabled);

        var name = $('<span class="cubox-plugin-name"></span>').text(plugin.name);

        var row = $('<div class="cubox-plugin-row"></div>');
        row.attr('data-cubox-file', plugin.file);
        row.append(circle);
        row.append(name);

        var descr = $('<div class="settings-param__descr cubox-plugin-descr"></div>').text('v' + plugin.version + ' • ' + plugin.description);

        return { row: row, descr: descr };
    }

    function buildStoreComponent() {
        ensureStyle();

        fetchManifest(function (plugins) {
            if (!Array.isArray(plugins) || !plugins.length) {
                Lampa.Noty.show('Не удалось загрузить список плагинов');
                return;
            }

            // добавляем параметры для каждого плагина
            plugins.forEach(function (plugin) {
                Lampa.SettingsApi.addParam({
                    component: 'cubox_store',
                    param: {
                        name: 'cubox_plugin_' + plugin.file.replace(/[^a-zA-Z0-9]/g, '_'),
                        type: 'trigger',
                        default: false
                    },
                    field: {
                        name: plugin.name
                    },
                    onRender: function (item) {
                        var rendered = renderPluginParam(plugin);

                        // заменяем стандартное имя на наш кастомный ряд
                        var nameContainer = item.find('.settings-param__name');
                        if (nameContainer.length) {
                            nameContainer.empty().append(rendered.row);
                        }

                        // добавляем описание
                        item.append(rendered.descr);

                        // вешаем клик
                        item.off('hover:enter').on('hover:enter', function () {
                            var currentState = enabledPlugins[plugin.file] === true;
                            togglePlugin(plugin.file, currentState);
                        });
                    }
                });
            });

            // открываем компонент
            Lampa.Settings.create('cubox_store');
            Lampa.Controller.enabled().controller.back();
        });
    }

    function initStore() {
        // регистрируем компонент один раз
        Lampa.SettingsApi.addComponent({
