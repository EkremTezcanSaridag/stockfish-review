// Import chess.js from local vendor (same-origin, no CDN dependency)
import { Chess } from './vendor/chess.mjs';
import { OPENING_BOOK, isBookMove } from './opening-book.js';

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

// Simple chess board renderer with arrows and badges
class SimpleBoard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.position = null;
        this.highlightSquare = null;
        this.classificationBadge = null;
        this.bestMoveArrow = null;
        this.showArrows = true;
        this.render();
    }

    setPosition(fen) {
        this.position = this.parseFen(fen);
        this.render();
    }

    setHighlight(from, to, classification = null, bestMove = null) {
        this.highlightSquare = { from, to };
        this.classificationBadge = classification;
        
        // Show arrow for mistakes/inaccuracies/blunders
        if (bestMove && classification && 
            ['inaccuracy', 'mistake', 'blunder'].includes(classification)) {
            this.bestMoveArrow = bestMove;
        } else {
            this.bestMoveArrow = null;
        }
        
        this.render();
    }

    clearHighlight() {
        this.highlightSquare = null;
        this.classificationBadge = null;
        this.bestMoveArrow = null;
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
        
        // Add arrow overlay after squares
        if (this.bestMoveArrow) {
            const arrowHTML = this.renderArrow();
            if (arrowHTML) {
                this.container.insertAdjacentHTML('beforeend', arrowHTML);
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

    squareToCoords(square) {
        const file = square.charCodeAt(0) - 97; // a=0, h=7
        const rank = 8 - parseInt(square[1]); // 8=0, 1=7
        return { row: rank, col: file };
    }

    renderArrow() {
        if (!this.bestMoveArrow || !this.showArrows) return '';
        
        try {
            // Parse best move (UCI format: e2e4 or e7e8q)
            const from = this.bestMoveArrow.substring(0, 2);
            const to = this.bestMoveArrow.substring(2, 4);
            
            const fromCoords = this.squareToCoords(from);
            const toCoords = this.squareToCoords(to);
            
            // Calculate center positions (percentages)
            const fromX = (fromCoords.col + 0.5) * 12.5; // 12.5% per square
            const fromY = (fromCoords.row + 0.5) * 12.5;
            const toX = (toCoords.col + 0.5) * 12.5;
            const toY = (toCoords.row + 0.5) * 12.5;
            
            // Arrow SVG overlay
            return `
                <svg class="board-arrow" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                            <polygon points="0 0, 6 3, 0 6" fill="rgba(255, 170, 0, 0.9)" />
                        </marker>
                    </defs>
                    <line x1="${fromX}%" y1="${fromY}%" x2="${toX}%" y2="${toY}%" 
                          stroke="rgba(255, 170, 0, 0.85)" stroke-width="2.5" 
                          marker-end="url(#arrowhead)" stroke-linecap="round" />
                </svg>
            `;
        } catch (e) {
            console.warn('[board] Arrow render error:', e);
            return '';
        }
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

// Analyze position with timeout and stop protection
function analyzePosition(fen, depth = 12) {
    return new Promise((resolve) => {
        if (!stockfish || !stockfishReady) {
            resolve({ eval: 0, bestMove: null, mate: null, isMate: false });
            return;
        }

        let bestMove = null;
        let evaluation = 0;
        let mate = null;
        let resolved = false;

        const messageHandler = (event) => {
            const message = event.data;

            if (typeof message === 'string') {
                if (message.startsWith('bestmove')) {
                    if (resolved) return;
                    
                    const parts = message.split(' ');
                    bestMove = parts[1];
                    
                    resolved = true;
                    clearTimeout(timeoutId);
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

        // Timeout protection: 10 seconds max per position
        const timeoutId = setTimeout(() => {
            if (resolved) return;
            
            console.warn('[stockfish-review] Position analysis timeout after 10s, using last eval');
            resolved = true;
            stockfish.removeEventListener('message', messageHandler);
            
            // Stop any ongoing analysis
            try {
                stockfish.postMessage('stop');
            } catch (e) {}
            
            // Resolve with last known evaluation
            resolve({
                eval: mate !== null ? (mate > 0 ? 10000 : -10000) : evaluation,
                bestMove: bestMove,
                mate: mate,
                isMate: mate !== null
            });
        }, 10000);

        stockfish.addEventListener('message', messageHandler);
        
        // Stop any previous analysis before starting new one
        stockfish.postMessage('stop');
        stockfish.postMessage('position fen ' + fen);
        stockfish.postMessage('go depth ' + depth);
    });
}

// Convert centipawns to win probability (Chess.com/Lichess sigmoid model)
// Uses sigmoid function: 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
function cpToWinProbability(cp) {
    if (cp > 10000) return 100; // Forced mate
    if (cp < -10000) return 0;
    
    // Standard sigmoid model used by Lichess/Chess.com
    const WIN_PERCENTAGE_SCALE = 0.00368208; // Empirically derived constant
    return 50 + 50 * (2 / (1 + Math.exp(-WIN_PERCENTAGE_SCALE * cp)) - 1);
}

// Classify move based on win% delta (Chess.com-style) with opening book check
function classifyMove(cpLoss, wasBestMove, prevEval, currentEval, plyNumber, isBookMove = false) {
    const prevWinPct = cpToWinProbability(prevEval);
    const currentWinPct = cpToWinProbability(currentEval);
    const winPctLoss = prevWinPct - currentWinPct;

    // Opening book moves: if in book and within first 16 plies, classify as book
    // This fixes Scandinavian Defense and other openings being marked as mistakes
    if (isBookMove && plyNumber <= 16) {
        // Book move with minimal loss (<5%) gets book classification
        if (winPctLoss < 5.0) {
            return 'book';
        }
        // Book move with larger loss still gets gentler treatment
        // (won't mark as inaccuracy/mistake unless really bad)
        if (winPctLoss < 8.0) {
            return 'good';
        }
    }
    
    // Opening book leniency: first 8 plies are lenient
    const isOpening = plyNumber <= 8;
    
    // If best move and reasonable position, could be brilliant
    if (wasBestMove) {
        // Brilliant: best move that maintains or improves significant advantage
        if (prevWinPct >= 70 && currentWinPct >= prevWinPct - 2) {
            return 'brilliant';
        }
        // Great: best move in sharp position
        if (prevWinPct >= 60 && currentWinPct >= prevWinPct - 3) {
            return 'great';
        }
        return 'best';
    }

    // Win% delta thresholds (Chess.com-style)
    if (winPctLoss < 1.0) {
        return isOpening ? 'book' : 'best';
    }
    if (winPctLoss < 2.0) {
        return 'excellent';
    }
    if (winPctLoss < 3.0) {
        return 'good';
    }
    
    // Opening leniency: less harsh on early moves
    if (isOpening || isBookMove) {
        if (winPctLoss < 5.0) return 'good';
        if (winPctLoss < 8.0) return 'inaccuracy';
        if (winPctLoss < 12.0) return 'mistake';
        return 'blunder';
    }
    
    // Standard game thresholds
    if (winPctLoss < 5.0) {
        return 'inaccuracy';
    }
    if (winPctLoss < 10.0) {
        return 'mistake';
    }
    return 'blunder';
}

// Get Turkish classification label
function getClassificationLabel(classification) {
    return TURKISH_LABELS[classification] || classification;
}

// Calculate accuracy based on win% model
function calculateAccuracy(moves) {
    if (moves.length === 0) return 100;

    let totalWinPctLoss = 0;
    let moveCount = 0;

    moves.forEach(move => {
        if (move.classification) {
            // Calculate actual win% loss for this move
            const prevWinPct = cpToWinProbability(move.fen === move.fenBefore ? 0 : move.cpLoss);
            // Use a model that penalizes mistakes more
            const winPctLoss = Math.abs(move.cpLoss) > 0 ? prevWinPct : 0;
            totalWinPctLoss += Math.min(winPctLoss, 15); // Cap individual loss
            moveCount++;
        }
    });

    if (moveCount === 0) return 100;

    // Accuracy formula similar to Chess.com
    const avgLoss = totalWinPctLoss / moveCount;
    const accuracy = Math.max(0, Math.min(100, 100 - avgLoss * 3));
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

        let analysis = { eval: 0, bestMove: null, mate: null, isMate: false };
        let afterAnalysis = { eval: 0, bestMove: null, mate: null, isMate: false };

        try {
            // Analyze position before move
            updateProgress(((i + 0.5) / totalMoves) * 100, `${i + 1} / ${totalMoves}`);
            updateLoadingText(`Hamle ${i + 1} / ${totalMoves} analiz ediliyor... (pozisyon öncesi)`);
            analysis = await analyzePosition(fen, depth);
            
            game.move(move.san);
            
            // Analyze position after move
            updateProgress(((i + 0.75) / totalMoves) * 100, `${i + 1} / ${totalMoves}`);
            updateLoadingText(`Hamle ${i + 1} / ${totalMoves} analiz ediliyor... (pozisyon sonrası)`);
            const afterFen = game.fen();
            afterAnalysis = await analyzePosition(afterFen, depth);
        } catch (error) {
            console.error(`[stockfish-review] Error analyzing move ${i + 1}:`, error);
            // Continue with default values if position analysis fails
            if (game.turn() === move.color) {
                game.move(move.san); // Ensure move is made if not done yet
            }
        }

        const bestMove = analysis.bestMove;

        let currentEval = afterAnalysis.eval;
        if (move.color === 'b') {
            currentEval = -currentEval;
            prevEval = -prevEval;
        }

        const cpLoss = prevEval - currentEval;
        const wasBestMove = bestMove && (move.from + move.to === bestMove || move.san === bestMove);
        
        // Check if move is in opening book
        const moveIsBook = isBookMove(fen, move);

        const classification = classifyMove(cpLoss, wasBestMove, prevEval, currentEval, i + 1, moveIsBook);

        analysisResults.push({
            move: move,
            evaluation: afterAnalysis.eval,
            bestMove: bestMove,
            cpLoss: cpLoss,
            classification: classification,
            fen: afterAnalysis.eval !== 0 ? game.fen() : fen, // Use current fen if analysis succeeded
            fenBefore: fen,
            moveNumber: Math.floor(i / 2) + 1,
            isWhite: move.color === 'w'
        });

        prevEval = -currentEval;

        const progress = ((i + 1) / totalMoves) * 100;
        updateProgress(progress, `${i + 1} / ${totalMoves}`);
        updateLoadingText(`Hamle ${i + 1} / ${totalMoves} analiz edildi`);
    }

    console.log(`[stockfish-review] Analysis complete: ${analysisResults.length} moves analyzed`);
    updateProgress(100, `${totalMoves} / ${totalMoves}`);
    updateLoadingText('Analiz tamamlanıyor...');
    return analysisResults;
}

// Generate compact game summary bar
function displayGameSummary(whiteMoves, blackMoves, whiteAccuracy, blackAccuracy) {
    const summaryContent = document.getElementById('summary-content');
    if (!summaryContent) return;
    
    // Count classifications
    const countClass = (moves, classification) => moves.filter(m => m.classification === classification).length;
    
    const whiteErrors = countClass(whiteMoves, 'inaccuracy') + countClass(whiteMoves, 'mistake') + countClass(whiteMoves, 'blunder');
    const blackErrors = countClass(blackMoves, 'inaccuracy') + countClass(blackMoves, 'mistake') + countClass(blackMoves, 'blunder');
    const whiteBrilliant = countClass(whiteMoves, 'brilliant') + countClass(whiteMoves, 'great');
    const blackBrilliant = countClass(blackMoves, 'brilliant') + countClass(blackMoves, 'great');
    
    // Find worst 3 moves
    const worstMoves = analysisResults
        .filter(r => ['inaccuracy', 'mistake', 'blunder'].includes(r.classification))
        .sort((a, b) => Math.abs(b.cpLoss) - Math.abs(a.cpLoss))
        .slice(0, 3);
    
    // Generate Turkish summary text
    const totalMoves = whiteMoves.length + blackMoves.length;
    let summaryText = `${Math.ceil(totalMoves / 2)} hamlelik oyun. `;
    
    if (whiteAccuracy >= 90 && blackAccuracy >= 90) {
        summaryText += 'Her iki taraf da çok yüksek doğrulukla oynadı.';
    } else if (whiteAccuracy > blackAccuracy + 10) {
        summaryText += 'Beyaz daha iyi oynadı.';
    } else if (blackAccuracy > whiteAccuracy + 10) {
        summaryText += 'Siyah daha iyi oynadı.';
    } else {
        summaryText += 'Dengeli bir oyun.';
    }
    
    if (whiteBrilliant + blackBrilliant > 0) {
        summaryText += ` ${whiteBrilliant + blackBrilliant} muhteşem hamle.`;
    }
    
    if (whiteErrors + blackErrors > 0) {
        summaryText += ` ${whiteErrors + blackErrors} hata yapıldı.`;
    }
    
    // Build compact HTML
    let html = `
        <div class="summary-header">
            📊 Oyun Özeti
        </div>
        <div class="summary-compact">
            <div class="summary-accuracy-chips">
                <div class="accuracy-chip">
                    <div class="accuracy-chip-label">Beyaz</div>
                    <div class="accuracy-chip-value">${whiteAccuracy}%</div>
                </div>
                <div class="accuracy-chip">
                    <div class="accuracy-chip-label">Siyah</div>
                    <div class="accuracy-chip-value">${blackAccuracy}%</div>
                </div>
            </div>
            <div class="summary-text">${summaryText}</div>
        </div>
    `;
    
    if (worstMoves.length > 0) {
        html += `
            <div class="worst-moves-compact">
                <div class="worst-moves-header">En Kötü ${worstMoves.length} Hamle</div>
                <div class="worst-moves-row">
        `;
        
        worstMoves.forEach((move, index) => {
            const winPctLoss = Math.abs(cpToWinProbability(move.evaluation + move.cpLoss) - cpToWinProbability(move.evaluation));
            html += `
                <div class="worst-move-chip" data-move-index="${analysisResults.indexOf(move)}">
                    <div class="worst-move-chip-rank">${index + 1}.</div>
                    <div class="worst-move-chip-notation">${move.moveNumber}${move.isWhite ? '.' : '...'} ${move.move.san}</div>
                    <div class="worst-move-chip-class classification-${move.classification}">${getClassificationLabel(move.classification)}</div>
                    <div class="worst-move-chip-loss">-${winPctLoss.toFixed(1)}%</div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    summaryContent.innerHTML = html;
    
    // Add click handlers to worst moves
    document.querySelectorAll('.worst-move-chip').forEach(item => {
        item.addEventListener('click', () => {
            const moveIndex = parseInt(item.dataset.moveIndex);
            jumpToMove(moveIndex);
        });
    });
}

// Display results
function displayResults() {
    const whiteMoves = analysisResults.filter(r => r.isWhite);
    const blackMoves = analysisResults.filter(r => !r.isWhite);

    const whiteAccuracy = calculateAccuracy(whiteMoves);
    const blackAccuracy = calculateAccuracy(blackMoves);

    document.getElementById('white-accuracy').textContent = whiteAccuracy + '%';
    document.getElementById('black-accuracy').textContent = blackAccuracy + '%';
    
    // Generate game summary
    displayGameSummary(whiteMoves, blackMoves, whiteAccuracy, blackAccuracy);

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
        
        // Auto-jump to first interesting move (mistake or worse) or move 1
        const firstMistake = analysisResults.findIndex(r => 
            r.classification === 'mistake' || 
            r.classification === 'blunder' ||
            r.classification === 'inaccuracy'
        );
        
        if (firstMistake >= 0) {
            jumpToMove(firstMistake);
        } else if (analysisResults.length > 0) {
            jumpToMove(0); // Jump to move 1
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
        board.setHighlight(result.move.from, result.move.to, result.classification, result.bestMove);
    }
    updatePositionInfo();
    highlightCurrentMove();
    playMoveSound();
}

// Update coach panel with expanded Turkish commentary (2-4 sentences)
function updateCoachPanel() {
    const coachPanel = document.getElementById('coach-panel');
    if (!coachPanel) return;

    if (currentMoveIndex < 0) {
        coachPanel.innerHTML = '<div class="coach-text">Başlangıç pozisyonu. İleri ok ile hamleleri incele ve her hamle hakkında detaylı açıklama al.</div>';
        return;
    }

    const result = analysisResults[currentMoveIndex];
    if (!result) {
        coachPanel.innerHTML = '<div class="coach-text">Bir hamle seç veya analizi başlat.</div>';
        return;
    }

    const classification = result.classification;
    const move = result.move;
    const cpLoss = Math.abs(result.cpLoss || 0);
    const prevWinPct = cpToWinProbability(result.evaluation + (move.color === 'w' ? cpLoss : -cpLoss));
    const currentWinPct = cpToWinProbability(result.evaluation);
    const winPctLoss = Math.abs(prevWinPct - currentWinPct);

    let commentary = '';
    let icon = '';

    // Get best move in SAN
    let bestMoveSAN = result.bestMove;
    if (result.bestMove && result.fenBefore) {
        try {
            const tempGame = new Chess(result.fenBefore);
            const moveObj = tempGame.move(result.bestMove);
            if (moveObj) {
                bestMoveSAN = moveObj.san;
            }
        } catch (e) {}
    }

    // Varied templates for natural commentary
    const templates = {
        brilliant: [
            `Muhteşem bir hamle! ${move.san} sadece güçlü değil, aynı zamanda çok yaratıcı. Bu hamle pozisyondaki avantajını daha da artırıyor ve rakibine ciddi sorunlar yaratıyor. Böyle hamleler oyunun gidişatını tamamen değiştirebilir.`,
            `Bravo! ${move.san} parlak bir fikir. Bu hamle pozisyonunu çok güçlendiriyor ve rakibini zor durumda bırakıyor. Devam eden hamlelerde bu avantajı korumaya çalış.`,
            `Muhteşem! ${move.san} ile pozisyonunda büyük bir sıçrama yaptın. Bu tür hamleler sadece materyel kazanmakla kalmaz, aynı zamanda rakibin planlarını da bozar.`
        ],
        great: [
            `Harika hamle! ${move.san} pozisyonunda çok iyi bir seçim. Bu hamle avantajını koruyor ve oyun planını sürdürüyor. Devam etmek için doğru yoldasın.`,
            `Çok iyi! ${move.san} güçlü bir hamle. Pozisyonunu sağlamlaştırıyor ve rakibine baskı yapıyorsun. Bu tür tutarlı oyun başarı getirir.`,
            `Mükemmel seçim! ${move.san} ile pozisyonunu geliştirmeye devam ediyorsun. Avantajını korumak için böyle hamlelere ihtiyaç var.`
        ],
        best: [
            `En iyi hamle! ${move.san} pozisyondaki en güçlü devam. Bu hamle teorik olarak en doğru seçim ve avantajını maksimize ediyor. Böyle devam!`,
            `Mükemmel! ${move.san} bilgisayarın da seçeceği hamle. Pozisyonunu en iyi şekilde değerlendirdin. Tutarlı oyununu sürdür.`,
            `Kusursuz! ${move.san} pozisyonda en doğru hamle. Bu tür hassasiyetle oynamaya devam edersen başarı kaçınılmaz.`
        ],
        excellent: [
            `Çok iyi hamle! ${move.san} pozisyonunda neredeyse mükemmel bir seçim. Belki en güçlü değil ama avantajını koruyor ve oyun planına sadık kalıyorsun.`,
            `Güzel! ${move.san} sağlam bir hamle. Pozisyonunu geliştiriyor ve rakibine sorun yaratmaya devam ediyorsun. İyi iş!`
        ],
        good: [
            `İyi hamle. ${move.san} makul bir seçim ve pozisyonu dengeliyor. Her zaman en güçlü hamleyi bulmak zor olabilir, ama bu da işini görüyor.`,
            `Fena değil. ${move.san} pozisyonda kabul edilebilir bir devam. Daha iyileri olabilir ama bu hamle de işe yarıyor.`
        ],
        book: [
            `Kitap hamlesi. ${move.san} bu açılışta bilinen ve test edilmiş bir hamle. Açılış teorisine uygun oynuyorsun, şimdi orta oyuna hazırlan.`,
            `Teorik hamle! ${move.san} bu açılışın standart devamı. Açılış prensiplerini doğru uyguluyorsun: gelişim, merkez kontrolü, kale güvenliği.`
        ],
        inaccuracy: [
            `Yanlış hamle. ${move.san} tam doğru değil ve ${winPctLoss.toFixed(1)}% kazanma şansı kaybettirdi. ${bestMoveSAN ? `Yerine <strong>${bestMoveSAN}</strong> daha iyi olurdu. Bu hamle pozisyonunu daha güçlü geliştirir ve rakibine daha az fırsat bırakır.` : 'Daha dikkatli olmaya çalış.'} Küçük hatalar birikince sorun olabilir.`,
            `Belirsiz hamle. ${move.san} ile ${winPctLoss.toFixed(1)}% avantaj kaybettin. ${bestMoveSAN ? `<strong>${bestMoveSAN}</strong> daha net ve güçlüydü. Böyle pozisyonlarda merkez kontrolü ve taş gelişimi öncelikli olmalı.` : 'Alternatif hamleleri düşün.'} Dikkat et!`
        ],
        mistake: [
            `Hata! ${move.san} kötü bir hamle ve ${winPctLoss.toFixed(1)}% kazanma şansı kaybettirdi. ${bestMoveSAN ? `<strong>${bestMoveSAN}</strong> çok daha iyiydi. Bu hamle pozisyonunu güçlendirir ve rakibine taktik fırsatlar vermezdi.` : 'Hamle yapmadan önce tüm tehlikeleri kontrol et.'} Böyle hatalara dikkat!`,
            `Vahim! ${move.san} ile ${winPctLoss.toFixed(1)}% kayıp. ${bestMoveSAN ? `Kesinlikle <strong>${bestMoveSAN}</strong> oynanmalıydı. Bu hamle hem materyel hem de pozisyon açısından çok daha üstün.` : 'Pozisyonu dikkatli değerlendir.'} Bu tür hatalardan kaçınmaya çalış.`
        ],
        blunder: [
            `Vahim hata! ${move.san} çok kötü bir hamle ve ${winPctLoss.toFixed(1)}% kazanma şansı kaybettirdi! ${bestMoveSAN ? `<strong>${bestMoveSAN}</strong> mutlaka oynanmalıydı. Bu hamle rakibinin taktik tehditlerine karşı savunma yapar ve pozisyonunu güvence altına alırdı.` : 'Her hamleden önce tehlikeleri görmeye çalış.'} Böyle büyük hatalar oyunu kaybettirir!`,
            `Felaket! ${move.san} korkunç bir hamle, ${winPctLoss.toFixed(1)}% kayıp! ${bestMoveSAN ? `<strong>${bestMoveSAN}</strong> tek doğru hamleydi. Bu hamle hem materyel hem de pozisyon avantajı sağlar.` : 'Çok daha dikkatli ol!'} Taktik tehditleri görmek için hesaplama yap!`
        ]
    };

    // Select random template for variety
    const classTemplates = templates[classification] || [];
    const template = classTemplates[Math.floor(Math.random() * classTemplates.length)] || `${move.san} oynandı.`;

    switch (classification) {
        case 'brilliant':
            icon = '✨';
            commentary = `<strong>Muhteşem!</strong><br>${template}`;
            break;
        case 'great':
            icon = '🎯';
            commentary = `<strong>Harika!</strong><br>${template}`;
            break;
        case 'best':
            icon = '✓';
            commentary = `<strong>En İyi!</strong><br>${template}`;
            break;
        case 'excellent':
            icon = '✓';
            commentary = `<strong>Mükemmel!</strong><br>${template}`;
            break;
        case 'good':
            icon = '👍';
            commentary = `<strong>İyi.</strong><br>${template}`;
            break;
        case 'book':
            icon = '📖';
            commentary = `<strong>Kitap.</strong><br>${template}`;
            break;
        case 'inaccuracy':
            icon = '⚠️';
            commentary = `<strong>Yanlış.</strong><br>${template}`;
            break;
        case 'mistake':
            icon = '❗';
            commentary = `<strong>Hata!</strong><br>${template}`;
            break;
        case 'blunder':
            icon = '‼️';
            commentary = `<strong>Vahim!</strong><br>${template}`;
            break;
        default:
            icon = '';
            commentary = `${move.san} oynandı.`;
    }

    // Add evaluation context
    const evalText = Math.abs(result.evaluation) > 5000 
        ? `Mat ${Math.abs(Math.floor(result.evaluation / 1000))}`
        : `${(result.evaluation / 100).toFixed(1)}`;
    
    const evalColor = result.evaluation > 0 ? 'Beyaz' : 'Siyah';
    const evalLabel = Math.abs(result.evaluation) > 50 
        ? `<div class="coach-eval">${evalColor} avantajlı: ${evalText}</div>`
        : `<div class="coach-eval">Pozisyon dengeli: ${evalText}</div>`;

    coachPanel.innerHTML = `
        <div class="coach-icon">${icon}</div>
        <div class="coach-text">${commentary}</div>
        ${evalLabel}
    `;
}

function highlightCurrentMove() {
    document.querySelectorAll('.move-item').forEach(item => {
        item.classList.remove('selected');
    });

    if (currentMoveIndex >= 0) {
        const currentItem = document.querySelector(`[data-index="${currentMoveIndex}"]`);
        if (currentItem) {
            currentItem.classList.add('selected');
            
            // Scroll within the moves list container only, not the whole page
            const movesList = document.getElementById('moves-list');
            if (movesList) {
                const containerRect = movesList.getBoundingClientRect();
                const itemRect = currentItem.getBoundingClientRect();
                
                // Only scroll if item is outside visible area of the list
                if (itemRect.top < containerRect.top) {
                    movesList.scrollTop -= (containerRect.top - itemRect.top + 20);
                } else if (itemRect.bottom > containerRect.bottom) {
                    movesList.scrollTop += (itemRect.bottom - containerRect.bottom + 20);
                }
            }
        }
    }

    updateCoachPanel();
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
    updateCoachPanel();
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
        board.setHighlight(result.move.from, result.move.to, result.classification, result.bestMove);
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
    board.setHighlight(result.move.from, result.move.to, result.classification, result.bestMove);
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
    board.setHighlight(result.move.from, result.move.to, result.classification, result.bestMove);
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
