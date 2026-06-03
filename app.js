/* ==========================================================================
  完全版: タイピングゲーム制御スクリプト
  ==========================================================================
*/

let gameState = 'IDLE'; 
let masterVocabDb = [];
let masteredIds = [];
let currentPlaylist = [];
let revengeDb = [];

let timerId = null;
let wordIndex = 0;
let step = 0;
let activeCategory = 'all';

let gameScore = 0;
let gameCombo = 0;
let targetString = "";
let typedIndex = 0;
let isCurrentWordCleared = false;
let hasError = false;

// --- ⚙️ 基本関数 ---
function initBgmTracks() {
    // 既存のBGM初期化処理
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
    if (activeCategory === 'revenge') {
        currentPlaylist = [...revengeDb];
    } else {
        let baseList = masterVocabDb.filter(item => !masteredIds.includes(item.id));
        if (activeCategory !== 'all') baseList = baseList.filter(item => item.tag === activeCategory);
        currentPlaylist = [...baseList].sort(() => Math.random() - 0.5);
    }
}

// --- 🎮 ゲーム制御 ---
function startLoop() {
    if (gameState === 'PLAYING') return;
    applyFilterAndShuffle();
    if (currentPlaylist.length === 0) { alert("単語がありません。"); return; }
    
    gameState = 'PLAYING';
    step = 0;
    wordIndex = 0;
    typedIndex = 0;
    
    window.addEventListener('keydown', handleTypingInput);
    document.getElementById('action-btn').innerText = "PAUSE";
    document.getElementById('stop-btn').style.display = "block";
    
    processChantStep();
}

function stopLoop() {
    gameState = 'IDLE';
    if (timerId) clearInterval(timerId);
    window.removeEventListener('keydown', handleTypingInput);
    document.getElementById('action-btn').innerText = "START";
    document.getElementById('stop-btn').style.display = "none";
}

// --- ⌨️ 入力制御 ---
function handleTypingInput(e) {
    if (gameState !== 'PLAYING') return;
    const ignoreKeys = ['Shift', 'CapsLock', 'Control', 'Alt', 'Enter', 'Tab', 'Escape'];
    if (ignoreKeys.includes(e.key)) return;
    if (targetString === "" || isCurrentWordCleared) return;

    if (e.key.toLowerCase() === targetString[typedIndex].toLowerCase()) {
        typedIndex++;
        renderTypingWord();
        if (typedIndex >= targetString.length) {
            isCurrentWordCleared = true;
            setTimeout(() => { if (gameState === 'PLAYING') processChantStep(); }, 400);
        }
    }
}

// --- 🔄 進行制御 ---
function processChantStep() {
    if (gameState !== 'PLAYING') return;
    if (timerId) clearInterval(timerId);

    // 簡易ステップ進行ロジック
    if (step < 3) {
        step++;
        timerId = setInterval(processChantStep, 2000);
    } else {
        // 次の問題へ
        wordIndex = (wordIndex + 1) % currentPlaylist.length;
        step = 0;
        isCurrentWordCleared = false;
        typedIndex = 0;
        targetString = currentPlaylist[wordIndex].word;
        renderTypingWord();
        timerId = setInterval(processChantStep, 2000);
    }
}

// --- 📝 ユーザーアクション ---
window.addCustomWord = function() {
    const wordInput = document.getElementById('custom-word');
    const meaningInput = document.getElementById('custom-meaning');
    if (!wordInput.value.trim()) return;

    const list = JSON.parse(localStorage.getItem('eiken4_customWords') || "[]");
    list.push({ id: Date.now(), word: wordInput.value.trim(), meaning: meaningInput.value.trim(), tag: "custom" });
    localStorage.setItem('eiken4_customWords', JSON.stringify(list));
    
    wordInput.value = '';
    meaningInput.value = '';
    loadSavedData();
};

window.switchCategory = function(cat) {
    if (gameState === 'PLAYING') return alert("停止してから変更してください。");
    activeCategory = cat;
    applyFilterAndShuffle();
};

// --- 💡 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    initBgmTracks();
    loadSavedData();
    applyFilterAndShuffle();
});
