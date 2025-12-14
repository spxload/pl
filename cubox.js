(function () {
    'use strict';

    // --- CSS FIX (Из анализа tekst.txt: жесткие стили для SVG и слоев) ---
    var style = document.createElement('style');
    style.innerHTML = `
        .cubox-select-icon {
            width: 14px !important;
            height: 14px !important;
            min-width: 14px !important;
            border-radius: 50% !important;
            margin-right: 12px !important;
            flex-shrink: 0 !important;
            display: inline-block !important;
            vertical-align: middle !important;
        }
        .cubox-select-item {
            display: flex !important;
            align-items: center !important;
            width: 100% !important;
            overflow: hidden !important;
        }
        .cubox-select-text {
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            font-size: 1.1em !important;
        }
        .cubox-store-item {
            display: flex;
            align-items: center;
        }
        .cubox-store-item .cubox-modal-item__content {
            flex: 1;
            min-width: 0;
        }
    `;
    document.head.appendChild(style);

    var GITHUB_USER = 'spxload'; 
    var GITHUB_REPO = 'pl'; 
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox'; 
    var CUBOX_VERSION = 'v3.4';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false;

    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?t=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        document.body.appendChild(script);
    }
    
    function startPlugins() {
        Object.keys(enabledPlugins).forEach(function(file) {
            if (enabledPlugins[file]) loadPlugin(file);
        });
    }

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

    function initStore() {
        // Регистрируем компонент настроек
        Lampa.SettingsApi.addComponent({
            component: 'cubox_store',
            name: 'Cubox Store',
            icon: '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
        });
        
        var wasInStore = false;
        var needReloadBeforeStore = false;
        
        // Обработчик открытия компонента
        Lampa.Settings.listener.follow('open', function(e) {
            if (e.name === 'cubox_store') {
                wasInStore = true;
                needReloadBeforeStore = needReload; // Сохраняем состояние до открытия
                buildStoreContent(e.body);
            } else if (wasInStore && e.name === 'main') {
                // Вернулись в главное меню после закрытия компонента
                wasInStore = false;
                // Проверяем, были ли изменения (needReload изменился)
                if (needReload && !needReloadBeforeStore) {
                    // Были изменения, нужно перезагрузить
                    Lampa.Noty.show('Перезагрузка...');
                    setTimeout(function() {
                        window.location.reload();
                    }, 1000);
                }
                // Сбрасываем флаг только если не было изменений
                if (!needReload) {
                    needReloadBeforeStore = false;
                }
            }
        });
    }

    function buildStoreContent(body) {
        // Показываем загрузку
        body.html('<div style="padding: 2em; text-align: center;">Загрузка...</div>');
        
        fetchManifest(function(plugins) {
            // Очищаем содержимое
            body.empty();
            
            // Создаем элементы списка
            if (Array.isArray(plugins) && plugins.length > 0) {
                plugins.forEach(function(p) {
                    var isEnabled = enabledPlugins[p.file] === true;
                    var statusColor = '#4bbc16'; 

                    // Создаем элемент списка
                    var circle = isEnabled ? 
                        `<div class="cubox-select-icon" style="background:${statusColor}; box-shadow:0 0 6px ${statusColor}; border:none;"></div>` : 
                        `<div class="cubox-select-icon" style="border:2px solid rgba(255,255,255,0.3);"></div>`;

                    var item = $('<div class="settings-param selector cubox-store-item"></div>');
                    item.html(`
                        <div class="cubox-select-item">
                            ${circle}
                            <div class="cubox-modal-item__content">
                                <div class="settings-param__name cubox-select-text">${p.name}</div>
                                <div class="settings-param__descr">v${p.version} • ${p.description || ''}</div>
                            </div>
                        </div>
                    `);
                    
                    // Сохраняем данные плагина в элементе
                    item.data('plugin-file', p.file);
                    item.data('plugin-enabled', isEnabled);
                    item.data('plugin-data', p);
                    
                    // Обработка выбора
                    item.on('hover:enter', function() {
                        if (p.file === 'none') return;
                        
                        var currentEnabled = enabledPlugins[p.file] === true;
                        enabledPlugins[p.file] = !currentEnabled;
                        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                        needReload = true;
                        item.data('plugin-enabled', enabledPlugins[p.file]);
                        
                        // Обновляем визуальное состояние
                        var newCircle = enabledPlugins[p.file] ? 
                            `<div class="cubox-select-icon" style="background:${statusColor}; box-shadow:0 0 6px ${statusColor}; border:none;"></div>` : 
                            `<div class="cubox-select-icon" style="border:2px solid rgba(255,255,255,0.3);"></div>`;
                        
                        var contentDiv = item.find('.cubox-modal-item__content');
                        item.find('.cubox-select-item').html(newCircle + contentDiv[0].outerHTML);
                        
                        // Показываем уведомление о необходимости перезагрузки
                        if (needReload) {
                            Lampa.Noty.show('Изменения применятся после перезагрузки');
                        }
                    });
                    
                    body.append(item);
                });
            } else {
                var emptyItem = $('<div class="settings-param"></div>');
                emptyItem.html('<div class="settings-param__name">Нет плагинов</div><div class="settings-param__descr">Список пуст</div>');
                body.append(emptyItem);
            }
            
            // Обновляем скролл
            Lampa.Settings.update();
        });
    }

    function addMenu() {
        // Компонент уже зарегистрирован через SettingsApi.addComponent
        // Он автоматически появится в главном меню настроек
        // Обработка открытия уже настроена в initStore()
    }

    // Инициализация
    function init() {
        initStore();
        addMenu();
        startPlugins();
    }
    
    if (window.appready) { 
        init();
    } else { 
        Lampa.Listener.follow('app', function (e) { 
            if (e.type == 'ready') { 
                init();
            } 
        }); 
    }
})();
