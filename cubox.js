(function () {
    'use strict';

    // =============================
    // НАСТРОЙКИ
    // =============================
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v3.4';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';

    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}') || {};
    var needReload = false;

    var lastFocusedSettingsEl = null;   // куда вернуть фокус в настройках

    // =============================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // =============================

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
        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO +
            '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();

        fetch(apiUrl)
            .then(function (r) {
                if (!r.ok) throw new Error('GitHub API error');
                return r.json();
            })
            .then(function (data) {
                var jsonString = decodeURIComponent(escape(window.atob((data.content || '').replace(/\s/g, ''))));
                callback(JSON.parse(jsonString));
            })
            .catch(function () {
                var cdnUrl = CDN_BASE + 'plugins.json?t=' + Date.now();
                fetch(cdnUrl)
                    .then(function (r) { return r.json(); })
                    .then(callback)
                    .catch(function () { callback([]); });
            });
    }

    function ensureStyle() {
        if (document.getElementById('cubox-store-style')) return;

        var css = `
            .cubox-panel {
                position: absolute;
                inset: 0;
                z-index: 5000;
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: auto;
            }
            .cubox-panel__overlay {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.65);
            }
            .cubox-panel__content {
                position: relative;
                z-index: 2;
                width: min(880px, 94vw);
                max-height: 86vh;
                background: rgba(30,30,40,0.96);
                border-radius: 18px;
                border: 2px solid rgba(255,255,255,0.12);
                box-shadow: 0 12px 32px rgba(0,0,0,0.7);
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .cubox-panel__header {
                padding: 14px 18px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .cubox-panel__title {
                font-size: 1.25em;
                font-weight: 700;
            }
            .cubox-panel__ver {
                font-size: 0.85em;
                opacity: 0.7;
                background: rgba(255,255,255,0.08);
                padding: 3px 10px;
                border-radius: 999px;
            }
            .cubox-panel__body {
                padding: 10px 10px 4px 10px;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            .cubox-item {
                display: flex;
                align-items: center;
                padding: 11px 12px;
                margin-bottom: 6px;
                border-radius: 12px;
                background: rgba(255,255,255,0.04);
            }
            .cubox-item.focus {
                background: rgba(255,255,255,0.10);
            }
            .cubox-circle {
                width: 14px;
                height: 14px;
                min-width: 14px;
                max-width: 14px;
                border-radius: 50%;
                margin-right: 12px;
                box-sizing: border-box;
                flex-shrink: 0;
            }
            .cubox-circle--on {
                background: #4bbc16;
                border: 2px solid #4bbc16;
                box-shadow: 0 0 8px rgba(75,188,22,0.9);
            }
            .cubox-circle--off {
                background: transparent;
                border: 2px solid rgba(255,255,255,0.28);
            }
            .cubox-text {
                min-width: 0;
                flex: 1;
            }
            .cubox-name {
                font-size: 1.02em;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .cubox-descr {
                margin-top: 2px;
                font-size: 0.85em;
                opacity: 0.75;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .cubox-panel__hint {
                padding: 6px 12px 10px 12px;
                font-size: 0.8em;
                opacity: 0.7;
                border-top: 1px solid rgba(255,255,255,0.1);
            }
        `;

        var style = document.createElement('style');
        style.id = 'cubox-store-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // =============================
    // ПАНЕЛЬ ВНУТРИ НАСТРОЕК
    // =============================

    function buildPanelShell() {
        ensureStyle();

        // ищем контейнер настроек
        var root = document.querySelector('.settings .settings__body') ||
                   document.querySelector('.settings__body') ||
                   document.querySelector('.settings');

        if (!root) return null;
        if (root.querySelector('.cubox-panel')) return root.querySelector('.cubox-panel');

        var panel = document.createElement('div');
        panel.className = 'cubox-panel';
        panel.innerHTML = `
            <div class="cubox-panel__overlay"></div>
            <div class="cubox-panel__content">
                <div class="cubox-panel__header">
                    <div class="cubox-panel__title">Cubox Store</div>
                    <div class="cubox-panel__ver">${CUBOX_VERSION}</div>
                </div>
                <div class="cubox-panel__body">
                    <div class="cubox-panel__list"></div>
                </div>
                <div class="cubox-panel__hint">
                    OK — включить/выключить плагин. Назад — закрыть и перезагрузить, если были изменения.
                </div>
            </div>
        `;

        // чтобы абсолют сидел в нужных границах
        var style = window.getComputedStyle(root);
        if (style.position === 'static') root.style.position = 'relative';

        root.appendChild(panel);

        // клик по подложке = закрытие
        panel.querySelector('.cubox-panel__overlay')
            .addEventListener('click', function () { closeStore(); });

        return panel;
    }

    function renderList(plugins) {
        var panel = buildPanelShell();
        if (!panel) return;

        var list = panel.querySelector('.cubox-panel__list');
        list.innerHTML = '';

        if (!Array.isArray(plugins) || !plugins.length) {
            var empty = document.createElement('div');
            empty.className = 'cubox-item';
            empty.textContent = 'Список пуст или ошибка сети';
            list.appendChild(empty);
            return;
        }

        plugins.forEach(function (p) {
            var isEnabled = enabledPlugins[p.file] === true;

            var item = document.createElement('div');
            item.className = 'cubox-item selector';
            item.dataset.file = p.file;

            item.innerHTML = `
                <div class="cubox-circle ${isEnabled ? 'cubox-circle--on' : 'cubox-circle--off'}"></div>
                <div class="cubox-text">
                    <div class="cubox-name"></div>
                    <div class="cubox-descr"></div>
                </div>
            `;

            item.querySelector('.cubox-name').textContent = p.name;
            item.querySelector('.cubox-descr').textContent = 'v' + p.version + ' • ' + p.description;

            // клик и OK на пульте — одно и то же
            item.addEventListener('click', function () {
                togglePlugin(p.file, item);
            });
            item.addEventListener('hover:enter', function () {
                togglePlugin(p.file, item);
            });

            list.appendChild(item);
        });
    }

    function togglePlugin(file, itemEl) {
        enabledPlugins[file] = !enabledPlugins[file];
        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
        needReload = true;

        var circle = itemEl.querySelector('.cubox-circle');
        var on = enabledPlugins[file] === true;
        circle.classList.toggle('cubox-circle--on', on);
        circle.classList.toggle('cubox-circle--off', !on);
    }

    function attachController() {
        var panel = document.querySelector('.cubox-panel');
        if (!panel) return;

        var body = $(panel);
        var items = body.find('.selector');

        if (!Lampa.Controller._cubox_store_added) {
            Lampa.Controller._cubox_store_added = true;

            Lampa.Controller.add('cubox_store', {
                toggle: function () { },
                back: function () { closeStore(); },
                up: function () { Lampa.Navigator.move('up'); },
                down: function () { Lampa.Navigator.move('down'); },
                left: function () { Lampa.Navigator.move('left'); },
                right: function () { Lampa.Navigator.move('right'); }
            });
        }

        Lampa.Controller.collectionSet(items);
        Lampa.Controller.toggle('cubox_store');

        setTimeout(function () {
            var first = body.find('.cubox-item.selector').first();
            if (first.length) Lampa.Controller.collectionFocus(first[0], body);
        }, 30);
    }

    function openStore() {
        // окно рисуем ВНУТРИ настроек, не закрывая их
        Lampa.Loading.start(function () { Lampa.Loading.stop(); });

        fetchManifest(function (plugins) {
            Lampa.Loading.stop();
            renderList(plugins);
            attachController();
        });
    }

    function closeStore() {
        var panel = document.querySelector('.cubox-panel');
        if (panel) panel.remove();

        // если меняли — как ты и хотел: перезагрузка при выходе
        if (needReload) {
            Lampa.Noty.show('Перезагрузка...');
            setTimeout(function () { window.location.reload(); }, 700);
            return;
        }

        // вернуть управление в настройки
        setTimeout(function () {
            try { Lampa.Controller.toggle('settings_component'); } catch (e) {}
            try { Lampa.Controller.toggle('content'); } catch (e) {}

            if (lastFocusedSettingsEl && lastFocusedSettingsEl.length) {
                var scrollLayer = $('.settings__content .scroll__content');
                if (scrollLayer.length) {
                    try {
                        Lampa.Controller.collectionFocus(lastFocusedSettingsEl[0], scrollLayer);
                    } catch (e) {}
                }
            }
        }, 50);
    }

    // =============================
    // ПУНКТ МЕНЮ В НАСТРОЙКАХ
    // =============================

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
            if (e.name !== 'main') return;

            var timer = setInterval(function () {
                var scrollLayer = $('.settings__content .scroll__content');
                if (!scrollLayer.length) return;

                clearInterval(timer);
                scrollLayer.find('.cubox-menu-item').remove();

                var first = scrollLayer.find('.settings-folder').first();

                field.off('hover:enter click').on('hover:enter click', function () {
                    lastFocusedSettingsEl = $(this);
                    openStore();
                });

                if (first.length) first.before(field);
                else scrollLayer.append(field);
            }, 50);
        });
    }

    // =============================
    // СТАРТ
    // =============================

    if (window.appready) {
        addMenu();
        startPlugins();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                addMenu();
                startPlugins();
            }
        });
    }
})();
