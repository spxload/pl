// ==LampaPlugin==
// @name         Prestige Filter
// @version      1.0.0
// @description  Скрывает карточки online-prestige по ключевым словам (по умолчанию: "дубляж")
// @author       Copilot
// ==/LampaPlugin==

(function () {
  'use strict';

  var ID = 'prestige-filter';
  var NAME = 'Prestige Filter';
  var KEYWORDS = ['dolbyvision','украинский','грузинский','ukr','белорусский','казахский','чистый звук','mvo ua','+ua','Telesync','TS-AVC','-LQ','Camrip']; // можно добавить свои: ['дубляж','трейлер','реклама']

  function lower(s){ return String(s || '').toLowerCase(); }

  function matches(text, words){
    var t = lower(text);
    return words.some(function(w){ return t.includes(lower(w)); });
  }

  function cleanContext(root){
    try {
      var scope = root && root.nodeType === 1 ? root : document;
      var cards = scope.querySelectorAll('.online-prestige');
      var removed = 0;

      cards.forEach(function(card){
        // где угодно в карточке: заголовок, тело, доп. инфо
        var target =
          card.querySelector('.online-prestige__title, .online-prestige__body, .online-prestige__info') || card;

        if (matches(target.textContent || '', KEYWORDS)) {
          card.remove();
          removed++;
        }
      });

      if (removed) console.log('[PrestigeFilter] removed:', removed);
    } catch (e) {
      console.log('[PrestigeFilter] clean error:', e.message);
    }
  }

  function observe(){
    // первичная очистка после рендера
    setTimeout(function(){ cleanContext(document); }, 100);

    // отслеживаем динамические подгрузки
    var mo = new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++){
        var m = muts[i];
        if (!m.addedNodes || !m.addedNodes.length) continue;

        m.addedNodes.forEach(function(node){
          if (!(node instanceof HTMLElement)) return;

          if (node.classList && node.classList.contains('online-prestige')) {
            cleanContext(node.parentNode || node);
          } else if (node.querySelector && node.querySelector('.online-prestige')) {
            cleanContext(node);
          }
        });
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });
    window[ID + '_mo'] = mo;
  }

  function start(){
    // подстрахуемся: иногда тело ещё не готово
    var wait = setInterval(function(){
      if (document.body) {
        clearInterval(wait);
        observe();
      }
    }, 200);

    // плюс событийный хук Лампы, если доступен
    if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
      Lampa.Listener.follow('app', function(e){
        // на смене экранов/вкладок — повторная зачистка
        if (e.type === 'activity' || e.type === 'ready' || e.type === 'navigation') {
          setTimeout(function(){ cleanContext(document); }, 100);
        }
      });
    }
  }

  function stop(){
    var mo = window[ID + '_mo'];
    if (mo && mo.disconnect) mo.disconnect();
  }

  function boot(){
    try { start(); } catch(e){ console.log('[PrestigeFilter] boot error:', e.message); }
  }

  // Регистрация в Лампе (если API доступен), иначе — просто запускаем
  function register(){
    if (window.Lampa && Lampa.Plugin && Lampa.Plugin.create) {
      Lampa.Plugin.create({
        title: NAME,
        description: 'Скрывает карточки online-prestige по словам: ' + KEYWORDS.join(', '),
        version: '1.0.0',
        author: 'Copilot',
        onLoad: boot,
        onDestroy: stop
      });
    } else {
      // Фолбек: ждём готовности приложения и запускаем
      var t = setInterval(function(){
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          clearInterval(t);
          boot();
        }
      }, 200);
      setTimeout(function(){ clearInterval(t); }, 15000);
    }
  }

  register();
})();