// Import chess.js from local vendor (same-origin, no CDN dependency)
import { Chess } from './vendor/chess.mjs';

// Global state
let stockfish = null;
let analyzing = false;
let cancelAnalysis = false;
let game = null;
let currentMoveIndex = -1;
let analysisResults = [];
let moveHistory = [];
let stockfishReady = false;
let soundEnabled = true;

// Sample PGN for demo (ONLY used when "Örnek Oyun Yükle" clicked)
const SAMPLE_PGN = `[Event "Sample Game"]
[Site "Chess.com"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 
6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 
11. Nbd2 Bb7 12. Bc2 Re8`;

// Turkish classification labels
const TURKISH_LABELS = {
    brilliant: 'Muhteşem',
    great: 'Harika', 
    best: 'En iyi',
    excellent: 'Mükemmel',
    good: 'İyi',
    book: 'Kitap',
    inaccuracy: 'Yanlış',
    mistake: 'Hata',
    blunder: 'Vahim'
};

// Web Audio API wood-tap sound generator
function createWoodTapSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    return function playTap() {
        if (!soundEnabled) return;
        
        const now = audioContext.currentTime;
        
        // Wood tap has a sharp attack with quick decay
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(150, now);
        oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.02);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now);
        oscillator.stop(now + 0.08);
    };
}

let playWoodTap = null;

// Simple chess board renderer with better styled pieces
class SimpleBoard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.position = null;
        this.highlightSquare = null;
        this.classificationBadge = null;
        this.render();
    }

    setPosition(fen) {
        this.position = this.parseFen(fen);
        this.render();
    }

    setHighlight(from, to, classification = null) {
        this.highlightSquare = { from, to };
        this.classificationBadge = classification;
        this.render();
    }

    clearHighlight() {
        this.highlightSquare = null;
        this.classificationBadge = null;
        this.render();
    }

    parseFen(fen) {
        const parts = fen.split(' ');
        const rows = parts[0].split('/');
        const board = [];
        
        for (let i = 0; i < 8; i++) {
            const row = [];
            let col = 0;
            for (const char of rows[i]) {
                if (char >= '1' && char <= '8') {
                    const empty = parseInt(char);
                    for (let j = 0; j < empty; j++) {
                        row.push(null);
                    }
                    col += empty;
                } else {
                    const color = char === char.toUpperCase() ? 'w' : 'b';
                    const piece = char.toUpperCase();
                    row.push(color + piece);
                    col++;
                }
            }
            board.push(row);
        }
        return board;
    }

    getSquareNotation(row, col) {
        const file = String.fromCharCode(97 + col); // a-h
        const rank = 8 - row; // 8-1
        return file + rank;
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        this.container.className = 'simple-board';
        
        if (!this.position) {
            this.position = this.parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        }
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = 'board-square';
                square.dataset.square = this.getSquareNotation(row, col);
                
                if ((row + col) % 2 === 0) {
                    square.classList.add('light');
                } else {
                    square.classList.add('dark');
                }

                // Highlight last move
                const squareNotation = this.getSquareNotation(row, col);
                if (this.highlightSquare) {
                    if (squareNotation === this.highlightSquare.from || squareNotation === this.highlightSquare.to) {
                        square.classList.add('highlight');
                    }
                }
                
                const piece = this.position[row][col];
                if (piece) {
                    const pieceImg = document.createElement('img');
                    pieceImg.className = 'piece';
                    pieceImg.src = `./vendor/pieces/${piece}.svg`;
                    pieceImg.alt = piece;
                    pieceImg.draggable = false;
                    square.appendChild(pieceImg);
                }

                // Add classification badge on destination square
                if (this.classificationBadge && squareNotation === this.highlightSquare?.to) {
                    const badge = document.createElement('div');
                    badge.className = 'square-badge badge-' + this.classificationBadge;
                    badge.innerHTML = this.getClassificationIcon(this.classificationBadge);
                    square.appendChild(badge);
                }
                
                this.container.appendChild(square);
            }
        }
    }

    getClassificationIcon(classification) {
        const icons = {
            brilliant: '!!',
            great: '!',
            best: '✓',
            excellent: '✓',
            good: '✓',
            book: '📖',
            inaccuracy: '?',
            mistake: '?!',
            blunder: '??'
        };
        return icons[classification] || '';
    }
}

let board = null;

// Play move sound
function playMoveSound() {
    if (playWoodTap) {
        playWoodTap();
    }
}

// Toast notifications
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'error' ? '❌' : type === 'success' ? '✓' : 'ℹ️';
    const title = type === 'error' ? 'Hata' : type === 'success' ? 'Başarılı' : 'Bilgi';
    
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">
                <div class="toast-title">${title}</div>
                <div class="toast-text">${message}</div>
            </div>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Initialize Stockfish
function initStockfish() {
    return new Promise((resolve, reject) => {
        if (stockfishReady && stockfish) {
            resolve();
            return;
        }

        try {
            const workerUrl = new URL('./vendor/stockfish.js', import.meta.url);
            stockfish = new Worker(workerUrl);
            
            const readyTimeout = setTimeout(() => {
                if (!stockfishReady) {
                    console.error('[stockfish-review] Stockfish initialization timeout');
                    reject(new Error('Stockfish başlatma zaman aşımı'));
                }
            }, 10000);

            stockfish.onmessage = (event) => {
                const message = event.data;
                if (message === 'uciok') {
                    stockfish.postMessage('isready');
                } else if (message === 'readyok' && !stockfishReady) {
                    stockfishReady = true;
                    clearTimeout(readyTimeout);
                    console.log('[stockfish-review] Stockfish ready');
                    resolve();
                }
            };

            stockfish.onerror = (error) => {
                clearTimeout(readyTimeout);
                stockfishReady = false;
                console.error('[stockfish-review] Stockfish worker error:', error.message || error);
                reject(new Error('Stockfish yüklenemedi. Lütfen sayfayı yenileyin.'));
            };

            stockfish.postMessage('uci');
        } catch (error) {
            stockfishReady = false;
            console.error('[stockfish-review] Stockfish initialization failed:', error);
            reject(new Error('Stockfish başlatılamadı: ' + error.message));
        }
    });
}

// Analyze position
function analyzePosition(fen, depth = 12) {
    return new Promise((resolve) => {
        if (!stockfish || !stockfishReady) {
            resolve({ eval: 0, bestMove: null, mate: null, isMate: false });
            return;
        }

        let bestMove = null;
        let evaluation = 0;
        let mate = null;

        const messageHandler = (event) => {
            const message = event.data;

            if (typeof message === 'string') {
                if (message.startsWith('bestmove')) {
                    const parts = message.split(' ');
                    bestMove = parts[1];
                    
                    stockfish.removeEventListener('message', messageHandler);
                    resolve({
                        eval: mate !== null ? (mate > 0 ? 10000 : -10000) : evaluation,
                        bestMove: bestMove,
                        mate: mate,
                        isMate: mate !== null
                    });
                }

                if (message.includes('score cp')) {
                    const match = message.match(/score cp (-?\d+)/);
                    if (match) {
                        evaluation = parseInt(match[1]);
                    }
                }

                if (message.includes('score mate')) {
                    const match = message.match(/score mate (-?\d+)/);
                    if (match) {
                        mate = parseInt(match[1]);
                    }
                }
            }
        };

        stockfish.addEventListener('message', messageHandler);
        stockfish.postMessage('position fen ' + fen);
        stockfish.postMessage('go depth ' + depth);
    });
}

// Classify move
function classifyMove(cpLoss, wasBestMove, prevEval, currentEval) {
    if (wasBestMove) {
        if (prevEval > 100 && currentEval > prevEval - 50) {
            return 'brilliant';
        }
        return 'best';
    }

    const absLoss = Math.abs(cpLoss);

    if (Math.abs(prevEval) > 5000 || Math.abs(currentEval) > 5000) {
        if (absLoss < 100) return 'excellent';
        if (absLoss < 300) return 'good';
    }

    if (absLoss < 10) return 'best';
    if (absLoss < 25) return 'excellent';
    if (absLoss < 50) return 'good';
    if (absLoss < 100) return 'inaccuracy';
    if (absLoss < 300) return 'mistake';
    return 'blunder';
}

// Get Turkish classification label
function getClassificationLabel(classification) {
    return TURKISH_LABELS[classification] || classification;
}

// Calculate accuracy
function calculateAccuracy(moves) {
    if (moves.length === 0) return 100;

    let totalLoss = 0;
    let moveCount = 0;

    moves.forEach(move => {
        if (move.classification) {
            const cpLoss = Math.abs(move.cpLoss || 0);
            totalLoss += Math.min(cpLoss, 500);
            moveCount++;
        }
    });

    if (moveCount === 0) return 100;

    const avgLoss = totalLoss / moveCount;
    const accuracy = Math.max(0, Math.min(100, 100 - (avgLoss / 5)));
    return accuracy.toFixed(1);
}

// Update UI
function updateLoadingText(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = text;
}

function updateProgress(percent, text = null) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = text || Math.round(percent) + '%';
}

function showSection(section) {
    document.getElementById('input-section').style.display = section === 'input' ? 'block' : 'none';
    document.getElementById('loading-section').style.display = section === 'loading' ? 'block' : 'none';
    document.getElementById('results-section').style.display = section === 'results' ? 'block' : 'none';
}

// Strip clock times and comments from PGN
function cleanPgn(pgn) {
    // Remove clock times like {[%clk 0:05:00]}
    pgn = pgn.replace(/\{\[%clk[^\]]+\]\}/g, '');
    // Remove comments
    pgn = pgn.replace(/\{[^}]*\}/g, '');
    // Remove annotations
    pgn = pgn.replace(/\$\d+/g, '');
    return pgn.trim();
}

// Analyze game - CRITICAL: ONLY analyzes the pgn parameter passed in
async function analyzeGame(pgnInput, depth = 12) {
    console.log('[stockfish-review] analyzeGame called with PGN length:', pgnInput.length);
    console.log('[stockfish-review] PGN preview:', pgnInput.substring(0, 100));
    
    // CRITICAL: Clean and use ONLY the input PGN, never fallback to SAMPLE_PGN
    const cleanedPgn = cleanPgn(pgnInput);
    
    game = new Chess();
    
    try {
        game.loadPgn(cleanedPgn);
    } catch (error) {
        console.error('[stockfish-review] PGN load error:', error);
        throw new Error('Geçersiz PGN formatı. Lütfen kontrol edin.');
    }

    moveHistory = game.history({ verbose: true });
    analysisResults = [];

    if (moveHistory.length === 0) {
        throw new Error('PGN dosyasında hamle bulunamadı');
    }

    const totalMoves = moveHistory.length;
    const fullMoves = Math.ceil(totalMoves / 2);
    console.log(`[stockfish-review] Analyzing ${totalMoves} plies (${fullMoves} full moves)`);

    game.reset();
    let prevEval = 0;

    for (let i = 0; i < totalMoves; i++) {
        if (cancelAnalysis) {
            throw new Error('Analiz iptal edildi');
        }

        const move = moveHistory[i];
        const fen = game.fen();

        const analysis = await analyzePosition(fen, depth);
        const bestMove = analysis.bestMove;

        game.move(move.san);

        const afterFen = game.fen();
        const afterAnalysis = await analyzePosition(afterFen, depth);

        let currentEval = afterAnalysis.eval;
        if (move.color === 'b') {
            currentEval = -currentEval;
            prevEval = -prevEval;
        }

        const cpLoss = prevEval - currentEval;
        const wasBestMove = bestMove && (move.from + move.to === bestMove || move.san === bestMove);

        const classification = classifyMove(cpLoss, wasBestMove, prevEval, currentEval);

        analysisResults.push({
            move: move,
            evaluation: afterAnalysis.eval,
            bestMove: bestMove,
            cpLoss: cpLoss,
            classification: classification,
            fen: afterFen,
            fenBefore: fen,
            moveNumber: Math.floor(i / 2) + 1,
            isWhite: move.color === 'w'
        });

        prevEval = -currentEval;

        const progress = ((i + 1) / totalMoves) * 100;
        updateProgress(progress, `${i + 1} / ${totalMoves}`);
        updateLoadingText(`Hamle ${i + 1} / ${totalMoves} analiz ediliyor...`);
    }

    console.log(`[stockfish-review] Analysis complete: ${analysisResults.length} moves analyzed`);
    return analysisResults;
}

// Display results
function displayResults() {
    const whiteMoves = analysisResults.filter(r => r.isWhite);
    const blackMoves = analysisResults.filter(r => !r.isWhite);

    const whiteAccuracy = calculateAccuracy(whiteMoves);
    const blackAccuracy = calculateAccuracy(blackMoves);

    document.getElementById('white-accuracy').textContent = whiteAccuracy + '%';
    document.getElementById('black-accuracy').textContent = blackAccuracy + '%';

    const movesList = document.getElementById('moves-list');
    movesList.innerHTML = '';

    analysisResults.forEach((result, index) => {
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        moveItem.dataset.index = index;

        const moveNumber = document.createElement('div');
        moveNumber.className = 'move-number';
        moveNumber.textContent = result.moveNumber + (result.isWhite ? '.' : '...');

        const moveNotation = document.createElement('div');
        moveNotation.className = 'move-notation';
        moveNotation.textContent = result.move.san;

        const classification = document.createElement('div');
        classification.className = 'move-classification classification-' + result.classification;
        classification.textContent = getClassificationLabel(result.classification);

        moveItem.appendChild(moveNumber);
        moveItem.appendChild(moveNotation);
        moveItem.appendChild(classification);

        if (result.classification !== 'best' && result.classification !== 'excellent' && result.bestMove) {
            const details = document.createElement('div');
            details.className = 'move-details';
            
            if (result.cpLoss > 0) {
                const cpLossText = document.createTextNode(`Kayıp: ${result.cpLoss.toFixed(0)} cp`);
                details.appendChild(cpLossText);
                details.appendChild(document.createElement('br'));
            }
            
            let bestMoveText = result.bestMove;
            try {
                const tempGame = new Chess(result.fenBefore);
                const moveObj = tempGame.move(result.bestMove);
                if (moveObj) {
                    bestMoveText = moveObj.san;
                }
            } catch (e) {}
            
            const suggestionSpan = document.createElement('span');
            suggestionSpan.className = 'move-suggestion';
            suggestionSpan.textContent = `En iyi: ${bestMoveText}`;
            details.appendChild(suggestionSpan);
            
            moveItem.appendChild(details);
        }

        moveItem.addEventListener('click', () => {
            jumpToMove(index);
        });

        movesList.appendChild(moveItem);
    });

    game.reset();
    currentMoveIndex = -1;
    
    try {
        if (!board) {
            board = new SimpleBoard('board');
            console.log('[stockfish-review] Board created in displayResults');
        }
        board.setPosition(game.fen());
        console.log('[stockfish-review] Board position set');
    } catch (error) {
        console.error('[stockfish-review] Board error:', error);
        showToast('Satranç tahtası yüklenemedi', 'error');
    }

    updatePositionInfo();
    showSection('results');
    
    setTimeout(() => {
        try {
            if (board) {
                board.setPosition(game.fen());
                console.log('[stockfish-review] Board re-rendered after section visible');
            }
        } catch (e) {
            console.error('[stockfish-review] Board re-render failed:', e);
        }
    }, 50);
}

// Board navigation
function jumpToMove(index) {
    game.reset();
    currentMoveIndex = -1;

    for (let i = 0; i <= index; i++) {
        game.move(moveHistory[i]);
        currentMoveIndex = i;
    }

    const result = analysisResults[currentMoveIndex];
    board.setPosition(game.fen());
    if (result && result.move) {
        board.setHighlight(result.move.from, result.move.to, result.classification);
    }
    updatePositionInfo();
    highlightCurrentMove();
    playMoveSound();
}

function highlightCurrentMove() {
    document.querySelectorAll('.move-item').forEach(item => {
        item.classList.remove('selected');
    });

    if (currentMoveIndex >= 0) {
        const currentItem = document.querySelector(`[data-index="${currentMoveIndex}"]`);
        if (currentItem) {
            currentItem.classList.add('selected');
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

function updatePositionInfo() {
    const info = document.getElementById('position-info');
    if (currentMoveIndex < 0) {
        info.textContent = 'Başlangıç pozisyonu';
    } else {
        const result = analysisResults[currentMoveIndex];
        const evalText = Math.abs(result.evaluation) > 5000 
            ? `Mat ${Math.sign(result.evaluation) > 0 ? '+' : ''}${Math.abs(Math.floor(result.evaluation / 1000))}`
            : `${(result.evaluation / 100).toFixed(2)}`;
        
        info.textContent = `Hamle ${currentMoveIndex + 1} / ${moveHistory.length} | Değerlendirme: ${evalText}`;
    }

    updateEvalBar();
}

function updateEvalBar() {
    const evalBar = document.getElementById('eval-bar');
    
    let eval_cp = 0;
    if (currentMoveIndex >= 0 && analysisResults[currentMoveIndex]) {
        eval_cp = analysisResults[currentMoveIndex].evaluation;
    }

    const clampedEval = Math.max(-500, Math.min(500, eval_cp));
    const percentage = 50 + (clampedEval / 500) * 50;
    
    evalBar.style.width = percentage + '%';
    
    const evalText = Math.abs(eval_cp) > 5000
        ? `M${Math.abs(Math.floor(eval_cp / 1000))}`
        : (eval_cp / 100).toFixed(1);
    
    evalBar.setAttribute('data-eval', evalText);
}

function moveFirst() {
    game.reset();
    currentMoveIndex = -1;
    board.setPosition(game.fen());
    board.clearHighlight();
    updatePositionInfo();
    highlightCurrentMove();
    playMoveSound();
}

function movePrevious() {
    if (currentMoveIndex < 0) return;
    
    game.reset();
    currentMoveIndex--;
    
    for (let i = 0; i <= currentMoveIndex; i++) {
        game.move(moveHistory[i]);
    }
    
    board.setPosition(game.fen());
    if (currentMoveIndex >= 0) {
        const result = analysisResults[currentMoveIndex];
        board.setHighlight(result.move.from, result.move.to, result.classification);
    } else {
        board.clearHighlight();
    }
    updatePositionInfo();
    highlightCurrentMove();
    playMoveSound();
}

function moveNext() {
    if (currentMoveIndex >= moveHistory.length - 1) return;
    
    currentMoveIndex++;
    game.move(moveHistory[currentMoveIndex]);
    const result = analysisResults[currentMoveIndex];
    board.setPosition(game.fen());
    board.setHighlight(result.move.from, result.move.to, result.classification);
    updatePositionInfo();
    highlightCurrentMove();
    playMoveSound();
}

function moveLast() {
    game.reset();
    
    for (let i = 0; i < moveHistory.length; i++) {
        game.move(moveHistory[i]);
    }
    
    currentMoveIndex = moveHistory.length - 1;
    const result = analysisResults[currentMoveIndex];
    board.setPosition(game.fen());
    board.setHighlight(result.move.from, result.move.to, result.classification);
    updatePositionInfo();
    highlightCurrentMove();
    playMoveSound();
}

// Setup UI
function setupUI() {
    console.log('[stockfish-review] setupUI called');
    
    // Initialize wood tap sound
    try {
        playWoodTap = createWoodTapSound();
    } catch (e) {
        console.warn('[stockfish-review] Audio context not available:', e);
    }
    
    try {
        board = new SimpleBoard('board');
        console.log('[stockfish-review] Board initialized in setupUI');
    } catch (e) {
        console.error('[stockfish-review] Board init failed:', e);
    }
    
    // Sample button - ONLY way to load SAMPLE_PGN
    document.getElementById('sample-btn').addEventListener('click', () => {
        document.getElementById('pgn-input').value = SAMPLE_PGN;
        const moves = SAMPLE_PGN.split(/\d+\./).filter(m => m.trim()).length;
        showToast(`Örnek oyun yüklendi: Ruy Lopez (12 hamle / 24 yarı-hamle)`, 'success', 3000);
    });

    // Clear button
    document.getElementById('clear-btn').addEventListener('click', () => {
        document.getElementById('pgn-input').value = '';
    });

    // Sound toggle
    const soundToggle = document.createElement('button');
    soundToggle.className = 'btn btn-secondary';
    soundToggle.innerHTML = '<span>🔊 Ses açık</span>';
    soundToggle.style.marginLeft = 'auto';
    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundToggle.innerHTML = soundEnabled ? '<span>🔊 Ses açık</span>' : '<span>🔇 Ses kapalı</span>';
    });
    document.querySelector('.button-group').appendChild(soundToggle);

    // Board controls
    document.getElementById('start-btn').addEventListener('click', moveFirst);
    document.getElementById('prev-btn').addEventListener('click', movePrevious);
    document.getElementById('next-btn').addEventListener('click', moveNext);
    document.getElementById('end-btn').addEventListener('click', moveLast);

    // Analyze button - CRITICAL: reads textarea ONLY
    document.getElementById('analyze-btn').addEventListener('click', async () => {
        const pgn = document.getElementById('pgn-input').value.trim();
        
        console.log('[stockfish-review] Analyze button clicked');
        console.log('[stockfish-review] Textarea PGN length:', pgn.length);
        
        if (!pgn) {
            showToast('Lütfen PGN yapıştırın veya örnek oyun yükleyin', 'error');
            return;
        }

        try {
            analyzing = true;
            cancelAnalysis = false;
            document.getElementById('analyze-btn').disabled = true;
            document.getElementById('cancel-btn').style.display = 'inline-flex';
            
            showSection('loading');
            updateLoadingText('Stockfish hazırlanıyor...');
            updateProgress(0);

            if (!stockfishReady) {
                try {
                    await initStockfish();
                } catch (error) {
                    throw new Error('Stockfish başlatılamadı. Lütfen sayfayı yenileyin ve tekrar deneyin.');
                }
            }

            const depth = parseInt(document.getElementById('depth-select').value);
            updateLoadingText('Oyun analiz ediliyor...');
            
            // CRITICAL: Pass textarea PGN directly to analyzeGame
            await analyzeGame(pgn, depth);
            
            const plies = analysisResults.length;
            const fullMoves = Math.ceil(plies / 2);
            displayResults();
            showToast(`Analiz tamamlandı! ${fullMoves} hamle / ${plies} yarı-hamle`, 'success', 3000);

        } catch (error) {
            showToast(error.message, 'error');
            showSection('input');
        } finally {
            analyzing = false;
            document.getElementById('analyze-btn').disabled = false;
            document.getElementById('cancel-btn').style.display = 'none';
        }
    });

    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', () => {
        cancelAnalysis = true;
        analyzing = false;
        document.getElementById('analyze-btn').disabled = false;
        document.getElementById('cancel-btn').style.display = 'none';
        showSection('input');
        showToast('Analiz iptal edildi', 'info', 3000);
    });

    showSection('input');
}

// Fix DOMContentLoaded race condition
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUI);
} else {
    setupUI();
}
