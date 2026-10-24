// Import chess.js from local vendor (same-origin, no CDN dependency)
import { Chess } from './vendor/chess.mjs';

// Global state
let stockfish = null;
let analyzing = false;
let cancelAnalysis = false;
let game = null;
let board = null;
let currentMoveIndex = -1;
let analysisResults = [];
let moveHistory = [];
let stockfishReady = false;

// Sample PGN for demo
const SAMPLE_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "Player1"]
[Black "Player2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 
8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 
14. Ng3 g6 15. a4 c5 16. d5 c4 17. Bg5 h6 18. Be3 Nc5 19. Qe2 h5 
20. Nf1 Bg7 21. N1h2 Qc7 22. Bg5 Rf8 23. axb5 axb5 24. Rxa8 Rxa8`;

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
            // Use same-origin worker (vendored in repo)
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

// Get classification label
function getClassificationLabel(classification) {
    const labels = {
        brilliant: 'Brilliant',
        great: 'Great',
        best: 'Best',
        excellent: 'Excellent',
        good: 'Good',
        book: 'Book',
        inaccuracy: 'Inaccuracy',
        mistake: 'Mistake',
        blunder: 'Blunder'
    };
    return labels[classification] || classification;
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

// Analyze game
async function analyzeGame(pgn, depth = 12) {
    game = new Chess();
    
    try {
        game.loadPgn(pgn);
    } catch (error) {
        throw new Error('Geçersiz PGN formatı. Lütfen kontrol edin.');
    }

    moveHistory = game.history({ verbose: true });
    analysisResults = [];

    if (moveHistory.length === 0) {
        throw new Error('PGN dosyasında hamle bulunamadı');
    }

    game.reset();
    let prevEval = 0;

    for (let i = 0; i < moveHistory.length; i++) {
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
            moveNumber: Math.floor(i / 2) + 1,
            isWhite: move.color === 'w'
        });

        prevEval = -currentEval;

        const progress = ((i + 1) / moveHistory.length) * 100;
        updateProgress(progress, `${i + 1} / ${moveHistory.length}`);
        updateLoadingText(`Hamle ${i + 1} / ${moveHistory.length} analiz ediliyor...`);
    }

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
            
            const suggestionSpan = document.createElement('span');
            suggestionSpan.className = 'move-suggestion';
            suggestionSpan.textContent = `En iyi: ${result.bestMove}`;
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
    
    if (board) {
        board.position(game.fen());
    } else {
        // Access global Chessboard from window (loaded via script tag)
        if (typeof window.Chessboard === 'function') {
            board = window.Chessboard('board', {
                position: 'start',
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
            });
            console.log('[stockfish-review] Chess board initialized');
        } else {
            console.error('[stockfish-review] Chessboard library not loaded');
            showToast('Satranç tahtası yüklenemedi. Lütfen sayfayı yenileyin.', 'error');
        }
    }

    updatePositionInfo();
    showSection('results');
}

// Board navigation
function jumpToMove(index) {
    game.reset();
    currentMoveIndex = -1;

    for (let i = 0; i <= index; i++) {
        game.move(moveHistory[i]);
        currentMoveIndex = i;
    }

    board.position(game.fen());
    updatePositionInfo();
    highlightCurrentMove();
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
    board.position(game.fen());
    updatePositionInfo();
    highlightCurrentMove();
}

function movePrevious() {
    if (currentMoveIndex < 0) return;
    
    game.reset();
    currentMoveIndex--;
    
    for (let i = 0; i <= currentMoveIndex; i++) {
        game.move(moveHistory[i]);
    }
    
    board.position(game.fen());
    updatePositionInfo();
    highlightCurrentMove();
}

function moveNext() {
    if (currentMoveIndex >= moveHistory.length - 1) return;
    
    currentMoveIndex++;
    game.move(moveHistory[currentMoveIndex]);
    board.position(game.fen());
    updatePositionInfo();
    highlightCurrentMove();
}

function moveLast() {
    game.reset();
    
    for (let i = 0; i < moveHistory.length; i++) {
        game.move(moveHistory[i]);
    }
    
    currentMoveIndex = moveHistory.length - 1;
    board.position(game.fen());
    updatePositionInfo();
    highlightCurrentMove();
}

// Setup UI - all button listeners and initial state
function setupUI() {
    console.log('[stockfish-review] setupUI called');
    
    // Sample button
    document.getElementById('sample-btn').addEventListener('click', () => {
        document.getElementById('pgn-input').value = SAMPLE_PGN;
        showToast('Örnek oyun yüklendi', 'success', 3000);
    });

    // Clear button
    document.getElementById('clear-btn').addEventListener('click', () => {
        document.getElementById('pgn-input').value = '';
    });

    // Board controls
    document.getElementById('start-btn').addEventListener('click', moveFirst);
    document.getElementById('prev-btn').addEventListener('click', movePrevious);
    document.getElementById('next-btn').addEventListener('click', moveNext);
    document.getElementById('end-btn').addEventListener('click', moveLast);

    // Analyze button
    document.getElementById('analyze-btn').addEventListener('click', async () => {
        const pgn = document.getElementById('pgn-input').value.trim();
        
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

            // Initialize Stockfish if not ready
            if (!stockfishReady) {
                try {
                    await initStockfish();
                } catch (error) {
                    throw new Error('Stockfish başlatılamadı. Lütfen sayfayı yenileyin ve tekrar deneyin.');
                }
            }

            const depth = parseInt(document.getElementById('depth-select').value);
            updateLoadingText('Oyun analiz ediliyor...');
            
            await analyzeGame(pgn, depth);
            displayResults();
            showToast('Analiz tamamlandı!', 'success', 3000);

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

    // Show input section initially
    showSection('input');
}

// Fix DOMContentLoaded race condition in ES modules
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUI);
} else {
    // Document already loaded, setup immediately
    setupUI();
}
