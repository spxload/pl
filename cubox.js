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
        .cubox-modal-item {
            padding: 1.5em 2em;
            display: flex;
            align-items: center;
            cursor: pointer;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            transition: background-color 0.2s;
        }
        .cubox-modal-item:hover,
        .cubox-modal-item.focus {
            background-color: rgba(255, 255, 255, 0.05);
        }
        .cubox-modal-item__content {
            flex: 1;
            min-width: 0;
        }
        .cubox-modal-item__title {
            font-size: 1.1em;
            margin-bottom: 0.3em;
        }
        .cubox-modal-item__subtitle {
            font-size: 0.9em;
            color: rgba(255, 255, 255, 0.6);
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
    var menuItemElement = null; // Сохраняем ссылку на элемент меню для возврата фокуса

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
        
        menuItemElement = field[0]; // Сохраняем ссылку на элемент
        
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
                    }
                }, 50);
            }
        });
    }

    function openStore() {
        Lampa.Loading.start(function(){ Lampa.Loading.stop(); });
        
        fetchManifest(function(plugins) {
            Lampa.Loading.stop();
            
            // Создаем контент для модального окна
            var content = $('<div class="cubox-modal-content"></div>');
            var firstItem = null;
            
            // Добавляем элементы списка
            if (Array.isArray(plugins) && plugins.length > 0) {
                plugins.forEach(function(p) {
                    var isEnabled = enabledPlugins[p.file] === true;
                    var statusColor = '#4bbc16'; 

                    // Создаем элемент списка
                    var circle = isEnabled ? 
                        `<div class="cubox-select-icon" style="background:${statusColor}; box-shadow:0 0 6px ${statusColor}; border:none;"></div>` : 
                        `<div class="cubox-select-icon" style="border:2px solid rgba(255,255,255,0.3);"></div>`;

                    var item = $('<div class="cubox-modal-item selector"></div>');
                    item.html(`
                        <div class="cubox-select-item">
                            ${circle}
                            <div class="cubox-modal-item__content">
                                <div class="cubox-modal-item__title cubox-select-text">${p.name}</div>
                                <div class="cubox-modal-item__subtitle">v${p.version} • ${p.description || ''}</div>
                            </div>
                        </div>
                    `);
                    
                    // Сохраняем данные плагина в элементе
                    item.data('plugin-file', p.file);
                    item.data('plugin-enabled', isEnabled);
                    
                    // Обработка выбора
                    item.on('hover:enter', function() {
                        if (p.file === 'none') return;
                        
                        var currentEnabled = enabledPlugins[p.file] === true;
                        enabledPlugins[p.file] = !currentEnabled;
                        Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                        needReload = true;
                        item.data('plugin-enabled', enabledPlugins[p.file]);
                        
                        // Обновляем визуальное состояние - пересоздаем элемент
                        var newCircle = enabledPlugins[p.file] ? 
                            `<div class="cubox-select-icon" style="background:${statusColor}; box-shadow:0 0 6px ${statusColor}; border:none;"></div>` : 
                            `<div class="cubox-select-icon" style="border:2px solid rgba(255,255,255,0.3);"></div>`;
                        
                        var contentDiv = item.find('.cubox-modal-item__content');
                        item.find('.cubox-select-item').html(newCircle + contentDiv[0].outerHTML);
                        
                        // Перезагружаем список через небольшую задержку
                        setTimeout(function() {
                            openStore();
                        }, 100);
                    });
                    
                    content.append(item);
                    
                    // Сохраняем первый элемент для фокуса
                    if (!firstItem) {
                        firstItem = item[0];
                    }
                });
            } else {
                var emptyItem = $('<div class="cubox-modal-item"></div>');
                emptyItem.html('<div class="cubox-modal-item__content"><div class="cubox-modal-item__title">Нет плагинов</div><div class="cubox-modal-item__subtitle">Список пуст</div></div>');
                content.append(emptyItem);
            }
            
            // Открываем модальное окно
            // Modal сам создаст Scroll внутри, нам нужно только передать HTML
            Lampa.Modal.open({
                title: 'Cubox Store',
                html: content,
                size: 'large', // 37% ширины на десктопе, похоже на настройки
                align: 'top',
                mask: true,
                select: firstItem, // Устанавливаем фокус на первый элемент
                onBack: function() {
                    if (needReload) {
                        Lampa.Modal.close();
                        Lampa.Noty.show('Перезагрузка...');
                        setTimeout(function(){ 
                            window.location.reload(); 
                        }, 1000);
                    } else {
                        Lampa.Modal.close();
                        
                        // Возвращаемся в настройки
                        Lampa.Controller.toggle("settings_component");
                        
                        // Возвращаем фокус на пункт меню
                        setTimeout(function() {
                            if (menuItemElement) {
                                var scrollLayer = $('.settings__content .scroll__content');
                                if (scrollLayer.length) {
                                    Lampa.Controller.collectionFocus(menuItemElement, scrollLayer);
                                }
                            }
                        }, 100);
                    }
                }
            });
        });
    }

    // Инициализация
    if (window.appready) { 
        addMenu(); 
        startPlugins(); 
    } else { 
        Lampa.Listener.follow('app', function (e) { 
            if (e.type == 'ready') { 
                addMenu(); 
                startPlugins(); 
            } 
        }); 
    }
})();

