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
            flex-shrink: 0 !important;
            display: inline-block !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
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

    function openStore() {
        // Проверяем, не открыто ли уже модальное окно
        if (Lampa.Modal && Lampa.Modal.opened && Lampa.Modal.opened()) {
            return;
        }
        
        var needReloadBeforeOpen = needReload;
        var isClosing = false;
        var menuItemElement = null;
        var settingsWasOpen = $('body').hasClass('settings--open');
        
        // Сохраняем ссылку на элемент меню для возврата фокуса
        var menuItem = $('.cubox-menu-item');
        if (menuItem.length) {
            menuItemElement = menuItem[0];
        }
        
        // Убеждаемся, что настройки остаются открытыми
        if (!settingsWasOpen) {
            $('body').addClass('settings--open');
        }
        
        // Показываем загрузку (скрываем, чтобы не было мерцания)
        var loadingContent = $('<div style="padding: 2em; text-align: center; opacity: 0;">Загрузка...</div>');
        
        // Открываем модальное окно с высоким z-index чтобы было поверх настроек
        Lampa.Modal.open({
            title: 'Cubox Store',
            html: loadingContent,
            size: 'large',
            align: 'top',
            mask: true,
            zIndex: 60, // Выше настроек (z-index: 20)
            onBack: function() {
                // Защита от повторных вызовов
                if (isClosing) return;
                isClosing = true;
                
                // Анимируем закрытие (уезжает вправо)
                var modal = $('.modal.cubox-modal-settings');
                if (modal.length) {
                    var modalContent = modal.find('.modal__content');
                    modalContent.css('transform', 'translateX(0)');
                    
                    setTimeout(function() {
                        // Закрываем модальное окно
                        Lampa.Modal.close();
                        
                        // Небольшая задержка для полного закрытия модального окна
                        setTimeout(function() {
                            isClosing = false;
                            
                            // Убеждаемся, что настройки остаются открытыми
                            $('body').addClass('settings--open');
                            
                            // Проверяем, были ли изменения
                            if (needReload && !needReloadBeforeOpen) {
                                Lampa.Noty.show('Перезагрузка...');
                                setTimeout(function() {
                                    window.location.reload();
                                }, 1000);
                            } else {
                                // Правильно переключаем контроллер обратно в настройки
                                // Используем toggle чтобы активировать контроллер настроек
                                Lampa.Controller.toggle('settings');
                                
                                // Возвращаем фокус на пункт меню в настройках
                                setTimeout(function() {
                                    if (menuItemElement) {
                                        var scrollLayer = $('.settings__content .scroll__content');
                                        if (scrollLayer.length) {
                                            // Убеждаемся что настройки активны
                                            Lampa.Controller.collectionSet(scrollLayer);
                                            Lampa.Controller.collectionFocus(menuItemElement, scrollLayer);
                                        }
                                    }
                                }, 200);
                            }
                        }, 100);
                    }, 200);
                } else {
                    // Закрываем модальное окно
                    Lampa.Modal.close();
                    
                    // Небольшая задержка для полного закрытия модального окна
                    setTimeout(function() {
                        isClosing = false;
                        
                        // Убеждаемся, что настройки остаются открытыми
                        $('body').addClass('settings--open');
                        
                        // Проверяем, были ли изменения
                        if (needReload && !needReloadBeforeOpen) {
                            Lampa.Noty.show('Перезагрузка...');
                            setTimeout(function() {
                                window.location.reload();
                            }, 1000);
                        } else {
                            // Правильно переключаем контроллер обратно в настройки
                            Lampa.Controller.toggle('settings');
                            
                            // Возвращаем фокус на пункт меню в настройках
                            setTimeout(function() {
                                if (menuItemElement) {
                                    var scrollLayer = $('.settings__content .scroll__content');
                                    if (scrollLayer.length) {
                                        Lampa.Controller.collectionSet(scrollLayer);
                                        Lampa.Controller.collectionFocus(menuItemElement, scrollLayer);
                                    }
                                }
                            }, 200);
                        }
                    }, 100);
                }
            }
        });
        
        // Добавляем класс для стилизации под настройки СРАЗУ, чтобы не было мерцания
        // Используем requestAnimationFrame для применения стилей до отрисовки
        requestAnimationFrame(function() {
            var modal = $('.modal');
            if (modal.length && !modal.hasClass('cubox-modal-settings')) {
                modal.addClass('cubox-modal-settings');
                var modalContent = modal.find('.modal__content');
                // Устанавливаем начальную позицию сразу
                modalContent.css({
                    'transform': 'translateX(0)',
                    'left': '100%',
                    'transition': 'none' // Отключаем переход для мгновенного позиционирования
                });
                
                // Включаем переход и анимируем появление
                requestAnimationFrame(function() {
                    modalContent.css('transition', 'transform 0.2s');
                    setTimeout(function() {
                        modalContent.css('transform', 'translateX(-100%)');
                    }, 10);
                });
            }
        });
        
        // Загружаем список плагинов
        fetchManifest(function(plugins) {
            // Ждем, пока модальное окно полностью создастся и его внутренний scroll будет готов
            var checkModal = setInterval(function() {
                var scrollContent = $('.modal.cubox-modal-settings .modal__body .scroll__content');
                var scroll = $('.modal.cubox-modal-settings .modal__body .scroll');
                if (scrollContent.length && scroll.length) {
                    clearInterval(checkModal);
                    
                    // Очищаем содержимое загрузки
                    scrollContent.empty();
                    
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
                                Lampa.Noty.show('Изменения применятся после перезагрузки');
                            });
                            
                            scrollContent.append(item);
                        });
                    } else {
                        var emptyItem = $('<div class="settings-param"></div>');
                        emptyItem.html('<div class="settings-param__name">Нет плагинов</div><div class="settings-param__descr">Список пуст</div>');
                        scrollContent.append(emptyItem);
                    }
                    
                    // Настраиваем контроллер для навигации с пульта
                    // Modal сам управляет контроллером, но нужно обновить коллекцию после добавления элементов
                    setTimeout(function() {
                        var items = scrollContent.find('.selector');
                        if (items.length > 0) {
                            // Обновляем коллекцию контроллера с новыми элементами
                            // Modal использует scroll.render() для коллекции
                            Lampa.Controller.collectionSet(scroll);
                            
                            // Устанавливаем фокус на первый элемент
                            var firstItem = items[0][0];
                            if (firstItem) {
                                // Используем небольшой таймаут чтобы убедиться что Modal готов
                                setTimeout(function() {
                                    Lampa.Controller.collectionFocus(firstItem, scroll);
                                }, 100);
                            }
                            
                            // Добавляем обработку фокуса для каждого элемента для правильного скролла
                            items.each(function() {
                                var item = $(this);
                                item.on('hover:focus', function() {
                                    // Обновляем скролл при фокусе через внутренний механизм Modal
                                    var scrollInstance = scroll.data('scroll');
                                    if (scrollInstance && scrollInstance.update) {
                                        scrollInstance.update(item);
                                    }
                                });
                            });
                        }
                    }, 350);
                }
            }, 50);
            
            // Таймаут на случай, если модальное окно не создалось
            setTimeout(function() {
                clearInterval(checkModal);
            }, 5000);
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

    // Инициализация
    function init() {
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

