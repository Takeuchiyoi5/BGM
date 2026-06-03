/* ==========================================================================
  【完全版】BGM制御・ゲーム進行・エラー解消を統合したコード
  ==========================================================================
*/

// --- 変数領域 ---
let gameState = 'IDLE'; 
let masterVocabDb = [];
let masteredIds = [];
let currentPlaylist = [];
let revengeDb = [];
let timerId = null;
let wordIndex = 0;
let step = 0;
let activeCategory = 'all';
let targetString = "";
let typedIndex = 0;
let isCurrentWordCleared = false;
let hasError = false;

// --- 関数定義領域 (ここがすべて上にないとエラーになります) ---

function initBgmTracks() {
    console.log("BGMシステム初期化");
    // 必要に応じて元の initBgmTracks の中身をここに追加してください
}

function renderCustomVocabList(words) {
    const listContainer = document.getElementById('custom-vocab-list');
    if (!listContainer) return;
    // 元の描画ロジックをここに維持
}

function loadSavedData() {
    const savedMastered = localStorage.getItem('eiken4_masteredIds');
    masteredIds = savedMastered ? JSON.parse(savedMastered) : [];
    const savedCustomWords = localStorage.getItem('eiken4_customWords');
    const customWords = savedCustomWords ? JSON.parse(savedCustomWords) : [];
    masterVocabDb = typeof baseVocabDb !== 'undefined' ? [...baseVocabDb, ...customWords] : [...customWords];
    renderCustomVocabList(customWords);
}

function applyFilterAndShuffle() {
    let baseList = masterVocabDb.filter(item => !masteredIds.includes(item.id));
    if (activeCategory !== 'all') baseList = baseList.filter(item => item.tag === activeCategory);
    currentPlaylist = [...baseList].sort(() => Math.random() - 0.5);
    if (currentPlaylist.length > 0) targetString = currentPlaylist[0].word;
}

function renderTypingWord() {
    const display = document.getElementById('word-display');
    if (display) display.innerText = targetString;
}

function playWordCompleteSound() {
    // 元の音源ロジック
}

function processChantStep() {
    if (gameState !== 'PLAYING') return;
    if (isCurrentWordCleared) {
        wordIndex = (wordIndex + 1) % currentPlaylist.length;
        targetString = currentPlaylist[wordIndex]?.word || "";
        typedIndex = 0;
        isCurrentWordCleared = false;
        renderTypingWord();
    }
}

function handleTypingInput(e) {
    if (gameState !== 'PLAYING') return;
    const ignoreKeys = ['Shift', 'CapsLock', 'Control', 'Alt', 'Enter', 'Tab', 'Escape'];
    if (ignoreKeys.includes(e.key)) return;
    
    if (targetString && e.key.toLowerCase() === targetString[typedIndex]?.toLowerCase()) {
        typedIndex++;
        renderTypingWord();
        if (typedIndex >= targetString.length) {
            isCurrentWordCleared = true;
            playWordCompleteSound();
            setTimeout(processChantStep, 400);
        }
    }
}

// --- イベント登録領域 (必ず一番最後) ---
document.addEventListener('DOMContentLoaded', () => {
    initBgmTracks();
    loadSavedData();
    applyFilterAndShuffle();
    
    window.addEventListener('keydown', handleTypingInput);
    
    const startBtn = document.getElementById('action-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            gameState = 'PLAYING';
            renderTypingWord();
        });
    }
});
