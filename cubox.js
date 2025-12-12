(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v3.4.2';
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';

    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;

    var cuboxSection = null;  // контейнер плагинов внутри настроек

    // ---------- helpers ----------
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
            .then(function (r) {
                if (!r.ok) throw new Error('API Error: ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var jsonString = decodeURIComponent(escape(window.atob((data.content || '').replace(/\s/g, ''))));
                callback(JSON.parse(jsonString));
            })
            .catch(function () {
                var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
                fetch(cdnUrl).then(function (r) { return r.json(); }).then(callback).catch(function () { callback([]); });
            });
    }

    function ensureStyle() {
        if (document.getElementById('cubox-style')) return;

        var css = `
            #cubox-section { padding: 12px; border-top: 1px solid rgba(255,255,255,.08); }
            .cubox-item { display: flex; align-items: center; padding: 12px 0; margin: 0; border-radius: 8px; cursor: pointer; transition: background .15s ease; }
            .cubox-item:hover, .cubox-item.focus { background: rgba(255,255,255,.08) !important; }
            .cubox-circle { width: 14px !important; height: 14px !important; min-width: 14px !important; border-radius: 50% !important; margin-right: 12px !important; flex-shrink: 0 !important; box-sizing: border-box !important; }
            .cubox-circle--on { background: #4bbc16 !important; box-shadow: 0 0 8px rgba(75,188,22,.9) !important; border: 2px solid #4bbc16 !important; }
            .cubox-circle--off { background: transparent !important; border: 2px solid rgba(255,255,255,.28) !important; }
            .cubox-text { flex: 1; min-width: 0; }
            .cubox-name { font-size: 1.05em; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .cubox-descr { margin-top: 2px; font-size: .85em; opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .cubox-empty { text-align: center; opacity: .6; font-style: italic; padding: 40px 20px; }
        `;

        var style = document.createElement('style');
        style.id = 'cubox-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function togglePlugin(file, itemEl) {
        enabledPlugins[file] = !enabledPlugins[file];
        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
        needReload = true;

        // обновляем кружок
        var circle = itemEl.querySelector('.cubox-circle');
        circle.classList.toggle('cubox-circle--on', enabledPlugins[file]);
        circle.classList.toggle('cubox-circle--off', !enabledPlugins[file]);
    }

    function buildCuboxSection(plugins, scrollLayer) {
        ensureStyle();

        // удаляем старую, если есть
        if (cuboxSection) cuboxSection.remove();

        cuboxSection = $('<div id="cubox-section" class="settings-category selector"><div class="settings-category__title">Cubox Store ' + CUBOX_VERSION + '</div></div>');

        var body = $('<div class="settings-category__content"></div>');
        cuboxSection.append(body);

        if (!Array.isArray(plugins) || !plugins.length) {
            body.append('<div class="cubox-empty">Список пуст или ошибка сети</div>');
        } else {
            plugins.forEach(function (p) {
                var item = $('<div class="cubox-item selector"></div>');

                var circle = $('<div class="cubox-circle ' + (enabledPlugins[p.file] ? 'cubox-circle--on' : 'cubox-circle--off') + '"></div>');
                var text = $('<div class="cubox-text"><div class="cubox-name">' + p.name + '</div><div class="cubox-descr">v' + p.version + ' • ' + p.description + '</div></div>');

                item.append(circle).append(text);
                item.on('hover:enter click', function () { togglePlugin(p.file, item[0]); });

                body.append(item);
            });
        }

        scrollLayer.append(cuboxSection);
        return cuboxSection;
    }

    function toggleCuboxSection(scrollLayer) {
        if (cuboxSection && cuboxSection.length) {
            // toggle видимости
            cuboxSection.toggleClass('open');
            if (cuboxSection.hasClass('open')) {
                Lampa.Controller.collectionFocus(cuboxSection.find('.cubox-item.selector').first()[0], scrollLayer);
            }
            return;
        }

        // строим новую
        Lampa.Loading.start();
        fetchManifest(function (plugins) {
            Lampa.Loading.stop();
            var section = buildCuboxSection(plugins, scrollLayer);
            section.addClass('open');
            Lampa.Controller.collectionFocus(section.find('.cubox-item.selector').first()[0], scrollLayer);
        });
    }

    // ---------- перехват выхода из настроек ----------
    function checkReloadOnSettingsClose() {
        if (needReload && cuboxSection) {
            Lampa.Noty.show('Перезагрузка (изменения Cubox)...');
            setTimeout(function () { window.location.reload(); }, 700);
        }
    }

    // ---------- меню ----------
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
                    toggleCuboxSection(scrollLayer);
                });

                if (first.length) first.before(field);
                else scrollLayer.append(field);
            }, 50);
        });

        // перехват закрытия настроек
        Lampa.Settings.listener.follow('close', checkReloadOnSettingsClose);
    }

    // ---------- start ----------
    if (window.appready) { addMenu(); startPlugins(); }
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') { addMenu(); startPlugins(); }
        });
    }
})();
