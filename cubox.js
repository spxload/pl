(function () {
    'use strict';

    // --- CSS FIX (Из анализа tekst.txt: жесткие стили для SVG и слоев) ---
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
        .cubox-store-item {
            display: flex;
            align-items: center;
        }
        .cubox-store-item .cubox-modal-item__content {
            flex: 1;
            min-width: 0;
        }
        .cubox-modal-settings {
            position: fixed;
            top: 0;
            right: 0;
            z-index: 60 !important;
            background: transparent !important;
            padding: 0 !important;
        }
        .cubox-modal-settings .modal {
            z-index: 60 !important;
        }
        .cubox-modal-settings .modal__content {
            position: fixed;
            top: 0;
            left: 100%;
            transition: transform 0.2s;
            background: #262829;
            width: 35%;
            max-width: 35% !important;
            border-radius: 0;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            transform: translateX(0);
        }
        .cubox-modal-settings.animate .modal__content {
            transform: translateX(0);
        }
        @media screen and (max-width: 767px) {
            .cubox-modal-settings .modal__content {
                width: 50%;
                max-width: 50% !important;
            }
        }
        @media screen and (max-width: 580px) {
            .cubox-modal-settings .modal__content {
                width: 70%;
                max-width: 70% !important;
            }
        }
        @media screen and (max-width: 480px) {
            .cubox-modal-settings .modal__content {
                width: 100%;
                max-width: 100% !important;
                left: 0;
                top: unset;
                bottom: 0;
                height: auto;
                border-top-left-radius: 2em;
                border-top-right-radius: 2em;
            }
        }
        .cubox-modal-settings .modal__head {
            flex-shrink: 0;
            padding: 2em;
            padding-bottom: 0;
        }
        .cubox-modal-settings .modal__body {
            flex-grow: 1;
            overflow-y: auto;
            padding: 0;
        }
        .cubox-modal-settings .modal__title {
            font-size: 2.2em;
            font-weight: 300;
        }
    `;
    document.head.appendChild(style);

    var GITHUB_USER = 'spxload'; 
    var GITHUB_REPO = 'pl'; 
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox'; 
    var CUBOX_VERSION = 'v3.5';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = {};
    var needReload = false;
    
    // Инициализируем enabledPlugins из хранилища
    function initEnabledPlugins() {
        try {
            if (typeof Lampa !== 'undefined' && Lampa.Storage) {
                var stored = Lampa.Storage.get(STORAGE_KEY, '{}');
                if (typeof stored === 'string') {
                    enabledPlugins = JSON.parse(stored);
                } else if (typeof stored === 'object' && stored !== null) {
                    enabledPlugins = stored;
                } else {
                    enabledPlugins = {};
                }
            } else {
                enabledPlugins = {};
            }
        } catch(e) {
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
            Object.keys(enabledPlugins).forEach(function(file) {
                if (file && enabledPlugins[file] === true) {
                    loadPlugin(file);
                }
            });
        } catch(e) {
            console.error('Cubox Store: Error starting plugins', e);
        }
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

    function openStore() {
        // Сохраняем текущее состояние needReload в локальную переменную для замыкания
        var needReloadBeforeOpen = (typeof needReload !== 'undefined') ? needReload : false;
        
        // Открываем компонент настроек вместо модального окна
        if (typeof Lampa === 'undefined' || !Lampa.Settings || !Lampa.Settings.create) {
            console.error('Cubox Store: Lampa.Settings is not available');
            return;
        }
        
        try {
            Lampa.Settings.create('cubox_store', {
                onBack: function() {
                    try {
                        // Проверяем, были ли изменения (используем текущее значение needReload)
                        var currentNeedReload = (typeof needReload !== 'undefined') ? needReload : false;
                        var wasNeedReloadBefore = (typeof needReloadBeforeOpen !== 'undefined') ? needReloadBeforeOpen : false;
                        
                        if (currentNeedReload && !wasNeedReloadBefore) {
                            if (typeof Lampa !== 'undefined' && Lampa.Noty) {
                                Lampa.Noty.show('Перезагрузка...');
                            }
                            setTimeout(function() {
                                window.location.reload();
                            }, 1000);
                        } else {
                            // Возвращаемся в главное меню настроек
                            // Компонент уже уничтожен, просто возвращаемся в настройки
                            // Используем requestAnimationFrame для правильного порядка выполнения
                            // Используем двойной requestAnimationFrame для гарантии выполнения после уничтожения компонента
                            requestAnimationFrame(function() {
                                requestAnimationFrame(function() {
                                    try {
                                        if (typeof Lampa !== 'undefined' && Lampa.Settings && Lampa.Settings.create) {
                                            Lampa.Settings.create('main');
                                        } else if (typeof Lampa !== 'undefined' && Lampa.Controller) {
                                            // Fallback: используем Controller для возврата в настройки
                                            Lampa.Controller.toggle('settings');
                                        }
                                    } catch(e2) {
                                        console.error('Cubox Store: Error returning to main settings', e2);
                                        // Последняя попытка - через Controller
                                        if (typeof Lampa !== 'undefined' && Lampa.Controller) {
                                            Lampa.Controller.toggle('settings');
                                        }
                                    }
                                });
                            });
                        }
                    } catch(e) {
                        console.error('Cubox Store: Error in onBack', e);
                        // В случае ошибки все равно пытаемся вернуться в настройки
                        setTimeout(function() {
                            try {
                                if (typeof Lampa !== 'undefined' && Lampa.Settings && Lampa.Settings.create) {
                                    Lampa.Settings.create('main');
                                } else if (typeof Lampa !== 'undefined' && Lampa.Controller) {
                                    Lampa.Controller.toggle('settings');
                                }
                            } catch(e2) {
                                console.error('Cubox Store: Error creating main settings', e2);
                            }
                        }, 50);
                    }
                }
            });
        } catch(e) {
            console.error('Cubox Store: Error creating settings component', e);
        }
    }
    
    // Флаг для предотвращения повторной регистрации слушателя
    var storeListenerRegistered = false;
    
    // Регистрируем компонент настроек
    function registerStoreComponent() {
        // Регистрируем компонент только один раз
        if (typeof Lampa.SettingsApi !== 'undefined' && Lampa.SettingsApi.addComponent) {
            try {
                Lampa.SettingsApi.addComponent({
                    component: 'cubox_store',
                    name: 'Cubox Store',
                    icon: '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'
                });
            } catch(e) {
                console.error('Cubox Store: Error registering component', e);
            }
        }
        
        // Слушаем открытие компонента только один раз
        if (!storeListenerRegistered && typeof Lampa.Settings !== 'undefined' && Lampa.Settings.listener) {
            storeListenerRegistered = true;
            
            Lampa.Settings.listener.follow('open', function (e) {
                if (e && e.name == 'cubox_store' && e.body) {
                    // Ждем, пока компонент создастся
                    var checkComponent = setInterval(function() {
                        var scrollContent = e.body.find('.scroll__content');
                        if (scrollContent.length) {
                            clearInterval(checkComponent);
                            
                            // Загружаем список плагинов
                            fetchManifest(function(plugins) {
                                // Убеждаемся, что enabledPlugins инициализирован
                                if (!enabledPlugins || typeof enabledPlugins !== 'object') {
                                    initEnabledPlugins();
                                }
                                
                                // Создаем элементы списка
                                if (Array.isArray(plugins) && plugins.length > 0) {
                                    plugins.forEach(function(p) {
                                        if (!p || !p.file) return;
                                        
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
                                        
                                        // Сохраняем данные плагина в локальные переменные для замыкания
                                        var pluginFile = p.file;
                                        var pluginStatusColor = statusColor;
                                        
                                        // Обработка выбора
                                        item.on('hover:enter', function() {
                                            try {
                                                if (!pluginFile || pluginFile === 'none') return;
                                                
                                                // Убеждаемся, что enabledPlugins инициализирован
                                                if (!enabledPlugins || typeof enabledPlugins !== 'object') {
                                                    initEnabledPlugins();
                                                }
                                                
                                                var currentEnabled = enabledPlugins[pluginFile] === true;
                                                enabledPlugins[pluginFile] = !currentEnabled;
                                                
                                                try {
                                                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                                                } catch(e) {
                                                    console.error('Cubox Store: Error saving plugin state', e);
                                                }
                                                
                                                needReload = true;
                                                item.data('plugin-enabled', enabledPlugins[pluginFile]);
                                                
                                                // Обновляем визуальное состояние
                                                var newCircle = enabledPlugins[pluginFile] ? 
                                                    `<div class="cubox-select-icon" style="background:${pluginStatusColor}; box-shadow:0 0 6px ${pluginStatusColor}; border:none;"></div>` : 
                                                    `<div class="cubox-select-icon" style="border:2px solid rgba(255,255,255,0.3);"></div>`;
                                                
                                                var contentDiv = item.find('.cubox-modal-item__content');
                                                if (contentDiv.length) {
                                                    item.find('.cubox-select-item').html(newCircle + contentDiv[0].outerHTML);
                                                }
                                                
                                                // Показываем уведомление о необходимости перезагрузки
                                                Lampa.Noty.show('Изменения применятся после перезагрузки');
                                            } catch(e) {
                                                console.error('Cubox Store: Error in hover:enter handler', e);
                                            }
                                        });
                                        
                                        scrollContent.append(item);
                                    });
                                } else {
                                    var emptyItem = $('<div class="settings-param"></div>');
                                    emptyItem.html('<div class="settings-param__name">Нет плагинов</div><div class="settings-param__descr">Список пуст</div>');
                                    scrollContent.append(emptyItem);
                                }
                                
                                // Обновляем коллекцию контроллера после добавления элементов
                                setTimeout(function() {
                                    var scroll = e.body.find('.scroll');
                                    var items = scrollContent.find('.selector');
                                    if (items.length > 0 && scroll.length) {
                                        Lampa.Controller.collectionSet(scroll);
                                        var firstItem = items[0][0];
                                        if (firstItem) {
                                            setTimeout(function() {
                                                Lampa.Controller.collectionFocus(firstItem, scroll);
                                            }, 100);
                                        }
                                    }
                                }, 150);
                            });
                        }
                    }, 50);
                    
                    // Таймаут на случай, если компонент не создался
                    setTimeout(function() {
                        clearInterval(checkComponent);
                    }, 5000);
                }
            });
        }
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
            if (e.name == 'main') {
                var timer = setInterval(function() {
                    var scrollLayer = $('.settings__content .scroll__content');
                    if (scrollLayer.length) {
                        clearInterval(timer);
                        scrollLayer.find('.cubox-menu-item').remove();
                        var first = scrollLayer.find('.settings-folder').first();
                        
                        field.off('hover:enter click').on('hover:enter click', function() {
                            openStore();
                        });

                        if (first.length) first.before(field);
                        else scrollLayer.append(field);
                        
                        // Обновляем коллекцию контроллера после добавления элемента
                        // Это нужно для TV приставки, чтобы можно было переключиться на новый элемент
                        // Settings использует scrollLayer для коллекции
                        setTimeout(function() {
                            // Проверяем, активен ли контроллер настроек
                            var currentController = Lampa.Controller && Lampa.Controller.enabled ? Lampa.Controller.enabled() : null;
                            if (currentController && currentController.name === 'settings') {
                                // Обновляем коллекцию контроллера с новым элементом
                                Lampa.Controller.collectionSet(scrollLayer);
                            }
                        }, 150);
                    }
                }, 50);
            }
        });
    }

    // Инициализация
    function init() {
        initEnabledPlugins();
        registerStoreComponent();
        addMenu();
        startPlugins();
    }
    
    if (window.appready) { 
        init();
    } else { 
        if (typeof Lampa !== 'undefined' && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) { 
                if (e && e.type == 'ready') { 
                    init();
                } 
            });
        } else {
            // Если Lampa еще не загружен, ждем
            var checkLampa = setInterval(function() {
                if (typeof Lampa !== 'undefined' && Lampa.Listener) {
                    clearInterval(checkLampa);
                    Lampa.Listener.follow('app', function (e) { 
                        if (e && e.type == 'ready') { 
                            init();
                        } 
                    });
                }
            }, 100);
            
            // Таймаут на случай, если Lampa не загрузится
            setTimeout(function() {
                clearInterval(checkLampa);
            }, 10000);
        }
    }
})();

