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

    var SETTINGS_COMPONENT = 'cubox_store';
    var lastSettingsPage = null;

    function ensureStyle() {
        if (document.getElementById('cubox-store-style')) return;

        var css = `
            .cubox-circle{
                width:14px;height:14px;min-width:14px;border-radius:50%;
                display:inline-block;box-sizing:border-box;
            }
            .cubox-circle--on{background:#4bbc16;border:2px solid #4bbc16;box-shadow:0 0 8px rgba(75,188,22,.85)}
            .cubox-circle--off{background:transparent;border:2px solid rgba(255,255,255,.28)}
            .cubox-store-wrap{padding-top:8px}
            .cubox-store-row .settings-paramvalue{display:flex;align-items:center;justify-content:flex-end}
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
        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();

        fetch(apiUrl)
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (data) {
                var jsonString = decodeURIComponent(escape(window.atob((data.content || '').replace(/\s/g, ''))));
                callback(JSON.parse(jsonString));
            })
            .catch(function () {
                var cdnUrl = CDN_BASE + 'plugins.json?t=' + Date.now();
                fetch(cdnUrl).then(function (r) { return r.json(); }).then(callback).catch(function () { callback([]); });
            });
    }

    function drawStore(body) {
        ensureStyle();

        body.find('.cubox-store-wrap').remove();

        var wrap = $('<div class="cubox-store-wrap"></div>');
        body.append(wrap);

        Lampa.Loading.start(function(){});

        fetchManifest(function (plugins) {
            Lampa.Loading.stop();

            wrap.empty();

            if (!Array.isArray(plugins) || !plugins.length) {
                wrap.append('<div class="settings-param selector" data-static="true"><div class="settings-paramname">Список плагинов пуст</div></div>');
                try { Lampa.Params.listener.send('updateScroll'); } catch (e) {}
                return;
            }

            plugins.forEach(function (p) {
                var isEnabled = enabledPlugins[p.file] === true;

                var row = $(`
                    <div class="settings-param selector cubox-store-row" data-static="true">
                        <div class="settings-paramname"></div>
                        <div class="settings-paramvalue"><span class="cubox-circle"></span></div>
                        <div class="settings-paramdescr"></div>
                    </div>
                `);

                row.find('.settings-paramname').text(p.name);
                row.find('.settings-paramdescr').text('v' + p.version + ' • ' + p.description);

                var circle = row.find('.cubox-circle');
                circle.toggleClass('cubox-circle--on', isEnabled);
                circle.toggleClass('cubox-circle--off', !isEnabled);

                row.on('hover:enter click', function () {
                    enabledPlugins[p.file] = !enabledPlugins[p.file];
                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);

                    needReload = true;

                    circle.toggleClass('cubox-circle--on', enabledPlugins[p.file] === true);
                    circle.toggleClass('cubox-circle--off', enabledPlugins[p.file] !== true);
                });

                wrap.append(row);
            });

            // важно: чтобы Scroll в настройках пересчитал высоту/позиции
            try { Lampa.Params.listener.send('updateScroll'); } catch (e) {}
        });
    }

    function addSettingsComponent() {
        // Регистрируем “страницу” в настройках (появится как папка)
        Lampa.SettingsApi.addComponent({
            component: SETTINGS_COMPONENT,
            name: 'Cubox Store',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
        });

        // Рисуем магазин внутри настроек и ловим “выход” для автоперезагрузки
        Lampa.Settings.listener.follow('open', function (e) {
            // если выходим ИЗ магазина — применяем (как ты просил)
            if (lastSettingsPage === SETTINGS_COMPONENT && e.name !== SETTINGS_COMPONENT && needReload) {
                Lampa.Noty.show('Перезагрузка...');
                setTimeout(function () { window.location.reload(); }, 700);
                return;
            }

            lastSettingsPage = e.name;

            if (e.name === SETTINGS_COMPONENT) {
                // e.body — DOM компонента настроек
                drawStore(e.body);
            }
        });
    }

    // ---------- start ----------
    if (window.appready) {
        addSettingsComponent();
        startPlugins();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                addSettingsComponent();
                startPlugins();
            }
        });
    }
})();
