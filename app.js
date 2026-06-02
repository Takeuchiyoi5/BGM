/* ==========================================================================
  【ファイル役割】
  タイピングゲームの進行、タイマー、およびカテゴリごとのBGM切り替えを制御します。
  ★「毎日20個の積み上げ」「1問残りのリベンジバグ」「音声ブツ切り」を修正した完全版。
  ==========================================================================
*/

const beatInterval = 2000; 

let masterVocabDb = [];
let masteredIds = [];
let currentPlaylist = [];
let revengeDb = []; 

let isPlaying = false;
let isPaused = false; 
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
let isInfiniteTime = false; 

let audioCtx = null;

// --- 🎵 BGMシステム ---
let currentAudioEl = null;
let allModeTrackIndex = 0;
let allModeTimerId = null;

let bgTracks = {};

const volumeSlider = document.getElementById('volume');
const wordDisplay = document.getElementById('word-display');
const meaningDisplay = document.getElementById('meaning-display');
const actionBtn = document.getElementById('action-btn');
const stopBtn = document.getElementById('stop-btn'); 
const shuffleBtn = document.getElementById('shuffle-btn');
const scoreVal = document.getElementById('score-val');
const comboVal = document.getElementById('combo-val');
const comboPopup = document.getElementById('combo-popup');
const timerSetupPanel = document.getElementById('timer-setup-panel');
const timeLeftDisplay = document.getElementById('time-left-display');
const durationSelect = document.getElementById('game-duration-select');
const revengeTabBtn = document.getElementById('revenge-tab-btn');

let allModePlaylist = [];

function initBgmTracks() {
    bgTracks = {
        how: document.getElementById('bg-track-how'),     
        verbs: document.getElementById('bg-track-verbs'), 
        adj: document.getElementById('bg-track-adj'),     
        noun: document.getElementById('bg-track-noun'),   
        idiom: document.getElementById('bg-track-idiom')  
    };
    allModePlaylist = [
        bgTracks.how, 
        bgTracks.verbs, 
        bgTracks.adj, 
        bgTracks.noun, 
        bgTracks.idiom
    ].filter(el => el !== null);
}

function getTrackForCategory(category) {
    if (category === 'how') return bgTracks.how;
    if (category === 'verbs' || category === 'verbs3') return bgTracks.verbs;
    if (category === 'adj' || category === 'adj3') return bgTracks.adj;
    if (category === 'noun' || category === 'noun3') return bgTracks.noun;
    return bgTracks.idiom; 
}

function fadeTransitionTo(newTrack) {
    if (!newTrack) return;
    const targetVol = volumeSlider ? parseFloat(volumeSlider.value) : 0.2;
    const fadeDuration = 1000; 
    const steps = 10;
    const interval = fadeDuration / steps;

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

    currentAudioEl = newTrack;
    
    if (isPlaying && !isPaused) {
        currentAudioEl.volume = 0;
        if (currentAudioEl.paused) {
            currentAudioEl.currentTime = 0;
            currentAudioEl.play().catch(e => console.log("BGM再生がブロックされました"));
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

function startAllModeBgmCycle() {
    if (allModeTimerId) clearInterval(allModeTimerId);
    if (allModePlaylist.length === 0) return;
    allModeTrackIndex = 0;
    fadeTransitionTo(allModePlaylist[allModeTrackIndex]);

    allModeTimerId = setInterval(() => {
        if (!isPlaying || isPaused) return;
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

if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
        if (currentAudioEl) currentAudioEl.volume = parseFloat(volumeSlider.value);
    });
}

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playKeySuccessSound() {
    if (!audioCtx || isPaused) return;
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
    if (!audioCtx || isPaused) return;
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

function setupDurationSelect() {
    if (!durationSelect) return;
    durationSelect.innerHTML = "";
    const optionsData = [
        { value: "5", text: "⏱️ 5分" },
        { value: "10", text: "⏱️ 10分" },
        { value: "15", text: "⏱️ 15分" },
        { value: "infinite", text: "∞ 無制限" }
    ];
    optionsData.forEach(opt => {
        const element = document.createElement('option');
        element.value = opt.value;
        element.innerText = opt.text;
        if(opt.value === "15") element.selected = true;
        durationSelect.appendChild(element);
    });
}

function saveProgress() {
    localStorage.setItem('eiken4_masteredIds', JSON.stringify(masteredIds));
}

function resetLocalStorage() {
    if(confirm("【確認】これまでに「覚えた！」で隠した単語をすべて復活させますか？（※自分で追加したカスタム単語は消えずに残ります）")) {
        localStorage.removeItem('eiken4_masteredIds');
        location.reload();
    }
}

function applyFilterAndShuffle() {
    if (activeCategory === 'revenge') {
        currentPlaylist = [...revengeDb];
        return;
    }

    // 覚えた単語を除外
    let baseList = masterVocabDb.filter(item => !masteredIds.includes(item.id));
    
    // カテゴリフィルタリング
    if (activeCategory !== 'all') {
        baseList = baseList.filter(item => item.tag === activeCategory);
    }

    // シャッフルONなら全体を混ぜる
    if (isShuffleOn) {
        for (let i = baseList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [baseList[i], baseList[j]] = [baseList[j], baseList[i]];
        }
    }

    // --- ★【毎日20個ずつ進むロジックの統合】---
    if (baseList.length > 0) {
        const today = new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 0);
        const diff = today - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);

        const itemsPerPage = 20;
        const startIndex = (dayOfYear * itemsPerPage) % baseList.length;
        baseList = baseList.slice(startIndex, startIndex + itemsPerPage);
        
        // 20個の小グループ内をさらにシャッフルして出題
        baseList.sort(() => Math.random() - 0.5);
    }
    
    currentPlaylist = [...baseList];
}

function switchCategory(categoryTag, element) {
    if (isPlaying) return; 

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if(element) element.classList.add('active');
    activeCategory = categoryTag;
    
    applyFilterAndShuffle();
    wordIndex = 0;
    step = 0;
    
    if(wordDisplay && meaningDisplay) {
        if(categoryTag === 'revenge') {
            wordDisplay.innerHTML = "🎯 REVENGE!";
            meaningDisplay.innerText = `にがてな単語が ${currentPlaylist.length} 問たまっているよ！`;
        } else {
            wordDisplay.innerHTML = "Ready?";
            meaningDisplay.innerText = `Loaded ${currentPlaylist.length} items`;
        }
    }
}

function toggleShuffle() {
    isShuffleOn = !isShuffleOn;
    if (shuffleBtn) {
        shuffleBtn.innerText = isShuffleOn ? "🔀 シャッフル：ON" : "🔀 シャッフル：OFF";
        shuffleBtn.classList.toggle('active', isShuffleOn);
    }
    applyFilterAndShuffle();
}

function markAsMastered() {
    if (currentPlaylist.length === 0 || !isPlaying || isPaused) return;
    const currentItem = currentPlaylist[wordIndex];
    
    revengeDb = revengeDb.filter(item => item.id !== currentItem.id);
    if(revengeDb.length === 0 && revengeTabBtn) revengeTabBtn.style.display = 'none';

    masteredIds.push(currentItem.id); 
    saveProgress(); 
    alert(`「${currentItem.word}」を覚えたリストに登録しました！`);
    
    applyFilterAndShuffle();
    wordIndex = 0;
    step = 0;
    if (wordDisplay) wordDisplay.innerHTML = "Saved!";
    if (isPlaying && currentPlaylist.length > 0) {
        resetBeatTimer();
        processChantStep();
    }
}

function addCustomWord() {
    const wordInput = document.getElementById('custom-word');
    const wordMeaningInput = document.getElementById('custom-meaning');
    if (!wordInput || !wordMeaningInput || !wordInput.value.trim() || !wordMeaningInput.value.trim()) return;

    const newEntry = {
        id: Date.now(), 
        word: wordInput.value.trim().toLowerCase(), 
        meaning: wordMeaningInput.value.trim(),
        tag: "custom"
    };

    const savedCustomWords = localStorage.getItem('eiken4_customWords');
    const customList = savedCustomWords ? JSON.parse(savedCustomWords) : [];
    customList.push(newEntry);
    localStorage.setItem('eiken4_customWords', JSON.stringify(customList));
    
    wordInput.value = '';
    wordMeaningInput.value = '';
    loadSavedData(); 
    if (activeCategory === 'custom' || activeCategory === 'all') applyFilterAndShuffle();
}

function toggleApp() {
    if (!isPlaying) {
        startLoop();
    } else {
        if (!isPaused) {
            pauseLoop();
        } else {
            resumeLoop();
        }
    }
}

function startCountdown() {
    if (timerSetupPanel) timerSetupPanel.style.display = 'none'; 
    if (timeLeftDisplay) timeLeftDisplay.style.display = 'block'; 
    
    if (durationSelect && durationSelect.value === 'infinite') {
        isInfiniteTime = true;
        if (timeLeftDisplay) timeLeftDisplay.innerText = `⏱️ 残り時間: ∞ 無制限`;
        return;
    }
    
    isInfiniteTime = false;
    if (!isPaused && durationSelect) {
        let minutes = parseInt(durationSelect.value);
        totalSecondsLeft = minutes * 60;
    }
    updateTimerText();

    if (countdownTimerId) clearInterval(countdownTimerId);
    countdownTimerId = setInterval(() => {
        if (isPaused) return; 
        totalSecondsLeft--;
        updateTimerText();

        if (totalSecondsLeft <= 0) {
            clearInterval(countdownTimerId);
            endGameByTimeout(); 
        }
    }, 1000);
}

function updateTimerText() {
    if (isInfiniteTime || !timeLeftDisplay) return;
    let m = Math.floor(totalSecondsLeft / 60);
    let s = totalSecondsLeft % 60;
    timeLeftDisplay.innerText = `⏱️ 残り時間: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function endGameByTimeout() {
    stopLoop();
    if (wordDisplay) wordDisplay.innerHTML = "<span style='color:var(--accent); font-size:2rem;'>Time Up! タイムアップ！</span>";
    if (meaningDisplay) meaningDisplay.innerText = `今日のれんしゅう終了！よくがんばったね💖 (Score: ${gameScore})`;
    
    if (revengeDb.length > 0) {
        alert(`にがてな単語が ${revengeDb.length} 問たまっているよ！「リベンジモード」ボタンを押して再挑戦してみてね！`);
        if (revengeTabBtn) revengeTabBtn.style.display = 'block'; 
    } else {
        alert("全問大正解！すごいや！");
    }
}

function startLoop() {
    applyFilterAndShuffle();
    if (currentPlaylist.length === 0) {
        alert("カードがありません！");
        return;
    }
    initAudioContext(); 
    isPlaying = true;
    isPaused = false;
    
    if (actionBtn) {
        actionBtn.innerText = "PAUSE GAME";
        actionBtn.classList.add('playing');
    }
    if (stopBtn) stopBtn.style.display = "block"; 
    
    if (activeCategory === 'all') {
        startAllModeBgmCycle();
    } else {
        fadeTransitionTo(getTrackForCategory(activeCategory));
    }
    
    step = 0;
    wordIndex = 0; 
    gameScore = 0;
    gameCombo = 0;
    if (scoreVal) scoreVal.innerText = gameScore;
    if (comboVal) comboVal.innerText = gameCombo;
    
    window.removeEventListener('keydown', handleTypingInput); 
    window.addEventListener('keydown', handleTypingInput);
    
    startCountdown(); 
    resetBeatTimer();
    processChantStep();
}

function pauseLoop() {
    isPaused = true;
    if (actionBtn) {
        actionBtn.innerText = "RESUME GAME";
        actionBtn.classList.remove('playing');
    }
    
    if (currentAudioEl) currentAudioEl.pause();
    if (timerId) clearInterval(timerId);
    window.speechSynthesis.cancel();

    if (wordDisplay) wordDisplay.innerHTML = `<span style="color: #94a3b8;">⏸️ PAUSED</span>`;
    if (meaningDisplay) meaningDisplay.innerText = "ゲームを一時停止しているよ";
}

function resumeLoop() {
    isPaused = false;
    if (actionBtn) {
        actionBtn.innerText = "PAUSE GAME";
        actionBtn.classList.add('playing');
    }
    
    if (currentAudioEl) currentAudioEl.play().catch(e => console.log(e));
    
    if (step === 3) {
        renderTypingWord();
    } else {
        step = Math.max(0, step - 1);
        resetBeatTimer();
        processChantStep();
    }
}

function stopLoop() {
    isPlaying = false;
    isPaused = false;
    if (actionBtn) {
        actionBtn.innerText = "START GAME";
        actionBtn.classList.remove('playing');
    }
    if (stopBtn) stopBtn.style.display = "none"; 
    
    stopAllBgm();
    
    if (timerId) clearInterval(timerId);
    if (countdownTimerId) clearInterval(countdownTimerId);
    
    if (timerSetupPanel) timerSetupPanel.style.display = 'flex';
    if (timeLeftDisplay) timeLeftDisplay.style.display = 'none';

    window.removeEventListener('keydown', handleTypingInput);
    window.speechSynthesis.cancel(); 
    if (wordDisplay) wordDisplay.innerHTML = "Ready?";
    if (meaningDisplay) meaningDisplay.innerText = "Press Start";
}

function resetBeatTimer() {
    if (timerId) clearInterval(timerId);
    if (step === 3 || isPaused) return; 
    timerId = setInterval(processChantStep, beatInterval);
}

function renderTypingWord() {
    if (isPaused || !wordDisplay) return;
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
    if (!currentPlaylist || currentPlaylist.length === 0 || wordIndex >= currentPlaylist.length) return;
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
    if (isPaused || !comboPopup) return;
    comboPopup.innerText = `🔥 ${comboCount}問連続正解！`;
    comboPopup.classList.remove('pop-animate');
    void comboPopup.offsetWidth; 
    comboPopup.classList.add('pop-animate');
}

function processChantStep() {
    if (isPaused) return;
    if (!currentPlaylist || currentPlaylist.length === 0) { 
        stopLoop();
        return; 
    }
    
    // インデックスの安全な丸め（範囲外エラー防止）
    if (wordIndex >= currentPlaylist.length || wordIndex < 0) {
        wordIndex = 0;
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
            if (meaningDisplay) meaningDisplay.innerText = "---";
            
            speak(cleanTextForTTS(currentVocab.word, currentVocab.meaning), 'en-US');
            step = 1;
            break;
        case 1: 
            if (meaningDisplay) meaningDisplay.innerText = currentVocab.meaning;
            
            let cleanJapanese = currentVocab.meaning
                .replace(/（[^）]*）/g, '')  
                .replace(/\([^)]*\)/g, '')   
                .trim();                     
            
            if (cleanJapanese.includes('来る')) {
                cleanJapanese = cleanJapanese.replace(/来る/g, 'くる');
            }
            if (cleanJapanese.includes('間')) {
                cleanJapanese = cleanJapanese.replace(/間/g, 'あいだ');
            }
                
            speak(cleanJapanese, 'ja-JP');
            step = 2;
            break;
        case 2: 
            speak(cleanTextForTTS(currentVocab.word, currentVocab.meaning), 'en-US');
            step = 3; 
            // タイピング待ち(Step 3)に入るため、ここで一旦自動進行のタイマーを止めます
            if (timerId) clearInterval(timerId); 
            renderTypingWord(); 
            break;
        case 3:
            // スコア・コンボの計算とリベンジDbの処理
            if (isCurrentWordCleared) {
                gameScore += 10 + Math.floor(gameCombo / 5);
                gameCombo += 1;
                if (gameCombo > 0 && gameCombo % 5 === 0) triggerComboPopup(gameCombo);

                if (activeCategory === 'revenge') {
                    revengeDb = revengeDb.filter(item => item.id !== currentVocab.id);
                }
            } else {
                gameCombo = 0;
                if (!revengeDb.some(item => item.id === currentVocab.id)) revengeDb.push(currentVocab);
            }
            if (scoreVal) scoreVal.innerText = gameScore;
            if (comboVal) comboVal.innerText = gameCombo;

            // リベンジ時のインデックス処理
            if (activeCategory === 'revenge') {
                applyFilterAndShuffle();
                if(currentPlaylist.length === 0) {
                    playRevengeClearSound();
                    alert("すごいや！にがてな単語をすべてリベンジしたよ！完全クリア！");
                    revengeDb = [];
                    if (revengeTabBtn) revengeTabBtn.style.display = 'none';
                    switchCategory('all', document.querySelector('.nav-btn'));
                    return;
                }
                wordIndex = 0;
            } else {
                // 通常モードは次の単語へ
                wordIndex = (wordIndex + 1) % currentPlaylist.length;
            }

            step = 0; 
            resetBeatTimer(); 
            processChantStep(); 
            break;
    }
}

function handleTypingInput(e) {
    if (isPaused) return; 

    // スペースキーやEnterキーでのスクロールや誤動作を防止
    if (e.key === ' ' || e.key === 'Enter') {
        if (isPlaying) {
            e.preventDefault();
        }
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

            if (typedIndex >= targetString.length) {
                // すべて正しく打ち終えた！
                isCurrentWordCleared = true;
                playWordCompleteSound(); 
                renderTypingWord();
                
                // ★Enterを待たずに、即座に次の問題への移行処理(Case 3)を実行！
                setTimeout(() => {
                    processChantStep();
                }, 400); // 0.4秒だけ打ち終わりの余韻(効果音)を残して次へ進む
            } else {
                playKeySuccessSound();   
            }
        } 
        else if (key !== "Shift" && key !== "CapsLock" && key !== "Control" && key !== "Alt" && key !== "Enter") {
            hasError = true; 
            renderTypingWord(); 
        }
    }
}

function cleanTextForTTS(rawText, rawMeaning) {
    let text = rawText.trim().toLowerCase();
    let meaning = rawMeaning ? rawMeaning.trim() : "";

    if (text.includes('→') || text.includes('->')) {
        let parts = text.split(/[→]|\-\>/);
        if (parts.length === 2) {
            let before = parts[0].trim();
            let after = parts[1].trim();

            if (before === 'read' && after === 'read') return 'read changed to red';
            return `${before} changed to ${after}`;
        }
    }

    if (text === 'read') {
        if (meaning.includes('読んだ') || meaning.includes('過去')) return 'red';
        return 'read';
    }
    
    return rawText.replace('→', ' changed to ').replace('...', '');
}

function speak(text, lang) {
    if (isPaused) return;
    // 前の音声をクリアしつつ、連続で詰まらないように制御
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0; 
    window.speechSynthesis.speak(utterance);
}

// --- ⚙️ イベントリスナーの一元登録 ---
document.addEventListener('DOMContentLoaded', () => {
    initBgmTracks();

    document.querySelectorAll('[data-category]').forEach(btn => {
        if (btn.id === 'action-btn' || btn.id === 'shuffle-btn') return;

        btn.addEventListener('click', (e) => {
            const category = e.target.getAttribute('data-category');
            switchCategory(category, e.target);
            e.target.blur();
        });
    });

    // シャッフルボタン
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', (e) => {
            toggleShuffle();
            e.target.blur();
        });
    }

    // スタート / 一時停止 ボタン
    if (actionBtn) {
        actionBtn.addEventListener('click', (e) => {
            toggleApp();
            e.target.blur();
        });
    }

    // ストップボタン
    if (stopBtn) {
        stopBtn.addEventListener('click', (e) => {
            stopLoop();
            e.target.blur();
        });
    }

    // 覚えたボタン
    const masterBtn = document.getElementById('master-btn');
    if (masterBtn) {
        masterBtn.addEventListener('click', (e) => {
            markAsMastered();
            e.target.blur();
        });
    }

    // 初期化ボタン
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            resetLocalStorage();
            e.target.blur();
        });
    }

    // 単語追加ボタン
    const addWordBtn = document.getElementById('add-word-btn');
    if (addWordBtn) {
        addWordBtn.addEventListener('click', (e) => {
            addCustomWord();
            e.target.blur();
        });
    }

    loadSavedData();
    setupDurationSelect(); 
    applyFilterAndShuffle();
});
