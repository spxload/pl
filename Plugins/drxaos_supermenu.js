(function () {
  "use strict";

  function init() {
    if (typeof Lampa === "undefined") return;

    // === БАЗОВАЯ КОНФИГУРАЦИЯ ПЛАГИНА ===
    var SuperMenuConfig = {
      DEBUG: false,
      VERBOSE_LOGGING: false,

      // Профиль производительности (базовый)
      PERFORMANCE: {
        DEBOUNCE_DELAY: 300,
        THROTTLE_LIMIT: 100,
        MUTATION_THROTTLE: 50
      },

      // Поведение в разных средах
      PLATFORM: {
        isAndroid: Lampa.Platform.is("android"),
        isWebOS: Lampa.Platform.is("webos"),
        isTizen: Lampa.Platform.is("tizen"),
        isBrowser: Lampa.Platform.is("browser"),
        isTV:
          Lampa.Platform.is("android") ||
          Lampa.Platform.is("tizen") ||
          Lampa.Platform.is("webos") ||
          Lampa.Platform.is("orsay") ||
          Lampa.Platform.is("netcast")
      },

      // Цветовые схемы для меток качества и типа
      LABEL_COLORS: {
        vivid: {
          TYPE: {
            movie: "#FFD54F",
            tv: "#4CAF50",
            anime: "#E91E63"
          },
          QUALITY: {
            "4K": "#FF5722",
            "2160p": "#FF5722",
            "1080p": "#03A9F4",
            "720p": "#B0BEC5",
            SD: "#90A4AE",
            CAM: "#FF7043",
            HDR: "#FFC107"
          }
        },
        soft: {
          TYPE: {
            movie: "#FFE082",
            tv: "#A5D6A7",
            anime: "#F48FB1"
          },
          QUALITY: {
            "4K": "#FFAB91",
            "2160p": "#FFAB91",
            "1080p": "#81D4FA",
            "720p": "#CFD8DC",
            SD: "#B0BEC5",
            CAM: "#FFAB91",
            HDR: "#FFD54F"
          }
        }
      },

      LABEL_SCHEME: "vivid",

      // Параметры рейтингов и API
      RATINGS: {
        tmdbApiKey: "",
        kpApiKey: "",
        kpApiUrl: "https://kinopoiskapiunofficial.tech/api/v2.2/films"
      },

      // Кэш рейтингов на время сессии
      RATING_CACHE: {
        tmdb: Object.create(null),
        imdb: Object.create(null),
        kp: Object.create(null)
      },

      VOICEOVER: {
        enabled: false,
        cache: Object.create(null)
      },

      // Включение/выключение подсистем
      FEATURES: {
        madness: true,
        madness_level: "normal", // off | normal | full

        ratings_tmdb: true,
        ratings_imdb: true,
        ratings_kp: true,
        ratings_other: false,

        label_colors: true,
        voiceover_tracking: false,
        topbar_exit_menu: true,

        borderless_dark_theme: false
      }
    };

    // Профиль производительности для Android TV
    if (SuperMenuConfig.PLATFORM.isAndroid) {
      SuperMenuConfig.PERFORMANCE.DEBOUNCE_DELAY = 500;
      SuperMenuConfig.PERFORMANCE.THROTTLE_LIMIT = 150;
      SuperMenuConfig.PERFORMANCE.MUTATION_THROTTLE = 80;
    }

    // === УТИЛИТЫ ===
    function log() {
      if (!SuperMenuConfig.DEBUG && !SuperMenuConfig.VERBOSE_LOGGING) return;
      try {
        console.log.apply(console, ["[SuperMenu]"].concat([].slice.call(arguments)));
      } catch (e) {}
    }

    function debounce(fn, delay) {
      var timeout;
      return function () {
        var ctx = this;
        var args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
          fn.apply(ctx, args);
        }, delay);
      };
    }

    function throttle(fn, limit) {
      var inThrottle;
      var lastArgs;
      var lastCtx;
      return function () {
        lastCtx = this;
        lastArgs = arguments;
        if (!inThrottle) {
          fn.apply(lastCtx, lastArgs);
          inThrottle = true;
          setTimeout(function () {
            inThrottle = false;
            if (lastArgs) {
              fn.apply(lastCtx, lastArgs);
              lastArgs = null;
            }
          }, limit);
        }
      };
    }

    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РЕЙТИНГОВ ===

    function fetchJsonWithTimeout(url, options, timeoutMs) {
      return new Promise(function (resolve, reject) {
        var aborted = false;
        var timeout = setTimeout(function () {
          aborted = true;
          reject(new Error("Timeout " + timeoutMs + "ms for " + url));
        }, timeoutMs || 8000);

        fetch(url, options || {})
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
            return res.json();
          })
          .then(function (json) {
            if (!aborted) {
              clearTimeout(timeout);
              resolve(json);
            }
          })
          .catch(function (err) {
            if (!aborted) {
              clearTimeout(timeout);
              reject(err);
            }
          });
      });
    }

    function getRatingFromCache(source, key) {
      var cache = SuperMenuConfig.RATING_CACHE[source];
      if (!cache) return null;
      return cache[key] || null;
    }

    function setRatingToCache(source, key, value) {
      var cache = SuperMenuConfig.RATING_CACHE[source];
      if (!cache) return;
      cache[key] = value;
    }

    function getTmdbRating(meta, cb) {
      if (!SuperMenuConfig.FEATURES.ratings_tmdb) {
        cb && cb(null);
        return;
      }

      try {
        var key = meta.tmdbId || meta.id || meta.title + "_" + (meta.year || "");
        var cached = getRatingFromCache("tmdb", key);
        if (cached) {
          cb && cb(cached);
          return;
        }

        cb && cb(null);
      } catch (e) {
        log("getTmdbRating error:", e);
        cb && cb(null);
      }
    }

    function getImdbRating(meta, cb) {
      if (!SuperMenuConfig.FEATURES.ratings_imdb) {
        cb && cb(null);
        return;
      }

      try {
        var key = meta.imdbId || meta.id || meta.title + "_" + (meta.year || "");
        var cached = getRatingFromCache("imdb", key);
        if (cached) {
          cb && cb(cached);
          return;
        }

        cb && cb(null);
      } catch (e) {
        log("getImdbRating error:", e);
        cb && cb(null);
      }
    }

    function getKpRating(meta, cb) {
      if (!SuperMenuConfig.FEATURES.ratings_kp) {
        cb && cb(null);
        return;
      }

      try {
        var key = meta.kpId || meta.id || meta.title + "_" + (meta.year || "");
        var cached = getRatingFromCache("kp", key);
        if (cached) {
          cb && cb(cached);
          return;
        }

        if (!SuperMenuConfig.RATINGS.kpApiKey || !SuperMenuConfig.RATINGS.kpApiUrl) {
          cb && cb(null);
          return;
        }

        var url =
          SuperMenuConfig.RATINGS.kpApiUrl +
          "?keyword=" +
          encodeURIComponent(meta.title) +
          (meta.year ? "&yearFrom=" + meta.year + "&yearTo=" + meta.year : "");

        fetchJsonWithTimeout(
          url,
          {
            headers: {
              "X-API-KEY": SuperMenuConfig.RATINGS.kpApiKey
            }
          },
          8000
        )
          .then(function (json) {
            var film = null;

            if (json && Array.isArray(json.items) && json.items.length) {
              film = json.items[0];
            } else if (json && Array.isArray(json.films) && json.films.length) {
              film = json.films[0];
            }

            if (!film) {
              cb && cb(null);
              return;
            }

            var value = Number(
              film.ratingImdb || film.ratingKinopoisk || film.rating
            );
            var votes = Number(
              film.ratingImdbVoteCount ||
                film.ratingKinopoiskVoteCount ||
                film.votes
            );

            if (!isFinite(value)) {
              cb && cb(null);
              return;
            }

            var result = {
              source: "kp",
              value: value,
              votes: isFinite(votes) ? votes : undefined
            };
            setRatingToCache("kp", key, result);
            cb && cb(result);
          })
          .catch(function (err) {
            log("getKpRating fetch error:", err);
            cb && cb(null);
          });
      } catch (e) {
        log("getKpRating error:", e);
        cb && cb(null);
      }
    }

    // === МЕНЮ ВЫХОДА (адаптация menus.js) ===

    var ExitMenuConfig = {
      visibilityValues: { 1: "Скрыть", 2: "Отобразить" },
      items: [
        { name: "exit", defaultValue: "2", title: "Закрыть приложение" },
        { name: "reboot", defaultValue: "2", title: "Перезагрузить" },
        { name: "switch_server", defaultValue: "2", title: "Сменить сервер" },
        { name: "clear_cache", defaultValue: "2", title: "Очистить кэш" },
        { name: "youtube", defaultValue: "1", title: "YouTube" },
        { name: "rutube", defaultValue: "1", title: "RuTube" },
        { name: "drm_play", defaultValue: "1", title: "DRM Play" },
        { name: "twitch", defaultValue: "1", title: "Twitch" },
        { name: "fork_player", defaultValue: "1", title: "ForkPlayer" },
        { name: "speedtest", defaultValue: "1", title: "Speed Test" }
      ]
    };

    function exitMenuEnsureDefaults() {
      try {
        var defaults = {
          back_plug: true,
          exit: "2",
          reboot: "2",
          switch_server: "2",
          clear_cache: "2",
          youtube: "1",
          rutube: "1",
          drm_play: "1",
          twitch: "1",
          fork_player: "1",
          speedtest: "1"
        };

        Object.keys(defaults).forEach(function (key) {
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, defaults[key]);
          }
        });
      } catch (e) {
        log("exitMenuEnsureDefaults error:", e);
      }
    }

    function exitMenuSeason() {
      try {
        if (Lampa.Platform.is("apple_tv")) {
          window.location.assign("exit://exit");
        }
        if (Lampa.Platform.is("tizen")) {
          tizen.application.getCurrentApplication().exit();
        }
        if (Lampa.Platform.is("webos")) {
          window.close();
        }
        if (Lampa.Platform.is("android")) {
          Lampa.Android.exit();
        }
        if (Lampa.Platform.is("orsay")) {
          Lampa.Orsay.exit();
        }
        if (Lampa.Platform.is("netcast")) {
          window.NetCastBack();
        }
        if (Lampa.Platform.is("noname")) {
          window.history.back();
        }
        if (Lampa.Platform.is("browser")) {
          window.close();
        }
        if (Lampa.Platform.is("nw")) {
          nw.Window.get().close();
        }
      } catch (e) {
        log("exitMenuSeason error:", e);
      }
    }

    function exitMenuSpeedTest() {
      try {
        var wrapper = $(
          '<div style="text-align:right;"><div style="min-height:360px;"><iframe id="speedtest-iframe" width="100%" height="100%" frameborder="0"></iframe></div></div>'
        );
        Lampa.Modal.open({
          title: "",
          html: wrapper,
          size: "medium",
          mask: true,
          onBack: function () {
            Lampa.Modal.close();
            Lampa.Controller.toggle("content");
          },
          onSelect: function () {}
        });
        var iframe = document.getElementById("speedtest-iframe");
        if (iframe) iframe.src = "http://speedtest.vokino.tv/?R=3";
      } catch (e) {
        log("exitMenuSpeedTest error:", e);
      }
    }

    function exitMenuClearCache() {
      try {
        Lampa.Storage.clear();
        Lampa.Noty.show("Кэш Лампы очищен");
      } catch (e) {
        log("exitMenuClearCache error:", e);
      }
    }

    function exitMenuSwitchServer() {
      try {
        var proto = location.protocol === "https:" ? "https://" : "http://";
        Lampa.Input.edit(
          {
            title: "Укажите cервер",
            value: "",
            free: true
          },
          function (value) {
            if (value && value.trim() !== "") {
              window.location.href = proto + value.trim();
            }
          }
        );
      } catch (e) {
        log("exitMenuSwitchServer error:", e);
      }
    }

    function exitMenuOpenExternal(url) {
      try {
        window.location.href = url;
      } catch (e) {
        log("exitMenuOpenExternal error:", url, e);
      }
    }

    // Иконки для пунктов меню выхода (адаптированы из menus.js)
    function exitMenuIconHtml(id) {
      switch (id) {
        case "exit":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg width="256px" height="256px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<g stroke-width="0"></g>' +
            '<g stroke-linecap="round" stroke-linejoin="round"></g>' +
            '<g>' +
            '<path d="M14.5 9.50002L9.5 14.5M9.49998 9.5L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
            '<path d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
            "</g></svg></div>" +
            '<div style="font-size:1.3em">Закрыть приложение</div></div>'
          );
        case "reboot":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
            '<g stroke-width="0"></g>' +
            '<g stroke-linecap="round" stroke-linejoin="round"></g>' +
            '<g>' +
            '<g transform="rotate(-90 -504.181 526.181)">' +
            '<path style="fill:currentColor;" d="M11 2a9 9 0 0 0-4.676 1.324l1.461 1.461A7 7 0 0 1 11 4a7 7 0 0 1 7 7 7 7 0 0 1-.787 3.213l1.465 1.465A9 9 0 0 0 20 11a9 9 0 0 0-9-9zM3.322 6.322A9 9 0 0 0 2 11a9 9 0 0 0 9 9 9 9 0 0 0 4.676-1.324l-1.461-1.461A7 7 0 0 1 11 18a7 7 0 0 1-7-7 7 7 0 0 1 .787-3.213z" transform="translate(0 1030.362)"></path>' +
            '<path style="fill:currentColor;" d="m7 1034.362 3 3 1-1-3-3z"></path>' +
            '<path style="fill:currentColor;" d="m11 1046.362 3 3 1-1-3-3z"></path>' +
            "</g></g></svg></div>" +
            '<div style="font-size:1.3em">Перезагрузить</div></div>'
          );
        case "switch_server":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg width="256px" height="256px" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
            '<g stroke-width="0"></g>' +
            '<g stroke-linecap="round" stroke-linejoin="round"></g>' +
            '<g>' +
            '<path d="M13 21.75C13.4142 21.75 13.75 21.4142 13.75 21C13.75 20.5858 13.4142 20.25 13 20.25V21.75ZM3.17157 19.8284L3.7019 19.2981H3.7019L3.17157 19.8284ZM20.8284 4.17157L20.2981 4.7019V4.7019L20.8284 4.17157ZM21.25 13C21.25 13.4142 21.5858 13.75 22 13.75C22.4142 13.75 22.75 13.4142 22.75 13H21.25ZM10 3.75H14V2.25H10V3.75Z" fill="currentColor"></path>' +
            '<path d="M13.5 7.5L18 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
            '<path d="M6 17.5L6 15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
            '<path d="M6 8.5L6 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
            '<path d="M9 17.5L9 15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
            '<path d="M9 8.5L9 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
            "</g></svg></div>" +
            '<div style="font-size:1.3em">Сменить сервер</div></div>'
          );
        case "clear_cache":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
            '<path fill="currentColor" d="M26 20h-6v-2h6zm4 8h-6v-2h6zm-2-4h-6v-2h6z"/>' +
            '<path fill="currentColor" d="M17.003 20a4.9 4.9 0 0 0-2.404-4.173L22 3l-1.73-1l-7.577 13.126a5.7 5.7 0 0 0-5.243 1.503C3.706 20.24 3.996 28.682 4.01 29.04a1 1 0 0 0 1 .96h14.991a1 1 0 0 0 .6-1.8c-3.54-2.656-3.598-8.146-3.598-8.2m-5.073-3.003A3.11 3.11 0 0 1 15.004 20c0 .038.002.208.017.469l-5.9-2.624a3.8 3.8 0 0 1 2.809-.848M15.45 28A5.2 5.2 0 0 1 14 25h-2a6.5 6.5 0 0 0 .968 3h-2.223A16.6 16.6 0 0 1 10 24H8a17.3 17.3 0 0 0 .665 4H6c.031-1.836.29-5.892 1.803-8.553l7.533 3.35A13 13 0 0 0 17.596 28Z"/>' +
            "</svg></div>" +
            '<div style="font-size:1.3em">Очистить кэш</div></div>'
          );
        case "youtube":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
            '<path fill="currentColor" d="M10 2.3C.172 2.3 0 3.174 0 10s.172 7.7 10 7.7s10-.874 10-7.7s-.172-7.7-10-7.7m3.205 8.034l-4.49 2.096c-.393.182-.715-.022-.715-.456V8.026c0-.433.322-.638.715-.456l4.49 2.096c.393.184.393.484 0 .668"/>' +
            "</svg></div>" +
            '<div style="font-size:1.3em">YouTube</div></div>'
          );
        case "rutube":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg width="256px" height="256px" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" fill="none">' +
            '<g stroke-width="0"></g>' +
            '<g stroke-linecap="round" stroke-linejoin="round"></g>' +
            '<g>' +
            '<path fill="#ffffff" d="M128.689 47.57H20.396v116.843h30.141V126.4h57.756l26.352 38.013h33.75l-29.058-38.188c9.025-1.401 15.522-4.73 19.493-9.985 3.97-5.255 5.956-13.664 5.956-24.875v-8.759c0-6.657-.721-11.912-1.985-15.941-1.264-4.029-3.43-7.533-6.498-10.686-3.249-2.978-6.858-5.08-11.19-6.481-4.332-1.226-9.747-1.927-16.424-1.927z" style="fill:none;stroke:#ffffff;stroke-width:12;stroke-linecap:round;stroke-linejoin:round" transform="translate(1.605 -1.99)"></path>' +
            '<path fill="#ffffff" d="M162.324 45.568c5.52 0 9.998-4.477 9.998-10s-4.478-10-9.998-10c-5.524 0-10.002 4.477-10.002 10s4.478 10 10.002 10z" transform="translate(1.605 -1.99)"></path>' +
            "</g></svg></div>" +
            '<div style="font-size:1.3em">RuTube</div></div>'
          );
        case "drm_play":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg fill="#ffffff" width="256px" height="256px" viewBox="0 -6 46 46" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff" stroke-width="2.3">' +
            '<g stroke-width="0"></g>' +
            '<g stroke-linecap="round" stroke-linejoin="round"></g>' +
            '<g>' +
            '<path d="M46,37H2a1,1,0,0,1-1-1V8A1,1,0,0,1,2,7H46a1,1,0,0,1,1,1V36A1,1,0,0,1,46,37ZM45,9H3V35H45ZM21,16a.975.975,0,0,1,.563.2l7.771,4.872a.974.974,0,0,1,.261,1.715l-7.974,4.981A.982.982,0,0,1,21,28a1,1,0,0,1-1-1V17A1,1,0,0,1,21,16ZM15,39H33a1,1,0,0,1,0,2H15a1,1,0,0,1,0-2Z" fill-rule="evenodd"></path>' +
            "</g></svg></div>" +
            '<div style="font-size:1.3em">DRM Play</div></div>'
          );
        case "twitch":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
            '<path fill="currentColor" d="M3.774 2L2.45 5.452v14.032h4.774V22h2.678l2.548-2.548h3.871l5.226-5.226V2zm15.968 11.323l-3 3h-4.743L9.452 18.87v-2.548H5.42V3.774h14.32zm-2.968-6.097v5.226h-1.775V7.226zm-4.775 0v5.226h-1.774V7.226z"/>' +
            "</svg></div>" +
            '<div style="font-size:1.3em">Twitch</div></div>'
          );
        case "fork_player":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg width="256px" height="256px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="#ffffff" stroke="#000000" stroke-width="0.00032">' +
            '<g stroke-width="0"></g>' +
            '<g stroke-linecap="round" stroke-linejoin="round"></g>' +
            '<g>' +
            '<g fill="none" fill-rule="evenodd">' +
            '<path d="m0 0h32v32h-32z"></path>' +
            '<g fill="#ffffff" fill-rule="nonzero">' +
            '<path d="m32 16c0-8.836-7.164-16-16-16S0 7.164 0 16s7.164 16 16 16s16-7.164 16-16zM1.455 16C1.455 7.967 7.967 1.455 16 1.455S30.545 7.967 30.545 16 24.033 30.545 16 30.545 1.455 24.033 1.455 16z"></path>' +
            '<path d="M16.614 25.235v-9.235h3.047l.481-3.06h-3.529v-1.535c0-.799.262-1.56 1.408-1.56h2.291V6.79h-3.252c-2.735 0-3.481 1.801-3.481 4.297v1.852H11.3v3.062h1.876v9.235z"></path>' +
            "</g></g></g></svg></div>" +
            '<div style="font-size:1.3em">ForkPlayer</div></div>'
          );
        case "speedtest":
          return (
            '<div class="settings-folder" style="padding:0!important">' +
            '<div style="width:2.2em;height:1.7em;padding-right:.5em">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
            '<path fill="currentColor" d="M10.45 15.5q.625.625 1.575.588T13.4 15.4L19 7l-8.4 5.6q-.65.45-.712 1.362t.562 1.538M5.1 20q-.55 0-1.012-.238t-.738-.712q-.65-1.175-1-2.437T2 14q0-2.075.788-3.9t2.137-3.175T8.1 4.788T12 4q2.05 0 3.85.775T19 6.888t2.15 3.125t.825 3.837q.025 1.375-.312 2.688t-1.038 2.512q-.275.475-.737.713T18.874 20z"/>' +
            "</svg></div>" +
            '<div style="font-size:1.3em">Speed Test</div></div>'
          );
        default:
          return id;
      }
    }

    function exitMenuBuildItems() {
      var items = [];

      if (localStorage.getItem("exit") !== "1") {
        items.push({ id: "exit", title: exitMenuIconHtml("exit") });
      }
      if (localStorage.getItem("reboot") !== "1") {
        items.push({ id: "reboot", title: exitMenuIconHtml("reboot") });
      }
      if (localStorage.getItem("switch_server") !== "1") {
        items.push({
          id: "switch_server",
          title: exitMenuIconHtml("switch_server")
        });
      }
      if (localStorage.getItem("clear_cache") !== "1") {
        items.push({
          id: "clear_cache",
          title: exitMenuIconHtml("clear_cache")
        });
      }
      if (localStorage.getItem("youtube") !== "1") {
        items.push({ id: "youtube", title: exitMenuIconHtml("youtube") });
      }
      if (localStorage.getItem("rutube") !== "1") {
        items.push({ id: "rutube", title: exitMenuIconHtml("rutube") });
      }
      if (localStorage.getItem("drm_play") !== "1") {
        items.push({ id: "drm_play", title: exitMenuIconHtml("drm_play") });
      }
      if (localStorage.getItem("twitch") !== "1") {
        items.push({ id: "twitch", title: exitMenuIconHtml("twitch") });
      }
      if (localStorage.getItem("fork_player") !== "1") {
        items.push({
          id: "fork_player",
          title: exitMenuIconHtml("fork_player")
        });
      }
      if (localStorage.getItem("speedtest") !== "1") {
        items.push({
          id: "speedtest",
          title: exitMenuIconHtml("speedtest")
        });
      }

      return items;
    }

    function exitMenuOpen() {
      try {
        exitMenuEnsureDefaults();

        var items = exitMenuBuildItems();
        if (!items.length) {
          Lampa.Noty.show("Все пункты меню выхода скрыты в настройках");
          return;
        }

        Lampa.Select.show({
          title: "Меню выхода",
          items: items,
          onBack: function () {
            Lampa.Controller.toggle("content");
          },
          onSelect: function (selected) {
            switch (selected.id) {
              case "exit":
                exitMenuSeason();
                break;
              case "reboot":
                location.reload();
                break;
              case "switch_server":
                exitMenuSwitchServer();
                break;
              case "clear_cache":
                exitMenuClearCache();
                break;
              case "youtube":
                exitMenuOpenExternal("https://youtube.com/tv");
                break;
              case "rutube":
                exitMenuOpenExternal(
                  "https://rutube.ru/tv-release/rutube.server-22.0.0/webos/"
                );
                break;
              case "drm_play":
                exitMenuOpenExternal("https://ott.drm-play.com");
                break;
              case "twitch":
                exitMenuOpenExternal("https://webos.tv.twitch.tv");
                break;
              case "fork_player":
                exitMenuOpenExternal("http://browser.appfxml.com");
                break;
              case "speedtest":
                exitMenuSpeedTest();
                break;
            }
          }
        });
      } catch (e) {
        log("exitMenuOpen error:", e);
      }
    }

    // === ЦВЕТА МЕТОК ===

    function getCurrentLabelColors() {
      var scheme = SuperMenuConfig.LABEL_SCHEME;
      var all = SuperMenuConfig.LABEL_COLORS || {};
      return all[scheme] || all.vivid || { TYPE: {}, QUALITY: {} };
    }

    function colorizeLabelsInContainer(container, meta) {
      try {
        if (!SuperMenuConfig.FEATURES.label_colors) return;
        if (!container || !meta) return;

        var colors = getCurrentLabelColors();

        var typeEl = container.querySelector(
          ".drx-label-type, .card-type, .type-label"
        );
        var qualityEl = container.querySelector(
          ".drx-label-quality, .card-quality, .quality-label"
        );

        if (typeEl && meta.type) {
          var tColor = colors.TYPE[meta.type];
          if (tColor) typeEl.style.color = tColor;
        }

        if (qualityEl && meta.quality) {
          var q = meta.quality;
          if (/2160|4k/i.test(q)) q = "4K";
          else if (/1080/i.test(q)) q = "1080p";
          else if (/720/i.test(q)) q = "720p";
          else if (/cam/i.test(q)) q = "CAM";
          else if (/hdr/i.test(q)) q = "HDR";
          else if (/sd/i.test(q)) q = "SD";

          var qColor = colors.QUALITY[q];
          if (qColor) qualityEl.style.color = qColor;
        }
      } catch (e) {
        log("colorizeLabelsInContainer error:", e);
      }
    }

    // === MADNESS: заголовки разделов ===

    function madnessDecorateSectionTitle(element) {
      try {
        if (!SuperMenuConfig.FEATURES.madness) return;
        if (SuperMenuConfig.FEATURES.madness_level === "off") return;
        if (!element) return;

        if (!element.dataset.drxOriginalTitle) {
          element.dataset.drxOriginalTitle = element.textContent || "";
        }

        var original = element.dataset.drxOriginalTitle || "";
        var level = SuperMenuConfig.FEATURES.madness_level;

        element.innerHTML = "";
        var baseSpan = document.createElement("span");
        baseSpan.className = "drx-section-title-base";
        baseSpan.textContent = original;

        element.appendChild(baseSpan);

        if (level === "normal" || level === "full") {
          var badge = document.createElement("span");
          badge.className = "drx-section-title-madness";
          badge.textContent = " ✦ MADNESS";
          badge.style.marginLeft = "0.35em";
          badge.style.fontSize = "0.8em";
          badge.style.opacity = "0.8";
          element.appendChild(badge);
        }

        if (level === "full") {
          element.style.letterSpacing = "0.03em";
          element.style.textShadow = "0 0 6px rgba(0,0,0,0.85)";
        } else {
          element.style.letterSpacing = "";
          element.style.textShadow = "";
        }
      } catch (e) {
        log("madnessDecorateSectionTitle error:", e);
      }
    }

    function initMadnessSectionHooks() {
      try {
        if (!SuperMenuConfig.FEATURES.madness) return;

        if (
          Lampa.Controller &&
          Lampa.Controller.listener &&
          Lampa.Controller.listener.follow
        ) {
          Lampa.Controller.listener.follow("toggle", function () {
            try {
              var titleEl = document.querySelector(
                ".head .head__title, .simple-title, .section__title"
              );
              if (!titleEl) return;
              madnessDecorateSectionTitle(titleEl);
            } catch (e) {
              log("Madness toggle hook error:", e);
            }
          });
        }
      } catch (e) {
        log("initMadnessSectionHooks error:", e);
      }
    }

    // === ТЁМНАЯ ТЕМА БЕЗ РАМок ===

    var injectedBorderlessStyle = null;

    function injectBorderlessDarkTheme() {
      try {
        if (!SuperMenuConfig.FEATURES.borderless_dark_theme) {
          if (
            injectedBorderlessStyle &&
            injectedBorderlessStyle.parentNode
          ) {
            injectedBorderlessStyle.parentNode.removeChild(
              injectedBorderlessStyle
            );
            injectedBorderlessStyle = null;
          }
          return;
        }

        if (injectedBorderlessStyle) return;

        var css =
          "body { background-color: #05070A !important; color: #ECEFF4 !important; }" +
          ".card, .card--collection, .card-w { " +
          "  border:none!important;" +
          "  box-shadow:0 14px 40px rgba(0,0,0,0.75)!important;" +
          "  background:radial-gradient(circle at top,#1B1F27 0,#0B0F16 55%,#05070A 100%)!important;" +
          "}" +
          ".card__view, .card__title, .card__age, .card__tags { " +
          "  text-shadow:0 0 4px rgba(0,0,0,0.9)!important;" +
          "}" +
          ".drx-kp-badge, .cardvote { " +
          "  text-shadow:0 0 4px rgba(0,0,0,0.95)!important;" +
          "}" +
          ".head, .head__title, .simple-title, .section__title { " +
          "  background:transparent!important;" +
          "  color:#ECEFF4!important;" +
          "  text-shadow:0 0 8px rgba(0,0,0,0.9)!important;" +
          "}";

        injectedBorderlessStyle = document.createElement("style");
        injectedBorderlessStyle.type = "text/css";
        injectedBorderlessStyle.className = "drx-borderless-dark-theme";
        injectedBorderlessStyle.appendChild(document.createTextNode(css));

        document.head.appendChild(injectedBorderlessStyle);
      } catch (e) {
        log("injectBorderlessDarkTheme error:", e);
      }
    }

    function setBorderlessDarkThemeEnabled(enabled) {
      SuperMenuConfig.FEATURES.borderless_dark_theme = !!enabled;
      injectBorderlessDarkTheme();
    }

    // === ОЗУЧКИ (каркас) ===

    function rememberVoiceoverSelection(meta) {
      try {
        if (!SuperMenuConfig.VOICEOVER.enabled) return;
        if (!meta || !meta.key || !meta.voiceId) return;

        var cache = SuperMenuConfig.VOICEOVER.cache;
        var prev = cache[meta.key] || {};

        cache[meta.key] = {
          voiceId: meta.voiceId,
          lastSeason:
            meta.season != null ? meta.season : prev.lastSeason,
          lastEpisode:
            meta.episode != null ? meta.episode : prev.lastEpisode,
          title: meta.title || prev.title || "",
          updatedAt: Date.now()
        };
      } catch (e) {
        log("rememberVoiceoverSelection error:", e);
      }
    }

    function checkVoiceoverUpdate(meta) {
      try {
        if (!SuperMenuConfig.VOICEOVER.enabled) return { hasUpdate: false };
        if (!meta || !meta.key) return { hasUpdate: false };

        var cache = SuperMenuConfig.VOICEOVER.cache;
        var prev = cache[meta.key];
        if (!prev || !prev.voiceId) return { hasUpdate: false };

        if (meta.availableVoiceId && meta.availableVoiceId !== prev.voiceId) {
          return { hasUpdate: false };
        }

        if (
          Number.isFinite(meta.latestSeason) &&
          Number.isFinite(meta.latestEpisode) &&
          Number.isFinite(prev.lastSeason) &&
          Number.isFinite(prev.lastEpisode)
        ) {
          if (
            meta.latestSeason > prev.lastSeason ||
            (meta.latestSeason === prev.lastSeason &&
              meta.latestEpisode > prev.lastEpisode)
          ) {
            return {
              hasUpdate: true,
              reason: "Новая серия в озвучке " + prev.voiceId
            };
          }
        }

        return { hasUpdate: false };
      } catch (e) {
        log("checkVoiceoverUpdate error:", e);
        return { hasUpdate: false };
      }
    }

    // === НАСТРОЙКИ ПЛАГИНА В LAMPA ===

    function registerSettings() {
      try {
        // MADNESS on/off
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_madness",
            type: "toggle",
            default: SuperMenuConfig.FEATURES.madness
          },
          field: {
            name: "MADNESS режим",
            description:
              "Визуальные эффекты и расширенные украшения интерфейса"
          }
        });

        // Уровень MADNESS
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_madness_level",
            type: "select",
            values: {
              off: "Выключен",
              normal: "Стандартный",
              full: "Полный"
            },
            default: SuperMenuConfig.FEATURES.madness_level
          },
          field: {
            name: "Уровень MADNESS",
            description:
              "Насколько агрессивно модифицировать интерфейс"
          }
        });

        // Режим производительности
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_perf_mode",
            type: "select",
            values: {
              normal: "Обычный режим",
              android_perf: "Щадящий режим (Android TV)"
            },
            default: SuperMenuConfig.PLATFORM.isAndroid
              ? "android_perf"
              : "normal"
          },
          field: {
            name: "Производительность плагина",
            description:
              "Настройка отзывчивости интерфейса и нагрузки на устройство"
          }
        });

        // Рейтинги TMDB
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_ratings_tmdb",
            type: "toggle",
            default: SuperMenuConfig.FEATURES.ratings_tmdb
          },
          field: {
            name: "Рейтинг TMDB",
            description: "Отображать рейтинг TMDB на карточках"
          }
        });

        // Рейтинги IMDb
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_ratings_imdb",
            type: "toggle",
            default: SuperMenuConfig.FEATURES.ratings_imdb
          },
          field: {
            name: "Рейтинг IMDb",
            description: "Отображать рейтинг IMDb на карточках"
          }
        });

        // Рейтинги КиноПоиск
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_ratings_kp",
            type: "toggle",
            default: SuperMenuConfig.FEATURES.ratings_kp
          },
          field: {
            name: "Рейтинг КиноПоиск",
            description:
              "Отображать рейтинг КиноПоиск (требуется внешнее API)"
          }
        });

        // Цветные метки качества/типа
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_label_colors",
            type: "toggle",
            default: SuperMenuConfig.FEATURES.label_colors
          },
          field: {
            name: "Цветные метки качества и типа",
            description:
              "Раскраска текста качества и типа (фильм/сериал)"
          }
        });

        // Схема цветов
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_label_scheme",
            type: "select",
            values: {
              vivid: "Яркая схема",
              soft: "Мягкая схема"
            },
            default: SuperMenuConfig.LABEL_SCHEME
          },
          field: {
            name: "Цветовая схема меток",
            description: "Выбор палитры для меток качества и типа"
          }
        });

        // Меню выхода в верхней панели
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_topbar_exit",
            type: "toggle",
            default: SuperMenuConfig.FEATURES.topbar_exit_menu
          },
          field: {
            name: "Меню выхода в верхней панели",
            description:
              "Добавить кнопку меню выхода рядом с консолью и перезагрузкой"
          }
        });

        // Тёмная тема без рамок
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_borderless_dark",
            type: "toggle",
            default: SuperMenuConfig.FEATURES.borderless_dark_theme
          },
          field: {
            name: "Тема: тёмная без рамок",
            description:
              "Сглаженные карточки без рамок, тёмный фон, повышенная читаемость"
          }
        });

        // Трекинг озвучек
        Lampa.SettingsApi.addParam({
          component: "more",
          param: {
            name: "drxaos_supermenu_voiceover_tracking",
            type: "toggle",
            default: SuperMenuConfig.FEATURES.voiceover_tracking
          },
          field: {
            name: "Отслеживание озвучек (beta)",
            description:
              "Запоминать выбранную озвучку и подсвечивать новые серии в этой озвучке (если источник даёт данные)"
          }
        });
      } catch (e) {
        log("registerSettings error:", e);
      }
    }

    function applyUserSettings() {
      try {
        var madness =
          Lampa.Storage.get(
            "drxaos_supermenu_madness",
            SuperMenuConfig.FEATURES.madness ? "true" : "false"
          ) === "true";

        var perfMode = Lampa.Storage.get(
          "drxaos_supermenu_perf_mode",
          SuperMenuConfig.PLATFORM.isAndroid ? "android_perf" : "normal"
        );

        var ratingsTmdb =
          Lampa.Storage.get(
            "drxaos_supermenu_ratings_tmdb",
            SuperMenuConfig.FEATURES.ratings_tmdb ? "true" : "false"
          ) === "true";

        var ratingsImdb =
          Lampa.Storage.get(
            "drxaos_supermenu_ratings_imdb",
            SuperMenuConfig.FEATURES.ratings_imdb ? "true" : "false"
          ) === "true";

        var ratingsKp =
          Lampa.Storage.get(
            "drxaos_supermenu_ratings_kp",
            SuperMenuConfig.FEATURES.ratings_kp ? "true" : "false"
          ) === "true";

        var labelColors =
          Lampa.Storage.get(
            "drxaos_supermenu_label_colors",
            SuperMenuConfig.FEATURES.label_colors ? "true" : "false"
          ) === "true";

        var labelScheme = Lampa.Storage.get(
          "drxaos_supermenu_label_scheme",
          SuperMenuConfig.LABEL_SCHEME
        );

        var topbarExit =
          Lampa.Storage.get(
            "drxaos_supermenu_topbar_exit",
            SuperMenuConfig.FEATURES.topbar_exit_menu ? "true" : "false"
          ) === "true";

        var madnessLevel = Lampa.Storage.get(
          "drxaos_supermenu_madness_level",
          SuperMenuConfig.FEATURES.madness_level || "normal"
        );

        var borderlessTheme =
          Lampa.Storage.get(
            "drxaos_supermenu_borderless_dark",
            SuperMenuConfig.FEATURES.borderless_dark_theme
              ? "true"
              : "false"
          ) === "true";

        var voiceoverTracking =
          Lampa.Storage.get(
            "drxaos_supermenu_voiceover_tracking",
            SuperMenuConfig.FEATURES.voiceover_tracking
              ? "true"
              : "false"
          ) === "true";

        SuperMenuConfig.FEATURES.madness = madness;
        SuperMenuConfig.FEATURES.ratings_tmdb = ratingsTmdb;
        SuperMenuConfig.FEATURES.ratings_imdb = ratingsImdb;
        SuperMenuConfig.FEATURES.ratings_kp = ratingsKp;
        SuperMenuConfig.FEATURES.label_colors = labelColors;
        SuperMenuConfig.FEATURES.topbar_exit_menu = topbarExit;
        SuperMenuConfig.FEATURES.borderless_dark_theme = borderlessTheme;
        SuperMenuConfig.FEATURES.voiceover_tracking = voiceoverTracking;
        SuperMenuConfig.VOICEOVER.enabled = voiceoverTracking;

        if (labelScheme === "vivid" || labelScheme === "soft") {
          SuperMenuConfig.LABEL_SCHEME = labelScheme;
        }

        if (
          madnessLevel === "off" ||
          madnessLevel === "normal" ||
          madnessLevel === "full"
        ) {
          SuperMenuConfig.FEATURES.madness_level = madnessLevel;
        }

        if (perfMode === "android_perf") {
          SuperMenuConfig.PERFORMANCE.DEBOUNCE_DELAY = 500;
          SuperMenuConfig.PERFORMANCE.THROTTLE_LIMIT = 150;
          SuperMenuConfig.PERFORMANCE.MUTATION_THROTTLE = 80;
        } else {
          SuperMenuConfig.PERFORMANCE.DEBOUNCE_DELAY = 300;
          SuperMenuConfig.PERFORMANCE.THROTTLE_LIMIT = 100;
          SuperMenuConfig.PERFORMANCE.MUTATION_THROTTLE = 50;
        }
      } catch (e) {
        log("applyUserSettings error:", e);
      }
    }

    function registerTopBarButton() {
      try {
        if (!SuperMenuConfig.FEATURES.topbar_exit_menu) return;

        if (Lampa && Lampa.Panel && Lampa.Panel.add) {
          Lampa.Panel.add({
            name: "drxaos_supermenu_exit",
            title: "Меню выхода",
            icon:
              '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M14.5 9.50002L9.5 14.5M9.49998 9.5L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
              '<path d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
              "</svg>",
            onClick: function () {
              exitMenuOpen();
            }
          });
        } else {
          log("Panel API недоступен, кнопка верхней панели не будет добавлена");
        }
      } catch (e) {
        log("registerTopBarButton error:", e);
      }
    }

    function onSettingsChanged(event) {
      try {
        if (!event || !event.name) return;
        var name = event.name;

        if (name.indexOf("drxaos_supermenu_") === 0) {
          applyUserSettings();
          injectBorderlessDarkTheme();
          var titleEl = document.querySelector(
            ".head .head__title, .simple-title, .section__title"
          );
          if (titleEl) madnessDecorateSectionTitle(titleEl);
        }
      } catch (e) {
        log("onSettingsChanged error:", e);
      }
    }

    // === ЭКСПОРТ ВНЕШНЕГО API ===

    try {
      window.DrxSuperMenu = window.DrxSuperMenu || {};
      window.DrxSuperMenu.colorizeLabelsInContainer =
        colorizeLabelsInContainer;

      window.DrxSuperMenu.getTmdbRating = getTmdbRating;
      window.DrxSuperMenu.getImdbRating = getImdbRating;
      window.DrxSuperMenu.getKpRating = getKpRating;

      window.DrxSuperMenu.setBorderlessDarkThemeEnabled =
        setBorderlessDarkThemeEnabled;

      window.DrxSuperMenu.rememberVoiceoverSelection =
        rememberVoiceoverSelection;
      window.DrxSuperMenu.checkVoiceoverUpdate = checkVoiceoverUpdate;
    } catch (e) {
      log("Export DrxSuperMenu API error:", e);
    }

    // === ЗАПУСК ===
    registerSettings();
    applyUserSettings();
    injectBorderlessDarkTheme();
    registerTopBarButton();
    initMadnessSectionHooks();

    try {
      if (
        Lampa.Storage &&
        Lampa.Storage.listener &&
        Lampa.Storage.listener.follow
      ) {
        Lampa.Storage.listener.follow("change", onSettingsChanged);
      }
    } catch (e) {
      log("Storage listener attach error:", e);
    }
  }

    // === ЗАПУСК ПЛАГИНА ===
  function bootstrapSuperMenu() {
    try {
      if (typeof Lampa === "undefined") return;

      if (window.appready) {
        // Приложение уже готово — просто запускаем init()
        init();
      } else if (Lampa.Listener && typeof Lampa.Listener.follow === "function") {
        // Ждём события ready от приложения
        Lampa.Listener.follow("app", function (e) {
          try {
            if (e.type === "ready") init();
          } catch (err) {
            log("SuperMenu init on app:ready error:", err);
          }
        });
      }
    } catch (e) {
      log("bootstrapSuperMenu error:", e);
    }
  }

  // Ждём появления Lampa, если плагин подцепился слишком рано
  if (typeof Lampa !== "undefined") {
    bootstrapSuperMenu();
  } else {
    var superMenuTimer = setInterval(function () {
      if (typeof Lampa !== "undefined") {
        clearInterval(superMenuTimer);
        bootstrapSuperMenu();
      }
    }, 200);
  }
})();
