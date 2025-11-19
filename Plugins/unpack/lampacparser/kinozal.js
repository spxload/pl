const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const iconv = require('iconv-lite');

const TMDB_API_KEY = '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const RUTOR_URLS = {
  movies_foreign: { 
    urlTemplate: 'https://rutor.info/browse/%d/1/0/0', 
    tmdbType: 'movie',
    category: 'movies',
    pages: 0
  },
  movies_russian: { 
    urlTemplate: 'https://rutor.info/browse/%d/5/0/0', 
    tmdbType: 'movie',
    category: 'movies',
    pages: 0
  }, 
  tv_foreign: { 
    urlTemplate: 'https://rutor.info/browse/%d/4/0/0', 
    tmdbType: 'tv',
    category: 'tv',
    pages: 0
  },
  tv_russian: { 
    urlTemplate: 'https://rutor.info/browse/%d/16/0/0', 
    tmdbType: 'tv',
    category: 'tv',
    pages: 0
  } 
};

// Измененная конфигурация для Кинозала
const KINOZAL_URLS = {
  kinozal_4k: {
    url: 'https://kinozal.tv/browse.php?c=1002&v=7&page=',
    tmdbType: 'movie',
    category: 'movies_4k',
    pages: 6 
  },
  kinozal_1080p: {
    url: 'https://kinozal.tv/browse.php?c=1002&v=3001&page=',
    tmdbType: 'movie',
    category: 'movies_fhd',
    pages: 6 
  },
  kinozal_tv_4k: {
    url: 'https://kinozal.tv/browse.php?c=1001&v=7&page=',
    tmdbType: 'tv',
    category: 'tv_4k',
    pages: 6 
  },
  kinozal_tv_1080p: {
    url: 'https://kinozal.tv/browse.php?c=1001&v=3001&page=',
    tmdbType: 'tv',
    category: 'tv_fhd',
    pages: 6 
  },
  kinozal_mult_4k: {
    url: 'https://kinozal.tv/browse.php?c=1003&v=7&page=',
    tmdbType: 'all',
    category: 'mult_4k',
    pages: 6 
  },
  kinozal_mult_1080p: {
    url: 'https://kinozal.tv/browse.php?c=1003&v=3001&page=',
    tmdbType: 'all',
    category: 'mult_fhd',
    pages: 6 
  },kinozal_anime_4k: {
    url: 'https://kinozal.tv/browse.php?c=20&v=7&page=',
    tmdbType: 'all',
    category: 'anime_4k',
    pages: 6 
  },
  kinozal_anime_1080p: {
    url: 'https://kinozal.tv/browse.php?c=20&v=3001&page=',
    tmdbType: 'all',
    category: 'anime_fhd',
    pages: 6 
  },
};

const REQUEST_DELAY = 2000 + Math.random() * 300;
const ALLOWED_QUALITIES = ['2160p', '1080p']; 
const CACHE_FILE = 'tmdb_cache.json';
const MAX_RELEASE_DAYS_OLD = 30; // Максимальный возраст раздачи в днях
// Статистика
let stats = {
  totalFound: 0,
  filteredByQuality: 0,
  filteredByYear: 0,
  filteredByShortTitle: 0,
  filteredByNumericTitle: 0,
  saved: 0,
  tmdbTitleMismatch: 0,
  filteredByAge: 0, // Добавляем счетчик для фильтра по возрасту
  tmdbNoRussianOverview: 0, // Новый счетчик для элементов без русского описания
  categories: {}
};

let cache = {};

// ======== УТИЛИТЫ ========
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Проверка совпадения названий
function isTitleMatch(searchTitle, tmdbTitle) {
  if (!searchTitle || !tmdbTitle) return false;
  
  // Приводим к нижнему регистру и удаляем лишние символы
  const cleanSearch = searchTitle
    .toLowerCase()
    .replace(/[^\w\s]|\(.*?\)/g, '')
    .trim();
  
  const cleanTmdb = tmdbTitle
    .toLowerCase()
    .replace(/[^\w\s]|\(.*?\)/g, '')
    .trim();
  
  // Разделяем на слова и проверяем совпадение ключевых слов
  const searchWords = cleanSearch.split(/\s+/);
  const tmdbWords = cleanTmdb.split(/\s+/);
  
  // Проверяем, что все слова из поиска присутствуют в TMDB названии
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

function getFromCache(originalTitle, russianTitle, year, tmdbType) {
  const key = `${originalTitle}|${russianTitle}|${year}|${tmdbType}`;
  return cache[key] || null;
}

function saveToCache(originalTitle, russianTitle, year, tmdbType, responseData) {
  // Не кешируем результаты с короткими названиями
  if (originalTitle && originalTitle.length < 4) return false;
  
  const key = `${originalTitle}|${russianTitle}|${year}|${tmdbType}`;
  cache[key] = responseData;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    return true;
  } catch (error) {
    console.error('Ошибка сохранения кеша:', error.message);
    return false;
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 15000,
        responseType: 'arraybuffer',
        ...options
      });
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`[Retry ${i + 1}] ${url}`);
      await sleep(REQUEST_DELAY + Math.random() * 1000);
    }
  }
}

// ======== ФИЛЬТРАЦИЯ И ОБРАБОТКА ========
function filterAndProcessItems(items) {
  const currentYear = new Date().getFullYear();
  const results = [];
  
  items.forEach(item => {
    // Фильтрация по качеству
    if (!ALLOWED_QUALITIES.includes(item.quality)) {
      stats.filteredByQuality++;
      return;
    }
    
    // ФИЛЬТРАЦИЯ ПО ГОДУ ТОЛЬКО ДЛЯ ФИЛЬМОВ
    if (item.tmdbType === 'movie') {
      const yearNum = parseInt(item.year, 10);
      if (isNaN(yearNum)) {
        stats.filteredByYear++;
        return;
      }
      
      // Только текущий и предыдущий год для фильмов
      if (yearNum < currentYear - 1 || yearNum > currentYear) {
        stats.filteredByYear++;
        return;
      }
    }
    
    // Фильтрация коротких названий без русского варианта
    if (item.originalTitle && item.originalTitle.length < 3 && !item.russianTitle) {
      stats.filteredByShortTitle++;
      return;
    }
    
    // Фильтрация числовых названий
    if (/^\d+$/.test(item.originalTitle)) {
      stats.filteredByNumericTitle++;
      return;
    }
    
    // Фильтрация по старости раздачи
    if (item.releaseDateISO) {
      try {
        const releaseDate = new Date(item.releaseDateISO);
        const currentDate = new Date();
        
        // Рассчитываем разницу в днях
        const timeDiff = currentDate - releaseDate;
        const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
        
        if (daysDiff > MAX_RELEASE_DAYS_OLD) {
          stats.filteredByAge++;
          return;
        }
      } catch (e) {
        // Невалидная дата - пропускаем фильтр
        console.warn(`Invalid date: ${item.releaseDateISO}`, e);
      }
    }
    
    results.push(item);
  });
  
  return results;
}

// ======== УЛУЧШЕННОЕ УДАЛЕНИЕ ДУБЛИКАТОВ ========
function deduplicateItems(items) {
  const qualityPriority = ['2160p', '4k', '1080p', '720p', 'hd', 'sd'];
  const itemsMap = new Map();

  items.forEach(item => {
    // Создаем ключи для возможных дубликатов
    const keys = [];
    
    if (item.originalTitle) {
      keys.push(`${item.originalTitle.toLowerCase()}_${item.year}_${item.tmdbType}`);
    }
    
    if (item.russianTitle) {
      keys.push(`${item.russianTitle.toLowerCase()}_${item.year}_${item.tmdbType}`);
    }
    
    let bestItem = item;
    
    // Проверяем все ключи на наличие дубликатов
    for (const key of keys) {
      if (itemsMap.has(key)) {
        const existingItem = itemsMap.get(key);
        const existingIdx = qualityPriority.indexOf(existingItem.quality.toLowerCase());
        const newIdx = qualityPriority.indexOf(item.quality.toLowerCase());
        
        // Выбираем элемент с лучшим качеством
        if (newIdx < existingIdx) {
          bestItem = item;
        } else {
          bestItem = existingItem;
        }
      }
    }
    
    // Обновляем запись для всех ключей
    for (const key of keys) {
      itemsMap.set(key, bestItem);
    }
  });

  // Убираем дубликаты
  return Array.from(new Set(itemsMap.values()));
}

// ======== ПАРСЕР RUTOR ========
async function parseRutorPage(url, tmdbType, categoryName) {
  if (!stats.categories[categoryName]) {
    stats.categories[categoryName] = {
      found: 0,
      saved: 0
    };
  }

  try {
    console.log(`[Rutor] Загрузка: ${url}`);
    const response = await fetchWithRetry(url);
    const $ = cheerio.load(response.data);
    const results = [];

    $('#index table tr').each((i, row) => {
      const cols = $(row).find('td');
      if (cols.length < 3) return;
      
      // Проверяем, есть ли ссылка на раздачу (это отличит реальные раздачи от заголовков)
      const nameLink = cols.eq(1).find('a');
      if (nameLink.length === 0) return;
      
      const releaseDateRaw = cols.eq(0).text().trim();
      const releaseDateISO = parseRutorDate(releaseDateRaw);

      const rawName = nameLink.text().trim(); // Берем текст только из ссылки
      stats.categories[categoryName].found++;
      stats.totalFound++;

      // Извлекаем качество
      const qualityMatch = rawName.match(/(1080p|2160p)/i);
      const quality = qualityMatch ? qualityMatch[0].toLowerCase() : null;

      // Парсинг названий и года
      const { russianTitle, originalTitle, year } = parseTitles(rawName);
      
      results.push({ 
        russianTitle, 
        originalTitle, 
        year, 
        quality,
        tmdbType,
        rawName,
        releaseDateISO,
        source: 'rutor',
        categories: [categoryName] // Добавляем категорию
      });
      stats.categories[categoryName].saved++;
    });

    console.log(`[Rutor] ${categoryName}: найдено ${results.length} раздач`);
    return results;
  } catch (error) {
    console.error(`[Ошибка] ${categoryName}:`, error.message);
    return [];
  }
}

function parseRutorDate(dateStr) {
  const parts = dateStr.replace(/\u00A0/g, ' ').split(' ');
  if (parts.length !== 3) return null;

  let [day, monthRus, yearShort] = parts;

  const monthMap = {
    'Янв': '01',
    'Фев': '02',
    'Мар': '03',
    'Апр': '04',
    'Май': '05',
    'Июн': '06',
    'Июл': '07',
    'Авг': '08',
    'Сен': '09',
    'Окт': '10',
    'Ноя': '11',
    'Дек': '12'
  };

  const month = monthMap[monthRus] || '01';
  const year = yearShort.length === 2 ? '20' + yearShort : yearShort;

  return `${year}-${month}-${day.padStart(2, '0')}`;
}

// ======== ПАРСЕР KINOZAL ========
function parseKinozalDate(dateStr) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const months = {
    'янв': 0, 'фев': 1, 'мар': 2, 'апр': 3,
    'май': 4, 'июн': 5, 'июл': 6, 'авг': 7,
    'сен': 8, 'окт': 9, 'ноя': 10, 'дек': 11
  };

  try {
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

    const yesterdayMatch = dateStr.match(/вчера\s+в\s+(\d+):(\d+)/i);
    if (yesterdayMatch) {
      yesterday.setHours(parseInt(yesterdayMatch[1]), parseInt(yesterdayMatch[2]));
      return yesterday.toISOString();
    }

    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
    
    return new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

function parseKinozalTitles(rawName) {
  // Функция для очистки названия от информации о сезонах/сериях
  const cleanTitle = (title) => {
    return title
      .replace(/\s*\([^)]*(?:сезон|серии|серия|из)[^)]*\)/gi, '')
      .split(/(?:\s{2,}|\s+\|\s+| от | by )/i)[0]
      .replace(/\b(BDRemux|WEB[-]?DL|Blu[-]?Ray|HDRip|WEBRip|HDTV|iTunes|AVC|HEVC|AAC|MP3|DTS|FLAC|DDP5\.1|Dolby.*|HDR|4K|1080p|2160p)\b/gi, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Пытаемся разобрать по основному шаблону: Русское название / Оригинальное название / Год / Детали
  const pattern = /^(.*?)\s*\/\s*(.*?)\s*\/\s*(\d{4})\s*\/\s*(.*)/;
  const match = rawName.match(pattern);
  
  if (match) {
    return {
      russianTitle: cleanTitle(match[1].trim()),
      originalTitle: cleanTitle(match[2].trim()),
      year: match[3],
      details: match[4]
    };
  }
  
  // Альтернативный шаблон для случаев без русского названия: Оригинальное название / Год / Детали
  const altPattern = /^(.*?)\s*\/\s*(\d{4})\s*\/\s*(.*)/;
  const altMatch = rawName.match(altPattern);
  
  if (altMatch) {
    return {
      russianTitle: '',
      originalTitle: cleanTitle(altMatch[1].trim()),
      year: altMatch[2],
      details: altMatch[3]
    };
  }
  
  // Если не сработали шаблоны, пытаемся извлечь год из скобок
  const yearMatch = rawName.match(/\((\d{4})\)/);
  const year = yearMatch ? yearMatch[1] : null;
  
  // Ручной парсинг по слэшам
  const parts = rawName.split('/').map(p => cleanTitle(p.trim()));
  let russianTitle = '';
  let originalTitle = '';

  if (parts.length > 1) {
    russianTitle = parts[0];
    originalTitle = parts[1];
  } else {
    originalTitle = parts[0];
  }

  return { 
    russianTitle, 
    originalTitle, 
    year 
  };
}

// Обновленная функция parseKinozalPage
async function parseKinozalPage(baseUrl, tmdbType, categoryName, pageNum) {
  const url = `${baseUrl}${pageNum}`;
  
  if (!stats.categories[categoryName]) {
    stats.categories[categoryName] = {
      found: 0,
      saved: 0
    };
  }

  try {
    console.log(`[Kinozal] Загрузка: ${url}`);
    const response = await fetchWithRetry(url);
    
    const html = iconv.decode(response.data, 'win1251');
    const $ = cheerio.load(html);
    const results = [];

    const table = $('table.t_peer.w100p');
    if (!table.length) {
      console.log('[Kinozal] Таблица с раздачами не найдена!');
      return [];
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

        stats.categories[categoryName].found++;
        stats.totalFound++;

        let quality = null;
        if (rawName.match(/2160p|4K|UHD|4к/i)) {
          quality = '2160p';
        } else if (rawName.match(/1080p|FullHD|1080/i)) {
          quality = '1080p';
        }

        const { russianTitle, originalTitle, year } = parseKinozalTitles(rawName);
        const releaseDateISO = parseKinozalDate(releaseDateRaw);

        results.push({
          russianTitle,
          originalTitle,
          year: year ? parseInt(year) : null,
          quality,
          tmdbType,
          rawName,
          releaseDateISO,
          source: 'kinozal',
          categories: [categoryName] // Исправлено: передаем categoryName
        });
        
        stats.categories[categoryName].saved++;
      } catch (error) {
        console.error(`Ошибка в строке ${i}:`, error.message);
      }
    });

    console.log(`[Kinozal] ${categoryName} (стр. ${pageNum}): найдено ${results.length} раздач`);
    return results;
  } catch (error) {
    console.error(`[Kinozal] Ошибка ${categoryName}:`, error.message);
    return [];
  }
}

// Обновленная функция parseKinozalSources
async function parseKinozalSources() {
  const allItems = [];
  
  for (const [key, config] of Object.entries(KINOZAL_URLS)) {
    for (let page = 0; page < config.pages; page++) {
      //await sleep(REQUEST_DELAY);
      const pageItems = await parseKinozalPage(
        config.url, 
        config.tmdbType, 
        config.category, // Исправлено: передаем category из конфига
        page
      );
      allItems.push(...pageItems);
    }
  }
  
  return allItems;
}

// ======== ОБЩИЕ ФУНКЦИИ ========
function parseTitles(name) {
  const yearMatch = name.match(/\((\d{4})\)/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;
  const nameWithoutYear = year ? name.replace(`(${year})`, '').trim() : name.trim();

  const parts = nameWithoutYear.split('/').map(p => cleanTitle(p.trim()));
  
  let russianTitle = '';
  let originalTitle = '';

  if (parts.length > 1) {
    russianTitle = parts[0];
    originalTitle = parts[1];
  } else {
    originalTitle = parts[0];
  }

  return { 
    russianTitle: russianTitle || null, 
    originalTitle, 
    year 
  };
}

function cleanTitle(title) {
  return title
    // Удаляем блоки в скобках с информацией о сезонах/сериях
    .replace(/\s*\([^)]*(?:сезон|серии|серия|из)[^)]*\)/gi, '')
    
    .split(/(?:\s{2,}|\s+\|\s+| от | by )/i)[0]
    .replace(/\b(BDRemux|WEB[-]?DL|Blu[-]?Ray|HDRip|WEBRip|HDTV|iTunes|AVC|HEVC|AAC|MP3|DTS|FLAC|DDP5\.1|Dolby.*|HDR|4K|1080p|2160p)\b/gi, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchTmdb(title, year, type) {
  try {
    const searchUrl = `${TMDB_BASE_URL}/search/${type}?api_key=${TMDB_API_KEY}` +
      `&query=${encodeURIComponent(title)}` +
      `&year=${year}` +
      `&language=ru` +
      `&include_adult=false` + // исключаем взрослый контент
      `&region=RU`; // приоритет русскоязычным результатам
      
    const response = await axios.get(searchUrl);
    
    if (response.data.results && response.data.results.length > 0) {
      return {
        type,
        result: response.data.results[0]
      };
    }
    return null;
  } catch (error) {
    console.error(`[TMDB Ошибка] ${title} (${year}):`, error.message);
    return null;
  }
}

function hasRussianLetters(text) {
  if (!text) return false;
  return /[а-яёА-ЯЁ]/.test(text);
}

// Вспомогательная функция для получения года из результата TMDB
function getTmdbYear(result, type) {
  if (type === 'movie' && result.release_date) {
    return new Date(result.release_date).getFullYear();
  }
  if (type === 'tv' && result.first_air_date) {
    return new Date(result.first_air_date).getFullYear();
  }
  return null;
}

// ИЗМЕНЕННАЯ ФУНКЦИЯ - ДОБАВЛЕН СЧЕТЧИК ДЛЯ РЕЗУЛЬТАТОВ БЕЗ РУССКОГО ОПИСАНИЯ
async function findInTmdb(item, category, current, total) {
  let tmdbResults = [];
  const typesToSearch = item.tmdbType === 'all' ? ['tv', 'movie'] : [item.tmdbType];
  
  console.log(`\n[${current}/${total}] ${category}: Ищем "${item.originalTitle}" (${item.year})`);

  const cacheKey = {
    originalTitle: item.originalTitle,
    russianTitle: item.russianTitle,
    year: item.year,
    tmdbType: item.tmdbType
  };

  const cachedData = getFromCache(
    cacheKey.originalTitle,
    cacheKey.russianTitle,
    cacheKey.year,
    cacheKey.tmdbType
  );

  // Если найдено в кеше и есть русское описание - сразу возвращаем результат
  if (cachedData && cachedData.result.overview && hasRussianLetters(cachedData.result.overview)) {
    console.log(`→ Найдено в кеше! (${cachedData.result.title || cachedData.result.name})`);
    return {
      ...item,
      tmdb: cachedData
    };
  }

  // Флаг для отслеживания наличия результатов без русского описания
  let foundWithoutRussianOverview = false;

  for (const type of typesToSearch) {
    process.stdout.write(`→ Пробуем как ${type}... `);
    const result = await searchTmdb(item.originalTitle, item.year, type);
    
    if (result) {
      // Проверяем соответствие года только для фильмов
      if (type === 'movie') {
        const tmdbYear = getTmdbYear(result.result, type);
        
        // Если год в TMDB доступен и разница больше 1 года
        if (tmdbYear && item.year && Math.abs(tmdbYear - item.year) > 1) {
          console.log(`Найдено, но год не совпадает: TMDB ${tmdbYear} vs наш ${item.year} - пропускаем`);
          continue;
        }
      }
      
      if (result.result.overview && hasRussianLetters(result.result.overview)) {
        console.log(`Найдено! (${result.result.title || result.result.name})`);
        tmdbResults.push(result);
        break;
      } else {
        console.log('Найдено, но нет русского описания - пропускаем');
        foundWithoutRussianOverview = true;
        continue;
      }
    } else {
      console.log('Не найдено');
    }
  }

  if (tmdbResults.length === 0 && item.russianTitle && !foundWithoutRussianOverview) {
    console.log(`→ Пробуем русское название "${item.russianTitle}"`);
    for (const type of typesToSearch) {
      process.stdout.write(`  → Как ${type}... `);
      const result = await searchTmdb(item.russianTitle, item.year, type);
      
      if (result) {
        // Проверяем соответствие года только для фильмов
        if (type === 'movie') {
          const tmdbYear = getTmdbYear(result.result, type);
          
          // Если год в TMDB доступен и разница больше 1 года
          if (tmdbYear && item.year && Math.abs(tmdbYear - item.year) > 1) {
            console.log(`Найдено, но год не совпадает: TMDB ${tmdbYear} vs наш ${item.year} - пропускаем`);
            continue;
          }
        }
        
        if (result.result.overview && hasRussianLetters(result.result.overview)) {
          console.log(`Найдено! (${result.result.title || result.result.name})`);
          tmdbResults.push(result);
          break;
        } else {
          console.log('Найдено, но нет русского описания - пропускаем');
          foundWithoutRussianOverview = true;
        }
      } else {
        console.log('Не найдено');
      }
    }
  }
  
  // Задержка ТОЛЬКО если были реальные запросы к TMDB
  if (tmdbResults.length > 0 || foundWithoutRussianOverview) {
    await sleep(REQUEST_DELAY);
  }
  
  if (tmdbResults.length === 0) {
    console.log('✗ Ни один вариант не найден в TMDB с русским описанием');
    
    // Увеличиваем счетчик если были результаты без русского описания
    if (foundWithoutRussianOverview) {
      stats.tmdbNoRussianOverview++;
    }
    
    return null;
  }
  
  const tmdbData = tmdbResults[0];
  
  saveToCache(
    item.originalTitle,
    item.russianTitle,
    item.year,
    item.tmdbType,
    tmdbData
  );

  return {
    ...item,
    tmdb: tmdbData
  };
}

// Новая функция группировки
function groupByCategory(normalizedData) {
  const categoryTitles = {
    'movies_4k': 'Фильмы 4K',
    'movies_fhd': 'Фильмы FHD',
    'tv_4k': 'Сериалы 4K',
    'tv_fhd': 'Сериалы FHD',
    'mult_4k': 'Мультфильмы 4K',
    'mult_fhd': 'Мультфильмы FHD',
    'anime_4k': 'Аниме 4K',
    'anime_fhd': 'Аниме FHD'
  };

  // Получаем порядок категорий из ключей объекта
  const categoryOrder = Object.keys(categoryTitles);
  
  // Инициализируем категории в нужном порядке
  const categoriesMap = {};
  categoryOrder.forEach(catId => {
    categoriesMap[catId] = {
      id: catId,
      title: categoryTitles[catId],
      items: []
    };
  });

  // Заполняем категории элементами
  normalizedData.results.forEach(item => {
    item.categories?.forEach(catId => {
      if (categoriesMap[catId]) {
        categoriesMap[catId].items.push(item);
      }
    });
  });

  // Преобразуем в массив в исходном порядке
  const orderedCategories = categoryOrder.map(catId => categoriesMap[catId]);

  return {
    categories: orderedCategories
  };
}

function normalizeCustomJson(items) {
  const groups = {};
  const itemsWithoutId = [];
  let totalItems = items.length;
  let itemsWithTmdb = 0;
  
  // Получаем текущий и предыдущий год
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  items.forEach(item => {
    if (!item.releaseDateISO) {
      return;
    }

    if (item.tmdb && item.tmdb.result) {
      itemsWithTmdb++;
      const base = Object.assign({}, item.tmdb.result);
      base.release_quality = item.quality || '';
      base.media_type = item.tmdb?.type || (item.year ? 'movie' : 'tv');
      base._releaseDateISO = item.releaseDateISO;
      base._sourceYear = item.year;
      base.categories = item.categories || [];

      if (base.id && base.media_type) {
        const key = `${base.media_type}_${base.id}`;
        
        // Собираем все категории для этого элемента
        if (!groups[key]) {
          groups[key] = {
            items: [],
            allCategories: new Set()
          };
        }
        
        groups[key].items.push(base);
        item.categories?.forEach(cat => groups[key].allCategories.add(cat));
      } else {
        itemsWithoutId.push({
          title: item.originalTitle || item.russianTitle,
          reason: !base.id ? 'Отсутствует TMDB ID' : 'Отсутствует media_type'
        });
      }
    }
  });

  const groupedItems = [];
  let duplicatesRemoved = 0;
  let tmdbYearFiltered = 0;
  
  for (const key in groups) {
    const group = groups[key];
    let bestItem = group.items[0];
    
    if (group.items.length > 1) {
      duplicatesRemoved += group.items.length - 1;
      for (let i = 1; i < group.items.length; i++) {
        const currentDate = new Date(group.items[i]._releaseDateISO);
        const bestDate = new Date(bestItem._releaseDateISO);
        if (currentDate > bestDate) {
          bestItem = group.items[i];
        }
      }
    }
    
    // Присваиваем объединенные категории
    bestItem.categories = Array.from(group.allCategories);
    
    // === ИЗМЕНЕНИЕ: РАЗДЕЛЬНАЯ ОБРАБОТКА ДЛЯ СЕРИАЛОВ ===
    if (bestItem.media_type === 'tv') {
      // Для сериалов пропускаем фильтрацию по году
      groupedItems.push(bestItem);
    } else {
      // Для фильмов и другого контента применяем фильтр года
      let itemYear;
      if (bestItem.media_type === 'movie' && bestItem.release_date) {
        itemYear = new Date(bestItem.release_date).getFullYear();
      } else {
        itemYear = bestItem._sourceYear;
      }
      
      // Фильтрация по году
      if (itemYear >= previousYear && itemYear <= currentYear) {
        groupedItems.push(bestItem);
      } else {
        tmdbYearFiltered++;
      }
    }
  }

  // Сортировка и очистка
  groupedItems.sort((a, b) => 
    new Date(b._releaseDateISO) - new Date(a._releaseDateISO)
  );
  
  groupedItems.forEach(item => {
    delete item._releaseDateISO;
    delete item._sourceYear;
  });

  return {
    results: groupedItems,
    page: 1,
    total_pages: 1,
    total_results: groupedItems.length,
    _stats: {
      tmdbYearFiltered,
      duplicatesRemoved
    }
  };
}

// ИЗМЕНЕННАЯ ГЛАВНАЯ ФУНКЦИЯ - ДОБАВЛЕН ВЫВОД СТАТИСТИКИ ПО РУССКОМУ ОПИСАНИЮ
async function parseAll() {
  // Статистика по источникам
  const sourceStats = {
    rutor: 0,
    kinozal: 0
  };

  // 1. Парсинг Rutor 
  console.log('\n=== Начинаем парсинг Rutor ===');
  const rutorItems = [];
  for (const [category, config] of Object.entries(RUTOR_URLS)) {
    let categoryTotal = 0;
    for (let page = 0; page < config.pages; page++) {
      const url = config.urlTemplate.replace('%d', page);
      const pageItems = await parseRutorPage(
        url, 
        config.tmdbType, 
        config.category // Передаем категорию из конфига
      );
      rutorItems.push(...pageItems);
      categoryTotal += pageItems.length;
      console.log(`[Rutor] ${category}: страница ${page+1}/${config.pages} - найдено ${pageItems.length} раздач`);
    }
    console.log(`[Rutor] ${category}: ИТОГО ${categoryTotal} раздач\n`);
    sourceStats.rutor += categoryTotal;
  }
  fs.writeFileSync('wip/rutor_parsed.json', JSON.stringify(rutorItems, null, 2));
  console.log(`[Rutor] ВСЕГО: ${sourceStats.rutor} раздач\n`);
  
  // 2. Парсинг Kinozal
  console.log('\n=== Начинаем парсинг Kinozal ===');
  const kinozalItems = await parseKinozalSources();
  sourceStats.kinozal = kinozalItems.length;
  if (kinozalItems.length > 0) {
    fs.writeFileSync('wip/kinozal_parsed.json', JSON.stringify(kinozalItems, null, 2));
  }
  console.log(`[Kinozal] ВСЕГО: ${sourceStats.kinozal} раздач\n`);
  
  // 4. Объединение результатов
  const allItems = [...rutorItems, ...kinozalItems];
  const totalBeforeFilter = allItems.length;
  fs.writeFileSync('wip/combined_parsed.json', JSON.stringify(allItems, null, 2));
  
  // 5. Фильтрация по качеству и году
  console.log('\n=== Фильтрация результатов ===');
  console.log(`- До фильтрации: ${totalBeforeFilter} элементов`);
  const filteredItems = filterAndProcessItems(allItems);
  console.log(`- После фильтрации: ${filteredItems.length} элементов`);
  console.log(`  Отфильтровано по качеству: ${stats.filteredByQuality}`);
  console.log(`  Отфильтровано по году: ${stats.filteredByYear}`);
  console.log(`  Отфильтровано по старости: ${stats.filteredByAge}`); // Новый пункт статистики
  fs.writeFileSync('wip/filtered.json', JSON.stringify(filteredItems, null, 2));
  
  // 6. Дедубликация
  console.log('\n=== Дедубликация результатов ===');
  console.log(`- До дедубликации: ${filteredItems.length} элементов`);
  const deduplicatedItems = deduplicateItems(filteredItems);
  const duplicatesRemoved = filteredItems.length - deduplicatedItems.length;
  console.log(`- После дедубликации: ${deduplicatedItems.length} элементов`);
  console.log(`- Удалено дубликатов: ${duplicatesRemoved}`);
  fs.writeFileSync('wip/deduplicated.json', JSON.stringify(deduplicatedItems, null, 2));

  // 7. Поиск в TMDB
  console.log('\n=== Поиск в TMDB ===');
  console.log(`Всего элементов для поиска: ${deduplicatedItems.length}\n`);
  
  const tmdbResults = [];
  let tmdbNotFound = 0;
  
  for (let i = 0; i < deduplicatedItems.length; i++) {
    const item = deduplicatedItems[i];
    const tmdbData = await findInTmdb(item, 'main', i + 1, deduplicatedItems.length);
    
    if (tmdbData) {
      tmdbResults.push(tmdbData);
    } else {
      tmdbNotFound++;
    }
  }
  
  fs.writeFileSync('wip/tmdb_results.json', JSON.stringify(tmdbResults, null, 2));
  
  // 8. Нормализация данных
  console.log('\n=== Нормализация данных ===');
  const normalized = normalizeCustomJson(tmdbResults);
  const byCategory = groupByCategory(normalized);
  
  // Добавляем статистику фильтрации по году из TMDB
  stats.tmdbYearFiltered = normalized._stats.tmdbYearFiltered;
  
  // fs.writeFileSync('recentTitles.json', JSON.stringify(normalized, null, 2));
  fs.writeFileSync('recentTitlesByCategory.json', JSON.stringify(byCategory, null, 2));
  
  // 9. Сохранение кеша и статистики
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  
  // 10. Итоговая статистика
  console.log('\n=== ИТОГОВАЯ СТАТИСТИКА ===');
  console.log('Источники:');
  console.log(`- Rutor: ${sourceStats.rutor} раздач`);
  console.log(`- Kinozal: ${sourceStats.kinozal} раздач`);
  console.log(`- ВСЕГО собрано: ${totalBeforeFilter} раздач\n`);
  
  console.log('Фильтрация:');
  console.log(`- Отфильтровано по качеству: ${stats.filteredByQuality}`);
  console.log(`- Отфильтровано по году: ${stats.filteredByYear}`);
  console.log(`- Отфильтровано по старости: ${stats.filteredByAge}`);
  console.log(`- Осталось после фильтрации: ${filteredItems.length}\n`);
  
  console.log('Дедубликация:');
  console.log(`- Удалено дубликатов: ${duplicatesRemoved}`);
  console.log(`- Осталось уникальных: ${deduplicatedItems.length}\n`);
  
  console.log('Поиск в TMDB:');
  console.log(`- Найдено в TMDB: ${tmdbResults.length}`);
  console.log(`- Не найдено в TMDB: ${tmdbNotFound}`);
  console.log(`  Из них:`);
  console.log(`     - Не найдено ни одного результата: ${tmdbNotFound - stats.tmdbNoRussianOverview}`);
  console.log(`     - Найдено, но без русского описания: ${stats.tmdbNoRussianOverview}\n`);
  
  console.log('Финальная обработка:');
  console.log(`- Отфильтровано по году TMDB: ${stats.tmdbYearFiltered}`);
  console.log(`- Удалено дубликатов TMDB: ${normalized._stats.duplicatesRemoved}`);
  console.log(`- ИТОГО сохранено: ${normalized.total_results} элементов`);
  
  console.log('\nОперация завершена! Результаты сохранены в recentTitles.json');
}

// Запуск
parseAll();