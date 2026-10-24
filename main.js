// Global state
var stockfish = null;
var analyzing = false;
var cancelAnalysis = false;
var game = null;
var board = null;
var currentMoveIndex = -1;
var analysisResults = [];
var moveHistory = [];
var stockfishReady = false;

// Sample PGN for demo
var SAMPLE_PGN = "[Event \"Live Chess\"]\n[Site \"Chess.com\"]\n[White \"Player1\"]\n[Black \"Player2\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 \n8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 \n14. Ng3 g6 15. a4 c5 16. d5 c4 17. Bg5 h6 18. Be3 Nc5 19. Qe2 h5 \n20. Nf1 Bg7 21. N1h2 Qc7 22. Bg5 Rf8 23. axb5 axb5 24. Rxa8 Rxa8";

// Toast notifications
function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 5000;
    
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var icon = type === 'error' ? '❌' : type === 'success' ? '✓' : 'ℹ️';
    var title = type === 'error' ? 'Hata' : type === 'success' ? 'Başarılı' : 'Bilgi';
    
    toast.innerHTML = '<div class="toast-content"><div class="toast-icon">' + icon + '</div><div class="toast-message"><div class="toast-title">' + title + '</div><div class="toast-text">' + message + '</div></div></div>';
    
    container.appendChild(toast);
    
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(function() { 
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// Initialize Stockfish
function initStockfish() {
    return new Promise(function(resolve, reject) {
        if (stockfishReady && stockfish) {
            resolve();
            return;
        }

        try {
            var workerUrl = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';
            stockfish = new Worker(workerUrl);
            
            var readyTimeout = setTimeout(function() {
                if (!stockfishReady) {
                    reject(new Error('Stockfish başlatma zaman aşımı'));
                }
            }, 10000);

            stockfish.onmessage = function(event) {
                var message = event.data;
                if (message === 'uciok') {
                    stockfish.postMessage('isready');
                } else if (message === 'readyok' && !stockfishReady) {
                    stockfishReady = true;
                    clearTimeout(readyTimeout);
                    resolve();
                }
            };

            stockfish.onerror = function(error) {
                clearTimeout(readyTimeout);
                stockfishReady = false;
                reject(new Error('Stockfish yüklenemedi. Lütfen sayfayı yenileyin.'));
            };

            stockfish.postMessage('uci');
        } catch (error) {
            stockfishReady = false;
            reject(new Error('Stockfish başlatılamadı: ' + error.message));
        }
    });
}

// Analyze position
function analyzePosition(fen, depth) {
    depth = depth || 12;
    
    return new Promise(function(resolve) {
        if (!stockfish || !stockfishReady) {
            resolve({ eval: 0, bestMove: null, mate: null, isMate: false });
            return;
        }

        var bestMove = null;
        var evaluation = 0;
        var mate = null;

        var messageHandler = function(event) {
            var message = event.data;

            if (typeof message === 'string') {
                if (message.indexOf('bestmove') === 0) {
                    var parts = message.split(' ');
                    bestMove = parts[1];
                    
                    stockfish.removeEventListener('message', messageHandler);
                    resolve({
                        eval: mate !== null ? (mate > 0 ? 10000 : -10000) : evaluation,
                        bestMove: bestMove,
                        mate: mate,
                        isMate: mate !== null
                    });
                }

                if (message.indexOf('score cp') !== -1) {
                    var match = message.match(/score cp (-?\d+)/);
                    if (match) {
                        evaluation = parseInt(match[1]);
                    }
                }

                if (message.indexOf('score mate') !== -1) {
                    var match = message.match(/score mate (-?\d+)/);
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

    var absLoss = Math.abs(cpLoss);

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
    var labels = {
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

    var totalLoss = 0;
    var moveCount = 0;

    moves.forEach(function(move) {
        if (move.classification) {
            var cpLoss = Math.abs(move.cpLoss || 0);
            totalLoss += Math.min(cpLoss, 500);
            moveCount++;
        }
    });

    if (moveCount === 0) return 100;

    var avgLoss = totalLoss / moveCount;
    var accuracy = Math.max(0, Math.min(100, 100 - (avgLoss / 5)));
    return accuracy.toFixed(1);
}

// Update UI
function updateLoadingText(text) {
    var loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = text;
}

function updateProgress(percent, text) {
    var progressFill = document.getElementById('progress-fill');
    var progressText = document.getElementById('progress-text');
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = text || Math.round(percent) + '%';
}

function showSection(section) {
    document.getElementById('input-section').style.display = section === 'input' ? 'block' : 'none';
    document.getElementById('loading-section').style.display = section === 'loading' ? 'block' : 'none';
    document.getElementById('results-section').style.display = section === 'results' ? 'block' : 'none';
}

// Analyze game
function analyzeGame(pgn, depth) {
    depth = depth || 12;
    
    // Use global Chess constructor
    game = new Chess();
    
    return new Promise(function(resolve, reject) {
        try {
            game.load_pgn(pgn);
        } catch (error) {
            reject(new Error('Geçersiz PGN formatı. Lütfen kontrol edin.'));
            return;
        }

        moveHistory = game.history({ verbose: true });
        analysisResults = [];

        if (moveHistory.length === 0) {
            reject(new Error('PGN dosyasında hamle bulunamadı'));
            return;
        }

        game.reset();
        var prevEval = 0;
        var moveIndex = 0;

        function analyzeNextMove() {
            if (cancelAnalysis) {
                reject(new Error('Analiz iptal edildi'));
                return;
            }

            if (moveIndex >= moveHistory.length) {
                resolve(analysisResults);
                return;
            }

            var i = moveIndex;
            var move = moveHistory[i];
            var fen = game.fen();

            analyzePosition(fen, depth).then(function(analysis) {
                var bestMove = analysis.bestMove;

                game.move(move.san);

                var afterFen = game.fen();
                return analyzePosition(afterFen, depth).then(function(afterAnalysis) {
                    var currentEval = afterAnalysis.eval;
                    if (move.color === 'b') {
                        currentEval = -currentEval;
                        prevEval = -prevEval;
                    }

                    var cpLoss = prevEval - currentEval;
                    var wasBestMove = bestMove && (move.from + move.to === bestMove || move.san === bestMove);

                    var classification = classifyMove(cpLoss, wasBestMove, prevEval, currentEval);

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

                    var progress = ((i + 1) / moveHistory.length) * 100;
                    updateProgress(progress, (i + 1) + ' / ' + moveHistory.length);
                    updateLoadingText('Hamle ' + (i + 1) + ' / ' + moveHistory.length + ' analiz ediliyor...');

                    moveIndex++;
                    setTimeout(analyzeNextMove, 0);
                });
            }).catch(function(error) {
                reject(error);
            });
        }

        analyzeNextMove();
    });
}

// Display results
function displayResults() {
    var whiteMoves = analysisResults.filter(function(r) { return r.isWhite; });
    var blackMoves = analysisResults.filter(function(r) { return !r.isWhite; });

    var whiteAccuracy = calculateAccuracy(whiteMoves);
    var blackAccuracy = calculateAccuracy(blackMoves);

    document.getElementById('white-accuracy').textContent = whiteAccuracy + '%';
    document.getElementById('black-accuracy').textContent = blackAccuracy + '%';

    var movesList = document.getElementById('moves-list');
    movesList.innerHTML = '';

    analysisResults.forEach(function(result, index) {
        var moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        moveItem.dataset.index = index;

        var moveNumber = document.createElement('div');
        moveNumber.className = 'move-number';
        moveNumber.textContent = result.moveNumber + (result.isWhite ? '.' : '...');

        var moveNotation = document.createElement('div');
        moveNotation.className = 'move-notation';
        moveNotation.textContent = result.move.san;

        var classification = document.createElement('div');
        classification.className = 'move-classification classification-' + result.classification;
        classification.textContent = getClassificationLabel(result.classification);

        moveItem.appendChild(moveNumber);
        moveItem.appendChild(moveNotation);
        moveItem.appendChild(classification);

        if (result.classification !== 'best' && result.classification !== 'excellent' && result.bestMove) {
            var details = document.createElement('div');
            details.className = 'move-details';
            
            if (result.cpLoss > 0) {
                var cpLossText = document.createTextNode('Kayıp: ' + result.cpLoss.toFixed(0) + ' cp');
                details.appendChild(cpLossText);
                details.appendChild(document.createElement('br'));
            }
            
            var suggestionSpan = document.createElement('span');
            suggestionSpan.className = 'move-suggestion';
            suggestionSpan.textContent = 'En iyi: ' + result.bestMove;
            details.appendChild(suggestionSpan);
            
            moveItem.appendChild(details);
        }

        moveItem.addEventListener('click', function() {
            jumpToMove(index);
        });

        movesList.appendChild(moveItem);
    });

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
    showSection('results');
}

// Board navigation
function jumpToMove(index) {
    game.reset();
    currentMoveIndex = -1;

    for (var i = 0; i <= index; i++) {
        game.move(moveHistory[i]);
        currentMoveIndex = i;
    }

    board.position(game.fen());
    updatePositionInfo();
    highlightCurrentMove();
}

function highlightCurrentMove() {
    var items = document.querySelectorAll('.move-item');
    items.forEach(function(item) {
        item.classList.remove('selected');
    });

    if (currentMoveIndex >= 0) {
        var currentItem = document.querySelector('[data-index="' + currentMoveIndex + '"]');
        if (currentItem) {
            currentItem.classList.add('selected');
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

function updatePositionInfo() {
    var info = document.getElementById('position-info');
    if (currentMoveIndex < 0) {
        info.textContent = 'Başlangıç pozisyonu';
    } else {
        var result = analysisResults[currentMoveIndex];
        var evalText = Math.abs(result.evaluation) > 5000 
            ? 'Mat ' + (Math.sign(result.evaluation) > 0 ? '+' : '') + Math.abs(Math.floor(result.evaluation / 1000))
            : (result.evaluation / 100).toFixed(2);
        
        info.textContent = 'Hamle ' + (currentMoveIndex + 1) + ' / ' + moveHistory.length + ' | Değerlendirme: ' + evalText;
    }

    updateEvalBar();
}

function updateEvalBar() {
    var evalBar = document.getElementById('eval-bar');
    
    var eval_cp = 0;
    if (currentMoveIndex >= 0 && analysisResults[currentMoveIndex]) {
        eval_cp = analysisResults[currentMoveIndex].evaluation;
    }

    var clampedEval = Math.max(-500, Math.min(500, eval_cp));
    var percentage = 50 + (clampedEval / 500) * 50;
    
    evalBar.style.width = percentage + '%';
    
    var evalText = Math.abs(eval_cp) > 5000
        ? 'M' + Math.abs(Math.floor(eval_cp / 1000))
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
    
    for (var i = 0; i <= currentMoveIndex; i++) {
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
    
    for (var i = 0; i < moveHistory.length; i++) {
        game.move(moveHistory[i]);
    }
    
    currentMoveIndex = moveHistory.length - 1;
    board.position(game.fen());
    updatePositionInfo();
    highlightCurrentMove();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Sample button
    document.getElementById('sample-btn').addEventListener('click', function() {
        document.getElementById('pgn-input').value = SAMPLE_PGN;
        showToast('Örnek oyun yüklendi', 'success', 3000);
    });

    // Clear button
    document.getElementById('clear-btn').addEventListener('click', function() {
        document.getElementById('pgn-input').value = '';
    });

    // Board controls
    document.getElementById('start-btn').addEventListener('click', moveFirst);
    document.getElementById('prev-btn').addEventListener('click', movePrevious);
    document.getElementById('next-btn').addEventListener('click', moveNext);
    document.getElementById('end-btn').addEventListener('click', moveLast);

    // Analyze button
    document.getElementById('analyze-btn').addEventListener('click', function() {
        var pgn = document.getElementById('pgn-input').value.trim();
        
        if (!pgn) {
            showToast('Lütfen PGN yapıştırın veya örnek oyun yükleyin', 'error');
            return;
        }

        analyzing = true;
        cancelAnalysis = false;
        document.getElementById('analyze-btn').disabled = true;
        document.getElementById('cancel-btn').style.display = 'inline-flex';
        
        showSection('loading');
        updateLoadingText('Stockfish hazırlanıyor...');
        updateProgress(0);

        // Initialize Stockfish if not ready
        var initPromise = stockfishReady ? Promise.resolve() : initStockfish();

        initPromise.then(function() {
            var depth = parseInt(document.getElementById('depth-select').value);
            updateLoadingText('Oyun analiz ediliyor...');
            
            return analyzeGame(pgn, depth);
        }).then(function() {
            displayResults();
            showToast('Analiz tamamlandı!', 'success', 3000);
        }).catch(function(error) {
            showToast(error.message, 'error');
            showSection('input');
        }).finally(function() {
            analyzing = false;
            document.getElementById('analyze-btn').disabled = false;
            document.getElementById('cancel-btn').style.display = 'none';
        });
    });

    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', function() {
        cancelAnalysis = true;
        analyzing = false;
        document.getElementById('analyze-btn').disabled = false;
        document.getElementById('cancel-btn').style.display = 'none';
        showSection('input');
        showToast('Analiz iptal edildi', 'info', 3000);
    });

    // Show input section initially
    showSection('input');
});
