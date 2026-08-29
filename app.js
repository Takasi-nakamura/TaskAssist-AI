/* ============================================================
   TaskAssist AI — app.js
   ============================================================ */

const STORAGE_KEYS = {
  chats: 'ta_chats_v1',
  settings: 'ta_settings_v1',
};

const MODEL_MAP = {
  'flash-3.7': { label: '3.7Flash', apiModel: 'gemini-3.7-flash' },
  'flash-lite-3.6': { label: '3.6 Flash lite', apiModel: 'gemini-3.6ash-lite' },
};

let state = {
  chats: [],
  activeChatId: null,
  settings: {
    apiKey: '',
    defaultModel: 'flash-3.7',
    webSearchEnabled: true,
    theme: 'dark',
  },
  pendingAttachments: [], // {name, type, size, dataUrl}
  currentModel: 'flash-3.7',
  openMenuChatId: null,
  chatToDelete: null,
};

/* ---------------- persistence ---------------- */
function loadState() {
  try {
    const chats = JSON.parse(localStorage.getItem(STORAGE_KEYS.chats) || '[]');
    state.chats = chats;
  } catch { state.chats = []; }
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
    state.settings = { ...state.settings, ...s };
  } catch {}
  state.currentModel = state.settings.defaultModel || 'flash-3.7';
  if (state.chats.length) state.activeChatId = state.chats[0].id;
}

function saveChats() {
  localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(state.chats));
}
function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

/* ---------------- utils ---------------- */
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function activeChat() {
  return state.chats.find(c => c.id === state.activeChatId) || null;
}

/* ---------------- theme ---------------- */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
}

/* ---------------- rendering: sidebar ---------------- */
const chatListEl = document.getElementById('chatList');

function renderChatList() {
  chatListEl.innerHTML = '';
  state.chats
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item' + (chat.id === state.activeChatId ? ' active' : '');
      item.dataset.id = chat.id;

      const title = document.createElement('div');
      title.className = 'chat-item-title';
      title.textContent = chat.title || '無題のチャット';
      title.addEventListener('click', () => {
        if (item.querySelector('input')) return;
        state.activeChatId = chat.id;
        renderChatList();
        renderMessages();
        closeSidebarOnMobile();
      });

      const menuBtn = document.createElement('button');
      menuBtn.className = 'chat-item-menu-btn';
      menuBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/></svg>';
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.openMenuChatId = state.openMenuChatId === chat.id ? null : chat.id;
        renderChatList();
      });

      item.appendChild(title);
      item.appendChild(menuBtn);

      if (state.openMenuChatId === chat.id) {
        menuBtn.classList.add('open');
        const pop = document.createElement('div');
        pop.className = 'chat-item-popover';
        pop.innerHTML = `
          <button data-act="rename"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>名前を変更</button>
          <button data-act="delete" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>削除</button>
        `;
        pop.querySelector('[data-act="rename"]').addEventListener('click', (e) => {
          e.stopPropagation();
          state.openMenuChatId = null;
          startRename(chat.id, item, title);
        });
        pop.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
          e.stopPropagation();
          state.openMenuChatId = null;
          state.chatToDelete = chat.id;
          renderChatList();
          document.getElementById('confirmOverlay').classList.add('open');
        });
        item.appendChild(pop);
      }

      chatListEl.appendChild(item);
    });
}

function startRename(chatId, itemEl, titleEl) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  titleEl.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = chat.title || '';
  titleEl.appendChild(input);
  input.focus();
  input.select();
  const commit = () => {
    const v = input.value.trim();
    chat.title = v || chat.title || '無題のチャット';
    saveChats();
    renderChatList();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') renderChatList();
  });
  input.addEventListener('blur', commit);
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.chat-item-menu-btn') && !e.target.closest('.chat-item-popover')) {
    if (state.openMenuChatId) { state.openMenuChatId = null; renderChatList(); }
  }
  if (!e.target.closest('.model-select-wrap')) {
    document.getElementById('modelMenu').classList.remove('open');
  }
});

/* ---------------- new chat ---------------- */
document.getElementById('newChatBtn').addEventListener('click', () => {
  const chat = { id: uid(), title: '新しいチャット', messages: [], updatedAt: Date.now() };
  state.chats.push(chat);
  state.activeChatId = chat.id;
  saveChats();
  renderChatList();
  renderMessages();
  closeSidebarOnMobile();
  document.getElementById('promptInput').focus();
});

/* ---------------- delete confirm ---------------- */
document.getElementById('confirmCancelBtn').addEventListener('click', () => {
  state.chatToDelete = null;
  document.getElementById('confirmOverlay').classList.remove('open');
});
document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (state.chatToDelete) {
    state.chats = state.chats.filter(c => c.id !== state.chatToDelete);
    if (state.activeChatId === state.chatToDelete) {
      state.activeChatId = state.chats[0]?.id || null;
    }
    saveChats();
    renderChatList();
    renderMessages();
  }
  state.chatToDelete = null;
  document.getElementById('confirmOverlay').classList.remove('open');
});

/* ---------------- messages rendering ---------------- */
const messagesInner = document.getElementById('messagesInner');
const messagesEl = document.getElementById('messages');

const EMPTY_STATE_HTML = `
  <div class="empty-state">
    <div class="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 6.5" stroke="#04120e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <h1>何を調べますか?</h1>
    <p>商品名やテーマを入力すると、広域Web検索で最安値・特徴・マニアック情報をまとめ、ファイルに出力します。</p>
    <div class="suggestion-grid">
      <button class="suggestion-card" data-fill="このワイヤレスイヤホンの最安値と実機レビューのマニアックな情報をまとめて"><b>最安値リサーチ</b>型番から価格を横断比較</button>
      <button class="suggestion-card" data-fill="このゲーミングモニターの特徴とスペック比較表を作って"><b>スペック比較</b>複数製品の違いを整理</button>
      <button class="suggestion-card" data-fill="この製品の口コミに出てくるマニアックな不具合情報を集めて"><b>マニアック情報収集</b>知恵袋・レビューを横断調査</button>
      <button class="suggestion-card" data-fill="来週の出張の持ち物リストと注意点をまとめて"><b>タスク整理</b>チェックリストを作成</button>
    </div>
  </div>
`;

function renderMessages() {
  const chat = activeChat();
  messagesInner.innerHTML = '';
  updatePreviewBar();

  if (!chat || chat.messages.length === 0) {
    messagesInner.innerHTML = EMPTY_STATE_HTML;
    messagesInner.querySelectorAll('.suggestion-card').forEach(btn => {
      btn.addEventListener('click', () => {
        ensureChat();
        document.getElementById('promptInput').value = btn.dataset.fill;
        autoGrow(document.getElementById('promptInput'));
        document.getElementById('promptInput').focus();
      });
    });
    return;
  }

  chat.messages.forEach(msg => {
    const row = document.createElement('div');
    row.className = 'msg-row ' + msg.role;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = msg.role === 'user'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5L10 17.5L19 6.5" stroke="#04120e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const wrap = document.createElement('div');
    wrap.className = 'msg-bubble-wrap';

    if (msg.attachments && msg.attachments.length) {
      const atts = document.createElement('div');
      atts.className = 'msg-attachments';
      msg.attachments.forEach(a => {
        const chip = document.createElement('div');
        chip.className = 'msg-attachment-chip';
        chip.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg><span>${escapeHtml(a.name)}</span>`;
        atts.appendChild(chip);
      });
      wrap.appendChild(atts);
    }

    if (msg.pending) {
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
      wrap.appendChild(bubble);
    } else if (msg.text) {
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.textContent = msg.text;
      wrap.appendChild(bubble);

      const actions = document.createElement('div');
      actions.className = 'msg-actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'msg-action-btn';
      copyBtn.title = 'コピー';
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard?.writeText(msg.text);
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
        setTimeout(() => {
          copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>';
        }, 1200);
      });
      actions.appendChild(copyBtn);
      wrap.appendChild(actions);
    }

    if (msg.output) {
      wrap.appendChild(buildOutputCard(msg.output));
    }

    row.appendChild(avatar);
    row.appendChild(wrap);
    messagesInner.appendChild(row);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function buildOutputCard(output) {
  const card = document.createElement('div');
  card.className = 'output-card';
  card.innerHTML = `
    <div class="output-card-head">
      <div class="output-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></div>
      <div style="min-width:0;flex:1;">
        <div class="output-card-title">${escapeHtml(output.name)}</div>
        <div class="output-card-sub">${output.format.toUpperCase()} · ${(output.size/1024).toFixed(1)} KB</div>
      </div>
    </div>
    <div class="output-card-actions">
      <button class="output-action" data-act="preview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>プレビュー</button>
      <button class="output-action" data-act="share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5"/></svg>共有</button>
      <button class="output-action" data-act="download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>DL</button>
    </div>
  `;
  card.querySelector('[data-act="preview"]').addEventListener('click', () => previewOutput(output));
  card.querySelector('[data-act="share"]').addEventListener('click', () => shareOutput(output));
  card.querySelector('[data-act="download"]').addEventListener('click', () => downloadOutput(output));
  return card;
}

/* ---------------- top preview bar ---------------- */
function updatePreviewBar() {
  const chat = activeChat();
  const bar = document.getElementById('previewBar');
  const lastOutput = chat?.messages?.slice().reverse().find(m => m.output)?.output;
  if (lastOutput) {
    bar.classList.add('show');
    document.getElementById('previewBarName').textContent = lastOutput.name;
    document.getElementById('previewBarPreview').onclick = () => previewOutput(lastOutput);
    document.getElementById('previewBarShare').onclick = () => shareOutput(lastOutput);
    document.getElementById('previewBarDownload').onclick = () => downloadOutput(lastOutput);
  } else {
    bar.classList.remove('show');
  }
}

/* ---------------- output actions ---------------- */
function previewOutput(output) {
  window.open(output.url, '_blank');
}
async function shareOutput(output) {
  try {
    const res = await fetch(output.url);
    const blob = await res.blob();
    const file = new File([blob], output.name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: output.name });
      return;
    }
  } catch {}
  // fallback
  const a = document.createElement('a');
  a.href = output.url;
  a.download = output.name;
  a.click();
}
function downloadOutput(output) {
  const a = document.createElement('a');
  a.href = output.url;
  a.download = output.name;
  a.click();
}

/* ---------------- sidebar toggle (mobile) ---------------- */
const sidebarEl = document.getElementById('sidebar');
const scrimEl = document.getElementById('sidebarScrim');
document.getElementById('menuBtn').addEventListener('click', () => {
  sidebarEl.classList.add('open');
  scrimEl.classList.add('show');
});
scrimEl.addEventListener('click', closeSidebarOnMobile);
function closeSidebarOnMobile() {
  sidebarEl.classList.remove('open');
  scrimEl.classList.remove('show');
}

/* ---------------- settings modal ---------------- */
const settingsOverlay = document.getElementById('settingsOverlay');
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('closeSettings').addEventListener('click', () => settingsOverlay.classList.remove('open'));
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) settingsOverlay.classList.remove('open'); });

function openSettings() {
  document.getElementById('apiKeyInput').value = state.settings.apiKey || '';
  document.getElementById('defaultModelSelect').value = state.settings.defaultModel || 'flash-3.7';
  document.getElementById('webSearchToggle').checked = state.settings.webSearchEnabled !== false;
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.theme === state.settings.theme);
  });
  settingsOverlay.classList.add('open');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
  });
});

document.getElementById('revealKeyBtn').addEventListener('click', () => {
  const inp = document.getElementById('apiKeyInput');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

document.querySelectorAll('.theme-option').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    applyTheme(el.dataset.theme); // live preview
  });
});

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  state.settings.apiKey = document.getElementById('apiKeyInput').value.trim();
  state.settings.defaultModel = document.getElementById('defaultModelSelect').value;
  state.settings.webSearchEnabled = document.getElementById('webSearchToggle').checked;
  state.settings.theme = document.querySelector('.theme-option.selected')?.dataset.theme || 'dark';
  saveSettings();
  applyTheme(state.settings.theme);
  state.currentModel = state.settings.defaultModel;
  syncModelSelectUI();
  const toast = document.getElementById('saveToast');
  toast.textContent = '保存しました';
  setTimeout(() => { toast.textContent = ''; }, 1800);
});

/* ---------------- model select (composer) ---------------- */
const modelSelectBtn = document.getElementById('modelSelectBtn');
const modelMenu = document.getElementById('modelMenu');
modelSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  modelMenu.classList.toggle('open');
});
modelMenu.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    state.currentModel = btn.dataset.model;
    syncModelSelectUI();
    modelMenu.classList.remove('open');
  });
});
function syncModelSelectUI() {
  document.getElementById('modelSelectLabel').textContent = MODEL_MAP[state.currentModel].label;
  modelMenu.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.model === state.currentModel));
}

/* ---------------- attachments ---------------- */
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const attachRow = document.getElementById('attachPreviewRow');

attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  for (const file of fileInput.files) {
    const dataUrl = await fileToDataUrl(file);
    state.pendingAttachments.push({ name: file.name, type: file.type, size: file.size, dataUrl });
  }
  fileInput.value = '';
  renderAttachPreview();
});
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function renderAttachPreview() {
  attachRow.innerHTML = '';
  if (state.pendingAttachments.length) attachRow.classList.add('show');
  else attachRow.classList.remove('show');
  state.pendingAttachments.forEach((a, idx) => {
    const item = document.createElement('div');
    item.className = 'attach-preview-item';
    item.innerHTML = `<svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg><span>${escapeHtml(a.name)}</span>`;
    const rm = document.createElement('button');
    rm.className = 'attach-preview-remove';
    rm.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6L18 18M6 18L18 6"/></svg>';
    rm.addEventListener('click', () => { state.pendingAttachments.splice(idx, 1); renderAttachPreview(); });
    item.appendChild(rm);
    attachRow.appendChild(item);
  });
}

/* ---------------- composer / send ---------------- */
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}
promptInput.addEventListener('input', () => autoGrow(promptInput));
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});
sendBtn.addEventListener('click', handleSend);

function ensureChat() {
  if (!activeChat()) {
    const chat = { id: uid(), title: '新しいチャット', messages: [], updatedAt: Date.now() };
    state.chats.push(chat);
    state.activeChatId = chat.id;
    saveChats();
    renderChatList();
  }
}

async function handleSend() {
  const text = promptInput.value.trim();
  if (!text) return;
  ensureChat();
  const chat = activeChat();

  if (chat.messages.length === 0) {
    chat.title = text.slice(0, 24) + (text.length > 24 ? '…' : '');
  }

  const userMsg = { id: uid(), role: 'user', text, attachments: state.pendingAttachments.slice() };
  chat.messages.push(userMsg);
  state.pendingAttachments = [];
  renderAttachPreview();
  promptInput.value = '';
  autoGrow(promptInput);
  chat.updatedAt = Date.now();
  saveChats();
  renderChatList();
  renderMessages();

  const pendingMsg = { id: uid(), role: 'assistant', pending: true };
  chat.messages.push(pendingMsg);
  renderMessages();

  try {
    const resultText = await callGemini(chat, userMsg);
    pendingMsg.pending = false;
    pendingMsg.text = resultText;

    const format = document.getElementById('outputFormat').value;
    const output = await generateOutputFile(chat.title, resultText, format);
    pendingMsg.output = output;

    chat.updatedAt = Date.now();
    saveChats();
    renderMessages();
    renderChatList();

    // 完成した瞬間に自動で開く
    previewOutput(output);
  } catch (err) {
    pendingMsg.pending = false;
    pendingMsg.text = 'エラーが発生しました: ' + (err.message || err);
    saveChats();
    renderMessages();
  }
}

/* ---------------- Gemini API ---------------- */
async function callGemini(chat, userMsg) {
  const apiKey = state.settings.apiKey;
  if (!apiKey) {
    throw new Error('設定 > API タブでGemini APIキーを入力してください。');
  }
  const modelInfo = MODEL_MAP[state.currentModel];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelInfo.apiModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const parts = [{ text:
    `あなたはタスク実行を優先するリサーチアシスタント「TaskAssist AI」です。` +
    `広域なWeb検索を行ったうえで、ユーザーの依頼(最安値・特徴・マニアックな情報など)に対して、` +
    `出典を明記しながら日本語で構造的にまとめてください。\n\nユーザーの依頼: ${userMsg.text}`
  }];

  for (const att of (userMsg.attachments || [])) {
    if (att.dataUrl && att.dataUrl.startsWith('data:')) {
      const [, meta, b64] = att.dataUrl.match(/^data:(.*?);base64,(.*)$/) || [];
      if (b64) parts.push({ inline_data: { mime_type: meta || att.type, data: b64 } });
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
  };
  if (state.settings.webSearchEnabled) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API呼び出しに失敗しました (${res.status}) ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '(応答が空でした)';
  return text;
}

/* ---------------- output file generation ---------------- */
let jsPDFLoaded = false;
function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function generateOutputFile(title, text, format) {
  const safeTitle = (title || 'TaskAssist結果').replace(/[\\/:*?"<>|]/g, '');
  if (format === 'pdf') {
    await loadJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text(safeTitle, 40, 50);
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(text, 515);
    doc.text(lines, 40, 78);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    return { name: `${safeTitle}.pdf`, format: 'pdf', size: blob.size, url };
  } else if (format === 'md') {
    const content = `# ${safeTitle}\n\n${text}\n`;
    const blob = new Blob([content], { type: 'text/markdown' });
    return { name: `${safeTitle}.md`, format: 'md', size: blob.size, url: URL.createObjectURL(blob) };
  } else {
    const blob = new Blob([text], { type: 'text/plain' });
    return { name: `${safeTitle}.txt`, format: 'txt', size: blob.size, url: URL.createObjectURL(blob) };
  }
}

/* ---------------- init ---------------- */
function init() {
  loadState();
  applyTheme(state.settings.theme || 'dark');
  syncModelSelectUI();
  renderChatList();
  renderMessages();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();
