!function() {
    "use strict";
    
    var PLUGIN_NAME = "maxsm_inquality";
    var JSON_URL = "https://lampa.ruzha.ru/inq_parser.json";
    var ICON_SVG = '<svg height="30" viewBox="0 0 38 30" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="35" height="27" rx="1.5" stroke="currentColor" stroke-width="3"></rect><path d="M18.105 22H15.2936V16H9.8114V22H7V8H9.8114V13.6731H15.2936V8H18.105V22Z" fill="currentColor"></path><path d="M20.5697 22V8H24.7681C25.9676 8 27.039 8.27885 27.9824 8.83654C28.9321 9.38782 29.6724 10.1763 30.2034 11.2019C30.7345 12.2212 31 13.3814 31 14.6827V15.3269C31 16.6282 30.7376 17.7853 30.2128 18.7981C29.6943 19.8109 28.9602 20.5962 28.0105 21.1538C27.0609 21.7115 25.9895 21.9936 24.7962 22H20.5697ZM23.3811 10.3365V19.6827H24.7399C25.8395 19.6827 26.6798 19.3141 27.2608 18.5769C27.8419 17.8397 28.1386 16.7853 28.1511 15.4135V14.6731C28.1511 13.25 27.8637 12.1731 27.289 11.4423C26.7142 10.7051 25.8739 10.3365 24.7681 10.3365H23.3811Z" fill="currentColor"></path></svg>';
    
    Lampa.Lang.add({
        maxsm_inquality_title: {
            ru: "В качестве",
            en: "In Quality",
            uk: "У якості",
            be: "У якасці",
            pt: "Com Qualidade",
            zh: "高质量",
            he: "באיכות",
            cs: "V kvalitě",
            bg: "В качество"
        }
    });
    
    function InQualityService() {
        var self = this;
        var network = new Lampa.Reguest();
        
        self.list = function(params, onComplete, onError) {
            var page = parseInt(params.page) || 1;
            
            network.silent(JSON_URL, function(json) {
                if (json && json.results && Array.isArray(json.results)) {
                    var items = normalizeData(json.results);
                    var PAGE_SIZE = 20;
                    var startIndex = (page - 1) * PAGE_SIZE;
                    var endIndex = startIndex + PAGE_SIZE;
                    var pageItems = items.slice(startIndex, endIndex);
                    
                    onComplete({
                        results: pageItems,
                        page: page,
                        total_pages: Math.ceil(items.length / PAGE_SIZE),
                        total_results: items.length
                    });
                } else {
                    onError(new Error("Invalid data format"));
                }
            }, onError);
        };
        
        function normalizeData(items) {
            return items.map(function(item) {
                return {
                    id: item.id,
                    poster_path: item.poster_path || '',
                    vote_average: item.vote_average || 0,
                    title: item.title || '',
                    release_date: item.release_date || '',
                    quality: item.release_quality || '',
                    source: 'tmdb',
                    type: 'movie'
                };
            });
        }
        
        self.full = function(params, onSuccess, onError) {
            if (params.card) {
                Lampa.Api.sources.tmdb.full({
                    id: params.card.id,
                    method: params.card.type,
                    card: params.card
                }, onSuccess, onError);
            } else {
                onError(new Error("Card data missing"));
            }
        };
        
        self.clear = function() {
            network.clear();
        };
    }

    function startPlugin() {
        var inQualityService = new InQualityService();
        Lampa.Api.sources[PLUGIN_NAME] = inQualityService;
        
        var menuItem = $(
            '<li class="menu__item selector" data-action="' + PLUGIN_NAME + '">' +
                '<div class="menu__ico">' + ICON_SVG + '</div>' +
                '<div class="menu__text">' + Lampa.Lang.translate('maxsm_inquality_title') + '</div>' +
            '</li>'
        );
        
        menuItem.on("hover:enter", function() {
            Lampa.Activity.push({
                url: PLUGIN_NAME,
                title: Lampa.Lang.translate('maxsm_inquality_title'),
                component: "category_full",
                source: PLUGIN_NAME,
                page: 1
            });
        });
        
        $(".menu .menu__list").eq(0).append(menuItem);
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') startPlugin();
        });
    }
}();