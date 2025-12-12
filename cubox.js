(function () {
    'use strict';

    // =============================
    // НАСТРОЙКИ
    // =============================
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v3.4.2';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';

    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;
    var lastFocusedSettingsEl = null;

    // =============================
    // ЛОГИКА ЗАГРУЗКИ
    // =============================

    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?t=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        // Добавляем обработчик ошибок, чтобы видеть их в консоли, а не просто "Script error"
        script.onerror = function() { console.error('Cubox: Failed to load plugin', filename); };
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

        // Используем jQuery (Lampa его имеет), это надежнее fetch в старых WebView
        $.ajax({
            url: apiUrl,
            dataType: 'json',
            success: function (data) {
                try {
                    var jsonString = decodeURIComponent(escape(window.atob((data.content || '').replace(/\s/g, ''))));
                    callback(JSON.parse(jsonString));
                } catch (e) {
                    console.error('Cubox: JSON parse error', e);
                    useCdnFallback(callback);
                }
            },
            error: function () {
                useCdnFallback(callback);
            }
        });
    }

    function useCdnFallback(callback) {
        var cdnUrl = CDN_BASE + 'plugins.json?t=' + Date.now();
        $.ajax({
            url: cdnUrl,
            dataType: 'json',
            success: function(data) { callback(data); },
            error: function() { callback([]); }
        });
    }

    // =============================
    // СТИЛИ И ИНТЕРФЕЙС
    // =============================

    function ensureStyle() {
        if (document.getElementById('cubox-store-style')) return;

        var css = `
            .cubox-panel { position: absolute; inset: 0; z-index: 5000; display: flex; align-items: center; justify-content: center; pointer-events: auto; }
            .cubox-panel__overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.65); }
            .cubox-panel__content { position: relative; z-index: 2; width: min(880px, 94vw); max-height: 86vh; background: #24252d; border-radius: 18px; border: 2px solid rgba(255,255,255,0.12); box-shadow: 0 12px 32px rgba(0,0,0,0.7); display: flex; flex-direction: column; overflow: hidden; }
            .cubox-panel__header { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); }
            .cubox-panel__title { font-size: 1.3em; font-weight: 700; color: #fff; }
            .cubox-panel__ver { font-size: 0.85em; opacity: 0.7; background: rgba(255,255,255,0.1); padding: 3px 10px; border-radius: 99px; }
            .cubox-panel__body { padding: 10px; overflow-y: auto; -webkit-overflow-scrolling: touch; flex: 1; }
            .cubox-item { display: flex; align-items: center; padding: 12px 14px; margin-bottom: 6px; border-radius: 12px; background: rgba(255,255,255,0.04); transition: background 0.2s; }
            .cubox-item.focus { background: #fff; color: #000; }
            .cubox-item.focus .cubox-circle--off { border-color: #000; }
            .cubox-item.focus .cubox-name { color: #000; }
            .cubox-item.focus .cubox-descr { opacity: 0.7; color: #000; }
            .cubox-circle { width: 16px; height: 16px; min-width: 16px; border-radius: 50%; margin-right: 14px; box-sizing: border-box; flex-shrink: 0; }
            .cubox-circle--on { background: #4bbc16; border: 2px solid #4bbc16; box-shadow: 0 0 8px rgba(75,188,22,0.9); }
            .cubox-circle--off { background: transparent; border: 2px solid rgba(255,255,255,0.3); }
            .cubox-text { min-width: 0; flex: 1; }
            .cubox-name { font-size: 1.1em; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; }
            .cubox-descr { margin-top: 3px; font-size: 0.85em; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .cubox-panel__hint { padding: 10px 18px; font-size: 0.9em; opacity: 0.6; border-top: 1px solid rgba(255,255,255,0.1); text-align: right; background: rgba(0,0,0,0.1); }
        `;

        var style = document.createElement('style');
        style.id = 'cubox-store-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function buildPanelShell() {
        ensureStyle();

        // Поиск контейнера стал более гибким
        var root = $('.settings__body')[0] || $('.settings')[0] || document.body;

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
                    Влево — Закрыть/Назад
                </div>
            </div>
        `;

        // Фикс для позиционирования
        if (window.getComputedStyle(root).position === 'static') {
            root.style.position = 'relative';
        }

        root.appendChild(panel);

        // Клик по оверлею
        $(panel).find('.cubox-panel__overlay').on('click', closeStore);

        return panel;
    }

    function renderList(plugins) {
        var panel = buildPanelShell();
        var list = $(panel).find('.cubox-panel__list');
        list.empty();

        if (!Array.isArray(plugins) || !plugins.length) {
            list.append('<div class="cubox-item">Список пуст или ошибка загрузки</div>');
            return;
        }

        plugins.forEach(function (p) {
            var isEnabled = enabledPlugins[p.file] === true;
            
            var item = $(`
                <div class="cubox-item selector" data-file="${p.file}">
                    <div class="cubox-circle ${isEnabled ? 'cubox-circle--on' : 'cubox-circle--off'}"></div>
                    <div class="cubox-text">
                        <div class="cubox-name">${p.name}</div>
                        <div class="cubox-descr">v${p.version} • ${p.description}</div>
                    </div>
                </div>
            `);

            item.on('hover:enter click', function () {
                togglePlugin(p.file, item);
            });

            list.append(item);
        });
    }

    function togglePlugin(file, itemEl) {
        enabledPlugins[file] = !enabledPlugins[file];
        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
        needReload = true;

        var circle = $(itemEl).find('.cubox-circle');
        var on = enabledPlugins[file] === true;
        
        circle.toggleClass('cubox-circle--on', on);
        circle.toggleClass('cubox-circle--off', !on);
    }

    function attachController() {
        var panel = $('.cubox-panel');
        var items = panel.find('.selector');

        Lampa.Controller.add('cubox_store', {
            toggle: function () {
                Lampa.Controller.collectionFocus(false, panel);
                Lampa.Controller.toggle('content');
            },
            back: function () { closeStore(); },
            left: function () { closeStore(); }, // Добавил выход по "Влево" для удобства
            up: function () {
                if (Lampa.Navigator.canmove('up')) Lampa.Navigator.move('up');
                else Lampa.Controller.toggle('settings_component'); // Если вверх больше некуда — возврат в меню
            },
            down: function () { Lampa.Navigator.move('down'); },
            right: function () { Lampa.Navigator.move('right'); }
        });

        Lampa.Controller.collectionSet(items);
        Lampa.Controller.toggle('cubox_store');

        // Фокус на первый элемент
        setTimeout(function() {
            Lampa.Controller.collectionFocus(items[0], panel);
        }, 50);
    }

    function openStore() {
        Lampa.Loading.start(function () { Lampa.Loading.stop(); });

        fetchManifest(function (plugins) {
            Lampa.Loading.stop();
            try {
                renderList(plugins);
                attachController();
            } catch (e) {
                console.error('Cubox: Render error', e);
                Lampa.Noty.show('Ошибка отображения');
            }
        });
    }

    function closeStore() {
        $('.cubox-panel').remove();

        if (needReload) {
            Lampa.Noty.show('Перезагрузка для применения...');
            setTimeout(function () { window.location.reload(); }, 1000);
            return;
        }

        // Возврат управления
        Lampa.Controller.toggle('settings_component');
        
        if (lastFocusedSettingsEl && lastFocusedSettingsEl.length) {
             // Пытаемся вернуть фокус на кнопку магазина
            Lampa.Controller.collectionFocus(lastFocusedSettingsEl[0], $('.settings__content .scroll__content'));
        }
    }


    // =============================
    // КНОПКА В МЕНЮ
    // =============================

    function addMenu() {
        var field = $(`
            <div class="settings-folder selector cubox-menu-item" data-component="cubox">
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

                field.off('hover:enter click').on('hover:enter click', function () {
                    lastFocusedSettingsEl = $(this);
                    openStore();
                });

                // Вставляем первой кнопкой
                scrollLayer.prepend(field);
            }, 100);
        });
    }

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
