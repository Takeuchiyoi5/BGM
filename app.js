/* ==========================================================================
  【ファイル役割】
  タイピングゲームの進行、タイマー、およびカテゴリごとのBGM切り替えを完全に制御します。
  ==========================================================================
*/

const beatInterval = 2000; 

let masterVocabDb = [];
let masteredIds = [];
let currentPlaylist = [];
let revengeDb = []; 

let isPlaying = false;
let isShuffleOn = false;
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

let countdownTimerId = null;
let totalSecondsLeft = 0;

let audioCtx = null;

// --- 🎵 BGMシステム：5つのゲーム（カテゴリ）ごとの選曲マップ ---
let currentAudioEl = null;
let allModeTrackIndex = 0;
let allModeTimerId = null;

// HTML側の<audio>要素を取得
const bgTracks = {
    how: document.getElementById('bg-track-how'),     // How特訓：キラキラアイドル.mp3
    verbs: document.getElementById('bg-track-verbs'), // 4級/3級動詞：Pop_swing.mp3
    adj: document.getElementById('bg-track-adj'),     // 4級/3級形容詞：Snack_time.mp3
    noun: document.getElementById('bg-track-noun'),   // 4級/3級名詞：かわいいきみ。.mp3
    idiom: document.getElementById('bg-track-idiom')  // 3級熟語・その他すべて：わた雲を食べて.mp3
};

// 全て（ALL）モードの時のローテーション順序
const allModePlaylist = [
    bgTracks.how, 
    bgTracks.verbs, 
    bgTracks.adj, 
    bgTracks.noun, 
    bgTracks.idiom
];

const volumeSlider = document.getElementById('volume');
const wordDisplay = document.getElementById('word-display');
const meaningDisplay = document.getElementById('meaning-display');
const actionBtn = document.getElementById('action-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const scoreVal = document.getElementById('score-val');
const comboVal = document.getElementById('combo-val');
const comboPopup = document.getElementById('combo-popup');
const timerSetupPanel = document.getElementById('timer-setup-panel');
const timeLeftDisplay = document.getElementById('time-left-display');
const durationSelect = document.getElementById('game-duration-select');
const revengeTabBtn = document.getElementById('revenge-tab-btn');

// カテゴリ名から流すべきBGM要素を1対1で特定する関数
function getTrackForCategory(category) {
    if (category === 'how') return bgTracks.how;
    if (category === 'verbs' || category === 'verbs3') return bgTracks.verbs;
    if (category === 'adj' || category === 'adj3') return bgTracks.adj;
    if (category === 'noun' || category === 'noun3') return bgTracks.noun;
    return bgTracks.idiom; // prep, custom, revenge, idiom3 はすべてこれ
}

// 🎵 滑らかなクロスフェード（確実に前の曲を消し、新しい曲を再生）
function fadeTransitionTo(newTrack) {
    if (!newTrack) return;
    const targetVol = parseFloat(volumeSlider.value);
    const fadeDuration = 1000; // 1秒でクロスフェード
    const steps = 10;
    const interval = fadeDuration / steps;

    // 現在流れている曲があり、それが新しい曲と違う場合はフェードアウト
    if (currentAudioEl && currentAudioEl !== newTrack) {
        let oldTrack = currentAudioEl;
        let outStep = 0;
        let fadeOutId = setInterval(() => {
            outStep++;
            let ratio = 1 - (outStep / steps);
            oldTrack.volume = Math.max(0, targetVol * ratio);
            if (outStep >= steps) {
                clearInterval(fadeOutId);
                oldTrack.pause();
                oldTrack.currentTime = 0;
            }
        }, interval);
    }

    // 新しい曲を現在のトラックに指定
    currentAudioEl = newTrack;
    
    // ゲームプレイ中の場合のみ音量をゼロからフェードインさせて再生
    if (isPlaying) {
        currentAudioEl.volume = 0;
        // 途中で切り替わった場合も考慮し、既に対象の曲が流れていなければ最初から再生
        if (currentAudioEl.paused) {
            currentAudioEl.currentTime = 0;
            currentAudioEl.play().catch(e => console.log("BGM再生がブラウザにブロックされました（キー操作で解除されます）"));
        }

        let inStep = 0;
        let fadeInId = setInterval(() => {
            inStep++;
            let ratio = inStep / steps;
            if (currentAudioEl === newTrack) {
                currentAudioEl.volume = targetVol * ratio;
            }
            if (inStep >= steps) {
                clearInterval(fadeInId);
            }
        }, interval);
    }
}

// 🔄 「全て」モード専用：120秒ごとに5曲を自動でスイッチするループ
function startAllModeBgmCycle() {
    if (allModeTimerId) clearInterval(allModeTimerId);
    allModeTrackIndex = 0;
    fadeTransitionTo(allModePlaylist[allModeTrackIndex]);

    allModeTimerId = setInterval(() => {
        if (!isPlaying) return;
        allModeTrackIndex = (allModeTrackIndex + 1) % allModePlaylist.length;
        fadeTransitionTo(allModePlaylist[allModeTrackIndex]);
    }, 120000);
}

function stopAllBgm() {
    if (allModeTimerId) clearInterval(allModeTimerId);
    Object.values(bgTracks).forEach(track => {
        if(track) {
            track.pause();
            track.currentTime = 0;
            track.volume = 0;
        }
    });
    currentAudioEl = null;
}

// 音量スライダー変更時のリアルタイム反映
volumeSlider.addEventListener('input', () => {
    if (currentAudioEl) currentAudioEl.volume = parseFloat(volumeSlider.value);
});
// --- 🎵 BGMシステムここまで ---

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playKeySuccessSound() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playWordCompleteSound() {
    if (!audioCtx) return;
    let now = audioCtx.currentTime;
    const tones = [523.25, 659.25, 783.99, 1046.50]; 
    tones.forEach((freq, idx) => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + (idx * 0.06));
        gain.gain.setValueAtTime(0.15, now + (idx * 0.06));
        gain.gain.exponentialRampToValueAtTime(0.01, now + (idx * 0.06) + 0.2);
        osc.start(now + (idx * 0.06));
        osc.stop(now + (idx * 0.06) + 0.25);
    });
}

function playRevengeClearSound() {
    if (!audioCtx) return;
    let now = audioCtx.currentTime;
    const tones = [587.33, 698.46, 880.00, 1174.66]; 
    tones.forEach((freq, idx) => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now + (idx * 0.05));
        gain.gain.setValueAtTime(0.1, now + (idx * 0.05));
        gain.gain.exponentialRampToValueAtTime(0.01, now + (idx * 0.05) + 0.3);
        osc.start(now + (idx * 0.05));
        osc.stop(now + (idx * 0.05) + 0.35);
    });
}

function loadSavedData() {
    const savedMastered = localStorage.getItem('eiken4_masteredIds');
    masteredIds = savedMastered ? JSON.parse(savedMastered) : [];
    const savedCustomWords = localStorage.getItem('eiken4_customWords');
    const customWords = savedCustomWords ? JSON.parse(savedCustomWords) : [];
    masterVocabDb = typeof baseVocabDb !== 'undefined' ? [...baseVocabDb, ...customWords] : [...customWords];
}

function saveProgress() {
    localStorage.setItem('eiken4_masteredIds', JSON.stringify(masteredIds));
}

function resetLocalStorage() {
    if(confirm("【警告】保存されたすべての進捗をリセットしますか？")) {
        localStorage.removeItem('eiken4_masteredIds');
        localStorage.removeItem('eiken4_customWords');
        location.reload();
    }
}

function applyFilterAndShuffle() {
    if (activeCategory === 'revenge') {
        currentPlaylist = [...revengeDb];
        return;
    }

    let baseList = masterVocabDb.filter(item => !masteredIds.includes(item.id));
    if (activeCategory !== 'all') {
        baseList = baseList.filter(item => item.tag === activeCategory);
    }
    currentPlaylist = [...baseList];

    if (isShuffleOn) {
        for (let i = currentPlaylist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentPlaylist[i], currentPlaylist[j]] = [currentPlaylist[j], currentPlaylist[i]];
        }
    }
}

// 🌟 カテゴリメニューボタンが押された時の処理（再生中なら即座にBGMを切り替える）
function switchCategory(categoryTag, element) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    activeCategory = categoryTag;
    
    applyFilterAndShuffle();
    wordIndex = 0;
    step = 0;
    
    if(categoryTag === 'revenge') {
        wordDisplay.innerHTML = "🎯 REVENGE!";
        meaningDisplay.innerText = `にがてな単語が ${currentPlaylist.length} 問たまっているよ！`;
    } else {
        wordDisplay.innerHTML = "Ready?";
        meaningDisplay.innerText = `Loaded ${currentPlaylist.length} items`;
    }

    // 🌟 プレイ中にカテゴリボタンが押された場合、即座に対応するBGMへ変更
    if (isPlaying) {
        if (activeCategory === 'all') {
            startAllModeBgmCycle();
        } else {
            if (allModeTimerId) clearInterval(allModeTimerId); // ALLモードのタイマーを解除
            fadeTransitionTo(getTrackForCategory(activeCategory));
        }
        // 音声読み上げやテンポラリタイマーをリセットして次のステップへ
        resetBeatTimer();
        processChantStep();
    }
}

function toggleShuffle() {
    isShuffleOn = !isShuffleOn;
    shuffleBtn.innerText = isShuffleOn ? "🔀 シャッフル：ON" : "🔀 シャッフル：OFF";
    shuffleBtn.classList.toggle('active', isShuffleOn);
    
    applyFilterAndShuffle();
    wordIndex = 0;
    step = 0;
    if (isPlaying) {
        resetBeatTimer();
        processChantStep();
    }
}

function markAsMastered() {
    if (currentPlaylist.length === 0) return;
    const currentItem = currentPlaylist[wordIndex];
    
    revengeDb = revengeDb.filter(item => item.id !== currentItem.id);
    if(revengeDb.length === 0) revengeTabBtn.style.display = 'none';

    masteredIds.push(currentItem.id); 
    saveProgress(); 
    alert(`「${currentItem.word}」を覚えたリストに登録しました！`);
    
    applyFilterAndShuffle();
    wordIndex = 0;
    step = 0;
    wordDisplay.innerHTML = "Saved!";
    if (isPlaying && currentPlaylist.length > 0) {
        resetBeatTimer();
        processChantStep();
    }
}

function addCustomWord() {
    const wordInput = document.getElementById('custom-word');
    const meaningInput = document.getElementById('custom-meaning');
    if (!wordInput.value.trim() || !meaningInput.value.trim()) return;

    const newEntry = {
        id: Date.now(), 
        word: wordInput.value.trim().toLowerCase(), 
        meaning: meaningInput.value.trim(),
        tag: "custom"
    };

    const savedCustomWords = localStorage.getItem('eiken4_customWords');
    const customList = savedCustomWords ? JSON.parse(savedCustomWords) : [];
    customList.push(newEntry);
    localStorage.setItem('eiken4_customWords', JSON.stringify(customList));
    
    wordInput.value = '';
    meaningInput.value = '';
    loadSavedData(); 
    if (activeCategory === 'custom' || activeCategory === 'all') applyFilterAndShuffle();
}

function toggleApp() {
    if (isPlaying) { stopLoop(); } else { startLoop(); }
}

function startCountdown() {
    timerSetupPanel.style.display = 'none'; 
    timeLeftDisplay.style.display = 'block'; 
    
    let minutes = parseInt(durationSelect.value);
    totalSecondsLeft = minutes * 60;
    updateTimerText();

    if (countdownTimerId) clearInterval(countdownTimerId);
    countdownTimerId = setInterval(() => {
        totalSecondsLeft--;
        updateTimerText();

        if (totalSecondsLeft <= 0) {
            clearInterval(countdownTimerId);
            endGameByTimeout(); 
        }
    }, 1000);
}

function updateTimerText() {
    let m = Math.floor(totalSecondsLeft / 60);
    let s = totalSecondsLeft % 60;
    timeLeftDisplay.innerText = `⏱️ 残り時間: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function endGameByTimeout() {
    stopLoop();
    timerSetupPanel.style.display = 'flex';
    timeLeftDisplay.style.display = 'none';

    wordDisplay.innerHTML = "<span style='color:var(--accent); font-size:2rem;'>Time Up! タイムアップ！</span>";
    meaningDisplay.innerText = `今日のれんしゅう終了！よくがんばったね💖 (Score: ${gameScore})`;
    
    if (revengeDb.length > 0) {
        alert(`にがてな単語が ${revengeDb.length} 問たまっているよ！「リベンジモード」ボタンを押して再挑戦してみてね！`);
        revengeTabBtn.style.display = 'block'; 
    } else {
        alert("全問大正解！すごいや！");
    }
}

function startLoop() {
    if (currentPlaylist.length === 0) {
        alert("カードがありません！");
        return;
    }
    initAudioContext(); 
    isPlaying = true;
    actionBtn.innerText = "STOP GAME";
    actionBtn.classList.add('playing');
    
    // 🌟 ゲーム開始時のBGM選定と再生開始
    if (activeCategory === 'all') {
        startAllModeBgmCycle();
    } else {
        fadeTransitionTo(getTrackForCategory(activeCategory));
    }
    
    step = 0;
    gameScore = 0;
    gameCombo = 0;
    scoreVal.innerText = gameScore;
    comboVal.innerText = gameCombo;
    
    window.removeEventListener('keydown', handleTypingInput); // 重複防止
    window.addEventListener('keydown', handleTypingInput);
    
    startCountdown(); 
    resetBeatTimer();
    processChantStep();
}

function stopLoop() {
    isPlaying = false;
    actionBtn.innerText = "START GAME";
    actionBtn.classList.remove('playing');
    
    stopAllBgm();
    
    if (timerId) clearInterval(timerId);
    if (countdownTimerId) clearInterval(countdownTimerId);
    
    timerSetupPanel.style.display = 'flex';
    timeLeftDisplay.style.display = 'none';

    window.removeEventListener('keydown', handleTypingInput);
    window.speechSynthesis.cancel(); 
    wordDisplay.innerHTML = "Ready?";
    meaningDisplay.innerText = "Press Start";
}

function resetBeatTimer() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(processChantStep, beatInterval);
}

function renderTypingWord() {
    let htmlStr = "";
    for (let i = 0; i < targetString.length; i++) {
        if (i < typedIndex) {
            htmlStr += `<span class="char-correct">${targetString[i]}</span>`;
        } else if (i === typedIndex) {
            let cls = hasError ? "char-error" : "char-current";
            if (targetString[i] === ' ' || targetString[i] === '→') {
                htmlStr += `<span class="${cls}" style="display: inline-block; min-width: 14px; border-bottom: 3px solid currentColor;">${targetString[i]}</span>`;
            } else {
                htmlStr += `<span class="${cls}">${targetString[i]}</span>`;
            }
        } else {
            htmlStr += `<span class="char-remaining">${targetString[i]}</span>`;
        }
    }
    wordDisplay.innerHTML = htmlStr;
}

function checkAndSkipNonAlpha() {
    if (currentPlaylist.length === 0 || wordIndex >= currentPlaylist.length) return;
    const currentItem = currentPlaylist[wordIndex];
    let skippable = ['→', '.', '?', '-'];
    
    if (activeCategory !== 'how' && (!currentItem || currentItem.tag !== 'how')) {
        skippable.push(' ');
    }

    if (typedIndex < targetString.length && skippable.includes(targetString[typedIndex])) {
        typedIndex++;
        checkAndSkipNonAlpha(); 
    }
}

function triggerComboPopup(comboCount) {
    comboPopup.innerText = `🔥 ${comboCount}問連続正解！`;
    comboPopup.classList.remove('pop-animate');
    void comboPopup.offsetWidth; 
    comboPopup.classList.add('pop-animate');
}

function processChantStep() {
    if (currentPlaylist.length === 0) { 
        if(activeCategory === 'revenge') {
            playRevengeClearSound();
            alert("すごいや！にがてな単語をすべてリベンジしたよ！完全クリア！");
            revengeDb = [];
            revengeTabBtn.style.display = 'none';
            switchCategory('all', document.querySelector('.nav-btn'));
        } else {
            stopLoop(); 
        }
        return; 
    }
    const currentVocab = currentPlaylist[wordIndex];

    switch(step) {
        case 0: 
            targetString = currentVocab.word;
            typedIndex = 0;
            isCurrentWordCleared = false;
            hasError = false; 
            
            checkAndSkipNonAlpha();
            renderTypingWord();
            meaningDisplay.innerText = "---";
            speak(cleanTextForTTS(currentVocab.word), 'en-US');
            step = 1;
            break;
        case 1: 
            meaningDisplay.innerText = currentVocab.meaning;
            speak(currentVocab.meaning, 'ja-JP');
            step = 2;
            break;
        case 2: 
            speak(cleanTextForTTS(currentVocab.word), 'en-US');
            step = 3;
            break;
        case 3: 
            if (isCurrentWordCleared) {
                gameScore += 10 + Math.floor(gameCombo / 5);
                gameCombo += 1;
                
                if (gameCombo > 0 && gameCombo % 5 === 0) {
                    triggerComboPopup(gameCombo);
                }

                if (activeCategory === 'revenge') {
                    revengeDb = revengeDb.filter(item => item.id !== currentVocab.id);
                }
            } else {
                gameCombo = 0;
                if (!revengeDb.some(item => item.id === currentVocab.id)) {
                    revengeDb.push(currentVocab);
                }
            }
            scoreVal.innerText = gameScore;
            comboVal.innerText = gameCombo;

            wordDisplay.innerHTML = "<span style='color: var(--shuffle-color)'>• • •</span>";
            meaningDisplay.innerText = "";
            
            if (activeCategory === 'revenge' && isCurrentWordCleared) {
                applyFilterAndShuffle();
                if(wordIndex >= currentPlaylist.length) wordIndex = 0;
            } else {
                wordIndex = (wordIndex + 1) % currentPlaylist.length;
            }

            step = 0;
            break;
    }
}

function handleTypingInput(e) {
    if (e.key === ' ') {
        e.preventDefault();
    }

    if (targetString === "" || isCurrentWordCleared) return; 
    
    let key = e.key;
    checkAndSkipNonAlpha();
    
    if (typedIndex < targetString.length) {
        if (key.toLowerCase() === targetString[typedIndex].toLowerCase() || 
            (targetString[typedIndex] === ' ' && key === ' ')) {
            
            typedIndex++;
            hasError = false; 
            
            checkAndSkipNonAlpha(); 
            renderTypingWord();

            if (step >= 1) {
                resetBeatTimer(); 
            }

            if (typedIndex >= targetString.length) {
                isCurrentWordCleared = true;
                playWordCompleteSound(); 
            } else {
                playKeySuccessSound();   
            }
        } 
        else if (key !== "Shift" && key !== "CapsLock" && key !== "Control" && key !== "Alt") {
            hasError = true; 
            renderTypingWord(); 
        }
    }
}

function cleanTextForTTS(rawText) {
    return rawText.replace('→', ' changed to ').replace('...', '');
}

function speak(text, lang) {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0; 
    window.speechSynthesis.speak(utterance);
}

loadSavedData();
applyFilterAndShuffle();
