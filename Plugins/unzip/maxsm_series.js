!function() {
    "use strict";
    
    var PLUGIN_NAME = "maxsm_series";
    var JSON_URL = "https://lampa.ruzha.ru/inq_parser_series.json";
    var ICON_SVG = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><path fill="currentColor" d="M503.17,240.148L289.423,107.799c-5.735-3.548-12.98-3.722-18.883-0.435c-5.909,3.293-9.569,9.525-9.569,16.286v264.699c0,6.76,3.66,12.993,9.569,16.286c2.827,1.572,5.953,2.355,9.072,2.355c3.411,0,6.816-0.932,9.811-2.79L503.17,271.85c5.493-3.399,8.83-9.395,8.83-15.851C512,249.543,508.663,243.547,503.17,240.148z M298.252,354.888V157.122l159.695,98.877L298.252,354.888z"></path><path fill="currentColor" d="M242.2,240.148L28.452,107.799c-5.754-3.554-12.98-3.722-18.883-0.435C3.66,110.657,0,116.889,0,123.649v264.699c0,6.76,3.66,12.993,9.569,16.286c2.827,1.572,5.953,2.355,9.072,2.355c3.405,0,6.81-0.932,9.811-2.79L242.2,271.85c5.487-3.399,8.83-9.395,8.83-15.851C251.029,249.543,247.686,243.547,242.2,240.148z M37.282,354.888V157.122l159.696,98.877L37.282,354.888z"></path></svg>';
    
    var DEBUG = true;
    
    function log() {
        if (DEBUG && window.console) {
            var args = ['[MAXSM-SERIES]'].concat(Array.prototype.slice.call(arguments));
            console.log.apply(console, args);
        }
    }
    
    Lampa.Lang.add({
        maxsm_series_title: {
            ru: "Новые серии",
            en: "New Episodes",
            uk: "Нові серії",
            be: "Новыя серыі",
            pt: "Novos Episódios",
            zh: "最新剧集",
            he: "פרקים חדשים",
            cs: "Nové epizody",
            bg: "Нови епизоди"
        }
    });
    
    var style = document.createElement('style');
    style.innerHTML = 
        '.card__series {' +
            'position: absolute;' +
            'bottom: 0.5em;' +
            'left: 0.5em;' +
            'font-size: 1em;' +
            'font-weight: 700;' +
            'color: #fff;' +
            'background: rgba(0, 0, 0, 0.75);' +
            'border-radius: 0.5em;' +
            'padding: 0.4em;' +
        '}' +
        '.card__series:empty { display: none; }';
    document.head.appendChild(style);
    log('Styles added');
    
    function addSeriesIndicator(card) {
        log('Processing card:', card);
        
        if (card.getAttribute('data-series-added')) {
            log('Card already processed, skipping');
            return;
        }
        
        if (!card.card_data) {
            log('No card_data found on card element');
            return;
        }
        
        var data = card.card_data;
        log('Card data:', data);
        
        if (!data.series) {
            log('No series data in card_data');
            return;
        }
        
        log('Found series data:', data.series);
        
        var viewContainer = card.querySelector('.card__view');
        if (!viewContainer) {
            log('View container (.card__view) not found');
            return;
        }
        
        log('View container found:', viewContainer);
        
        var seriesEl = document.createElement('div');
        seriesEl.className = 'card__series';
        seriesEl.textContent = data.series;
        
        viewContainer.appendChild(seriesEl);
        card.setAttribute('data-series-added', 'true');
        log('Series indicator added successfully');
    }
    
    var observer = new MutationObserver(function(mutations) {
        log('DOM mutation detected');
        var newCards = [];
        
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            if (!mutation.addedNodes) continue;
            
            log('Mutation with added nodes:', mutation.addedNodes.length);
            
            for (var j = 0; j < mutation.addedNodes.length; j++) {
                var node = mutation.addedNodes[j];
                if (node.nodeType !== 1) continue;
                
                log('Added node:', node);
                
                if (node.classList && node.classList.contains('card')) {
                    log('Found card element:', node);
                    newCards.push(node);
                }
                
                var nestedCards = node.querySelectorAll('.card');
                log('Found nested cards:', nestedCards.length);
                
                for (var k = 0; k < nestedCards.length; k++) {
                    newCards.push(nestedCards[k]);
                }
            }
        }
        
        if (newCards.length) {
            log('New cards to process:', newCards.length);
            for (var idx = 0; idx < newCards.length; idx++) {
                addSeriesIndicator(newCards[idx]);
            }
        }
    });
    
    function processExistingCards() {
        log('Processing existing cards');
        var cards = document.querySelectorAll('.card:not([data-series-added])');
        log('Found cards:', cards.length);
        
        for (var i = 0; i < cards.length; i++) {
            addSeriesIndicator(cards[i]);
        }
    }
    
    function SeriesService() {
        var self = this;
        var network = new Lampa.Reguest();
        
        self.list = function(params, onComplete, onError) {
            var page = parseInt(params.page) || 1;
            log('Fetching series list, page:', page);
            
            network.silent(JSON_URL, function(json) {
                if (json && json.results && Array.isArray(json.results)) {
                    log('Received valid JSON data, items:', json.results.length);
                    var items = normalizeData(json.results);
                    var PAGE_SIZE = 20;
                    var startIndex = (page - 1) * PAGE_SIZE;
                    var endIndex = startIndex + PAGE_SIZE;
                    var pageItems = items.slice(startIndex, endIndex);
                    
                    log('Returning page items:', pageItems.length);
                    onComplete({
                        results: pageItems,
                        page: page,
                        total_pages: Math.ceil(items.length / PAGE_SIZE),
                        total_results: items.length
                    });
                } else {
                    log('Invalid data format received');
                    onError(new Error("Invalid data format"));
                }
            }, function(error) {
                log('Request error:', error);
                onError(error);
            });
        };
        
        function normalizeData(items) {
            var normalized = [];
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                

                var season = item.season != null ? item.season : '';
                var episode = item.episode != null ? item.episode : '';
                var totalEpisodes = item.totalEpisodes != null ? item.totalEpisodes : '';
        
                var series = '';
                if (season && episode && totalEpisodes) {
                    series = 'S' + season + 'E' + episode + '/' + totalEpisodes;
                } else if (season && episode) {
                    series = 'S' + season + 'E' + episode;
                } else if (episode && totalEpisodes) {
                    series = 'E' + episode + '/' + totalEpisodes;
                } else if (episode) {
                    series = 'E' + episode;
                }
                
                normalized.push({
                    id: item.id,
                    poster_path: item.poster_path || '',
                    vote_average: item.vote_average || 0,
                    name: item.name || '',
                    series: series,
                    original_name: item.original_name || item.name || '',
                    first_air_date: item.first_air_date || '',
                    quality: item.release_quality || '',
                    source: 'tmdb',
                    type: 'movie'
                });
            }
            log('Normalized', normalized.length, 'items');
            return normalized;
        }
        
        self.full = function(params, onSuccess, onError) {
            if (params.card) {
                log('Fetching full info for card:', params.card.id);
                Lampa.Api.sources.tmdb.full({
                    id: params.card.id,
                    method: params.card.type,
                    card: params.card
                }, onSuccess, onError);
            } else {
                log('Full info requested without card data');
                onError(new Error("Card data missing"));
            }
        };
        
        self.clear = function() {
            log('Clearing network requests');
            network.clear();
        };
    }

    function startPlugin() {
        log('Starting plugin');
        var seriesService = new SeriesService();
        Lampa.Api.sources[PLUGIN_NAME] = seriesService;
        
        var menuItem = $(
            '<li class="menu__item selector" data-action="' + PLUGIN_NAME + '">' +
                '<div class="menu__ico">' + ICON_SVG + '</div>' +
                '<div class="menu__text">' + Lampa.Lang.translate('maxsm_series_title') + '</div>' +
            '</li>'
        );
        
        menuItem.on("hover:enter", function() {
            log('Opening series view');
            Lampa.Activity.push({
                url: PLUGIN_NAME,
                title: Lampa.Lang.translate('maxsm_series_title'),
                component: "category_full",
                source: PLUGIN_NAME,
                page: 1
            });
        });
        
        $(".menu .menu__list").eq(0).append(menuItem);
        log('Menu item added');
        
        observer.observe(document.body, { 
            childList: true, 
            subtree: true
        });
        log('Mutation observer started');
        
        processExistingCards();
        
        setTimeout(function() {
            log('Delayed card processing');
            processExistingCards();
        }, 3000);
    }

    if (window.appready) {
        log('App already ready, starting immediately');
        startPlugin();
    } else {
        log('Waiting for app ready event');
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') {
                log('App ready event received');
                startPlugin();
            }
        });
    }
    
    log('Plugin script loaded');
}();