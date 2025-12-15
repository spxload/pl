// @name: Cub_off
// @version: 4
// @description: Отключение рекламы CUB (включая старые TV приставки и нативное Android приложение)

(function () {
    'use strict';

    // ========================================================================
    // 1. КОНФИГУРАЦИЯ (Применяем сразу, чтобы Лампа увидела их первой)
    // ========================================================================
    window.lampa_settings = window.lampa_settings || {};
    
    // Включаем все крутые функции
    window.lampa_settings.account_use = true;   // Использовать аккаунт
    window.lampa_settings.plugins_store = true; // Магазин плагинов
    window.lampa_settings.torrents_use = true;  // Торренты
    window.lampa_settings.read_only = false;    // Разрешаем менять настройки руками

    // Отключаем лишнее
    window.lampa_settings.disable_features = { 
        dmca: true,      // Отключаем фильтр пиратства (показывает всё)
        ads: true,       // Выключаем рекламу (на уровне настроек)
        trailers: false, // Трейлеры оставляем
        reactions: false, 
        discuss: false, 
        ai: true,
        blacklist: true  // Отключаем черные списки контента
    };

    var PLUGIN_VERSION = 'CUB OFF v23.0 (Native App Fix)';
    
    // ========================================================================
    // 0. РАННИЙ ПЕРЕХВАТ ДЛЯ СТАРЫХ TV ПРИСТАВОК (До загрузки модулей)
    // ========================================================================
    // Определяем, является ли это старой TV приставкой или нативным Android приложением
    var isOldTV = function() {
        try {
            var ua = navigator.userAgent.toLowerCase();
            var body = document.body;
            if (body && body.classList) {
                if (body.classList.contains('platform--orsay') || 
                    body.classList.contains('platform--netcast') ||
                    body.classList.contains('platform--android')) {
                    return true;
                }
            }
            if (ua.indexOf('maple') !== -1 || 
                ua.indexOf('netcast') !== -1 ||
                ua.indexOf('lampa_client') !== -1) {
                return true;
            }
        } catch(e) {}
        return false;
    };

    // Ранний перехват для старых TV приставок - перехватываем функции до загрузки модулей
    var earlyIntercept = function() {
        // Сохраняем оригинальные функции для перехвата
        var interceptedModules = {};
        
        // Перехватываем через глобальный объект window
        var originalWindowSetTimeout = window.setTimeout;
        var adTimers = [];
        
        // Перехватываем setTimeout для блокировки рекламных таймеров
        window.setTimeout = function(func, delay) {
            // Блокируем рекламные таймеры (3.5 секунды - стандартное время показа рекламы)
            if (delay === 3500 || (delay > 3400 && delay < 3600)) {
                // Вызываем функцию сразу, чтобы пропустить рекламу
                if (typeof func === 'function') {
                    try {
                        func();
                    } catch(e) {}
                }
                return 0; // Возвращаем фиктивный ID таймера
            }
            return originalWindowSetTimeout.apply(this, arguments);
        };

        // Перехватываем setInterval для блокировки рекламных интервалов
        var originalSetInterval = window.setInterval;
        window.setInterval = function(func, delay) {
            // Блокируем интервалы, связанные с рекламой
            if (delay === 1000) { // 1 секунда - часто используется для таймеров рекламы
                var funcStr = func.toString();
                if (funcStr.indexOf('tic') !== -1 || 
                    funcStr.indexOf('count') !== -1 ||
                    funcStr.indexOf('ad') !== -1 ||
                    funcStr.indexOf('premium') !== -1) {
                    // Это похоже на рекламный таймер, блокируем
                    return 0;
                }
            }
            return originalSetInterval.apply(this, arguments);
        };
    };

    // Запускаем ранний перехват сразу
    earlyIntercept();
    
    // Безопасная обертка всего функционала
    try {

        // ====================================================================
        // 2. ГЛУШИТЕЛЬ ОШИБОК CANVAS (Fix broken images)
        // ====================================================================
        var originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function() {
            try {
                return originalDrawImage.apply(this, arguments);
            } catch (e) {
                // Игнорируем ошибки битых картинок, чтобы не было красных экранов
                if (e.name === 'InvalidStateError' || e.message.indexOf('broken') !== -1) return;
            }
        };

        // ====================================================================
        // 3. ПЕРЕХВАТЧИК ПРЕМИУМА (Fake Premium)
        // ====================================================================
        var originalDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
            if (prop === 'hasPremium') {
                descriptor.value = function() { return true; };
                descriptor.writable = true; 
                descriptor.configurable = true;
            }
            return originalDefineProperty.call(this, obj, prop, descriptor);
        };

        // ====================================================================
        // 4. БЕЗОПАСНЫЙ CSS (Скрытие рекламы)
        // ====================================================================
        var injectSafeCSS = function() {
            var style = document.createElement("style");
            style.innerHTML = `
                /* Блокировка всех рекламных элементов */
                .ad-server, .ad-preroll, .player-advertising, .layer--advertising,
                .ad-preroll__bg, .ad-preroll__text, .ad-preroll__over,
                .modal--cub-premium, .cub-premium, .cub-premium__descr,
                [class*="ad"], [class*="advert"], [id*="ad"], [id*="advert"] {
                    opacity: 0 !important; 
                    visibility: hidden !important;
                    z-index: -9999 !important; 
                    pointer-events: none !important;
                    position: absolute !important; 
                    top: -9999px !important;
                    display: none !important;
                    height: 0 !important;
                    width: 0 !important;
                    overflow: hidden !important;
                }
                .button--subscribe, .card-promo, .settings--account-premium {
                    display: none !important;
                }
                /* Специальная блокировка для старых TV приставок */
                body.platform--orsay .ad-preroll,
                body.platform--netcast .ad-preroll,
                body.platform--orsay .modal--cub-premium,
                body.platform--netcast .modal--cub-premium,
                body.platform--orsay [class*="ad"],
                body.platform--netcast [class*="ad"] {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    position: absolute !important;
                    top: -9999px !important;
                    z-index: -9999 !important;
                }
                .cub-off-badge {
                    width: 100%; text-align: center; padding: 15px 0;
                    opacity: 0.6; font-size: 1em; color: #aaaaaa;
                    margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);
                    pointer-events: none;
                }
                .cub-off-badge span { color: #4bbc16; font-weight: bold; }
            `;
            document.body.appendChild(style);
        };

        // ====================================================================
        // 5. УМНЫЙ ПЕРЕХВАТ ТАЙМЕРОВ (Ускорение рекламы)
        // ====================================================================
        var patchTimers = function() {
            var originalSetTimeout = window.setTimeout;
            window.setTimeout = function(func, delay) {
                // Ускоряем только таймеры, похожие на рекламные (3.5 сек)
                if (delay === 3500 || (delay > 3400 && delay < 3600)) {
                    return originalSetTimeout(func, 1);
                }
                return originalSetTimeout(func, delay);
            };
        };

        // ====================================================================
        // 6. GHOST MODE (Блокировка шпионов и логов)
        // ====================================================================
        var killSpyware = function() {
            try {
                localStorage.removeItem('metric_ad_view');
                localStorage.removeItem('vast_device_uid');
            } catch(e) {}

            var interval = setInterval(function() {
                if (typeof Lampa !== 'undefined') {
                    // Глушим метрики
                    if (Lampa.ServiceMetric) {
                        Lampa.ServiceMetric.counter = function() { };
                        Lampa.ServiceMetric.histogram = function() { };
                    }
                    // Глушим глобальные функции рекламы
                    if (window.stat1launch) window.stat1launch = function() {};
                    if (window.stat1error) window.stat1error = function() {};
                    
                    // Выключаем статус разработчика (зеленую плашку ошибок)
                    if (Lampa.Settings && Lampa.Settings.developer) {
                        Lampa.Settings.developer.log = false;
                        Lampa.Settings.developer.active = false;
                        Lampa.Settings.developer.status = false;
                    }
                    clearInterval(interval);
                }
            }, 1000);
            
            // Отключаем проверку через 30 секунд
            setTimeout(function() { clearInterval(interval); }, 30000);
        };

        // ====================================================================
        // 6.5. ПЕРЕХВАТ РЕКЛАМНЫХ ФУНКЦИЙ (Для старых TV приставок)
        // ====================================================================
        var blockAdFunctions = function() {
            // Ранний перехват через прототипы и глобальные объекты
            var interceptedFunctions = {};
            var isOldTVDevice = isOldTV();
            
            // Функция для перехвата методов объекта
            var interceptMethod = function(obj, methodName, replacement, force) {
                if (!obj || !obj[methodName]) return false;
                try {
                    var key = (obj.constructor && obj.constructor.name ? obj.constructor.name : 'Object') + '.' + methodName;
                    if (!interceptedFunctions[key] || force) {
                        interceptedFunctions[key] = obj[methodName];
                        obj[methodName] = replacement;
                        return true;
                    }
                } catch(e) {}
                return false;
            };

            // Агрессивный перехват для старых TV приставок
            var aggressiveIntercept = function() {
                try {
                    // Перехватываем через глобальные объекты
                    if (window.Lampa) {
                        // Перехватываем Player.Preroll.show напрямую
                        if (window.Lampa.Player && window.Lampa.Player.Preroll && window.Lampa.Player.Preroll.show) {
                            interceptMethod(window.Lampa.Player.Preroll, 'show', function(data, call) {
                                if (call && typeof call === 'function') {
                                    call();
                                }
                            }, true);
                        }

                        // Перехватываем через Interaction
                        if (window.Lampa.Interaction) {
                            // Ищем модули рекламы
                            var interactionKeys = Object.keys(window.Lampa.Interaction);
                            for (var i = 0; i < interactionKeys.length; i++) {
                                var key = interactionKeys[i];
                                var module = window.Lampa.Interaction[key];
                                if (module && typeof module === 'object') {
                                    if (module.show && typeof module.show === 'function') {
                                        var showStr = module.show.toString();
                                        if (showStr.indexOf('cub-premium') !== -1 || 
                                            showStr.indexOf('premium') !== -1 ||
                                            showStr.indexOf('Modal.open') !== -1) {
                                            interceptMethod(module, 'show', function(data, call) {
                                                if (call && typeof call === 'function') {
                                                    call();
                                                }
                                            }, true);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch(e) {}
            };

            // Перехватываем функции показа рекламы через интервалы
            var checkInterval = setInterval(function() {
                try {
                    // Блокируем Advert/Offer модуль
                    if (typeof Lampa !== 'undefined') {
                        // Агрессивный перехват для старых TV приставок
                        if (isOldTVDevice) {
                            aggressiveIntercept();
                        }

                        // Блокируем через Interaction.Advert
                        if (Lampa.Interaction && Lampa.Interaction.Advert) {
                            if (Lampa.Interaction.Advert.Offer && Lampa.Interaction.Advert.Offer.show) {
                                interceptMethod(Lampa.Interaction.Advert.Offer, 'show', function(data, call) {
                                    if (call && typeof call === 'function') {
                                        call();
                                    }
                                }, isOldTVDevice);
                            }
                            if (Lampa.Interaction.Advert.Preroll && Lampa.Interaction.Advert.Preroll.show) {
                                interceptMethod(Lampa.Interaction.Advert.Preroll, 'show', function(data, call) {
                                    if (call && typeof call === 'function') {
                                        call();
                                    }
                                }, isOldTVDevice);
                            }
                        }

                        // Блокируем через прямой доступ к модулям
                        if (Lampa.Advert) {
                            if (Lampa.Advert.Offer && Lampa.Advert.Offer.show) {
                                interceptMethod(Lampa.Advert.Offer, 'show', function(data, call) {
                                    if (call && typeof call === 'function') {
                                        call();
                                    }
                                }, isOldTVDevice);
                            }
                            if (Lampa.Advert.Preroll && Lampa.Advert.Preroll.show) {
                                interceptMethod(Lampa.Advert.Preroll, 'show', function(data, call) {
                                    if (call && typeof call === 'function') {
                                        call();
                                    }
                                }, isOldTVDevice);
                            }
                        }

                        // Блокируем показ модальных окон с рекламой
                        if (Lampa.Modal && Lampa.Modal.open) {
                            interceptMethod(Lampa.Modal, 'open', function(options) {
                                if (options) {
                                    // Проверяем HTML содержимое
                                    if (options.html) {
                                        var htmlStr = '';
                                        if (typeof options.html === 'string') {
                                            htmlStr = options.html;
                                        } else if (options.html.outerHTML) {
                                            htmlStr = options.html.outerHTML;
                                        } else if (options.html.toString) {
                                            htmlStr = options.html.toString();
                                        } else if (options.html.jquery || options.html.length) {
                                            // jQuery объект
                                            htmlStr = options.html.html ? options.html.html() : '';
                                        }
                                        
                                        if (htmlStr.toLowerCase().indexOf('cub-premium') !== -1 || 
                                            htmlStr.toLowerCase().indexOf('premium') !== -1 ||
                                            (htmlStr.toLowerCase().indexOf('ad') !== -1 && htmlStr.toLowerCase().indexOf('disable') === -1)) {
                                            // Закрываем рекламное модальное окно сразу
                                            if (options.onBack && typeof options.onBack === 'function') {
                                                try { options.onBack(); } catch(e) {}
                                            }
                                            return;
                                        }
                                    }
                                    
                                    // Проверяем классы модального окна
                                    if (options.className && (options.className.indexOf('cub-premium') !== -1 || 
                                                               options.className.indexOf('ad') !== -1)) {
                                        if (options.onBack && typeof options.onBack === 'function') {
                                            try { options.onBack(); } catch(e) {}
                                        }
                                        return;
                                    }
                                }
                                
                                // Вызываем оригинальную функцию
                                var key = 'Modal.open';
                                if (interceptedFunctions[key]) {
                                    return interceptedFunctions[key].call(this, options);
                                }
                            }, isOldTVDevice);
                        }

                        // Блокируем Account.showCubPremium
                        if (Lampa.Account && Lampa.Account.showCubPremium) {
                            interceptMethod(Lampa.Account, 'showCubPremium', function() {
                                // Ничего не делаем
                            }, isOldTVDevice);
                        }

                        // Блокируем Offer.show напрямую (для нативного Android приложения)
                        // Ищем Offer через все возможные пути
                        var findAndBlockOffer = function(obj, path) {
                            if (!obj || typeof obj !== 'object') return;
                            try {
                                for (var key in obj) {
                                    if (key === 'Offer' && obj[key] && obj[key].show) {
                                        interceptMethod(obj[key], 'show', function(data, call) {
                                            if (call && typeof call === 'function') {
                                                call();
                                            }
                                        }, isOldTVDevice);
                                    }
                                    if (typeof obj[key] === 'object' && path.length < 5) {
                                        findAndBlockOffer(obj[key], path + '.' + key);
                                    }
                                }
                            } catch(e) {}
                        };
                        
                        if (isOldTVDevice) {
                            findAndBlockOffer(Lampa, 'Lampa');
                            findAndBlockOffer(window, 'window');
                        }
                    }
                } catch(e) {
                    // Игнорируем ошибки
                }
            }, isOldTVDevice ? 100 : 300); // Более частые проверки для старых TV приставок

            // Не останавливаем проверку - продолжаем работать постоянно
            // Это важно для старых TV приставок, где модули могут загружаться позже
        };

        // ====================================================================
        // 6.6. БЛОКИРОВКА СОЗДАНИЯ РЕКЛАМНЫХ ЭЛЕМЕНТОВ (MutationObserver)
        // ====================================================================
        var blockAdElements = function() {
            var isOldTVDevice = isOldTV();
            var hideAdElement = function(element) {
                if (!element) return;
                try {
                    element.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; top: -9999px !important; z-index: -9999 !important; height: 0 !important; width: 0 !important; overflow: hidden !important;';
                    if (element.parentNode && element.parentNode.removeChild) {
                        try {
                            element.parentNode.removeChild(element);
                        } catch(e) {}
                    }
                } catch(e) {}
            };

            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                            // Проверяем классы рекламы
                            if (node.classList) {
                                if (node.classList.contains('ad-preroll') ||
                                    node.classList.contains('ad-server') ||
                                    node.classList.contains('player-advertising') ||
                                    node.classList.contains('layer--advertising') ||
                                    node.classList.contains('modal--cub-premium') ||
                                    node.classList.contains('cub-premium')) {
                                    hideAdElement(node);
                                }
                                
                                // Проверяем частичные совпадения
                                for (var i = 0; i < node.classList.length; i++) {
                                    var className = node.classList[i];
                                    if (className.indexOf('ad') !== -1 || 
                                        className.indexOf('premium') !== -1 ||
                                        className.indexOf('advert') !== -1) {
                                        hideAdElement(node);
                                        break;
                                    }
                                }
                            }
                            
                            // Проверяем ID рекламы
                            if (node.id && (node.id.indexOf('ad') !== -1 || 
                                           node.id.indexOf('premium') !== -1 ||
                                           node.id.indexOf('advert') !== -1)) {
                                hideAdElement(node);
                            }

                            // Проверяем вложенные элементы
                            if (node.querySelectorAll) {
                                var adElements = node.querySelectorAll('.ad-preroll, .ad-server, .player-advertising, .layer--advertising, .modal--cub-premium, .cub-premium, [class*="ad"], [class*="premium"], [id*="ad"]');
                                for (var i = 0; i < adElements.length; i++) {
                                    hideAdElement(adElements[i]);
                                }
                            }
                        }
                    });
                });
            });

            // Начинаем наблюдение
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            } else {
                // Ждем загрузки body
                var bodyObserver = new MutationObserver(function(mutations, obs) {
                    if (document.body) {
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                        obs.disconnect();
                    }
                });
                bodyObserver.observe(document.documentElement, {
                    childList: true
                });
            }

            // Дополнительная проверка каждые 2 секунды (для старых TV приставок)
            var checkInterval = isOldTVDevice ? 500 : 2000; // Более частые проверки для старых TV приставок
            setInterval(function() {
                try {
                    var adElements = document.querySelectorAll('.ad-preroll, .ad-server, .player-advertising, .layer--advertising, .modal--cub-premium, .cub-premium, [class*="ad-preroll"], [class*="ad-server"], [class*="ad"], [id*="ad"]');
                    for (var i = 0; i < adElements.length; i++) {
                        hideAdElement(adElements[i]);
                    }
                    
                    // Дополнительная проверка для старых TV приставок - ищем все элементы с рекламой
                    if (isOldTVDevice) {
                        var allElements = document.querySelectorAll('*');
                        for (var j = 0; j < allElements.length; j++) {
                            var el = allElements[j];
                            if (el.classList) {
                                for (var k = 0; k < el.classList.length; k++) {
                                    var className = el.classList[k];
                                    if (className.indexOf('ad') !== -1 || 
                                        className.indexOf('premium') !== -1 ||
                                        className.indexOf('advert') !== -1) {
                                        hideAdElement(el);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                } catch(e) {}
            }, checkInterval);
        };

        // ====================================================================
        // 7. UI (Бейджик в настройках)
        // ====================================================================
        var injectInfo = function() {
            var observer = new MutationObserver(function(mutations) {
                var settingsBox = document.querySelector('.settings__content');
                if (settingsBox && !settingsBox.querySelector('.cub-off-badge')) {
                    var badge = document.createElement('div');
                    badge.className = 'cub-off-badge';
                    badge.innerHTML = PLUGIN_VERSION + '<br>Status: <span>Protected</span>';
                    settingsBox.appendChild(badge);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        };

        // ====================================================================
        // 8. ЗАПУСК
        // ====================================================================
        var init = function() {
            injectSafeCSS();
            patchTimers();
            killSpyware();
            blockAdFunctions();
            blockAdElements();
            injectInfo();
            
            // Финальная страховка премиума
            if (typeof Lampa !== 'undefined' && Lampa.Account) {
                try { Lampa.Account.hasPremium = function() { return true; }; } catch(e) {}
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

    } catch (globalError) {
        console.warn('CUB OFF wrapper error:', globalError);
    }

})();
