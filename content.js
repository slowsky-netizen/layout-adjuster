(function() {
    if (window.__layoutAdjusterLoaded) return;
    window.__layoutAdjusterLoaded = true;

    function isExtensionValid() {
        try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
    }

    function applySavedLayout() {
        if (!isExtensionValid()) return;
        const host = window.location.hostname;
        const storageKey = `layout_${host}`;
        
        chrome.storage.local.get([storageKey], (result) => {
            let storedData = result[storageKey];
            let rules = Array.isArray(storedData) ? storedData : (storedData ? [storedData] : []);

            rules.forEach(settings => {
                if (!settings.enabled || !settings.selector) return;
                const element = document.querySelector(settings.selector);
                if (!element) return;
                
                element.style.maxWidth = '';
                element.style.width = '';
                element.style.marginLeft = '';
                element.style.marginRight = '';

                if (settings.widthType === 'px') element.style.width = settings.widthPx + 'px';
                else element.style.maxWidth = '100%';

                if (settings.align === 'left') {
                    element.style.marginLeft = '0'; element.style.marginRight = 'auto';
                } else if (settings.align === 'center') {
                    element.style.marginLeft = 'auto'; element.style.marginRight = 'auto';
                } else if (settings.align === 'right') {
                    element.style.marginLeft = 'auto'; element.style.marginRight = '0';
                } else if (settings.align === 'custom') {
                    element.style.marginLeft = settings.margin + 'px'; element.style.marginRight = settings.margin + 'px';
                }
            });
        });
    }
    window.addEventListener('load', applySavedLayout);

    let picking = false;
    let hoveredElement = null;

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "start_picking") {
            picking = true;
            document.body.style.cursor = 'crosshair';
            removeSettingsPanel();
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (!picking) return;
        if (hoveredElement) hoveredElement.style.outline = '';
        hoveredElement = e.target;
        hoveredElement.style.outline = '2px solid red';
    });

    document.addEventListener('click', (e) => {
        if (!picking) return;
        e.preventDefault();
        e.stopPropagation();

        picking = false;
        document.body.style.cursor = 'default';
        if (hoveredElement) hoveredElement.style.outline = '';

        showSettingsPanel(e.target);
    }, true);

    function showSettingsPanel(el) {
        removeSettingsPanel();

        let selector = '';
        if (el.id) selector = '#' + el.id;
        else if (el.className && typeof el.className === 'string') selector = el.tagName.toLowerCase() + '.' + el.className.trim().replace(/\s+/g, '.');
        else selector = el.tagName.toLowerCase();

        const host = window.location.hostname;
        const storageKey = `layout_${host}`;

        chrome.storage.local.get([storageKey], (result) => {
            let storedData = result[storageKey];
            let rules = Array.isArray(storedData) ? storedData : (storedData ? [storedData] : []);

            const existingIndex = rules.findIndex(r => r.selector === selector);

            let defaults = { align: 'left', margin: 0, widthType: 'max', widthPx: 1200, enabled: true };

            if (existingIndex !== -1) {
                defaults = rules[existingIndex];
            }

            const panel = document.createElement('div');
            panel.id = 'layout-adjuster-panel';
            panel.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 999999;
                background: #fff; color: #000; border: 1px solid #ccc;
                border-radius: 8px; padding: 15px; width: 300px;
                font-family: sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            `;

            panel.innerHTML = `
                <h3 style="margin-top:0;">${existingIndex !== -1 ? 'Редактировать правило' : 'Добавить правило'}</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px; word-break: break-all;">Селектор: ${selector}</p>
                
                <label style="display:block; margin-bottom:10px;">Выравнивание:
                    <select id="la-align" style="width:100%; margin-top:5px;">
                        <option value="left" ${defaults.align === 'left' ? 'selected' : ''}>Левый край</option>
                        <option value="center" ${defaults.align === 'center' ? 'selected' : ''}>Центр</option>
                        <option value="right" ${defaults.align === 'right' ? 'selected' : ''}>Правый край</option>
                        <option value="custom" ${defaults.align === 'custom' ? 'selected' : ''}>Отступ от краев</option>
                    </select>
                </label>
                <label id="la-margin-label" style="display:${defaults.align === 'custom' ? 'block' : 'none'}; margin-bottom:10px;">Отступ (px):
                    <input type="number" id="la-margin" value="${defaults.margin}" style="width:100%; margin-top:5px;">
                </label>

                <label style="display:block; margin-bottom:10px;">Ширина:
                    <select id="la-width-type" style="width:100%; margin-top:5px;">
                        <option value="max" ${defaults.widthType === 'max' ? 'selected' : ''}>Max Width</option>
                        <option value="px" ${defaults.widthType === 'px' ? 'selected' : ''}>Своя (px)</option>
                    </select>
                </label>
                <label id="la-width-label" style="display:${defaults.widthType === 'px' ? 'block' : 'none'}; margin-bottom:10px;">Ширина (px):
                    <input type="number" id="la-width" value="${defaults.widthPx}" style="width:100%; margin-top:5px;">
                </label>

                <label style="display:block; margin-bottom:10px;">
                    <input type="checkbox" id="la-enabled" ${defaults.enabled ? 'checked' : ''}> Включить правило
                </label>

                <div style="display:flex; gap:10px;">
                    <button id="la-save" style="flex:1; padding:8px; cursor:pointer;">Сохранить</button>
                    <button id="la-cancel" style="flex:1; padding:8px; cursor:pointer;">Отмена</button>
                </div>
            `;

            document.body.appendChild(panel);

            document.getElementById('la-align').addEventListener('change', (e) => {
                document.getElementById('la-margin-label').style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
            document.getElementById('la-width-type').addEventListener('change', (e) => {
                document.getElementById('la-width-label').style.display = e.target.value === 'px' ? 'block' : 'none';
            });

            panel.addEventListener('click', (e) => {
                if (e.target.id === 'la-cancel') {
                    removeSettingsPanel();
                } else if (e.target.id === 'la-save') {
                    if (!isExtensionValid()) {
                        alert("Расширение было обновлено. Нажмите F5.");
                        removeSettingsPanel();
                        return;
                    }

                    const newRule = {
                        selector: selector,
                        align: document.getElementById('la-align').value,
                        margin: parseInt(document.getElementById('la-margin').value) || 0,
                        widthType: document.getElementById('la-width-type').value,
                        widthPx: parseInt(document.getElementById('la-width').value) || 1200,
                        enabled: document.getElementById('la-enabled').checked
                    };

                    if (existingIndex !== -1) {
                        rules[existingIndex] = newRule;
                    } else {
                        rules.push(newRule);
                    }

                    chrome.storage.local.set({ [storageKey]: rules }, () => {
                        applyLayoutToElement(el, newRule);
                        removeSettingsPanel();
                        try { chrome.runtime.sendMessage({ action: "rules_updated" }); } catch(e) {}
                    });
                }
            });
        });
    }

    function applyLayoutToElement(el, settings) {
        el.style.maxWidth = '';
        el.style.width = '';
        el.style.marginLeft = '';
        el.style.marginRight = '';

        if (settings.widthType === 'px') el.style.width = settings.widthPx + 'px';
        else el.style.maxWidth = '100%';

        if (settings.align === 'left') {
            el.style.marginLeft = '0'; el.style.marginRight = 'auto';
        } else if (settings.align === 'center') {
            el.style.marginLeft = 'auto'; el.style.marginRight = 'auto';
        } else if (settings.align === 'right') {
            el.style.marginLeft = 'auto'; el.style.marginRight = '0';
        } else if (settings.align === 'custom') {
            el.style.marginLeft = settings.margin + 'px'; el.style.marginRight = settings.margin + 'px';
        }
    }

    function removeSettingsPanel() {
        const panel = document.getElementById('layout-adjuster-panel');
        if (panel) panel.remove();
    }
})();
