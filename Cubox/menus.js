// @name: Backmenu
// @version: 1
// @description: Меню по кнопке назад

(function () {
  "use strict";

  // Инициализация платформы TV (оставляем как есть)
  if(Lampa.Platform && Lampa.Platform.tv) Lampa.Platform.tv();

  (function () {
    // Внутренняя функция-обертка (seiry) - оставляем, она не мешает
    var seiry = function () {
      var tersa = true;
      return function (kyrae, dnaiel) {
        var tabaitha = tersa
          ? function () {
              if (dnaiel) {
                var jru = dnaiel.apply(kyrae, arguments);
                dnaiel = null;
                return jru;
              }
            }
          : function () {};
        tersa = false;
        return tabaitha;
      };
    }();

    "use strict";

    function vel() {
      // --- УДАЛЕНА ПРОВЕРКА bylampa ---
      // if (Lampa.Manifest.origin !== "bylampa") { ... }

      // Конфиг для пунктов меню выхода
      var backMenuVisibilityValues = {1: "Скрыть", 2: "Отобразить"};
      var backMenuItems = [
        {name: "exit",          defaultValue: "2", title: "Закрыть приложение"},
        {name: "reboot",        defaultValue: "2", title: "Перезагрузить"},
        {name: "switch_server", defaultValue: "2", title: "Сменить сервер"},
        {name: "clear_cache",   defaultValue: "2", title: "Очистить кэш"},
        {name: "youtube",       defaultValue: "1", title: "YouTube"},
        {name: "rutube",        defaultValue: "1", title: "RuTube"},
        {name: "drm_play",      defaultValue: "1", title: "DRM Play"},
        {name: "twitch",        defaultValue: "1", title: "Twitch"},
        {name: "fork_player",   defaultValue: "1", title: "ForkPlayer"},
        {name: "speedtest",     defaultValue: "1", title: "Speed Test"}
      ];

      // Слушатель открытия настроек — добавляем компонент back_menu
      Lampa.Settings.listener.follow("open", function (tatevik) {
        if (tatevik.name == "main") {
          Lampa.SettingsApi.addComponent({component: "back_menu", name: "BackMenu"});
          setTimeout(function () {
            var backMenuElement = $("div[data-component=\"back_menu\"]");
            if (backMenuElement.length) backMenuElement.remove();
          }, 0);
        }
      });

      // Пункт «Меню Выход» в разделе «Остальное»
      Lampa.SettingsApi.addParam({
        component: "more",
        param: {name: "back_menu", type: "static", default: true},
        field: {
          name: "Меню Выход",
          description: "Настройки отображения пунктов меню"
        },
        onRender: function (shivin) {
          shivin.on("hover:enter", function () {
            Lampa.Settings.create("back_menu");
            Lampa.Controller.enabled().controller.back = function () {
              Lampa.Settings.create("more");
            };
          });
        }
      });

      // Все параметры back_menu
      backMenuItems.forEach(function (item) {
        Lampa.SettingsApi.addParam({
          component: "back_menu",
          param: {
            name: item.name,
            type: "select",
            values: backMenuVisibilityValues,
            default: item.defaultValue
          },
          field: {
            name: item.title,
            description: "Нажмите для выбора"
          }
        });
      });

      // Инициализация значений по умолчанию
      var initBackMenuInterval = setInterval(function () {
        if (typeof Lampa !== "undefined") {
          clearInterval(initBackMenuInterval);
          if (!Lampa.Storage.get("back_plug", "false")) {
            shimya();
          }
        }
      }, 200);

      function shimya() {
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
          Lampa.Storage.set(key, defaults[key]);
        });
      }

      function nitza() {
        var crissie = $('<div style="text-align:right;"><div style="min-height:360px;"><iframe id="speedtest-iframe" width="100%" height="100%" frameborder="0"></iframe></div></div>');
        Lampa.Modal.open({title: "", html: crissie, size: "medium", mask: true, onBack: function loudella() {
          Lampa.Modal.close();
          Lampa.Controller.toggle("content");
        }, onSelect: function () {}});
        var jimel = document.getElementById("speedtest-iframe");
        jimel.src = "http://speedtest.vokino.tv/?R=3";
      }

      function aubreanna() {
        Lampa.Storage.clear();
        // Перезагрузка после очистки кэша для надежности
        setTimeout(function() { location.reload(); }, 1000);
      }

      var shakura = location.protocol === "https:" ? "https://" : "http://";
      
      function lakeeta() {
        Lampa.Input.edit({title: "Укажите cервер", value: "", free: true}, function (tiquita) {
          if (tiquita !== "") {
            window.location.href = shakura + tiquita;
          } else {
            loralynn();
          }
        });
      }

      function season() {
        // Добавил проверку на webOS для старых телевизоров
        if (typeof webOS !== 'undefined' && webOS.platformBack) {
            webOS.platformBack();
            return;
        }

        if (Lampa.Platform.is("apple_tv")) { window.location.assign("exit://exit"); }
        if (Lampa.Platform.is("tizen")) { try { tizen.application.getCurrentApplication().exit(); } catch(e){} }
        if (Lampa.Platform.is("webos")) { window.close(); }
        if (Lampa.Platform.is("android")) { Lampa.Android.exit(); }
        if (Lampa.Platform.is("orsay")) { Lampa.Orsay.exit(); }
        if (Lampa.Platform.is("netcast")) { window.NetCastBack(); }
        if (Lampa.Platform.is("noname")) { window.history.back(); }
        if (Lampa.Platform.is("browser")) { window.close(); }
        if (Lampa.Platform.is("nw")) { nw.Window.get().close(); }
      }

      // Функция отрисовки меню (оставил как есть, только иконки SVG длинные)
      function loralynn() {
        var gadi = [];
        
        // --- ICONS (SVG) ---
        // Я сократил код SVG для читаемости, но функционал тот же
        var icon_exit = '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 9.50002L9.5 14.5M9.49998 9.5L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>';
        var icon_reboot = '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
        var icon_server = '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6" y2="6"></line><line x1="6" y1="18" x2="6" y2="18"></line></svg>';
        var icon_cache = '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        var icon_app = '<svg width="20px" height="20px" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';

        // Helper для создания HTML пункта
        function makeItem(icon, text) {
             return '<div class="settings-folder" style="padding:0!important"><div style="width:2.2em;height:1.7em;padding-right:.5em; display:flex; align-items:center;">' + icon + '</div><div style="font-size:1.3em">' + text + '</div></div>';
        }

        if (localStorage.getItem("exit") !== "1")          gadi.push({title: makeItem(icon_exit, "Закрыть приложение"), action: "exit"});
        if (localStorage.getItem("reboot") !== "1")        gadi.push({title: makeItem(icon_reboot, "Перезагрузить"), action: "reboot"});
        if (localStorage.getItem("switch_server") !== "1") gadi.push({title: makeItem(icon_server, "Сменить сервер"), action: "server"});
        if (localStorage.getItem("clear_cache") !== "1")   gadi.push({title: makeItem(icon_cache, "Очистить кэш"), action: "cache"});
        
        // Внешние приложения (оставил стандартную иконку icon_app для простоты)
        if (localStorage.getItem("youtube") !== "1")     gadi.push({title: makeItem(icon_app, "YouTube"), action: "youtube"});
        if (localStorage.getItem("rutube") !== "1")      gadi.push({title: makeItem(icon_app, "RuTube"), action: "rutube"});
        if (localStorage.getItem("drm_play") !== "1")    gadi.push({title: makeItem(icon_app, "DRM Play"), action: "drm"});
        if (localStorage.getItem("twitch") !== "1")      gadi.push({title: makeItem(icon_app, "Twitch"), action: "twitch"});
        if (localStorage.getItem("fork_player") !== "1") gadi.push({title: makeItem(icon_app, "ForkPlayer"), action: "fork"});
        if (localStorage.getItem("speedtest") !== "1")   gadi.push({title: makeItem(icon_app, "Speed Test"), action: "speedtest"});

        Lampa.Select.show({
            title: "Выход", 
            items: gadi, 
            onBack: function() { Lampa.Controller.toggle("content"); }, 
            onSelect: function(item) {
                // Используем поле 'action' вместо сравнения длинных HTML строк (это надежнее)
                switch(item.action) {
                    case "exit": season(); break;
                    case "reboot": location.reload(); break;
                    case "server": lakeeta(); break;
                    case "cache": aubreanna(); break;
                    case "youtube": window.location.href = "https://youtube.com/tv"; break;
                    case "rutube": window.location.href = "https://rutube.ru/tv-release/rutube.server-22.0.0/webos/"; break;
                    case "drm": window.location.href = "https://ott.drm-play.com"; break;
                    case "twitch": window.location.href = "https://webos.tv.twitch.tv"; break;
                    case "fork": window.location.href = "http://browser.appfxml.com"; break;
                    case "speedtest": nitza(); break;
                }
            }
        });
      }

      // Перехват кнопки выхода в главном меню
      Lampa.Controller.listener.follow("toggle", function (loreli) {
        if (loreli.name == "select" && $(".selectbox__title").text() == Lampa.Lang.translate("title_out")) {
          Lampa.Select.hide();
          setTimeout(function () {
            loralynn();
          }, 100);
        }
      });
    }

    if (window.appready) {
      vel();
    } else {
      Lampa.Listener.follow("app", function (cobalt) {
        if (cobalt.type == "ready") {
          vel();
        }
      });
    }
  }());
}());
