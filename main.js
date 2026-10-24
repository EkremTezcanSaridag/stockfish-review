import { Chess } from 'chess.js';

// Stockfish engine instance
let stockfish = null;
let analyzing = false;
let cancelAnalysis = false;

// Game state
let game = null;
let board = null;
let currentMoveIndex = -1;
let analysisResults = [];
let moveHistory = [];

// Initialize Stockfish
function initStockfish() {
    return new Promise((resolve, reject) => {
        try {
            // Use Stockfish.js from CDN
            stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');
            
            stockfish.onmessage = function(event) {
                const message = event.data;
                if (message === 'uciok') {
                    stockfish.postMessage('isready');
                } else if (message === 'readyok') {
                    resolve();
                }
            };

            stockfish.onerror = function(error) {
                reject(error);
            };

            stockfish.postMessage('uci');
        } catch (error) {
            reject(error);
        }
    });
}

// Analyze position with Stockfish
function analyzePosition(fen, depth = 15) {
    return new Promise((resolve) => {
        if (!stockfish) {
            resolve({ eval: 0, bestMove: null, pv: [] });
            return;
        }

        let bestMove = null;
        let evaluation = 0;
        let mate = null;

        const messageHandler = (event) => {
            const message = event.data;

            if (typeof message === 'string') {
                // Parse bestmove
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

                // Parse evaluation
                if (message.includes('score cp')) {
                    const match = message.match(/score cp (-?\d+)/);
                    if (match) {
                        evaluation = parseInt(match[1]);
                    }
                }

                // Parse mate
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

// Classify move based on centipawn loss
function classifyMove(cpLoss, wasBestMove, prevEval, currentEval) {
    if (wasBestMove) {
        // Check for brilliant moves (sacrifices or forcing moves that maintain advantage)
        if (prevEval > 100 && currentEval > prevEval - 50) {
            return 'brilliant';
        }
        return 'best';
    }

    const absLoss = Math.abs(cpLoss);

    // Handle mate situations
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

// Get classification label in Turkish
function getClassificationLabel(classification) {
    const labels = {
        brilliant: 'Brilliant (!!) Muhteşem',
        great: 'Great (!) Harika',
        best: 'Best En İyi',
        excellent: 'Excellent Mükemmel',
        good: 'Good İyi',
        book: 'Book Kitap',
        inaccuracy: 'Inaccuracy (?!) Belirsizlik',
        mistake: 'Mistake (?) Hata',
        blunder: 'Blunder (??) Bozgun'
    };
    return labels[classification] || classification;
}

// Calculate accuracy percentage
function calculateAccuracy(moves) {
    if (moves.length === 0) return 100;

    let totalLoss = 0;
    let moveCount = 0;

    moves.forEach(move => {
        if (move.classification) {
            const cpLoss = Math.abs(move.cpLoss || 0);
            // Cap loss at 500 for accuracy calculation
            totalLoss += Math.min(cpLoss, 500);
            moveCount++;
        }
    });

    if (moveCount === 0) return 100;

    const avgLoss = totalLoss / moveCount;
    // Convert to accuracy (100% = 0 loss, 0% = 500+ avg loss)
    const accuracy = Math.max(0, Math.min(100, 100 - (avgLoss / 5)));
    return accuracy.toFixed(1);
}

// Analyze entire game
async function analyzeGame(pgn, depth = 15) {
    game = new Chess();
    
    try {
        game.loadPgn(pgn);
    } catch (error) {
        throw new Error('Geçersiz PGN formatı: ' + error.message);
    }

    moveHistory = game.history({ verbose: true });
    analysisResults = [];

    if (moveHistory.length === 0) {
        throw new Error('PGN dosyasında hamle bulunamadı');
    }

    // Reset to start
    game.reset();
    let prevEval = 0;

    updateLoadingText(`0 / ${moveHistory.length} hamle analiz edildi...`);
    updateProgress(0);

    for (let i = 0; i < moveHistory.length; i++) {
        if (cancelAnalysis) {
            throw new Error('Analiz iptal edildi');
        }

        const move = moveHistory[i];
        const fen = game.fen();

        // Analyze current position
        const analysis = await analyzePosition(fen, depth);
        const bestMove = analysis.bestMove;

        // Make the actual move
        game.move(move.san);

        // Get evaluation after the move
        const afterFen = game.fen();
        const afterAnalysis = await analyzePosition(afterFen, depth);

        // Calculate centipawn loss (from perspective of side that moved)
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

        // Update eval for next move (flip perspective)
        prevEval = -currentEval;

        // Update progress
        updateLoadingText(`${i + 1} / ${moveHistory.length} hamle analiz edildi...`);
        updateProgress(((i + 1) / moveHistory.length) * 100);
    }

    return analysisResults;
}

// UI Functions
function updateLoadingText(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = text;
}

function updateProgress(percent) {
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) progressFill.style.width = percent + '%';
}

function showLoading(show) {
    document.getElementById('loading-section').style.display = show ? 'block' : 'none';
    document.getElementById('results-section').style.display = show ? 'none' : 'block';
}

function displayResults() {
    // Calculate accuracies
    const whiteMoves = analysisResults.filter(r => r.isWhite);
    const blackMoves = analysisResults.filter(r => !r.isWhite);

    const whiteAccuracy = calculateAccuracy(whiteMoves);
    const blackAccuracy = calculateAccuracy(blackMoves);

    document.getElementById('white-accuracy').textContent = whiteAccuracy + '%';
    document.getElementById('black-accuracy').textContent = blackAccuracy + '%';

    // Display move list
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

        // Add details for non-best moves
        if (result.classification !== 'best' && result.classification !== 'excellent' && result.bestMove) {
            const details = document.createElement('div');
            details.className = 'move-details';
            
            const cpLossText = result.cpLoss > 0 ? `Kayıp: ${result.cpLoss.toFixed(0)} centipawn` : '';
            const bestMoveText = `En iyi hamle: ${result.bestMove}`;
            
            details.innerHTML = `${cpLossText}<br><span class="move-suggestion">${bestMoveText}</span>`;
            moveItem.appendChild(details);
        }

        moveItem.addEventListener('click', () => {
            jumpToMove(index);
        });

        movesList.appendChild(moveItem);
    });

    // Initialize board
    game.reset();
    currentMoveIndex = -1;
    
    if (board) {
        board.position(game.fen());
    } else {
        board = Chessboard('board', {
            position: 'start',
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });
    }

    updatePositionInfo();
    document.getElementById('results-section').style.display = 'block';
}

function jumpToMove(index) {
    // Reset game
    game.reset();
    currentMoveIndex = -1;

    // Replay moves up to index
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
            ? `Mat ${Math.sign(result.evaluation) > 0 ? '+' : '-'}${Math.abs(Math.floor(result.evaluation / 1000))}`
            : `${(result.evaluation / 100).toFixed(2)}`;
        
        info.textContent = `Hamle ${currentMoveIndex + 1} / ${moveHistory.length} | Değerlendirme: ${evalText}`;
    }

    // Update eval bar
    updateEvalBar();
}

function updateEvalBar() {
    const evalBar = document.getElementById('eval-bar');
    
    let eval_cp = 0;
    if (currentMoveIndex >= 0 && analysisResults[currentMoveIndex]) {
        eval_cp = analysisResults[currentMoveIndex].evaluation;
    }

    // Convert to percentage (white advantage = right side, -300 to +300 range)
    const clampedEval = Math.max(-500, Math.min(500, eval_cp));
    const percentage = 50 + (clampedEval / 500) * 50;
    
    evalBar.style.width = percentage + '%';
    
    const evalText = Math.abs(eval_cp) > 5000
        ? `M${Math.abs(Math.floor(eval_cp / 1000))}`
        : (eval_cp / 100).toFixed(1);
    
    evalBar.setAttribute('data-eval', evalText);
}

// Board navigation
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

// Fetch Chess.com game (with CORS workaround attempt)
async function fetchChesscomGame(url) {
    // Extract game ID from URL
    const match = url.match(/chess\.com\/(?:game\/live|live)\/(\d+)/);
    if (!match) {
        throw new Error('Geçersiz Chess.com URL formatı');
    }

    const gameId = match[1];
    
    try {
        // Try direct API call (may fail due to CORS)
        const response = await fetch(`https://www.chess.com/callback/live/game/${gameId}`);
        if (!response.ok) throw new Error('API hatası');
        
        const data = await response.json();
        return data.game.pgn || data.pgn;
    } catch (error) {
        // CORS blocked - show helpful message
        throw new Error('Chess.com API\'ye doğrudan erişim engellenmiş. Lütfen oyunu Chess.com\'da açın, "Share" → "PGN" seçeneğiyle PGN\'yi kopyalayın ve "PGN Yapıştır" sekmesine yapıştırın.');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tab + '-tab').classList.add('active');
        });
    });

    // Board controls
    document.getElementById('start-btn').addEventListener('click', moveFirst);
    document.getElementById('prev-btn').addEventListener('click', movePrevious);
    document.getElementById('next-btn').addEventListener('click', moveNext);
    document.getElementById('end-btn').addEventListener('click', moveLast);

    // Analyze button
    document.getElementById('analyze-btn').addEventListener('click', async () => {
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        let pgn = '';

        try {
            if (activeTab === 'pgn') {
                pgn = document.getElementById('pgn-input').value.trim();
                if (!pgn) {
                    alert('Lütfen PGN yapıştırın');
                    return;
                }
            } else {
                const url = document.getElementById('url-input').value.trim();
                if (!url) {
                    alert('Lütfen Chess.com URL\'si girin');
                    return;
                }
                showLoading(true);
                updateLoadingText('Chess.com\'dan oyun yükleniyor...');
                pgn = await fetchChesscomGame(url);
            }

            analyzing = true;
            cancelAnalysis = false;
            document.getElementById('analyze-btn').disabled = true;
            document.getElementById('cancel-btn').style.display = 'inline-block';
            
            showLoading(true);
            updateLoadingText('Stockfish başlatılıyor...');

            if (!stockfish) {
                await initStockfish();
            }

            const depth = parseInt(document.getElementById('depth-select').value);
            await analyzeGame(pgn, depth);

            displayResults();
            showLoading(false);

        } catch (error) {
            alert('Hata: ' + error.message);
            console.error(error);
            showLoading(false);
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
        showLoading(false);
    });

    // Initialize Stockfish on load
    try {
        showLoading(true);
        updateLoadingText('Stockfish hazırlanıyor...');
        await initStockfish();
        updateLoadingText('Hazır! PGN veya Chess.com URL\'si girin.');
        showLoading(false);
    } catch (error) {
        console.error('Stockfish başlatma hatası:', error);
        updateLoadingText('Stockfish yüklenemedi. Sayfayı yenileyin veya modern bir tarayıcı kullanın.');
    }
});
