/* jshint esversion: 6 */
(function () {
    'use strict';

    if (window.plugin_tmdb_mod_ready) return;
    window.plugin_tmdb_mod_ready = true;

    var extend = function (target, source) {
        if (Lampa.Arrays && Lampa.Arrays.extend) {
            return Lampa.Arrays.extend(target, source);
        }
        return Object.assign(target, source);
    };

    var Episode = function (data) {
        var card = data.card || data;
        var episode = data.next_episode_to_air || data.episode || {};
        if (!card.source) card.source = 'tmdb';
        extend(card, {
            title: card.name,
            original_title: card.original_name,
            release_date: card.first_air_date
        });
        card.release_year = ((card.release_date || '0000') + '').slice(0, 4);
        var html, imgPoster, imgEpisode, loaded = false;

        this.build = function () {
            if (!Lampa.Template || typeof Lampa.Template.js !== 'function') return this.createFallback();
            html = Lampa.Template.js('card_episode');
            if (!html) return this.createFallback();
            this.setupElements();
            this.attachEvents();
            return html;
        };

        this.createFallback = function () {
            html = document.createElement('div');
            html.className = 'card card__episode';
            html.innerHTML = '<div class="card__title"></div><div class="card__img"><img src="./img/img_broken.svg"></div>';
            this.setupElements();
            return html;
        };

        this.setupElements = function () {
            if (!html) return;
            imgPoster = html.querySelector('.card__img img') || html.querySelector('.card__img');
            imgEpisode = html.querySelector('.full-episode__img img');
            var titleElem = html.querySelector('.card__title');
            var numElem = html.querySelector('.full-episode__num');
            var nameElem = html.querySelector('.full-episode__name');
            var dateElem = html.querySelector('.full-episode__date');
            var ageElem = html.querySelector('.card__age');
            if (titleElem) titleElem.textContent = card.title || card.name || '';
            if (numElem) numElem.textContent = card.unwatched || '';
            if (episode && episode.air_date) {
                if (nameElem) nameElem.textContent = 's' + (episode.season_number || '?') + 'e' + (episode.episode_number || '?') + '. ' + (episode.name || 'Unknown');
                if (dateElem && Lampa.Utils && Lampa.Utils.parseTime) {
                    var parsed = Lampa.Utils.parseTime(episode.air_date);
                    dateElem.textContent = parsed && parsed.full ? parsed.full : episode.air_date;
                }
            }
            if (card.release_year === '0000' || !card.release_year) {
                if (ageElem) ageElem.remove();
            } else {
                if (ageElem) ageElem.textContent = card.release_year;
            }
        };

        this.attachEvents = function () {
            if (!html) return;
            html.addEventListener('mouseenter', this.onFocus.bind(this));
            html.addEventListener('mouseleave', this.onHover.bind(this));
            html.addEventListener('click', this.onEnter.bind(this));
        };

        this.load = function () {
            if (loaded || !html) return;
            loaded = true;
            if (imgPoster) {
                var src = '';
                if (card.poster_path && Lampa.Api && Lampa.Api.img) src = Lampa.Api.img(card.poster_path);
                else if (card.profile_path && Lampa.Api && Lampa.Api.img) src = Lampa.Api.img(card.profile_path);
                else if (card.poster) src = card.poster;
                else if (card.img) src = card.img;
                else src = './img/img_broken.svg';
                if (imgPoster.tagName === 'IMG') {
                    imgPoster.src = src;
                    imgPoster.onerror = function () { imgPoster.src = './img/img_broken.svg'; };
                } else {
                    imgPoster.style.backgroundImage = 'url(' + src + ')';
                }
            }
            if (imgEpisode) {
                var episodeSrc = '';
                if (episode.still_path && Lampa.Api && Lampa.Api.img) episodeSrc = Lampa.Api.img(episode.still_path, 'w300');
                else if (card.backdrop_path && Lampa.Api && Lampa.Api.img) episodeSrc = Lampa.Api.img(card.backdrop_path, 'w300');
                else if (episode.img) episodeSrc = episode.img;
                else if (card.img) episodeSrc = card.img;
                else episodeSrc = './img/img_broken.svg';
                imgEpisode.src = episodeSrc;
                imgEpisode.onerror = function () { imgEpisode.src = './img/img_broken.svg'; };
            }
        };

        this.onFocus = function () { this.load(); };
        this.onHover = function () {};
        this.onEnter = function () { if (this.onSelect) this.onSelect(card); };
        this.render = function () { return html; };
        this.destroy = function () {
            if (html) {
                html.removeEventListener('mouseenter', this.onFocus);
                html.removeEventListener('mouseleave', this.onHover);
                html.removeEventListener('click', this.onEnter);
                html.remove();
            }
            html = null; imgPoster = null; imgEpisode = null; loaded = false;
        };
    };

    var createDiscoveryMain = function (parent) {
        return function () {
            var owner = this;
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
            var oncomplete = arguments.length > 1 ? arguments[1] : undefined;
            var onerror = arguments.length > 2 ? arguments[2] : undefined;

            var hasSequentials = Lampa.Api && Lampa.Api.sequentials && typeof Lampa.Api.sequentials === 'function';
            var hasPartNext = Lampa.Api && Lampa.Api.partNext && typeof Lampa.Api.partNext === 'function';

            if (!hasSequentials && !hasPartNext) { if (onerror) onerror(); return; }

            var today = new Date().toISOString().substr(0, 10);

            var parts_data = [
                function (call) { parent.get('discover/movie?sort_by=revenue.desc&vote_count.gte=100&primary_release_year=2025', params, function (json) { json.title = '★★★ 2025 Хиты'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=vote_average.desc&vote_count.gte=500&primary_release_year=2025', params, function (json) { json.title = '★★ 2025 Топ'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=popularity.desc&vote_count.gte=100&primary_release_year=2025', params, function (json) { json.title = '★ 2025 Новое'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=revenue.desc&vote_count.gte=100&primary_release_year=2024', params, function (json) { json.title = '★★★ 2024 Хиты'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=vote_average.desc&vote_count.gte=100&primary_release_year=2024', params, function (json) { json.title = '★★ 2024 Топ'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=revenue.desc&vote_count.gte=100&primary_release_year=2023', params, function (json) { json.title = '★★★ 2023 Хиты'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=vote_average.desc&vote_count.gte=100&primary_release_year=2023', params, function (json) { json.title = '★★ 2023 Топ'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=primary_release_date.desc&vote_count.gte=100&vote_average.gte=6&region=RU&primary_release_date.lte=' + today, params, function (json) { json.title = 'Горячие новинки'; call(json); }, call); },
                function (call) { parent.get('trending/movie/week', params, function (json) { json.title = 'Тренды Фильмы'; call(json); }, call); },
                function (call) { parent.get('trending/tv/week', params, function (json) { json.title = 'Тренды Сериалы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Популярные'; call(json); }, call); },
                function (call) { var upcoming = []; if (Lampa.TimeTable && typeof Lampa.TimeTable.lately === 'function') { try { upcoming = Lampa.TimeTable.lately().slice(0, 20); } catch (e) {} } call({ source: 'tmdb', results: upcoming, title: 'Предстоящие', nomore: true, cardClass: Episode }); },
                function (call) { parent.get('discover/movie?with_original_language=ru&sort_by=primary_release_date.desc&vote_count.gte=5&region=RU', params, function (json) { json.title = 'Русские фильмы'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_original_language=ru&sort_by=popularity.desc', params, function (json) { json.title = 'Русские сериалы'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=3871&sort_by=first_air_date.desc', params, function (json) { json.title = 'ОККО'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=2493&sort_by=first_air_date.desc', params, function (json) { json.title = 'START'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=2859&sort_by=first_air_date.desc', params, function (json) { json.title = 'Premier'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=5806&sort_by=first_air_date.desc', params, function (json) { json.title = 'WINK'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=4085&sort_by=first_air_date.desc', params, function (json) { json.title = 'KION'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=3827&sort_by=first_air_date.desc', params, function (json) { json.title = 'Кинопоиск'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=806&sort_by=first_air_date.desc', params, function (json) { json.title = 'СТС'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=1191&sort_by=first_air_date.desc', params, function (json) { json.title = 'ТНТ'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=3923&sort_by=first_air_date.desc', params, function (json) { json.title = 'ИВИ'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=1024|1025|1026&sort_by=first_air_date.desc', params, function (json) { json.title = 'ТВ России'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=1399&sort_by=first_air_date.desc', params, function (json) { json.title = 'Netflix'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=49&sort_by=first_air_date.desc', params, function (json) { json.title = 'HBO'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=2552&sort_by=first_air_date.desc', params, function (json) { json.title = 'Apple TV+'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=3268&sort_by=first_air_date.desc', params, function (json) { json.title = 'Amazon Prime'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=4353&sort_by=first_air_date.desc', params, function (json) { json.title = 'Disney+'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=1436&sort_by=first_air_date.desc', params, function (json) { json.title = 'Hulu'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=2739&sort_by=first_air_date.desc', params, function (json) { json.title = 'Peacock'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=77&sort_by=first_air_date.desc', params, function (json) { json.title = 'SyFy'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=318&sort_by=first_air_date.desc', params, function (json) { json.title = 'Starz'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=174&sort_by=first_air_date.desc', params, function (json) { json.title = 'AMC'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=en&sort_by=revenue.desc&vote_count.gte=100', params, function (json) { json.title = 'USA'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=ko&sort_by=rating.desc&vote_count.gte=50', params, function (json) { json.title = 'Корея'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=ja&sort_by=rating.desc&vote_count.gte=50', params, function (json) { json.title = 'Япония'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=de&sort_by=popularity.desc&vote_count.gte=30', params, function (json) { json.title = 'Германия'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=fr&sort_by=popularity.desc&vote_count.gte=30', params, function (json) { json.title = 'Франция'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=it&sort_by=popularity.desc&vote_count.gte=30', params, function (json) { json.title = 'Италия'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=es&sort_by=popularity.desc&vote_count.gte=30', params, function (json) { json.title = 'Испания'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_origin_country=KR&sort_by=popularity.desc&vote_count.gte=50', params, function (json) { json.title = 'K-Drama'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=28&sort_by=revenue.desc&vote_count.gte=100', params, function (json) { json.title = 'Боевики'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=12&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Приключения'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=16&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Мультфильмы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=35&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Комедии'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=80&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Криминал'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=18&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Драмы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=10751&sort_by=popularity.desc&vote_count.gte=50', params, function (json) { json.title = 'Семейные'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=14&sort_by=revenue.desc&vote_count.gte=100', params, function (json) { json.title = 'Фантастика'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=27&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Ужасы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=10749&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Романтика'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=9648&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Детективы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=878&sort_by=revenue.desc&vote_count.gte=100', params, function (json) { json.title = 'Sci-Fi'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=37&sort_by=popularity.desc&vote_count.gte=50', params, function (json) { json.title = 'Вестерны'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=53&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Триллеры'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10759&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Боевые'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=16&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Анимация'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=35&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Комедийные'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=18&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Драматические'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10765&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Мистика'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10764&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Реалити'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10766&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Мыльные'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10767&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Ток-шоу'; call(json); }, call); }
            ];

            var methodToUse = Lampa.Api.sequentials ? Lampa.Api.sequentials : Lampa.Api.partNext;
            methodToUse(parts_data, 72, oncomplete, onerror);
            return function () {};
        };
    };

    var createMovieMain = function (parent) {
        return function () {
            var owner = this;
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
            var oncomplete = arguments.length > 1 ? arguments[1] : undefined;
            var onerror = arguments.length > 2 ? arguments[2] : undefined;

            var hasSequentials = Lampa.Api && Lampa.Api.sequentials && typeof Lampa.Api.sequentials === 'function';
            var hasPartNext = Lampa.Api && Lampa.Api.partNext && typeof Lampa.Api.partNext === 'function';
            if (!hasSequentials && !hasPartNext) { if (onerror) onerror(); return; }

            var today = new Date().toISOString().substr(0, 10);

            var parts_data = [
                function (call) { parent.get('discover/movie?sort_by=revenue.desc&vote_count.gte=100&primary_release_year=2025', params, function (json) { json.title = '★★★ 2025 Хиты'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=vote_average.desc&vote_count.gte=500&primary_release_year=2025', params, function (json) { json.title = '★★ 2025 Топ'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=revenue.desc&vote_count.gte=100&primary_release_year=2024', params, function (json) { json.title = '★★★ 2024 Хиты'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=vote_average.desc&vote_count.gte=100&primary_release_year=2024', params, function (json) { json.title = '★★ 2024 Топ'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=revenue.desc&vote_count.gte=100&primary_release_year=2023', params, function (json) { json.title = '★★★ 2023 Хиты'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=vote_average.desc&vote_count.gte=100&primary_release_year=2023', params, function (json) { json.title = '★★ 2023 Топ'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=primary_release_date.desc&vote_count.gte=100&vote_average.gte=6&region=RU&primary_release_date.lte=' + today, params, function (json) { json.title = 'Горячие новинки'; call(json); }, call); },
                function (call) { parent.get('trending/movie/week', params, function (json) { json.title = 'Тренды'; call(json); }, call); },
                function (call) { parent.get('discover/movie?sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Популярные'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=ru&sort_by=primary_release_date.desc&vote_count.gte=5&region=RU', params, function (json) { json.title = 'Русские'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=en&sort_by=revenue.desc&vote_count.gte=100', params, function (json) { json.title = 'USA'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=ko&sort_by=rating.desc&vote_count.gte=50', params, function (json) { json.title = 'Корея'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=ja&sort_by=rating.desc&vote_count.gte=50', params, function (json) { json.title = 'Япония'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=de&sort_by=popularity.desc&vote_count.gte=30', params, function (json) { json.title = 'Германия'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=fr&sort_by=popularity.desc&vote_count.gte=30', params, function (json) { json.title = 'Франция'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=it&sort_by=popularity.desc&vote_count.gte=30', params, function (json) { json.title = 'Италия'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_original_language=es&sort_by=popularity.desc&vote_count.gte=30', params, function (json) { json.title = 'Испания'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=28&sort_by=revenue.desc&vote_count.gte=100', params, function (json) { json.title = 'Боевики'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=12&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Приключения'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=16&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Мультфильмы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=35&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Комедии'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=80&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Криминал'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=18&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Драмы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=10751&sort_by=popularity.desc&vote_count.gte=50', params, function (json) { json.title = 'Семейные'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=14&sort_by=revenue.desc&vote_count.gte=100', params, function (json) { json.title = 'Фантастика'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=27&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Ужасы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=10749&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Романтика'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=9648&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Детективы'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=878&sort_by=revenue.desc&vote_count.gte=100', params, function (json) { json.title = 'Sci-Fi'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=37&sort_by=popularity.desc&vote_count.gte=50', params, function (json) { json.title = 'Вестерны'; call(json); }, call); },
                function (call) { parent.get('discover/movie?with_genres=53&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Триллеры'; call(json); }, call); }
            ];

            var methodToUse = Lampa.Api.sequentials ? Lampa.Api.sequentials : Lampa.Api.partNext;
            methodToUse(parts_data, 31, oncomplete, onerror);
            return function () {};
        };
    };

    var createTVMain = function (parent) {
        return function () {
            var owner = this;
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
            var oncomplete = arguments.length > 1 ? arguments[1] : undefined;
            var onerror = arguments.length > 2 ? arguments[2] : undefined;

            var hasSequentials = Lampa.Api && Lampa.Api.sequentials && typeof Lampa.Api.sequentials === 'function';
            var hasPartNext = Lampa.Api && Lampa.Api.partNext && typeof Lampa.Api.partNext === 'function';
            if (!hasSequentials && !hasPartNext) { if (onerror) onerror(); return; }

            var parts_data = [
                function (call) { var upcoming = []; if (Lampa.TimeTable && typeof Lampa.TimeTable.lately === 'function') { try { upcoming = Lampa.TimeTable.lately().slice(0, 20); } catch (e) {} } call({ source: 'tmdb', results: upcoming, title: 'Предстоящие', nomore: true, cardClass: Episode }); },
                function (call) { parent.get('trending/tv/week', params, function (json) { json.title = 'Тренды'; call(json); }, call); },
                function (call) { parent.get('discover/tv?sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Популярные'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_original_language=ru&sort_by=popularity.desc', params, function (json) { json.title = 'Русские'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=3871&sort_by=first_air_date.desc', params, function (json) { json.title = 'ОККО'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=2493&sort_by=first_air_date.desc', params, function (json) { json.title = 'START'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=2859&sort_by=first_air_date.desc', params, function (json) { json.title = 'Premier'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=5806&sort_by=first_air_date.desc', params, function (json) { json.title = 'WINK'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=4085&sort_by=first_air_date.desc', params, function (json) { json.title = 'KION'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=3827&sort_by=first_air_date.desc', params, function (json) { json.title = 'Кинопоиск'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=806&sort_by=first_air_date.desc', params, function (json) { json.title = 'СТС'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=1191&sort_by=first_air_date.desc', params, function (json) { json.title = 'ТНТ'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=3923&sort_by=first_air_date.desc', params, function (json) { json.title = 'ИВИ'; call(json); }, call); },
                function (call) { parent.get('discover/tv?language=ru&with_networks=1024|1025|1026&sort_by=first_air_date.desc', params, function (json) { json.title = 'ТВ России'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=1399&sort_by=first_air_date.desc', params, function (json) { json.title = 'Netflix'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=49&sort_by=first_air_date.desc', params, function (json) { json.title = 'HBO'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=2552&sort_by=first_air_date.desc', params, function (json) { json.title = 'Apple TV+'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=3268&sort_by=first_air_date.desc', params, function (json) { json.title = 'Amazon Prime'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_networks=4353&sort_by=first_air_date.desc', params, function (json) { json.title = 'Disney+'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_origin_country=KR&sort_by=popularity.desc&vote_count.gte=50', params, function (json) { json.title = 'K-Drama'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10759&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Боевые'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=16&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Анимация'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=35&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Комедийные'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=18&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Драматические'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10765&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Мистика'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10764&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Реалити'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10766&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Мыльные'; call(json); }, call); },
                function (call) { parent.get('discover/tv?with_genres=10767&sort_by=popularity.desc&vote_count.gte=100', params, function (json) { json.title = 'Ток-шоу'; call(json); }, call); }
            ];

            var methodToUse = Lampa.Api.sequentials ? Lampa.Api.sequentials : Lampa.Api.partNext;
            methodToUse(parts_data, 28, oncomplete, onerror);
            return function () {};
        };
    };

    function initPlugin() {
        try {
            if (!Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return false;

            var originalTMDB = Lampa.Api.sources.tmdb;
            var originalGet = originalTMDB.get;

            var modObj = { get: originalGet.bind(originalTMDB) };

            originalTMDB.main = function () {
                var args = Array.from(arguments);
                if (this.type === 'tv') return createTVMain(modObj).apply(this, args);
                if (this.type === 'movie') return createMovieMain(modObj).apply(this, args);
                return createDiscoveryMain(modObj).apply(this, args);
            };

            if (Lampa.Manifest && Lampa.Manifest.catalog) {
                if (!Lampa.Manifest.catalog.tmdb_mod) {
                    Lampa.Manifest.catalog.tmdb_mod = {
                        name: 'tmdb_mod',
                        title: 'TMDB MOD (72+ Sections)',
                        icon: 'tmdb',
                        order: 1,
                        source: 'tmdb'
                    };
                }
            }

            if (Lampa.Params && Lampa.Params.select) {
                try {
                    var sources = Lampa.Params.values && Lampa.Params.values.source ? Lampa.Params.values.source : {};
                    if (!sources.tmdb_mod) {
                        sources.tmdb_mod = 'TMDB MOD (72+ Sections)';
                        Lampa.Params.select('source', sources, 'tmdb_mod');
                    }
                } catch (e) {}
            }

            return true;
        } catch (e) { return false; }
    }

    function waitForApp() {
        if (window.appready) {
            initPlugin();
        } else if (Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') initPlugin();
            });
        } else {
            setTimeout(waitForApp, 1000);
        }
    }

    waitForApp();

})();
