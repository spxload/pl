(function () {
    'use strict';

    // =============================
    // КОНФИГУРАЦИЯ
    // =============================
    var GITHUB_USER = 'spxload';
    var GITHUB_REPO = 'pl';
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox';
    var CUBOX_VERSION = 'v3.5';
    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';

    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}') || {};
    var needReload = false;

    // =============================
    // ЗАГРУЗКА И СТАРТ ПЛАГИНОВ
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

    // =============================
    // ИНТЕГРАЦИЯ В НАСТРОЙКИ
    // =============================

    function addSettingsComponent() {
        // Добавляем новый компонент настроек
        Lampa.SettingsApi.addComponent({
            component: 'cubox_store',
            name: 'Cubox Store',
            icon: '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
        });

        // Определяем, как рендерить содержимое этого компонента
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'cubox_store') {
                e.body.html(''); // очищаем тело настроек

                var scroll = new Lampa.Scroll({ mask: true, over: true });
                e.body.append(scroll.render());

                var list = document.createElement('div');
                list.className = 'settings-param';
                
                // Загрузка
                var loader = document.createElement('div');
                loader.className = 'settings-param__name';
                loader.innerText = 'Загрузка списка...';
                list.appendChild(loader);
                scroll.append(list);

                fetchManifest(function (plugins) {
                    list.remove(); // убираем лоадер

                    if (!plugins || !plugins.length) {
                        var empty = document.createElement('div');
                        empty.className = 'settings-param__name';
                        empty.innerText = 'Список пуст или ошибка сети';
                        scroll.append(empty);
                        return;
                    }

                    // Отрисовка каждого плагина как переключателя (toggle)
                    plugins.forEach(function (p) {
                        var isEnabled = enabledPlugins[p.file] === true;

                        // Используем стандартный шаблон настроек 'toggle'
                        // Lampa.Template.get('settings_param_trigger', { ... }) или ручная вёрстка как в SettingsApi
                        
                        var item = $(`
                            <div class="settings-param selector" data-type="toggle" data-name="${p.file}">
                                <div class="settings-param__name">${p.name}</div>
                                <div class="settings-param__descr" style="opacity:0.7; font-size:0.9em;">v${p.version} • ${p.description}</div>
                                <div class="settings-param__status">
                                    <div class="settings-param__value">${isEnabled ? 'ВКЛ' : 'ВЫКЛ'}</div>
                                </div>
                            </div>
                        `);

                        item.on('hover:enter', function () {
                            togglePlugin(p.file, item);
                        });

                        scroll.append(item[0]);
                    });
                });
                
                // Обработка выхода из этого раздела
                // Лампа сама обрабатывает 'back' для закрытия компонента, 
                // нам нужно перехватить момент закрытия настроек или смены компонента, чтобы перезагрузить
                var originalDestroy = e.destroy;
                e.destroy = function () {
                    if (needReload) {
                        Lampa.Noty.show('Перезагрузка для применения...');
                        setTimeout(function () { window.location.reload(); }, 500);
                    }
                    if (originalDestroy) originalDestroy();
                };
            }
        });
    }

    function togglePlugin(file, itemEl) {
        enabledPlugins[file] = !enabledPlugins[file];
        var isEnabled = enabledPlugins[file];
        
        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
        needReload = true; // флаг, что нужно перезагрузить при выходе

        // Обновляем текст статуса сразу
        itemEl.find('.settings-param__value').text(isEnabled ? 'ВКЛ' : 'ВЫКЛ');
        
        // Визуально подсвечиваем изменение (опционально, если CSS лампы не хватает)
        if (isEnabled) itemEl.find('.settings-param__status').addClass('active');
        else itemEl.find('.settings-param__status').removeClass('active');
    }

    // =============================
    // СТАРТ
    // =============================

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
