(function () {
    'use strict';

    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v3.4.1';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';

    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;

    var last_controller = null;
    var last_items = null;

    function ensureStyle() {
        if (document.getElementById('cubox-select-style')) return;

        var css = `
            /* кружок */
            .cubox-circle {
                width: 14px !important;
                height: 14px !important;
                min-width: 14px !important;
                border-radius: 50% !important;
                margin-right: 12px !important;
                display: inline-block !important;
                vertical-align: middle !important;
                box-sizing: border-box !important;
                flex-shrink: 0 !important;
            }
            .cubox-circle--on {
                background: #4bbc16 !important;
                border: 2px solid #4bbc16 !important;
                box-shadow: 0 0 8px rgba(75,188,22,.85) !important;
            }
            .cubox-circle--off {
                background: transparent !important;
                border: 2px solid rgba(255,255,255,.28) !important;
                box-shadow: none !important;
            }

            /* выравнивание текста рядом с кружком */
            .cubox-row {
                display: flex !important;
                align-items: center !important;
                min-width: 0 !important;
            }
            .cubox-row__text {
                min-width: 0 !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }

            /* кнопка применения */
            .cubox-apply {
                color: #f44336 !important;
                font-weight: 700 !important;
            }
        `;

        var style = document.createElement('style');
        style.id = 'cubox-select-style';
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
            .then(function (res) { return res.json(); })
            .then(function (data) {
                var json = JSON.parse(decodeURIComponent(escape(window.atob((data.content || '').replace(/\s/g, '')))));
                callback(json);
            })
            .catch(function () {
                var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
                fetch(cdnUrl).then(function (r) { return r.json(); }).then(callback).catch(function () { callback([]); });
            });
    }

    function decorateSelect(items) {
        // ждём, пока Select реально отрисуется
        setTimeout(function () {
            var rows = $('.selectboxlist .selector');
            if (!rows.length) rows = $('.selectbox .selector'); // запасной селектор

            rows.each(function (i) {
                var row = $(this);

                // пропускаем не наши элементы, если вдруг Select рендерит ещё что-то
                if (!items || !items[i]) return;
                var it = items[i];

                // title контейнер — разные сборки Лампы могут иметь разные классы
                var title = row.find('.selectbox__item-title, .selectbox__title, .selectbox__item-name, .selectbox__item').first();
                if (!title.length) title = row;

                // если уже украшено — только обновим кружок
                var existing = title.find('.cubox-circle');
                if (!existing.length) {
                    // оборачиваем текст в ряд с кружком (без HTML в title!)
                    var txt = title.text();
                    title.empty();

                    var wrap = $('<div class="cubox-row"></div>');
                    var circle = $('<span class="cubox-circle"></span>');
                    var text = $('<span class="cubox-row__text"></span>').text(txt);

                    wrap.append(circle);
                    wrap.append(text);
                    title.append(wrap);
                }

                // обновляем состояние
                var circleEl = title.find('.cubox-circle');
                circleEl.toggleClass('cubox-circle--on', !!it.enabled);
                circleEl.toggleClass('cubox-circle--off', !it.enabled);

                // помечаем apply-строку
                if (it.apply) row.addClass('cubox-apply');
            });
        }, 30);
    }

    function openStore() {
        ensureStyle();

        last_controller = (Lampa.Controller && Lampa.Controller.enabled && Lampa.Controller.enabled().name) ? Lampa.Controller.enabled().name : 'content';

        Lampa.Loading.start(function () { Lampa.Loading.stop(); });

        fetchManifest(function (plugins) {
            Lampa.Loading.stop();

            var items = [];

            // 1) обычные плагины
            if (Array.isArray(plugins) && plugins.length) {
                plugins.forEach(function (p) {
                    var isEnabled = enabledPlugins[p.file] === true;

                    items.push({
                        title: p.name,
                        subtitle: 'v' + p.version + ' • ' + p.description,
                        file: p.file,
                        enabled: isEnabled
                    });
                });
            } else {
                items.push({
                    title: 'Список пуст',
                    subtitle: 'Не удалось загрузить plugins.json',
                    empty: true,
                    enabled: false
                });
            }

            // 2) кнопка применения (появляется всегда, но “срабатывает” только когда needReload)
            items.push({
                title: 'Применить изменения (перезагрузка)',
                subtitle: needReload ? 'Готово к применению' : 'Пока нечего применять',
                apply: true,
                enabled: false
            });

            last_items = items;

            Lampa.Select.show({
                title: 'Cubox Store ' + CUBOX_VERSION,
                items: items,

                // важно: не закрывать Select после onSelect (чтобы не было “закрылось–открылось”)
                nohide: true,

                onSelect: function (item) {
                    if (item.empty) return;

                    // применить
                    if (item.apply) {
                        if (needReload) window.location.reload();
                        return;
                    }

                    // переключить
                    enabledPlugins[item.file] = !item.enabled;
                    item.enabled = enabledPlugins[item.file];

                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                    needReload = true;

                    // обновляем только UI кружка и подвал (без переоткрытия)
                    decorateSelect(last_items);
                },

                onBack: function () {
                    // вернём управление туда, где были до открытия (как делает Лампа в своих Select-меню)
                    if (last_controller) Lampa.Controller.toggle(last_controller);

                    // если были изменения — как раньше: перезагрузка
                    if (needReload) {
                        Lampa.Noty.show('Перезагрузка...');
                        setTimeout(function () { window.location.reload(); }, 700);
                    }
                }
            });

            decorateSelect(items);
        });
    }

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
                    openStore();
                });

                if (first.length) first.before(field);
                else scrollLayer.append(field);
            }, 50);
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
