(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ
    // ==========================================
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v3.4';
    // ==========================================

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';

    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;

    var lastFocusedSettingsEl = null;  // куда вернуть фокус в настройках
    var modalCreated = false;

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
        if (document.getElementById('cubox-store-style')) return;

        var css = `
            .cubox-modal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center}
            .cubox-modal__overlay{position:absolute;inset:0;background:rgba(0,0,0,.6)}
            .cubox-modal__content{position:relative;z-index:2;width:min(860px,92vw);max-height:88vh;overflow:hidden;
                background:rgba(30,30,40,.95);border:2px solid rgba(255,255,255,.08);border-radius:18px;
                box-shadow:0 10px 30px rgba(0,0,0,.6);display:flex;flex-direction:column}
            .cubox-modal__header{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center}
            .cubox-modal__title{font-size:1.25em;font-weight:700}
            .cubox-modal__ver{font-size:.85em;opacity:.7;background:rgba(255,255,255,.08);padding:2px 10px;border-radius:10px}
            .cubox-modal__body{padding:10px 10px 0 10px;overflow:auto;-webkit-overflow-scrolling:touch}
            .cubox-item{display:flex;align-items:center;padding:12px 12px;border-radius:12px;margin:0 0 8px 0;background:rgba(255,255,255,.05)}
            .cubox-item.focus{background:rgba(255,255,255,.10)}
            .cubox-circle{width:14px;height:14px;min-width:14px;max-width:14px;border-radius:50%;margin-right:12px;flex-shrink:0;box-sizing:border-box}
            .cubox-circle--on{background:#4bbc16;box-shadow:0 0 8px rgba(75,188,22,.9);border:2px solid #4bbc16}
            .cubox-circle--off{background:transparent;border:2px solid rgba(255,255,255,.28)}
            .cubox-text{min-width:0;flex:1}
            .cubox-name{font-size:1.05em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .cubox-descr{margin-top:2px;font-size:.85em;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .cubox-modal__footer{padding:10px 12px 12px 12px;border-top:1px solid rgba(255,255,255,.08);display:flex;gap:10px;justify-content:flex-end}
            .cubox-btn{padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.08)}
            .cubox-btn.focus{background:rgba(255,255,255,.14)}
            .cubox-btn--apply{display:none;background:rgba(244,67,54,.20)}
            .cubox-btn--apply.cubox-btn--show{display:block}
        `;

        var style = document.createElement('style');
        style.id = 'cubox-store-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ---------- settings menu ----------
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
                <div class="settings-folder__name">Cubox</div>
                <div class="settings-folder__descr">${CUBOX_VERSION}</div>
            </div>
        `);

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'main') {
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
            }
        });
    }

    // ---------- custom modal (как в tekst.txt) ----------
    function buildModalShell() {
        ensureStyle();

        if (document.querySelector('.cubox-modal')) return;

        var modal = document.createElement('div');
        modal.className = 'cubox-modal';
        modal.innerHTML = `
            <div class="cubox-modal__overlay"></div>
            <div class="cubox-modal__content">
                <div class="cubox-modal__header">
                    <div class="cubox-modal__title">Cubox Store</div>
                    <div class="cubox-modal__ver">${CUBOX_VERSION}</div>
                </div>
                <div class="cubox-modal__body">
                    <div class="cubox-modal__list"></div>
                </div>
                <div class="cubox-modal__footer">
                    <div class="cubox-btn cubox-btn--apply selector">Применить (перезагрузка)</div>
                    <div class="cubox-btn cubox-btn--close selector">Закрыть</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // overlay click => close
        modal.querySelector('.cubox-modal__overlay').addEventListener('click', closeStore);
        modal.querySelector('.cubox-btn--close').addEventListener('click', closeStore);

        // apply
        modal.querySelector('.cubox-btn--apply').addEventListener('click', function () {
            window.location.reload();
        });

        modalCreated = true;
    }

    function renderList(plugins) {
        var modal = document.querySelector('.cubox-modal');
        var list = modal.querySelector('.cubox-modal__list');
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

        // обновляем кружок на месте (без закрытия/переоткрытия)
        var circle = itemEl.querySelector('.cubox-circle');
        circle.classList.toggle('cubox-circle--on', enabledPlugins[file] === true);
        circle.classList.toggle('cubox-circle--off', enabledPlugins[file] !== true);

        // показываем кнопку "Применить"
        var applyBtn = document.querySelector('.cubox-btn--apply');
        if (applyBtn) applyBtn.classList.add('cubox-btn--show');
    }

    function attachController() {
        // собираем все focusable
        var modal = document.querySelector('.cubox-modal');
        var body = $(modal);
        var items = body.find('.selector');

        // один раз регистрируем контроллер
        if (!Lampa.Controller._cubox_store_added) {
            Lampa.Controller._cubox_store_added = true;

            Lampa.Controller.add('cubox_store', {
                toggle: function () {},
                back: function () { closeStore(); },
                up: function () { Lampa.Navigator.move('up'); },
                down: function () { Lampa.Navigator.move('down'); },
                left: function () { Lampa.Navigator.move('left'); },
                right: function () { Lampa.Navigator.move('right'); }
            });
        }

        Lampa.Controller.collectionSet(items);
        Lampa.Controller.toggle('cubox_store');

        // фокус на первый пункт списка, если есть
        setTimeout(function () {
            var first = body.find('.cubox-item.selector').first();
            if (first.length) Lampa.Controller.collectionFocus(first[0], body);
            else {
                var closeBtn = body.find('.cubox-btn--close.selector').first();
                if (closeBtn.length) Lampa.Controller.collectionFocus(closeBtn[0], body);
            }
        }, 30);
    }

    function openStore() {
        buildModalShell();

        // сброс видимости apply, если ещё ничего не меняли
        var applyBtn = document.querySelector('.cubox-btn--apply');
        if (applyBtn) applyBtn.classList.toggle('cubox-btn--show', needReload);

        Lampa.Loading.start(function () { Lampa.Loading.stop(); });

        fetchManifest(function (plugins) {
            Lampa.Loading.stop();
            renderList(plugins);
            attachController();
        });
    }

    function closeStore() {
        var modal = document.querySelector('.cubox-modal');
        if (modal) modal.remove();

        // если меняли — по старой логике предлагаем перезагрузку
        if (needReload) {
            Lampa.Noty.show('Перезагрузка...');
            setTimeout(function () { window.location.reload(); }, 700);
            return;
        }

        // вернуть управление в настройки (как было в твоём рабочем варианте)
        setTimeout(function () {
            try { Lampa.Controller.toggle('settings_component'); } catch (e) {}
            try { Lampa.Controller.toggle('content'); } catch (e) {}

            // вернуть фокус на кнопку Cubox
            var scrollLayer = $('.settings__content .scroll__content');
            if (lastFocusedSettingsEl && lastFocusedSettingsEl.length && scrollLayer.length) {
                try { Lampa.Controller.collectionFocus(lastFocusedSettingsEl[0], scrollLayer); } catch (e) {}
            }
        }, 50);
    }

    // ---------- start ----------
    if (window.appready) { addMenu(); startPlugins(); }
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') { addMenu(); startPlugins(); }
        });
    }
})();
