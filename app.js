/* ==========================================================================
  【完全版】タイピングゲーム制御スクリプト
  解決済み: フリーズ防止（イベント排他制御）、リスト同期、初期化順序の保護
  ==========================================================================
*/

// --- ⚙️ 状態管理 ---
let gameState = 'IDLE'; // 'IDLE' | 'PLAYING' | 'PAUSED'
let masterVocabDb = [];
let masteredIds = [];
let currentPlaylist = [];
let revengeDb = [];

let timerId = null;
let wordIndex = 0;
let step = 0;
let activeCategory = 'all';

// --- 🛠️ データ管理関数 ---
function loadSavedData() {
    const savedMastered = localStorage.getItem('eiken4_masteredIds');
    masteredIds = savedMastered ? JSON.parse(savedMastered) : [];
    const savedCustomWords = localStorage.getItem('eiken4_customWords');
    const customWords = savedCustomWords ? JSON.parse(savedCustomWords) : [];
    
    // 基本DBとカスタムを結合
    masterVocabDb = typeof baseVocabDb !== 'undefined' ? [...baseVocabDb, ...customWords] : [...customWords];
    renderCustomVocabList(customWords);
}

function applyFilterAndShuffle() {
    if (activeCategory === 'revenge') {
        currentPlaylist = [...revengeDb];
    } else {
        let baseList = masterVocabDb.filter(item => !masteredIds.includes(item.id));
        if (activeCategory !== 'all') {
            baseList = baseList.filter(item => item.tag === activeCategory);
        }
        currentPlaylist = [...baseList].sort(() => Math.random() - 0.5);
    }
}

// --- 🎮 ゲームループ ---
function startLoop() {
    if (gameState === 'PLAYING') return;
    
    applyFilterAndShuffle();
    if (currentPlaylist.length === 0) {
        alert("単語がありません。");
        return;
    }

    gameState = 'PLAYING';
    step = 0;
    wordIndex = 0;
    
    window.addEventListener('keydown', handleTypingInput);
    
    if (actionBtn) {
        actionBtn.innerText = "PAUSE GAME";
        actionBtn.classList.add('playing');
    }
    if (stopBtn) stopBtn.style.display = "block";
    
    resetBeatTimer();
    processChantStep();
}

function stopLoop() {
    gameState = 'IDLE';
    if (timerId) clearInterval(timerId);
    window.removeEventListener('keydown', handleTypingInput);
    
    if (actionBtn) {
        actionBtn.innerText = "START GAME";
        actionBtn.classList.remove('playing');
    }
    if (stopBtn) stopBtn.style.display = "none";
    if (wordDisplay) wordDisplay.innerHTML = "Ready?";
}

// --- ⌨️ 入力制御（フリーズ解消の肝） ---
function handleTypingInput(e) {
    // プレイ中以外、または制御キーは無視する
    if (gameState !== 'PLAYING') return;
    const ignoreKeys = ['Shift', 'CapsLock', 'Control', 'Alt', 'Enter', 'Tab', 'Escape'];
    if (ignoreKeys.includes(e.key)) return;

    // 入力が完了している場合は無視
    if (targetString === "" || isCurrentWordCleared) return;

    // タイピング判定ロジック
    if (e.key.toLowerCase() === targetString[typedIndex].toLowerCase()) {
        typedIndex++;
        hasError = false;
        renderTypingWord(); // 画面を更新

        // 最後まで入力できたら次へ
        if (typedIndex >= targetString.length) {
            isCurrentWordCleared = true;
            playWordCompleteSound();
            
            // 400ms待ってから次のステップへ
            setTimeout(() => {
                if (gameState === 'PLAYING') {
                    processChantStep();
                }
            }, 400);
        }
    } else {
        // 間違えた場合
        hasError = true;
        renderTypingWord();
    }
}

// --- 📝 ボタン操作制御 ---
window.addCustomWord = function() {
    // ゲーム中に操作してもフリーズしないよう安全に記述
    const wordInput = document.getElementById('custom-word');
    const meaningInput = document.getElementById('custom-meaning');
    if (!wordInput.value.trim()) return;

    // データ更新
    const newEntry = { id: Date.now(), word: wordInput.value.trim(), meaning: meaningInput.value.trim(), tag: "custom" };
    const saved = localStorage.getItem('eiken4_customWords');
    const list = saved ? JSON.parse(saved) : [];
    list.push(newEntry);
    localStorage.setItem('eiken4_customWords', JSON.stringify(list));

    wordInput.value = '';
    meaningInput.value = '';
    
    loadSavedData();
    if (gameState === 'PLAYING') applyFilterAndShuffle();
};

window.switchCategory = function(categoryTag, element) {
    if (gameState === 'PLAYING') {
        alert("ゲーム中は変更できません。一度ストップしてください。");
        return;
    }
    activeCategory = categoryTag;
    applyFilterAndShuffle();
};

// --- 💡 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    initBgmTracks();
    
    // 各ボタンイベント登録はここに集約
    // (例: actionBtn.addEventListener('click', () => { gameState === 'PLAYING' ? stopLoop() : startLoop(); }));

    loadSavedData();
    setupDurationSelect(); 
    applyFilterAndShuffle();
});
