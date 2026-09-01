let currentHost = null;

const tabPickBtn = document.getElementById('tab-pick-btn');
const tabRulesBtn = document.getElementById('tab-rules-btn');
const tabPickContent = document.getElementById('tab-pick-content');
const tabRulesContent = document.getElementById('tab-rules-content');

tabPickBtn.addEventListener('click', () => switchTab('pick'));
tabRulesBtn.addEventListener('click', () => switchTab('rules'));

async function initHost() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentHost = new URL(tab.url).hostname;
}

function switchTab(tab) {
  tabPickBtn.classList.toggle('active', tab === 'pick');
  tabRulesBtn.classList.toggle('active', tab === 'rules');
  tabPickContent.classList.toggle('hidden', tab !== 'pick');
  tabRulesContent.classList.toggle('hidden', tab !== 'rules');
  
  if (tab === 'rules') loadRules();
}

document.getElementById('pick-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentHost = new URL(tab.url).hostname;
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) { console.log(e); }

  chrome.tabs.sendMessage(tab.id, { action: "start_picking" });
  window.close();
});

// Слушаем обновление правил из content.js
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "rules_updated") loadRules();
});

function loadRules() {
  const listEl = document.getElementById('rules-list');
  const editForm = document.getElementById('edit-form');
  editForm.classList.add('hidden');
  listEl.innerHTML = 'Загрузка...';

  chrome.storage.local.get([`layout_${currentHost}`], (result) => {
    let storedData = result[`layout_${currentHost}`];
    let rules = [];

    // Преобразуем старый объект в массив
    if (Array.isArray(storedData)) rules = storedData;
    else if (storedData && typeof storedData === 'object') rules = [storedData];

    listEl.innerHTML = '';

    if (rules.length === 0) {
      listEl.innerHTML = '<p style="color: #666; font-style: italic;">Правил для этого сайта пока нет.</p>';
      return;
    }

    rules.forEach((rule, index) => {
      let alignText = rule.align;
      if (alignText === 'left') alignText = 'По левому краю';
      else if (alignText === 'center') alignText = 'По центру';
      else if (alignText === 'right') alignText = 'По правому краю';
      else alignText = `Отступ ${rule.margin}px`;

      let widthText = rule.widthType === 'px' ? `${rule.widthPx}px` : 'Максимум';
      let statusText = rule.enabled ? 'Включено' : 'Выключено';

      const item = document.createElement('div');
      item.className = 'rule-item';
      item.innerHTML = `
        <div class="rule-header">${rule.selector}</div>
        <div style="font-size: 12px; color: #555;">
          Выравнивание: ${alignText}<br>
          Ширина: ${widthText}<br>
          Статус: ${statusText}
        </div>
        <div class="rule-actions">
          <button class="edit-btn" data-action="edit" data-index="${index}">Редактировать</button>
          <button class="delete-btn" data-action="delete" data-index="${index}">Удалить</button>
        </div>
      `;
      listEl.appendChild(item);
    });
  });
}

document.getElementById('rules-list').addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  const index = parseInt(e.target.dataset.index);

  if (action === 'delete') {
    if (confirm('Удалить это правило?')) {
      chrome.storage.local.get([`layout_${currentHost}`], (result) => {
        let rules = result[`layout_${currentHost}`] || [];
        if (!Array.isArray(rules)) rules = [rules]; // На всякий случай

        rules.splice(index, 1);
        chrome.storage.local.set({ [`layout_${currentHost}`]: rules }, () => loadRules());
      });
    }
  } else if (action === 'edit') {
    chrome.storage.local.get([`layout_${currentHost}`], (result) => {
      let rules = result[`layout_${currentHost}`] || [];
      if (!Array.isArray(rules)) rules = [rules];

      const rule = rules[index];
      if (!rule) return;

      document.getElementById('edit-selector').value = rule.selector;
      document.getElementById('edit-align').value = rule.align;
      document.getElementById('edit-margin').value = rule.margin || 0;
      document.getElementById('edit-width-type').value = rule.widthType;
      document.getElementById('edit-width').value = rule.widthPx || 1200;
      document.getElementById('edit-enabled').checked = rule.enabled;

      updateEditFields();

      document.getElementById('rules-list').style.display = 'none';
      document.getElementById('edit-form').classList.remove('hidden');
      document.getElementById('clear-all-btn').style.display = 'none';
      
      document.getElementById('save-edit-btn').dataset.index = index;
    });
  }
});

document.getElementById('edit-align').addEventListener('change', updateEditFields);
document.getElementById('edit-width-type').addEventListener('change', updateEditFields);

function updateEditFields() {
  const align = document.getElementById('edit-align').value;
  const widthType = document.getElementById('edit-width-type').value;

  document.getElementById('edit-margin-label').classList.toggle('hidden', align !== 'custom');
  document.getElementById('edit-width-label').classList.toggle('hidden', widthType !== 'px');
}

document.getElementById('save-edit-btn').addEventListener('click', () => {
  const index = parseInt(document.getElementById('save-edit-btn').dataset.index);
  if (isNaN(index)) return;

  const newSelector = document.getElementById('edit-selector').value;
  if (!newSelector) { alert('Введите CSS селектор!'); return; }

  const updatedRule = {
    selector: newSelector,
    align: document.getElementById('edit-align').value,
    margin: parseInt(document.getElementById('edit-margin').value) || 0,
    widthType: document.getElementById('edit-width-type').value,
    widthPx: parseInt(document.getElementById('edit-width').value) || 1200,
    enabled: document.getElementById('edit-enabled').checked
  };

  chrome.storage.local.get([`layout_${currentHost}`], (result) => {
    let rules = result[`layout_${currentHost}`] || [];
    if (!Array.isArray(rules)) rules = [rules];

    rules[index] = updatedRule;

    chrome.storage.local.set({ [`layout_${currentHost}`]: rules }, () => {
      document.getElementById('edit-form').classList.add('hidden');
      document.getElementById('rules-list').style.display = 'block';
      document.getElementById('clear-all-btn').style.display = 'block';
      loadRules();
    });
  });
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
  document.getElementById('edit-form').classList.add('hidden');
  document.getElementById('rules-list').style.display = 'block';
  document.getElementById('clear-all-btn').style.display = 'block';
});

// Кнопка полной очистки
document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (confirm('Удалить ВСЕ сохраненные правила для этого сайта?')) {
    chrome.storage.local.remove([`layout_${currentHost}`], () => {
      loadRules();
    });
  }
});

initHost();