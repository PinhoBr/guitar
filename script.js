// --- Configurações do Jogo por Dificuldade ---
const difficultySettings = {
    easy: {
        arrowSpeed: 2000, // Bolinhas mais lentas (2 segundos para cair)
        spawnInterval: 1000, // Spawn a cada 1 segundo
        perfectTolerance: 30, // Mais tolerante
        goodTolerance: 60,
        mehTolerance: 100,
        healthPerHit: 7, // Recupera mais vida
        healthPerMiss: 10 // Perde menos vida
    },
    medium: {
        arrowSpeed: 1500, // Velocidade padrão (1.5 segundos para cair)
        spawnInterval: 750, // Spawn a cada 0.75 segundos
        perfectTolerance: 15, // Tolerância padrão
        goodTolerance: 40,
        mehTolerance: 80,
        healthPerHit: 5, // Padrão
        healthPerMiss: 15 // Padrão
    },
    hard: {
        arrowSpeed: 1000, // Bolinhas mais rápidas (1 segundo para cair)
        spawnInterval: 500, // Spawn a cada 0.5 segundos (mais rápido)
        perfectTolerance: 10, // Menos tolerante
        goodTolerance: 25,
        mehTolerance: 50,
        healthPerHit: 3, // Recupera menos vida
        healthPerMiss: 20 // Perde mais vida
    }
};

// --- Configuração atual do jogo (será carregada da dificuldade) ---
let currentConfig = {
    arrowSpeed: 1500, // Padrão inicial
    score: {
        perfect: 100,
        good: 50,
        meh: 20,
        miss: -10
    },
    perfectTolerance: 15,
    goodTolerance: 40,
    mehTolerance: 80,
    maxConsecutiveMisses: 3,
    hitEffectDuration: 200,
    initialHealth: 100,
    healthPerHit: 5,
    healthPerMiss: 15
};

// --- Beatmaps das Músicas ---
const musicBeatmaps = {
    // Para "musica.mp3" (Ikimono Gakari - Netsujou no Spectrum),
    // NÃO definiremos um beatmap manual aqui, para que ele sempre gere um cíclico
    // com base na duração da música e na dificuldade selecionada.
    "bensound-funkyelement.mp3": [
        { time: 500, lane: 'a' },
        { time: 1000, lane: 's' },
        { time: 1500, lane: 'j' },
        { time: 2000, lane: 'k' },
        { time: 2500, lane: 'a' },
        { time: 3000, lane: 's' },
        { time: 3500, lane: 'j' },
        { time: 4000, lane: 'k' },
        { time: 4500, lane: 'a' },
        { time: 5000, lane: 's' },
        { time: 5500, lane: 'j' },
        { time: 6000, lane: 'k' },
    ]
};

// Tempo de pausa antes da música começar (em milissegundos)
const PRE_GAME_PAUSE_MS = 4000; // 4 segundos

// Gera um beatmap cíclico para preencher a duração da música
function generateCyclicBeatmapForDuration(musicDurationMs, laneKeys, spawnInterval) {
    const generatedMap = [];
    let currentTime = 0;
    // Gera beats até o final da música, com uma pequena margem
    const finalTime = musicDurationMs + currentConfig.arrowSpeed * 2; // Margem para as últimas setas caírem

    let laneIndex = 0;
    while (currentTime < finalTime) {
        generatedMap.push({ time: currentTime, lane: laneKeys[laneIndex] });
        currentTime += spawnInterval; // Usa o spawnInterval da dificuldade
        laneIndex = (laneIndex + 1) % laneKeys.length;
    }
    return generatedMap;
}

// Gera um beatmap "infinito" (ciclico) que não depende da duração da música
// Usado quando o beatmap pre-definido acaba e a musica ainda esta tocando.
function generateContinuousBeatPattern(startTime, spawnInterval) {
    // Este padrão pode ser mais complexo para um ritmo interessante
    const pattern = [
        { relativeTime: 0, lane: 'a' },
        { relativeTime: spawnInterval, lane: 's' },
        { relativeTime: spawnInterval * 2, lane: 'j' },
        { relativeTime: spawnInterval * 3, lane: 'k' },
    ];
    // Ajusta os tempos relativos para serem absolutos a partir do startTime
    return pattern.map(beat => ({
        time: startTime + beat.relativeTime,
        lane: beat.lane
    }));
}


// --- Elementos do DOM ---
const lanes = {
    a: document.getElementById("lane-a"),
    s: document.getElementById("lane-s"),
    j: document.getElementById("lane-j"),
    k: document.getElementById("lane-k")
};
const laneKeys = Object.keys(lanes);

const scoreDisplay = document.getElementById("score");
const bgm = document.getElementById("bgm");
const resetBtn = document.getElementById("reset-btn");

const startScreen = document.getElementById("startScreen");
const musicSelector = document.getElementById("musicSelector");
const difficultySelector = document.getElementById("difficultySelector"); // NOVO
const startGameBtn = document.getElementById("startGameBtn");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreDisplay = document.getElementById("finalScore");
const restartGameBtn = document.getElementById("restartGameBtn");

const hitFeedbackDisplay = document.getElementById("hitFeedback");
const healthBar = document.getElementById("healthBar");

// --- Variáveis de Estado do Jogo ---
let currentScore = 0;
let consecutiveMisses = 0;
let currentHealth = currentConfig.initialHealth; // Usa a configuração inicial
let gameRunning = false;
let currentBeatmap = [];
let beatmapIndex = 0;
let gameStartTime = 0;
let nextArrowSpawnTimeoutId = null;
let preGameTimerId = null; // Para o timeout da pausa

// --- Medidas dinâmicas ---
let targetBottomPositionPx;
let laneHeightPx;

function calculateDynamicMeasures() {
    const targetElement = document.querySelector(".target");
    const gameRect = document.querySelector('.game').getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    targetBottomPositionPx = targetRect.bottom - gameRect.top;
    laneHeightPx = document.querySelector(".lane").clientHeight;
}


// --- Funções do Jogo ---

function updateScoreDisplay() {
    scoreDisplay.textContent = `Pontos: ${currentScore}`;
}

function updateHealthBar() {
    healthBar.style.width = `${currentHealth}%`;
    if (currentHealth <= 0) {
        gameOver();
    }
}

function showHitFeedback(type) {
    hitFeedbackDisplay.textContent = type.toUpperCase() + '!';
    hitFeedbackDisplay.className = `hit-feedback show ${type}`;

    setTimeout(() => {
        hitFeedbackDisplay.classList.remove('show');
    }, 600);
}

function gameOver() {
    if (!gameRunning) return;

    gameRunning = false;
    clearTimeout(nextArrowSpawnTimeoutId);
    clearTimeout(preGameTimerId); // Limpa o timer da pausa se o jogo acabar antes
    bgm.pause();
    bgm.currentTime = 0;
    finalScoreDisplay.textContent = currentScore;
    gameOverOverlay.classList.add("active");
    disableGameInput();
}

function enableGameInput() {
    document.addEventListener("keydown", keyHandler);
    document.querySelector(".game").addEventListener("click", clickHandler);
}

function disableGameInput() {
    document.removeEventListener("keydown", keyHandler);
    document.querySelector(".game").removeEventListener("click", clickHandler);
}

/**
 * Inicia o loop de spawn de setas.
 * Continua gerando bolinhas enquanto a música toca ou a vida não chega a zero.
 */
function startBeatmapSequence() {
    const currentTimeInGame = performance.now() - gameStartTime;

    if (beatmapIndex < currentBeatmap.length) {
        const nextBeat = currentBeatmap[beatmapIndex];
        const timeToSpawn = nextBeat.time - currentConfig.arrowSpeed; // Usa arrowSpeed da dificuldade
        const delay = timeToSpawn - currentTimeInGame;

        nextArrowSpawnTimeoutId = setTimeout(() => {
            spawnArrow(nextBeat.lane);
            beatmapIndex++;
            startBeatmapSequence();
        }, Math.max(0, delay));
    } else if (bgm.currentTime < bgm.duration) {
        // Se o beatmap original terminou, mas a música ainda está tocando,
        // geramos um padrão contínuo a partir do tempo atual da música.
        const nextBeatTime = currentTimeInGame + currentConfig.spawnInterval; // Usa spawnInterval da dificuldade
        const continuousBeats = generateContinuousBeatPattern(nextBeatTime, currentConfig.spawnInterval);

        // Adiciona um beat do padrão contínuo para ser processado.
        // Isso simula um beatmap "infinito"
        currentBeatmap.push(continuousBeats[0]);
        beatmapIndex = currentBeatmap.length - 1; // Aponta para o beat recém-adicionado

        const nextBeat = currentBeatmap[beatmapIndex];
        const timeToSpawn = nextBeat.time - currentConfig.arrowSpeed;
        const delay = timeToSpawn - currentTimeInGame;

        nextArrowSpawnTimeoutId = setTimeout(() => {
            spawnArrow(nextBeat.lane);
            // NÃO incrementamos beatmapIndex aqui, pois estamos em um loop "infinito"
            // apenas agendamos o próximo a partir do tempo atual.
            startBeatmapSequence();
        }, Math.max(0, delay));

    } else {
        console.log("Música e beatmap terminaram. Fim de jogo!");
        gameOver();
    }
}


function startGame() {
    if (gameRunning) return;

    // Carrega as configurações da dificuldade selecionada
    const selectedDifficulty = difficultySelector.value;
    currentConfig = { ...currentConfig, ...difficultySettings[selectedDifficulty] };
    console.log("Configurações da dificuldade:", currentConfig);

    calculateDynamicMeasures();
    gameRunning = true;
    startScreen.classList.remove("active");
    enableGameInput();

    const selectedMusic = musicSelector.value;
    bgm.src = selectedMusic;

    bgm.load();
    bgm.onloadedmetadata = () => {
        // Usa o beatmap pré-definido ou gera um cíclico para a duração da música
        if (musicBeatmaps[selectedMusic] && musicBeatmaps[selectedMusic].length > 0) {
            currentBeatmap = [...musicBeatmaps[selectedMusic]];
        } else {
            console.warn(`Beatmap para ${selectedMusic} não encontrado ou vazio. Gerando um beatmap cíclico para a duração da música com base na dificuldade.`);
            currentBeatmap = generateCyclicBeatmapForDuration(bgm.duration * 1000, laneKeys, currentConfig.spawnInterval); // Passa spawnInterval
        }

        // NOVO: Pausa antes de iniciar a música e o spawn de bolinhas
        console.log(`Iniciando contagem regressiva de ${PRE_GAME_PAUSE_MS / 1000} segundos...`);
        // Aqui você pode adicionar um contador visual na tela
        preGameTimerId = setTimeout(() => {
            bgm.play().catch(e => console.error("Erro ao tocar música:", e));
            gameStartTime = performance.now(); // Marca o início do jogo APÓS a pausa
            beatmapIndex = 0;
            startBeatmapSequence();
        }, PRE_GAME_PAUSE_MS);

    };

    bgm.onerror = (e) => {
        console.error("Erro ao carregar ou tocar a música:", e);
        alert("Não foi possível carregar a música. Verifique o caminho do arquivo.");
        gameOver();
    };

    if (bgm.readyState >= 2) {
        bgm.onloadedmetadata();
    }
}


function spawnArrow(laneKey) {
    if (!gameRunning) return;

    const arrow = document.createElement("div");
    arrow.classList.add("arrow");
    arrow.dataset.lane = laneKey;
    arrow.style.animationDuration = currentConfig.arrowSpeed + "ms"; // Usa arrowSpeed da dificuldade

    lanes[laneKey].appendChild(arrow);
    arrow.dataset.hit = "false";

    arrow.addEventListener('animationend', (event) => {
        if (event.animationName === 'fall' && arrow.dataset.hit === "false") {
            if (arrow.parentElement) {
                arrow.remove();
                handleMiss();
            }
        }
    });
}

function processHit(laneKey, arrow) {
    if (!gameRunning || arrow.dataset.hit === "true") return;

    const arrowRect = arrow.getBoundingClientRect();
    const gameRect = document.querySelector('.game').getBoundingClientRect();
    const arrowBottomYInGame = arrowRect.bottom - gameRect.top;
    const distanceToTargetBottom = Math.abs(arrowBottomYInGame - targetBottomPositionPx);

    let feedbackType = '';
    let points = 0;

    // Usa as tolerâncias da dificuldade
    if (distanceToTargetBottom <= currentConfig.perfectTolerance) {
        feedbackType = 'perfect';
        points = currentConfig.score.perfect;
        consecutiveMisses = 0;
        currentHealth = Math.min(100, currentHealth + currentConfig.healthPerHit * 2);
    } else if (distanceToTargetBottom <= currentConfig.goodTolerance) {
        feedbackType = 'good';
        points = currentConfig.score.good;
        consecutiveMisses = 0;
        currentHealth = Math.min(100, currentHealth + currentConfig.healthPerHit);
    } else if (distanceToTargetBottom <= currentConfig.mehTolerance) {
        feedbackType = 'meh';
        points = currentConfig.score.meh;
        consecutiveMisses = 0;
        currentHealth = Math.min(100, currentHealth + currentConfig.healthPerHit / 2);
    } else {
        feedbackType = 'miss';
        points = currentConfig.score.miss;
        consecutiveMisses++;
        currentHealth = Math.max(0, currentHealth - currentConfig.healthPerMiss);
    }

    showHitFeedback(feedbackType);
    currentScore = Math.max(0, currentScore + points);
    updateScoreDisplay();
    updateHealthBar();

    arrow.dataset.hit = "true";
    arrow.classList.add("hit");

    setTimeout(() => {
        if (arrow.parentElement) arrow.remove();
    }, currentConfig.hitEffectDuration); // Usa hitEffectDuration da dificuldade

    if (consecutiveMisses >= currentConfig.maxConsecutiveMisses) {
        gameOver();
    }
}

function handleMiss() {
    if (!gameRunning) return;
    showHitFeedback('miss');
    consecutiveMisses++;
    currentScore = Math.max(0, currentScore + currentConfig.score.miss);
    currentHealth = Math.max(0, currentHealth - currentConfig.healthPerMiss);
    updateScoreDisplay();
    updateHealthBar();

    if (consecutiveMisses >= currentConfig.maxConsecutiveMisses) {
        gameOver();
    }
}

function keyHandler(e) {
    const key = e.key.toLowerCase();
    if (lanes[key]) {
        const lane = lanes[key];
        const arrowsInLane = Array.from(lane.querySelectorAll(".arrow"));

        let closestArrow = null;
        let minDistance = Infinity;

        arrowsInLane.forEach(arrow => {
            if (arrow.dataset.hit === "true") return;

            const arrowRect = arrow.getBoundingClientRect();
            const gameRect = document.querySelector('.game').getBoundingClientRect();
            const arrowBottomYInGame = arrowRect.bottom - gameRect.top;
            const targetBottomYInGame = targetBottomPositionPx;

            const distance = Math.abs(arrowBottomYInGame - targetBottomYInGame);

            // Usa a tolerância "meh" para encontrar a seta mais próxima dentro da área de acerto
            if (distance <= currentConfig.mehTolerance && distance < minDistance) {
                 minDistance = distance;
                 closestArrow = arrow;
            }
        });

        if (closestArrow) {
            processHit(key, closestArrow);
        } else {
            handleMiss();
        }
    }
}

function clickHandler(e) {
    if (e.target.classList.contains("arrow")) {
        const laneKey = e.target.dataset.lane;
        processHit(laneKey, e.target);
    } else {
        handleMiss();
    }
}

// --- Event Listeners ---
startGameBtn.addEventListener("click", startGame);
restartGameBtn.addEventListener("click", () => {
    gameOverOverlay.classList.remove("active");
    resetGame();
});
resetBtn.addEventListener("click", resetGame);


function resetGame() {
    gameRunning = false;
    clearTimeout(nextArrowSpawnTimeoutId);
    clearTimeout(preGameTimerId); // Limpa o timer da pausa
    bgm.pause();
    bgm.currentTime = 0;
    currentScore = 0;
    consecutiveMisses = 0;
    currentHealth = currentConfig.initialHealth; // Reinicia a vida com base na dificuldade selecionada
    beatmapIndex = 0;
    currentBeatmap = [];
    updateScoreDisplay();
    updateHealthBar();

    document.querySelectorAll(".arrow").forEach(arrow => {
        arrow.remove();
    });

    startScreen.classList.add("active");
    disableGameInput();
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // Carrega as configurações da dificuldade padrão (Médio) ao iniciar
    currentConfig = { ...currentConfig, ...difficultySettings['medium'] };
    updateScoreDisplay();
    updateHealthBar();
    disableGameInput();
    calculateDynamicMeasures();
});