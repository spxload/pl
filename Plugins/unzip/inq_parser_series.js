require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const iconv = require('iconv-lite');
const {
    SocksProxyAgent
} = require('socks-proxy-agent');

// ======== КОНФИГУРАЦИЯ ДЛЯ СЕРИАЛОВ ========
const SOCKS_PROXY = process.env.SOCKS_PROXY;
const USE_PROXY_FOR = ['kinozal', 'tmdb'];

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Telegram оповещения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Конфигурация парсинга кинозала для сериалов
const KINOZAL_URLS = {
    kinozal_4k: {
        url: 'https://kinozal.tv/browse.php?c=1001&v=7&page=',
        pages: 4
    },
    kinozal_1080p: {
        url: 'https://kinozal.tv/browse.php?c=1001&v=3001&page=',
        pages: 4
    },
    kinozal_4k_mult: {
        url: 'https://kinozal.tv/browse.php?c=1003&v=7&page=',
        pages: 4
    },
    kinozal_1080p_mult: {
        url: 'https://kinozal.tv/browse.php?c=1003&v=3001&page=',
        pages: 4
    }
};

const KINOZAL_DAILY_URLS = {
    kinozal_4k: {
        url: 'https://kinozal.tv/browse.php?s=&g=0&c=1001&v=7&d=0&w=3&t=0&f=0',
        pages: 1
    },
    kinozal_1080p: {
        url: 'https://kinozal.tv/browse.php?s=&g=0&c=1001&v=3001&d=0&w=3&t=0&f=0',
        pages: 1
    },
    kinozal_4k_mult: {
        url: 'https://kinozal.tv/browse.php?s=&g=0&c=1003&v=7&d=0&w=3&t=0&f=0',
        pages: 1
    },
    kinozal_1080p_mult: {
        url: 'https://kinozal.tv/browse.php?s=&g=0&c=1003&v=3001&d=0&w=3&t=0&f=0',
        pages: 1
    }
};

const REQUEST_DELAY = 200 + Math.random() * 300;
const KZ_REQUEST_DELAY = 200 + Math.random() * 300;
const QUALITY_ORDER = ['2160p', '1080p'];
const CACHE_FILE = 'tmdb_cache_series.json';
const MAX_RELEASE_DAYS_OLD = 90;
const MAX_FINAL_ITEMS = 180;

// Статистика
let stats = {
    totalFound: 0,
    filteredByShortTitle: 0,
    saved: 0,
    tmdbTitleMismatch: 0,
    filteredByAge: 0,
    tmdbNoRussianOverview: 0,
    filteredByMissingEpisode: 0,
    categories: {}
};

let cache = {};

// ======== УТИЛИТЫ ========
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isTitleMatch(searchTitle, tmdbTitle) {
    if (!searchTitle || !tmdbTitle) return false;

    const cleanSearch = searchTitle
        .toLowerCase()
        .replace(/[^\w\s]|\(.*?\)/g, '')
        .trim();

    const cleanTmdb = tmdbTitle
        .toLowerCase()
        .replace(/[^\w\s]|\(.*?\)/g, '')
        .trim();

    const searchWords = cleanSearch.split(/\s+/);
    const tmdbWords = cleanTmdb.split(/\s+/);

    return searchWords.every(word =>
        tmdbWords.some(tmdbWord => tmdbWord.includes(word))
    );
}

// Загрузка кеша
if (fs.existsSync(CACHE_FILE)) {
    try {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        console.log(`Загружен кеш: ${Object.keys(cache).length} записей`);
    } catch (e) {
        console.error('Ошибка загрузки кеша:', e.message);
    }
}

function getFromCache(originalTitle, russianTitle, year) {
    const key = `${originalTitle}|${russianTitle}|${year}`;
    return cache[key] || null;
}

function saveToCache(originalTitle, russianTitle, year, responseData) {
    if (originalTitle && originalTitle.length < 4) return false;
    
    const key = `${originalTitle}|${russianTitle}|${year}`;
    
    if (cache[key]) return false; // Уже в кеше
    
    cache[key] = responseData;
    
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        return true;
    } catch (error) {
        console.error('Ошибка сохранения кеша:', error.message);
        return false;
    }
}

async function fetchWithRetry(url, options = {}, maxRetries = 3, sourceType) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const config = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                timeout: 60000,
                responseType: 'arraybuffer',
                ...options
            };

            if (SOCKS_PROXY && USE_PROXY_FOR.includes(sourceType)) {
                config.httpAgent = new SocksProxyAgent(SOCKS_PROXY);
                config.httpsAgent = new SocksProxyAgent(SOCKS_PROXY);
                console.log(`[PROXY] Используем прокси для ${sourceType}`);
            }

            const response = await axios.get(url, config);
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`[Retry ${i + 1}] ${url}`);
            await sleep(REQUEST_DELAY + Math.random() * 100);
        }
    }
}

// ======== ФИЛЬТРАЦИЯ ДЛЯ СЕРИАЛОВ ========
function filterItems(items) {
    const results = [];

    items.forEach(item => {
        if (item.originalTitle && item.originalTitle.length < 3 && !item.russianTitle) {
            stats.filteredByShortTitle++;
            return;
        }
        
        // Дополнительные фильтры
        if (!item.season || !item.episode) {
            stats.filteredByMissingEpisode++;
            return; // отсеиваем без указания серии
        }

        if (item.releaseDateISO) {
            try {
                const releaseDate = new Date(item.releaseDateISO);
                const currentDate = new Date();
                const timeDiff = currentDate - releaseDate;
                const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

                if (daysDiff > MAX_RELEASE_DAYS_OLD) {
                    stats.filteredByAge++;
                    return;
                }
            } catch (e) {
                console.warn(`Invalid date: ${item.releaseDateISO}`, e);
            }
        }

        results.push(item);
    });

    return results;
}


// ======== ПАРСИНГ KINOZAL ДЛЯ СЕРИАЛОВ ========
async function parseKinozalPage(baseUrl, pageNum) {
    const url = `${baseUrl}${pageNum}`;

    try {
        console.log(`\n[Kinozal] Загрузка страницы ${pageNum+1}: ${url}`);
        const response = await fetchWithRetry(url, {}, 3, 'kinozal');
        const html = iconv.decode(response.data, 'win1251');
        const $ = cheerio.load(html);
        const results = [];

        const table = $('table.t_peer.w100p');
        if (!table.length) {
            console.log('[Kinozal] Таблица с раздачами не найдена!');
            return results;
        }

        const rows = table.find('tr.bg');

        rows.each((i, row) => {
            try {
                const cols = $(row).find('td');
                if (cols.length < 8) return;

                const titleElem = $(cols[1]).find('a[class^="r"]');
                if (!titleElem.length) return;

                const rawName = titleElem.text().trim();
                const releaseDateRaw = $(cols[6]).text().trim();

                stats.totalFound++;

                results.push({
                    rawName,
                    releaseDateRaw
                });
            } catch (error) {
                console.error(`Ошибка в строке ${i}:`, error.message);
            }
        });

        console.log(`[Kinozal] (стр. ${pageNum+1}): собрано ${results.length} сырых записей`);
        return results;
    } catch (error) {
        console.error(`[Kinozal] Ошибка:`, error.message);
        return [];
    }
}

function processKinozalRawItems(rawItems) {
    return rawItems.map(rawItem => {
        try {
            const parsed = parseKinozalTitles(rawItem.rawName);
            return {
                rawName: rawItem.rawName,
                ...parsed,
                releaseDateISO: parseKinozalDate(rawItem.releaseDateRaw)
            };
        } catch (error) {
            console.error('Ошибка обработки:', error.message, rawItem);
            return null;
        }
    }).filter(Boolean);
}

function parseKinozalTitles(rawName) {
    // 1. Разделяем строку на части
    const parts = rawName.split('/').map(p => p.trim());

    // 2. Ищем качество с конца
    let quality = null;
    let qualityIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].includes('2160p')) {
            quality = '2160p';
            qualityIndex = i;
            break;
        } else if (parts[i].includes('1080p')) {
            quality = '1080p';
            qualityIndex = i;
            break;
        }
    }

    // 3. Ищем год в оставшихся частях (до qualityIndex)
    let year = null;
    let yearIndex = -1;
    for (let i = (qualityIndex >= 0 ? qualityIndex - 1 : parts.length - 1); i >= 0; i--) {
        const yearMatch = parts[i].match(/\b\d{4}\b/);
        if (yearMatch) {
            year = yearMatch[0];
            yearIndex = i;
            break;
        }
    }

    // 4. Извлекаем названия из оставшихся частей (до yearIndex)
    const nameParts = parts.slice(0, yearIndex >= 0 ? yearIndex : qualityIndex);

    // 5. Обработка русского названия
    let russianTitle = '';
    if (nameParts.length > 0) {
        russianTitle = nameParts[0].trim();
    }

    // 6. Обработка английского названия
    let originalTitle = null;
    if (nameParts.length > 1) {
        originalTitle = nameParts.slice(1).join(' / ').trim();
    }

    // 7. Парсинг информации о сериях
    let season = null;
    let episode = null;
    let totalEpisodes = null;

    // Паттерн с сезоном: "2 сезон: 1-3 серии из 8"
    const seriesMatch = russianTitle.match(
        /(\d+)\s*сезон[^]*?(\d+)(?:\s*[—\-]\s*(\d+))?\s*сер(ия|ии|ий)(?: из (\d+))?/i
    );

    if (seriesMatch) {
        season = parseInt(seriesMatch[1], 10);
        episode = seriesMatch[3] ? parseInt(seriesMatch[3], 10) : parseInt(seriesMatch[2], 10);
        totalEpisodes = seriesMatch[5] ? parseInt(seriesMatch[5], 10) : null;

        // Удаляем совпадение из русского названия
        russianTitle = russianTitle.replace(seriesMatch[0], '').trim();
        russianTitle = russianTitle.replace(/\(\s*\)/g, '').trim();
    } else {
        // Паттерн без сезона: "1-16 серии из 16"
        const noSeasonMatch = russianTitle.match(
            /\(\s*(\d+)\s*(?:[—\-]\s*(\d+))?\s*сер(ия|ии|ий)(?: из (\d+))?\s*\)/i
        );
        if (noSeasonMatch) {
            season = 1; // минисериал
            episode = noSeasonMatch[2]
                ? parseInt(noSeasonMatch[2], 10)
                : parseInt(noSeasonMatch[1], 10);
            totalEpisodes = noSeasonMatch[4] ? parseInt(noSeasonMatch[4], 10) : null;

            // Удаляем совпадение из русского названия
            russianTitle = russianTitle.replace(noSeasonMatch[0], '').trim();
            russianTitle = russianTitle.replace(/\(\s*\)/g, '').trim();
        }
    }

    return {
        russianTitle,
        originalTitle,
        year: year ? parseInt(year, 10) : null,
        quality,
        season,
        episode,
        totalEpisodes
    };
}


function parseKinozalDate(dateStr) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const months = {
        'янв': 0,
        'фев': 1,
        'мар': 2,
        'апр': 3,
        'май': 4,
        'июн': 5,
        'июл': 6,
        'авг': 7,
        'сен': 8,
        'окт': 9,
        'ноя': 10,
        'дек': 11
    };

    try {
        const dotFormatMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+в\s+(\d{1,2}):(\d{2}))?/);
        if (dotFormatMatch) {
            const day = parseInt(dotFormatMatch[1]);
            const month = parseInt(dotFormatMatch[2]) - 1;
            const year = parseInt(dotFormatMatch[3]);
            const hours = dotFormatMatch[4] ? parseInt(dotFormatMatch[4]) : 0;
            const minutes = dotFormatMatch[5] ? parseInt(dotFormatMatch[5]) : 0;
            return new Date(year, month, day, hours, minutes).toISOString();
        }

        const lowerDateStr = dateStr.toLowerCase();

        if (lowerDateStr.includes('сегодня')) {
            const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                today.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]));
            }
            return today.toISOString();
        }

        if (lowerDateStr.includes('вчера')) {
            const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                yesterday.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]));
            }
            return yesterday.toISOString();
        }

        const parts = dateStr.split(' ').filter(p => p.trim() !== '');
        if (parts.length >= 3) {
            const day = parseInt(parts[0]);
            const month = months[parts[1]];
            let year = parts[2];

            if (year.length === 2) {
                year = 2000 + parseInt(year);
            } else {
                year = parseInt(year);
            }

            if (isNaN(day) || isNaN(month) || isNaN(year)) {
                return new Date().toISOString();
            }

            return new Date(year, month, day).toISOString();
        }

        return new Date().toISOString();
    } catch (error) {
        return new Date().toISOString();
    }
}

async function parseKinozalSources(config) {
    const allRawItems = [];

    for (const [key, sourceConfig] of Object.entries(config)) {
        for (let page = 0; page < sourceConfig.pages; page++) {
            const pageItems = await parseKinozalPage(sourceConfig.url, page);
            allRawItems.push(...pageItems);
            await sleep(KZ_REQUEST_DELAY);
        }
    }

    // Сохраняем сырые данные
    if (allRawItems.length > 0) {
        fs.mkdirSync('wip_series', {
            recursive: true
        });
        fs.writeFileSync('wip_series/parsed_pages.json', JSON.stringify(allRawItems, null, 2));
        console.log(`\nСохранено сырых данных: wip_series/parsed_pages.json (${allRawItems.length} записей)`);
    }

    // Обрабатываем сырые данные
    const processedItems = processKinozalRawItems(allRawItems);

    // Сохраняем обработанные данные
    if (processedItems.length > 0) {
        fs.writeFileSync('wip_series/parsed_parsed.json', JSON.stringify(processedItems, null, 2));
        console.log(`Сохранено обработанных данных: wip_series/parsed_parsed.json (${processedItems.length} записей)`);
    }

    return processedItems;
}

// ======== TMDB ПОИСК ДЛЯ СЕРИАЛОВ ========
async function searchTmdb(title, year, type = 'tv') {
    try {
        const searchUrl = `${TMDB_BASE_URL}/search/${type}?api_key=${TMDB_API_KEY}` +
            `&query=${encodeURIComponent(title)}` +
            `&language=ru` +
            `&include_adult=false` +
            `&region=RU`;

        const response = await axios.get(searchUrl);

        if (response.data.results && response.data.results.length > 0) {
            return {
                type,
                result: response.data.results[0]
            };
        }
        return null;
    } catch (error) {
        console.error(`[TMDB Ошибка] ${title}:`, error.message);
        return null;
    }
}

function hasRussianLetters(text) {
    if (!text) return false;
    return /[а-яёА-ЯЁ]/.test(text);
}

async function findInTmdb(item, current, total) {
    console.log('\n' + '='.repeat(80));
    console.log(`[${current}/${total}] Поиск: ${item.originalTitle || 'N/A'} / ${item.russianTitle || 'N/A'} / ${item.year || 'N/A'}`);
    console.log(`Сезон: ${item.season || 'N/A'}, Серия: ${item.episode || 'N/A'}`);
    console.log('='.repeat(80));

    // Проверка кеша
    const cachedData = getFromCache(
        item.originalTitle || '',
        item.russianTitle || '',
        item.year || ''
    );

    if (cachedData) {
        console.log(`[КЕШ] Найдено: ${cachedData.result.name} (ID: ${cachedData.result.id})`);
        return {
            ...item,
            tmdb: cachedData
        };
    }

    function compareTitles(searchTitle, tmdbTitle, tmdbOriginalTitle) {
        console.log('\n[СРАВНЕНИЕ НАЗВАНИЙ]');
        console.log(`Исходный запрос: "${searchTitle}"`);
        console.log(`TMDB название:   "${tmdbTitle}"`);
        console.log(`TMDB оригинал:    "${tmdbOriginalTitle}"`);

        // Нормализация с сохранением пробелов
        const normalize = (str) => str.toLowerCase().replace(/[^a-zа-яё0-9\s]/g, '');

        const normalizedSearch = normalize(searchTitle);
        const normalizedTmdb = normalize(tmdbTitle);
        const normalizedOriginal = tmdbOriginalTitle ? normalize(tmdbOriginalTitle) : '';

        // Разбиваем на слова
        const searchWords = normalizedSearch.split(/\s+/).filter(w => w);
        const tmdbWords = normalizedTmdb.split(/\s+/).filter(w => w);
        const originalWords = normalizedOriginal.split(/\s+/).filter(w => w);

        console.log(`Слова запроса: [${searchWords.join(', ')}]`);
        console.log(`Слова TMDB (локал): [${tmdbWords.join(', ')}]`);
        console.log(`Слова TMDB (оригинал): [${originalWords.join(', ')}]`);

        // Проверка точного совпадения всех слов
        const exactMatch = (words1, words2) => {
            return words1.length === words2.length &&
                words1.every((w, i) => w === words2[i]);
        };

        // Проверка вхождения всех слов запроса
        const containsAllWords = (source, target) => {
            return source.every(word => target.includes(word));
        };

        // 1. Проверка точного совпадения
        if (exactMatch(searchWords, tmdbWords)) {
            console.log('✅ ТОЧНОЕ СОВПАДЕНИЕ (локализованное название)');
            return {
                match: true,
                type: 'exact',
                matchedField: 'name'
            };
        }

        if (normalizedOriginal && exactMatch(searchWords, originalWords)) {
            console.log('✅ ТОЧНОЕ СОВПАДЕНИЕ (оригинальное название)');
            return {
                match: true,
                type: 'exact',
                matchedField: 'original_name'
            };
        }

        // 2. Проверка вхождения всех слов
        if (containsAllWords(searchWords, tmdbWords)) {
            console.log('✅ ЧАСТИЧНОЕ СОВПАДЕНИЕ (все слова запроса в локализованном названии)');
            return {
                match: true,
                type: 'partial',
                matchedField: 'name'
            };
        }

        if (normalizedOriginal && containsAllWords(searchWords, originalWords)) {
            console.log('✅ ЧАСТИЧНОЕ СОВПАДЕНИЕ (все слова запроса в оригинальном названии)');
            return {
                match: true,
                type: 'partial',
                matchedField: 'original_name'
            };
        }

        console.log('❌ НЕТ СОВПАДЕНИЯ ПО НАЗВАНИЮ');
        return {
            match: false
        };
    }

    // Основная функция поиска для сериалов
    const performSearch = async (query) => {
        console.log(`\nЗапрос: ${query}`);

        try {
            const params = {
                api_key: TMDB_API_KEY,
                query: encodeURIComponent(query),
                language: 'ru-RU',
                include_adult: false
            };

            const response = await axios.get(`${TMDB_BASE_URL}/search/tv`, {
                params
            });
            console.log(`\nНайдено результатов: ${response.data.results.length}`);

            for (const [index, result] of response.data.results.entries()) {
                console.log(`\n[Кандидат ${index + 1}/${response.data.results.length}] ${result.name} (ID: ${result.id})`);

                // Проверка русского описания
                if (!result.overview || !hasRussianLetters(result.overview)) {
                    console.log('❌ Пропуск: отсутствует русское описание');
                    continue;
                }

                // Сравнение названий
                const titleMatch = compareTitles(query, result.name, result.original_name);

                if (titleMatch.match) {
                    console.log(`🎉 НАЙДЕН ПОДХОДЯЩИЙ КАНДИДАТ!`);
                    console.log(`Тип совпадения: ${titleMatch.type} (по полю: ${titleMatch.matchedField})`);

                    try {
                        // Запрос дополнительных данных
                        const details = await axios.get(
                            `${TMDB_BASE_URL}/tv/${result.id}`, {
                                params: {
                                    api_key: TMDB_API_KEY,
                                    language: 'ru-RU',
                                    append_to_response: 'genres'
                                }
                            }
                        );
                        console.log(`✅ Получены детали сериала`);
                        return {
                            result: {
                                ...details.data,
                                overview: result.overview // сохраняем русское описание
                            }
                        };
                    } catch (error) {
                        console.error('Ошибка получения деталей:', error.message);
                        return {
                            result
                        }; // возвращаем базовые данные
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Ошибка поиска:', error.message);
            return null;
        }
    };

    // Пробуем сначала основные названия
    let result = null;

    if (item.originalTitle) {
        console.log('\nПопытка 1: Поиск по оригинальному названию');
        result = await performSearch(item.originalTitle);
    }

    if (!result && item.russianTitle) {
        console.log('\nПопытка 2: Поиск по русскому названию');
        result = await performSearch(item.russianTitle);
    }

    if (result) {
        console.log(`\nУСПЕШНО НАЙДЕНО: ${result.result.name} (ID: ${result.result.id})`);

        // Сохраняем в кеш
        saveToCache(
            item.originalTitle || '',
            item.russianTitle || '',
            item.year || '',
            result
        );

        return {
            ...item,
            tmdb: result
        };
    }

    console.log('\n❌ РЕЗУЛЬТАТ НЕ НАЙДЕН');
    return null;
}

// ======== ДЕДУБЛИКАЦИЯ (после парсинга Kinozal) ========
function deduplicateItems(items) {
    const deduplicationMap = new Map();

    items.forEach(item => {
        // Ключ: только русское и оригинальное название
        const key = `${item.russianTitle}|${item.originalTitle}`;
        const existing = deduplicationMap.get(key);

        if (!existing) {
            // Первая запись с таким названием
            deduplicationMap.set(key, item);
            return;
        }

        // Определяем какая запись новее по серии (с учетом сезона)
        let shouldReplace = false;
        
        // 1. Сравниваем сезоны
        if (item.season > existing.season) {
            shouldReplace = true;
        } 
        // 2. При одинаковом сезоне сравниваем серии
        else if (item.season === existing.season && item.episode > existing.episode) {
            shouldReplace = true;
        }
        // 3. При одинаковых сезоне и серии выбираем лучшее качество
        else if (item.season === existing.season && item.episode === existing.episode) {
            const existingQualityIndex = QUALITY_ORDER.indexOf(existing.quality);
            const currentQualityIndex = QUALITY_ORDER.indexOf(item.quality);
            
            if (currentQualityIndex < existingQualityIndex) {
                shouldReplace = true;
            }
            // 4. При одинаковом качестве выбираем новую дату
            else if (currentQualityIndex === existingQualityIndex && 
                     new Date(item.releaseDateISO) > new Date(existing.releaseDateISO)) {
                shouldReplace = true;
            }
        }

        if (shouldReplace) {
            deduplicationMap.set(key, item);
        }
    });

    return Array.from(deduplicationMap.values());
}

// ======== НОРМАЛИЗАЦИЯ ДАННЫХ ДЛЯ СЕРИАЛОВ ========
function normalizeCustomJson(items) {
    const groups = {};
    const itemsWithoutId = [];
    let itemsWithTmdb = 0;

    items.forEach(item => {
        if (!item.releaseDateISO) return;

        if (item.tmdb && item.tmdb.result) {
            itemsWithTmdb++;
            const base = {
                ...item.tmdb.result,
                rawName: item.rawName,
                release_quality: item.quality || '',
                media_type: 'tv',
                torrent_release_date: item.releaseDateISO,
                season: item.season,
                episode: item.episode,
                totalEpisodes: item.totalEpisodes
            };

            if (base.id) {
                // Ключ ТОЛЬКО по TMDB ID
                const key = `tv_${base.id}`;

                if (!groups[key]) {
                    groups[key] = {
                        items: [],
                    };
                }

                groups[key].items.push(base);
            } else {
                itemsWithoutId.push({
                    title: item.originalTitle || item.russianTitle,
                    reason: 'Отсутствует TMDB ID'
                });
            }
        }
    });

    const groupedItems = [];
    let duplicatesRemoved = 0;

    for (const key in groups) {
        const group = groups[key];

        // Сортировка по новизне серии (сезон + серия)
        group.items.sort((a, b) => {
            // 1. По сезону (новые сезоны важнее)
            if (b.season !== a.season) {
                return b.season - a.season;
            }
            
            // 2. По серии (новые серии важнее)
            if (b.episode !== a.episode) {
                return b.episode - a.episode;
            }
            
            // 3. По качеству
            const aQualityIndex = QUALITY_ORDER.indexOf(a.release_quality);
            const bQualityIndex = QUALITY_ORDER.indexOf(b.release_quality);
            if (aQualityIndex !== bQualityIndex) {
                return aQualityIndex - bQualityIndex;
            }
            
            // 4. По дате релиза
            return new Date(b.torrent_release_date) - new Date(a.torrent_release_date);
        });

        // Берем самый свежий элемент (первый после сортировки)
        const bestItem = group.items[0];
        duplicatesRemoved += group.items.length - 1;
        groupedItems.push(bestItem);
    }

    // Сортировка финального списка по дате релиза
    groupedItems.sort((a, b) =>
        new Date(b.torrent_release_date) - new Date(a.torrent_release_date)
    );

    return {
        results: groupedItems,
        page: 1,
        total_pages: 1,
        total_results: groupedItems.length,
        _stats: {
            duplicatesRemoved
        }
    };
}

// ======== СОХРАНЕНИЕ РЕЗУЛЬТАТОВ ========
function saveFinalOutput(normalizedData, limit = MAX_FINAL_ITEMS) {
    const limitedResults = normalizedData.results.slice(0, limit);

    const result = {
        results: limitedResults,
        page: 1,
        total_pages: 1,
        total_results: limitedResults.length
    };

    fs.writeFileSync('inq_parser_series.json', JSON.stringify(result, null, 2));
    console.log(`Финальные результаты сохранены в inq_parser_series.json (${limitedResults.length} элементов)`);
}

// ======== TELEGRAM ОПОВЕЩЕНИЯ ДЛЯ СЕРИАЛОВ ========
async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('Отсутствуют Telegram credentials - пропускаем отправку');
        return false;
    }

    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }, {
                timeout: 10000
            }
        );
        return true;
    } catch (error) {
        console.error(`Ошибка отправки в Telegram: ${error.message}`);
        return false;
    }
}

async function sendTelegramPhoto(photoUrl, caption) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('Отсутствуют Telegram credentials - пропускаем отправку');
        return false;
    }

    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
                chat_id: TELEGRAM_CHAT_ID,
                photo: photoUrl,
                caption: caption,
                parse_mode: 'HTML'
            }, {
                timeout: 10000
            }
        );
        return true;
    } catch (error) {
        console.error(`Ошибка отправки фото в Telegram: ${error.message}`);
        return false;
    }
}

// Форматирование сообщения для сериала
function formatSeriesMessage(series, season, episode, isNewEpisode = false, oldSeason = null, oldEpisode = null) {
    const prefix = isNewEpisode ? 
        `🆕 <b>НОВАЯ СЕРИЯ</b>\n\n` : 
        `📺 <b>НОВЫЙ СЕРИАЛ</b>\n\n`;

    const titleBlock = [
        `<b>Сериал:</b> ${series.name}`,
        series.original_name && series.original_name !== series.name ?
        `<b>Оригинальное:</b> ${series.original_name}` : null,
        season ? `<b>Сезон:</b> ${season}` : null,
        episode ? `<b>Серия:</b> ${episode}` : null
    ].filter(Boolean).join('\n');

    const ratingText = series.vote_average > 0 ? 
        `${series.vote_average.toFixed(1)}/10` : 
        'Мало оценок';

    const genres = series.genres?.map(g => g.name).join(', ') || 'Не указано';

    const details = [
        `⭐ <b>Рейтинг:</b> ${ratingText}`,
        `🎭 <b>Жанры:</b> ${genres}`,
        series.origin_country?.length > 0 ? 
        `🌍 <b>Страна:</b> ${series.origin_country[0]}` : null
    ].filter(Boolean).join('\n');

    return prefix + titleBlock + '\n\n' + details + '\n\n📝 <b>Описание:</b>\n' + series.overview;
}

// ======== РЕЖИМ ЕЖЕДНЕВНОГО ОБНОВЛЕНИЯ ========
async function dailyUpdate() {
    console.log('\n' + '='.repeat(50));
    console.log('=== РЕЖИМ ЕЖЕДНЕВНОГО ОБНОВЛЕНИЯ ДЛЯ СЕРИАЛОВ ===');
    console.log('='.repeat(50) + '\n');

    // Проверяем наличие основного файла
    if (!fs.existsSync('inq_parser_series.json')) {
        console.log('⚠️ Основной файл не найден, запускаем первичное наполнение...');
        await primaryFill();
        return;
    }

    // Загрузка текущего списка
    console.log('📥 Загрузка текущего списка...');
    const currentData = JSON.parse(fs.readFileSync('inq_parser_series.json', 'utf8'));
    const currentItems = currentData.results;
    console.log(`✅ Загружен текущий список: ${currentItems.length} элементов\n`);

    // Парсинг новых раздач
    console.log('='.repeat(50));
    console.log('=== ПАРСИНГ НОВЫХ РАЗДАЧ ЗА 3 ДНЯ ===');
    console.log('='.repeat(50));

    const dailyRawItems = [];
    let totalPages = 0;
    let totalRawItems = 0;

    for (const [key, config] of Object.entries(KINOZAL_DAILY_URLS)) {
        for (let page = 0; page < config.pages; page++) {
            totalPages++;
            console.log(`\n🔎 Парсинг страницы ${page} (${key})`);
            const pageItems = await parseKinozalPage(config.url, page);
            dailyRawItems.push(...pageItems);
            totalRawItems += pageItems.length;
            console.log(`   → Получено записей: ${pageItems.length}`);
            await sleep(KZ_REQUEST_DELAY);
        }
    }

    // Вывод статистики парсинга
    console.log('\n' + '📊 СТАТИСТИКА ПАРСИНГА:');
    console.log('='.repeat(40));
    console.log(`- Всего страниц: ${totalPages}`);
    console.log(`- Всего сырых записей: ${totalRawItems}`);

    // Сохранение сырых данных
    if (dailyRawItems.length > 0) {
        fs.writeFileSync('wip_series/parsed_pages_daily.json', JSON.stringify(dailyRawItems, null, 2));
        console.log(`- Сохранено сырых данных: wip_series/parsed_pages_daily.json`);
    }

    // Обработка данных
    console.log('\n' + '='.repeat(50));
    console.log('=== ОБРАБОТКА ДАННЫХ ===');
    console.log('='.repeat(50));

    console.log('\n🔧 Обработка названий и дат...');
    const processedDaily = processKinozalRawItems(dailyRawItems);
    console.log(`✅ Обработано записей: ${processedDaily.length}`);

    console.log('\n⚙️ Фильтрация результатов...');
    const filteredDaily = filterItems(processedDaily);
    console.log(`✅ После фильтрации: ${filteredDaily.length}`);

    console.log('\n♻️ Дедубликация результатов...');
    const dedupDaily = deduplicateItems(filteredDaily);
    console.log(`✅ После дедубликации: ${dedupDaily.length}`);

    // Сохранение промежуточных данных
    if (dedupDaily.length > 0) {
        fs.writeFileSync('wip_series/filtered_daily.json', JSON.stringify(filteredDaily, null, 2));
        fs.writeFileSync('wip_series/deduplicated_daily.json', JSON.stringify(dedupDaily, null, 2));
        console.log('\n💾 Сохранены промежуточные данные:');
        console.log(`- wip_series/filtered_daily.json (${filteredDaily.length})`);
        console.log(`- wip_series/deduplicated_daily.json (${dedupDaily.length})`);
    }

    // TMDB поиск
    console.log('\n' + '='.repeat(50));
    console.log('=== ПОИСК В TMDB ===');
    console.log('='.repeat(50));

    const tmdbDailyResults = [];
    let tmdbNotFound = 0;

    console.log(`\n🔍 Всего элементов для поиска: ${dedupDaily.length}`);

    for (let i = 0; i < dedupDaily.length; i++) {
        const item = dedupDaily[i];
        const tmdbData = await findInTmdb(item, i + 1, dedupDaily.length);

        if (tmdbData) {
            tmdbDailyResults.push(tmdbData);
        } else {
            tmdbNotFound++;
        }

        await sleep(REQUEST_DELAY);
    }

    // Вывод статистики TMDB
    console.log('\n' + '📊 СТАТИСТИКА TMDB:');
    console.log('='.repeat(40));
    console.log(`- Обработано элементов: ${dedupDaily.length}`);
    console.log(`- Найдено в TMDB: ${tmdbDailyResults.length}`);
    console.log(`- Не найдено в TMDB: ${tmdbNotFound}`);

    // Сохранение результатов TMDB
    if (tmdbDailyResults.length > 0) {
        fs.writeFileSync('wip_series/tmdb_results_daily.json', JSON.stringify(tmdbDailyResults, null, 2));
        console.log(`💾 Сохранено: wip_series/tmdb_results_daily.json`);
    }

    // Нормализация
    console.log('\n' + '='.repeat(50));
    console.log('=== НОРМАЛИЗАЦИЯ ДАННЫХ ===');
    console.log('='.repeat(50));

    console.log('\n📦 Нормализация результатов TMDB...');
    const normalizedDaily = normalizeCustomJson(tmdbDailyResults);
    const newItems = normalizedDaily.results;

    console.log('\n' + '📊 СТАТИСТИКА НОРМАЛИЗАЦИИ:');
    console.log('='.repeat(40));
    console.log(`- Получено новых элементов: ${newItems.length}`);
    console.log(`- Удалено дубликатов TMDB: ${normalizedDaily._stats.duplicatesRemoved}`);

    if (newItems.length > 0) {
        fs.writeFileSync('wip_series/normalized_daily.json', JSON.stringify(normalizedDaily, null, 2));
        console.log(`💾 Сохранено: wip_series/normalized_daily.json`);
    }

    // Объединение со старым списком
    console.log('\n' + '='.repeat(50));
    console.log('=== ОБЪЕДИНЕНИЕ СО СПИСКОМ ===');
    console.log('='.repeat(50));

    console.log(`\n🔄 Объединяем с текущим списком (${currentItems.length} элементов)`);
    console.log(`- Новых элементов для добавления: ${newItems.length}`);

    const updatedItems = [...currentItems];
    let added = 0;
    let replaced = 0;
    let skipped = 0;

    // Список для оповещений
    const notifications = [];

    for (const newItem of newItems) {
        // Ищем существующий сериал с таким же ID
        const existingIndex = updatedItems.findIndex(item => 
            item.id === newItem.id && item.media_type === newItem.media_type
        );

        if (existingIndex !== -1) {
            const existingItem = updatedItems[existingIndex];
            
            // Проверяем наличие новых серий
            const isNewSeason = newItem.season > existingItem.season;
            const isNewEpisode = newItem.season === existingItem.season && 
                                 newItem.episode > existingItem.episode;
            
            if (isNewSeason || isNewEpisode) {
                // updatedItems.splice(existingIndex, 1, newItem);
                // УДАЛЯЕМ старую запись и ДОБАВЛЯЕМ новую в НАЧАЛО
                updatedItems.splice(existingIndex, 1);
                updatedItems.unshift(newItem);  // Добавляем в начало
                replaced++;
                console.log(`🔄 Обновлен "${newItem.name}" (Сезон: ${existingItem.season}->${newItem.season}, Серия: ${existingItem.episode}->${newItem.episode})`);

                // Добавляем в оповещения
                notifications.push({
                    item: newItem,
                    type: 'new_episode',
                    oldSeason: existingItem.season,
                    oldEpisode: existingItem.episode
                });
            } else {
                skipped++;
                console.log(`⏩ Пропущен "${newItem.name}" (нет новых серий)`);
            }
        } else {
            // Добавляем новый элемент в начало
            updatedItems.unshift(newItem);
            added++;
            console.log(`✅ Добавлен новый сериал "${newItem.name}" (Сезон ${newItem.season}, Серия ${newItem.episode})`);

            // Добавляем в оповещения
            notifications.push({
                item: newItem,
                type: 'new'
            });
        }
    }

    // Вывод результатов объединения
    console.log('\n' + '📊 РЕЗУЛЬТАТЫ ОБЪЕДИНЕНИЯ:');
    console.log('='.repeat(40));
    console.log(`- Добавлено новых элементов: ${added}`);
    console.log(`- Обновлено по новым сериям: ${replaced}`);
    console.log(`- Пропущено (без изменений): ${skipped}`);
    console.log(`- Всего элементов после объединения: ${updatedItems.length}`);

    // Обрезаем до MAX_FINAL_ITEMS
    const finalResult = {
        results: updatedItems.slice(0, MAX_FINAL_ITEMS),
        page: 1,
        total_pages: 1,
        total_results: Math.min(updatedItems.length, MAX_FINAL_ITEMS)
    };

    // Сохраняем результат
    fs.writeFileSync('inq_parser_series.json', JSON.stringify(finalResult, null, 2));
    console.log(`\n💾 Финальный список сохранен (${finalResult.total_results} элементов)`);

    // Сохраняем кеш
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log('💾 Обновлен кеш TMDB');

    // Отправка оповещений в Telegram
    if (notifications.length > 0) {
        console.log('\n' + '='.repeat(50));
        console.log('=== ОТПРАВКА ОПОВЕЩЕНИЙ В TELEGRAM ===');
        console.log('='.repeat(50));

        console.log(`\n✉️ Всего оповещений для отправки: ${notifications.length}`);

        for (const notification of notifications) {
            try {
                const {
                    item,
                    type,
                    oldSeason,
                    oldEpisode
                } = notification;
                
                const isNewEpisode = type === 'new_episode';
                const message = formatSeriesMessage(
                    item,
                    item.season,
                    item.episode,
                    isNewEpisode,
                    oldSeason,
                    oldEpisode
                );

                let sendResult = false;

                if (item.poster_path) {
                    const posterUrl = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
                    console.log(`\n🖼️ Отправка фотооповещения: ${item.name}`);
                    sendResult = await sendTelegramPhoto(posterUrl, message);
                } else {
                    console.log(`\n✉️ Отправка текстового оповещения: ${item.name}`);
                    sendResult = await sendTelegramMessage(message);
                }

                if (sendResult) {
                    console.log(`✅ Оповещение отправлено: ${item.name}`);
                } else {
                    console.log(`❌ Ошибка отправки оповещения: ${item.name}`);
                }

                // Задержка между отправками
                await sleep(3000);
            } catch (error) {
                console.error(`⚠️ Ошибка отправки оповещения: ${error.message}`);
            }
        }
        console.log('\n✅ Все оповещения обработаны');
    } else {
        console.log('\nℹ️ Нет новых оповещений для отправки в Telegram');
    }

    console.log('\n' + '='.repeat(50));
    console.log('=== ЕЖЕДНЕВНОЕ ОБНОВЛЕНИЕ ДЛЯ СЕРИАЛОВ ЗАВЕРШЕНО ===');
    console.log('='.repeat(50));
}

// ======== РЕЖИМ ПЕРВИЧНОГО НАПОЛНЕНИЯ ========
async function primaryFill() {
    // Создаем папку для промежуточных результатов
    if (!fs.existsSync('wip_series')) {
        fs.mkdirSync('wip_series');
    }

    console.log('\n=== Этап 1: Парсинг Kinozal.tv ===');
    const kinozalItems = await parseKinozalSources(KINOZAL_URLS);
    console.log(`\n[Kinozal] Всего сохранено: ${kinozalItems.length} раздач\n`);

    const totalBeforeFilter = kinozalItems.length;

    console.log('\n=== Этап 2: Фильтрация результатов ===');
    console.log(`- До фильтрации: ${totalBeforeFilter} элементов`);
    const filteredItems = filterItems(kinozalItems);
    console.log(`- После фильтрации: ${filteredItems.length} элементов`);

    // Сохраняем отфильтрованные данные
    fs.writeFileSync('wip_series/filtered.json', JSON.stringify(filteredItems, null, 2));
    console.log('Сохранено: wip_series/filtered.json');

    console.log('\n=== Этап 3: Дедубликация ===');
    console.log(`- До дедубликации: ${filteredItems.length} элементов`);
    const deduplicatedItems = deduplicateItems(filteredItems);
    const duplicatesRemoved = filteredItems.length - deduplicatedItems.length;
    console.log(`- После дедубликации: ${deduplicatedItems.length} элементов`);
    console.log(`- Удалено дубликатов: ${duplicatesRemoved}`);

    // Сохраняем дедублицированные данные
    fs.writeFileSync('wip_series/deduplicated.json', JSON.stringify(deduplicatedItems, null, 2));
    console.log('Сохранено: wip_series/deduplicated.json');

    console.log('\n=== Этап 4: Поиск в TMDB ===');
    console.log(`Всего элементов для поиска: ${deduplicatedItems.length}\n`);

    const tmdbResults = [];
    let tmdbNotFound = 0;

    for (let i = 0; i < deduplicatedItems.length; i++) {
        const item = deduplicatedItems[i];
        const tmdbData = await findInTmdb(item, i + 1, deduplicatedItems.length);

        if (tmdbData) {
            tmdbResults.push(tmdbData);
        } else {
            tmdbNotFound++;
        }

        await sleep(REQUEST_DELAY);
    }

    // Сохраняем результаты TMDB
    fs.writeFileSync('wip_series/tmdb_results.json', JSON.stringify(tmdbResults, null, 2));
    console.log('\nСохранено: wip_series/tmdb_results.json');

    console.log('\n=== Этап 5: Нормализация данных ===');
    const normalized = normalizeCustomJson(tmdbResults);
    saveFinalOutput(normalized);

    // Сохраняем кеш
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log('Обновлен кеш TMDB');

    console.log('\n=== ИТОГОВАЯ СТАТИСТИКА ===');
    console.log('Фильтрация:');
    console.log(`- Отфильтровано коротких названий: ${stats.filteredByShortTitle}`);
    console.log(`- Отфильтровано релизов без указания серии: ${stats.filteredByMissingEpisode}`);
    console.log(`- Отфильтровано старых раздач (>${MAX_RELEASE_DAYS_OLD} дней): ${stats.filteredByAge}`); 
    console.log(`- Осталось после фильтрации: ${filteredItems.length}`);

    console.log('\nДедубликация:');
    console.log(`- Удалено дубликатов: ${duplicatesRemoved}`);
    console.log(`- Осталось уникальных: ${deduplicatedItems.length}`);

    console.log('\nПоиск в TMDB:');
    console.log(`- Найдено в TMDB: ${tmdbResults.length}`);
    console.log(`- Не найдено в TMDB: ${tmdbNotFound}`);

    console.log('\nФинальная обработка:');
    console.log(`- Удалено дубликатов TMDB: ${normalized._stats.duplicatesRemoved}`);
    console.log(`- После нормализации: ${normalized.total_results} элементов`);

    console.log(`- ИТОГО сохранено: ${MAX_FINAL_ITEMS} элементов или менее`);

    console.log('\nПервичное наполнение завершено!');
}

// ======== ГЛАВНАЯ ФУНКЦИЯ ========
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--primary')) {
        console.log('\n=== РЕЖИМ ПЕРВИЧНОГО НАПОЛНЕНИЯ ДЛЯ СЕРИАЛОВ ===');
        await primaryFill();
    } else {
        await dailyUpdate();
    }
}

// Запуск приложения
main().catch(console.error);