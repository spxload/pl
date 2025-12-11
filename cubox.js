(function () {
    'use strict';

    var GITHUB_USER = 'spxload'; 
    var GITHUB_REPO = 'pl'; 
    var BRANCH = 'main';
    var FOLDER_PATH = 'Cubox'; 
    var CUBOX_VERSION = 'v3.3';

    var STORAGE_KEY = 'cubox_plugins_state';
    var CDN_BASE = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/';
    var enabledPlugins = Lampa.Storage.get(STORAGE_KEY, '{}');
    var needReload = false; 

    function loadPlugin(filename) {
        var url = CDN_BASE + filename + '?t=' + Date.now();
        var script = document.createElement('script');
        script.src = url;
        script.async = true;
        document.body.appendChild(script);
    }
    
    function startPlugins() {
        Object.keys(enabledPlugins).forEach(function(file) {
            if (enabledPlugins[file]) loadPlugin(file);
        });
    }

    function fetchManifest(callback) {
        var apiUrl = 'https://api.github.com/repos/' + GITHUB_USER + '/' + GITHUB_REPO + '/contents/' + FOLDER_PATH + '/plugins.json?ref=' + BRANCH + '&_t=' + Date.now();
        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                var json = JSON.parse(decodeURIComponent(escape(window.atob(data.content.replace(/\s/g, '')))));
                callback(json);
            })
            .catch(() => {
                var cdnUrl = 'https://cdn.jsdelivr.net/gh/' + GITHUB_USER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + FOLDER_PATH + '/plugins.json?t=' + Date.now();
                fetch(cdnUrl).then(r => r.json()).then(callback).catch(() => callback([]));
            });
    }

    function addMenu() {
        var field = $(`
            <div class="settings-folder selector cubox-menu-item">
                <div class="settings-folder__icon">
                    <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                </div>
                <div class="settings-folder__name">Cubox Store</div>
                <div class="settings-folder__descr">${CUBOX_VERSION}</div>
            </div>
        `);
        
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name == 'main') {
                var timer = setInterval(function() {
                    var scrollLayer = $('.settings__content .scroll__content');
                    if (scrollLayer.length) {
                        clearInterval(timer);
                        scrollLayer.find('.cubox-menu-item').remove();
                        var first = scrollLayer.find('.settings-folder').first();
                        field.off('hover:enter click').on('hover:enter click', openStore);
                        if (first.length) first.before(field);
                        else scrollLayer.append(field);
                    }
                }, 50);
            }
        });
    }

    function openStore() {
        Lampa.Loading.start(function(){ Lampa.Loading.stop(); });
        
        fetchManifest(function(plugins) {
            Lampa.Loading.stop();
            var items = [];

            if (Array.isArray(plugins) && plugins.length > 0) {
                plugins.forEach(function(p) {
                    var isEnabled = enabledPlugins[p.file] === true;
                    var statusColor = '#4bbc16'; 

                    // --- ФИНАЛЬНАЯ ПОПЫТКА СТИЛИЗАЦИИ ---
                    // Мы используем SVG вместо DIV для кружочка, так как SVG лучше пролезает через фильтры
                    var svgIcon = isEnabled ? 
                        `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle; margin-right:10px;"><circle cx="8" cy="8" r="6" fill="${statusColor}" stroke="${statusColor}" stroke-width="2"/></svg>` : 
                        `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle; margin-right:10px;"><circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/></svg>`;

                    // Формируем заголовок
                    var titleText = `<span style="font-size: 1.1em; font-weight: 500;">${p.name}</span>`;
                    
                    // Формируем подзаголовок
                    var subText = `<span style="opacity: 0.7; font-size: 0.9em;">v${p.version}</span> <span style="opacity: 0.5;">• ${p.description}</span>`;

                    items.push({
                        title: svgIcon + ' ' + titleText, // Иконка + Текст в заголовке
                        subtitle: subText,
                        file: p.file,
                        enabled: isEnabled,
                        icon: '' // Очищаем стандартную иконку
                    });
                });
            } else {
                items.push({ title: 'Нет плагинов', subtitle: 'Список пуст', file: 'none' });
            }

            Lampa.Select.show({
                title: 'Cubox Store',
                items: items,
                onSelect: function(item) {
                    if (item.file === 'none') return;
                    enabledPlugins[item.file] = !item.enabled;
                    Lampa.Storage.set(STORAGE_KEY, enabledPlugins);
                    needReload = true;
                    setTimeout(openStore, 10);
                },
                onBack: function() {
                    if (needReload) {
                        Lampa.Noty.show('Перезагрузка...');
                        setTimeout(function(){ window.location.reload(); }, 1000);
                    } else {
                        Lampa.Controller.toggle('settings_component');
                    }
                }
            });
            
            // ХАК: После открытия Select находим его DOM-элементы и разрешаем HTML
            // Это нужно, если Lampa экранирует HTML по умолчанию
            setTimeout(function() {
                $('.select__item .select__title, .select__item .select__descr').each(function() {
                    var $this = $(this);
                    var html = $this.text(); // Если текст содержит теги как текст
                    if (html.includes('<') && html.includes('>')) {
                        $this.html(html); // Превращаем текст обратно в HTML
                    }
                });
            }, 50);
        });
    }

    if (window.appready) { addMenu(); startPlugins(); }
    else { Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') { addMenu(); startPlugins(); } }); }
})();
