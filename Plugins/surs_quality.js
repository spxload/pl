(function () {
    'use strict';

    // Переменные настройки
    var ENABLE_LOGGING = false; // Централизованное управление логами
    var Q_CACHE_TIME = 72 * 60 * 60 * 1000; // Время кэша качества (72 часа)
    var QUALITY_CACHE = 'surs_quality_cache';
    var JACRED_PROTOCOL = 'https://';
    var JACRED_URL = Lampa.Storage.get('jacred.xyz') || 'jacred.xyz'; // Адрес JacRed
    var PROXY_LIST = [
        'http://api.allorigins.win/raw?url=',
        'http://cors.bwa.workers.dev/'
    ];
    var PROXY_TIMEOUT = 5000; // Таймаут прокси

    // Добавление стилей для экранок (camrip)
    var style = document.createElement('style');
    style.textContent = `
        .full-start__status.surs_quality.camrip {
            color: red !important;
        }
    `;
    document.head.appendChild(style);

    // Функция логирования с централизованным управлением
    function log() {
        if (ENABLE_LOGGING) {
            console.log.apply(console, arguments);
        }
    }

    // Функция для работы с прокси
    function fetchWithProxy(url, cardId, callback) {
        var currentProxyIndex = 0;
        var callbackCalled = false;
        var controller = new AbortController();
        var signal = controller.signal;

        function tryNextProxy() {
            if (currentProxyIndex >= PROXY_LIST.length) {
                if (!callbackCalled) {
                    callbackCalled = true;
                    callback(new Error('Все прокси не сработали для ' + url + ': исчерпаны все попытки'));
                }
                return;
            }
            var proxyUrl = PROXY_LIST[currentProxyIndex] + encodeURIComponent(url);
            log('SURS_QUALITY', 'card: ' + cardId + ', Запрос через прокси: ' + proxyUrl);
            var timeoutId = setTimeout(function () {
                controller.abort();
                if (!callbackCalled) {
                    log('SURS_QUALITY', 'card: ' + cardId + ', Прокси запрос превысил время ожидания: ' + proxyUrl);
                    currentProxyIndex++;
                    tryNextProxy();
                }
            }, PROXY_TIMEOUT);
            fetch(proxyUrl, { signal: signal })
                .then(function (response) {
                    clearTimeout(timeoutId);
                    if (!response.ok) throw new Error('Ошибка прокси: ' + response.status + ' ' + response.statusText);
                    return response.text();
                })
                .then(function (data) {
                    if (!callbackCalled) {
                        callbackCalled = true;
                        clearTimeout(timeoutId);
                        callback(null, data);
                    }
                })
                .catch(function (error) {
                    clearTimeout(timeoutId);
                    log('SURS_QUALITY', 'card: ' + cardId + ', Ошибка запроса через прокси: ' + proxyUrl + ', сообщение: ' + error.message);
                    if (!callbackCalled) {
                        currentProxyIndex++;
                        tryNextProxy();
                    }
                });
        }

        log('SURS_QUALITY', 'card: ' + cardId + ', Прямой запрос: ' + url);
        var directTimeoutId = setTimeout(function () {
            controller.abort();
            if (!callbackCalled) {
                log('SURS_QUALITY', 'card: ' + cardId + ', Прямой запрос превысил время ожидания, переходим к прокси.');
                tryNextProxy();
            }
        }, PROXY_TIMEOUT);

        fetch(url, { signal: signal })
            .then(function (response) {
                clearTimeout(directTimeoutId);
                if (!response.ok) throw new Error('Ошибка прямого запроса: ' + response.status + ' ' + response.statusText);
                return response.text();
            })
            .then(function (data) {
                if (!callbackCalled) {
                    callbackCalled = true;
                    clearTimeout(directTimeoutId);
                    callback(null, data);
                }
            })
            .catch(function (error) {
                clearTimeout(directTimeoutId);
                log('SURS_QUALITY', 'card: ' + cardId + ', Ошибка прямого запроса: ' + url + ', сообщение: ' + error.message);
                if (!callbackCalled) {
                    log('SURS_QUALITY', 'card: ' + cardId + ', Прямой запрос не удался, переходим к прокси.');
                    tryNextProxy();
                }
            });
    }

    // Функция получения лучшего качества из JacRed
    function getBestReleaseFromJacred(normalizedCard, cardId, callback) {
        if (!JACRED_URL) {
            log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: JACRED_URL не установлен.');
            callback(null);
            return;
        }

        function translateQuality(quality, isCamrip) {
            if (isCamrip) return 'Экранка';
            if (typeof quality !== 'number') return quality;
            if (quality >= 2160) return '4K';
            if (quality >= 1080) return 'FHD';
            if (quality >= 720) return 'HD';
            if (quality > 0) return 'SD';
            return null;
        }

        log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: Начало поиска качества.');
        var year = '';
        var dateStr = normalizedCard.release_date || '';
        if (dateStr.length >= 4) {
            year = dateStr.substring(0, 4);
        }
        if (!year || isNaN(year)) {
            log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: Отсутствует или неверный год: ' + JSON.stringify(normalizedCard));
            callback(null);
            return;
        }

        function searchJacredApi(searchTitle, searchYear, exactMatch, strategyName, apiCallback) {
            var userId = Lampa.Storage.get('lampac_unic_id', '');
            var apiUrl = JACRED_PROTOCOL + JACRED_URL + '/api/v1.0/torrents?search=' +
                encodeURIComponent(searchTitle) +
                '&year=' + searchYear +
                (exactMatch ? '&exact=true' : '') +
                '&uid=' + userId;

            log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: ' + strategyName + ' URL: ' + apiUrl);

            fetchWithProxy(apiUrl, cardId, function (error, responseText) {
                if (error) {
                    log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: ' + strategyName + ' ошибка запроса, сообщение: ' + error.message);
                    apiCallback(null);
                    return;
                }
                if (!responseText) {
                    log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: ' + strategyName + ' пустой ответ.');
                    apiCallback(null);
                    return;
                }
                try {
                    var torrents = JSON.parse(responseText);
                    if (!Array.isArray(torrents) || torrents.length === 0) {
                        log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: ' + strategyName + ' не найдены торренты.');
                        apiCallback(null);
                        return;
                    }
                    var bestNumericQuality = -1;
                    var bestFoundTorrent = null;
                    var camripFound = false;
                    var camripQuality = -1;

                    for (var i = 0; i < torrents.length; i++) {
                        var currentTorrent = torrents[i];
                        var currentNumericQuality = currentTorrent.quality;
                        var lowerTitle = (currentTorrent.title || '').toLowerCase();
                        if (!/\b(ts|telesync|camrip|cam)\b/i.test(lowerTitle)) {
                            if (typeof currentNumericQuality !== 'number' || currentNumericQuality === 0) {
                                continue;
                            }
                            if (currentNumericQuality > bestNumericQuality) {
                                bestNumericQuality = currentNumericQuality;
                                bestFoundTorrent = currentTorrent;
                            }
                        }
                    }

                    if (!bestFoundTorrent) {
                        for (var i = 0; i < torrents.length; i++) {
                            var currentTorrent = torrents[i];
                            var currentNumericQuality = currentTorrent.quality;
                            var lowerTitle = (currentTorrent.title || '').toLowerCase();
                            if (/\b(ts|telesync|camrip|cam)\b/i.test(lowerTitle)) {
                                if (typeof currentNumericQuality !== 'number' || currentNumericQuality === 0) {
                                    continue;
                                }
                                if (currentNumericQuality >= 720) {
                                    camripFound = true;
                                    if (currentNumericQuality > camripQuality) {
                                        camripQuality = currentNumericQuality;
                                        bestFoundTorrent = currentTorrent;
                                    }
                                }
                            }
                        }
                    }

                    if (bestFoundTorrent) {
                        var isCamrip = camripFound && bestNumericQuality === -1;
                        log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: Найден лучший торрент в ' + strategyName + ': "' + bestFoundTorrent.title + '" с качеством: ' + (bestFoundTorrent.quality || bestNumericQuality) + 'p, camrip: ' + isCamrip);
                        apiCallback({
                            quality: translateQuality(bestFoundTorrent.quality || bestNumericQuality, isCamrip),
                            title: bestFoundTorrent.title,
                            isCamrip: isCamrip
                        });
                    } else {
                        log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: Подходящие торренты не найдены в ' + strategyName + '.');
                        apiCallback(null);
                    }
                } catch (e) {
                    log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: ' + strategyName + ' ошибка парсинга ответа, сообщение: ' + e.message);
                    apiCallback(null);
                }
            });
        }

        var searchStrategies = [];
        if (normalizedCard.original_title && /[a-zа-яё0-9]/i.test(normalizedCard.original_title)) {
            searchStrategies.push({
                title: normalizedCard.original_title.trim(),
                year: year,
                exact: true,
                name: 'OriginalTitle Exact Year'
            });
        }
        if (normalizedCard.title && /[a-zа-яё0-9]/i.test(normalizedCard.title)) {
            searchStrategies.push({
                title: normalizedCard.title.trim(),
                year: year,
                exact: true,
                name: 'Title Exact Year'
            });
        }

        function executeNextStrategy(index) {
            if (index >= searchStrategies.length) {
                log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: Все стратегии не сработали. Качество не найдено.');
                callback(null);
                return;
            }
            var strategy = searchStrategies[index];
            log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: Пробуем стратегию: ' + strategy.name);
            searchJacredApi(strategy.title, strategy.year, strategy.exact, strategy.name, function (result) {
                if (result !== null) {
                    log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: Качество найдено с помощью ' + strategy.name + ': ' + result.quality);
                    callback(result);
                } else {
                    executeNextStrategy(index + 1);
                }
            });
        }

        if (searchStrategies.length > 0) {
            executeNextStrategy(0);
        } else {
            log('SURS_QUALITY', 'card: ' + cardId + ', JacRed: Нет подходящих заголовков для поиска.');
            callback(null);
        }
    }

    // Функции для работы с кэшем качества
    function getQualityCache(key) {
        var cache = Lampa.Storage.get(QUALITY_CACHE) || {};
        var item = cache[key];
        return item && (Date.now() - item.timestamp < Q_CACHE_TIME) ? item : null;
    }

    function saveQualityCache(key, data, localCurrentCard) {
        log('SURS_QUALITY', 'card: ' + localCurrentCard + ', Сохранение кэша качества');
        var cache = Lampa.Storage.get(QUALITY_CACHE) || {};
        // Очистка устаревших записей
        for (var cacheKey in cache) {
            if (cache.hasOwnProperty(cacheKey)) {
                if (Date.now() - cache[cacheKey].timestamp >= Q_CACHE_TIME) {
                    log('SURS_QUALITY', 'card: ' + localCurrentCard + ', Удаление устаревшей записи кэша для ключа: ' + cacheKey);
                    delete cache[cacheKey];
                }
            }
        }
        cache[key] = {
            quality: data.quality || null,
            isCamrip: data.isCamrip || false,
            timestamp: Date.now()
        };
        Lampa.Storage.set(QUALITY_CACHE, cache);
    }

    // Удаление элементов качества внутри карточки
    function clearQualityElements(localCurrentCard, render) {
        if (render) {
            $('.full-start__status.surs_quality', render).remove();
        }
    }

    // Плейсхолдер качества внутри карточки
    function showQualityPlaceholder(localCurrentCard, render) {
        if (!render) return;
        var rateLine = $('.full-start-new__rate-line', render);
        if (!rateLine.length) return;
        if (!$('.full-start__status.surs_quality', render).length) {
            var placeholder = document.createElement('div');
            placeholder.className = 'full-start__status surs_quality';
            placeholder.textContent = '...';
            placeholder.style.opacity = '0.7';
            rateLine.append(placeholder);
        }
    }

    // Обновление элемента качества внутри карточки
    function updateQualityElement(quality, isCamrip, localCurrentCard, render) {
        if (!render) return;
        var element = $('.full-start__status.surs_quality', render);
        var rateLine = $('.full-start-new__rate-line', render);
        if (!rateLine.length) return;
        if (element.length) {
            log('SURS_QUALITY', 'card: ' + localCurrentCard + ', Обновление элемента качества с "' + quality + '"');
            element.text(quality).css('opacity', '1');
            if (isCamrip) element.addClass('camrip');
            else element.removeClass('camrip');
        } else {
            log('SURS_QUALITY', 'card: ' + localCurrentCard + ', Создание нового элемента качества с "' + quality + '"');
            var div = document.createElement('div');
            div.className = 'full-start__status surs_quality' + (isCamrip ? ' camrip' : '');
            div.textContent = quality;
            rateLine.append(div);
        }
    }

    // Получение качества последовательно
    function fetchQualitySequentially(normalizedCard, localCurrentCard, qCacheKey, render) {
        log('SURS_QUALITY', 'card: ' + localCurrentCard + ', Начало запроса качества JacRed');
        getBestReleaseFromJacred(normalizedCard, localCurrentCard, function (jrResult) {
            log('SURS_QUALITY', 'card: ' + localCurrentCard + ', Получен ответ от JacRed');
            var quality = (jrResult && jrResult.quality) || null;
            var isCamrip = (jrResult && jrResult.isCamrip) || false;
            if (quality && quality !== 'NO') {
                log('SURS_QUALITY', 'card: ' + localCurrentCard + ', JacRed нашел качество: ' + quality + ', camrip: ' + isCamrip);
                saveQualityCache(qCacheKey, { quality: quality, isCamrip: isCamrip }, localCurrentCard);
                updateQualityElement(quality, isCamrip, localCurrentCard, render);
            } else {
                clearQualityElements(localCurrentCard, render);
            }
        });
    }

    // Определение типа карточки
    function getCardType(card) {
        var type = card.media_type || card.type;
        if (type === 'movie' || type === 'tv') return type;
        return card.name || card.original_name ? 'tv' : 'movie';
    }

    // Основная функция обработки качества внутри карточки
    function fetchQualityForCard(card, render) {
        if (!render) return;
        var localCurrentCard = card.id;
        log('SURS_QUALITY', 'card: ' + localCurrentCard + ', Начало обработки карточки: ' + JSON.stringify(card));
        var normalizedCard = {
            id: card.id,
            title: card.title || card.name || '',
            original_title: card.original_title || card.original_name || '',
            type: getCardType(card),
            release_date: card.release_date || card.first_air_date || ''
        };
        if (normalizedCard.type === 'tv') {
            clearQualityElements(localCurrentCard, render);
            return;
        }
        var rateLine = $('.full-start-new__rate-line', render);
        if (rateLine.length) {
            rateLine.css('visibility', 'hidden');
            rateLine.addClass('done');
        }
        var qCacheKey = normalizedCard.type + '_' + (normalizedCard.id || normalizedCard.imdb_id);
        var cacheQualityData = getQualityCache(qCacheKey);

        if (cacheQualityData) {
            log('SURS_QUALITY', 'card: ' + localCurrentCard + ', Получение качества из кэша');
            updateQualityElement(cacheQualityData.quality, cacheQualityData.isCamrip, localCurrentCard, render);
        } else {
            clearQualityElements(localCurrentCard, render);
            showQualityPlaceholder(localCurrentCard, render);
            fetchQualitySequentially(normalizedCard, localCurrentCard, qCacheKey, render);
        }
        if (rateLine.length) {
            rateLine.css('visibility', 'visible');
        }
    }

    // Инициализация плагина
    function startPlugin() {
        log('SURS_QUALITY', 'Запуск плагина качества!');
        window.sursQualityPlugin = true;

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var render = e.object.activity.render();
                fetchQualityForCard(e.data.movie, render);
            }
        });
    }

    if (!window.sursQualityPlugin) {
        startPlugin();
    }
})();