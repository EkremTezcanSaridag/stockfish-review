// Opening book database (ECO codes with main lines)
// Offline client-side opening book for classification.
// Key format: first 4 FEN fields (placement, side, castling, ep).
const OPENING_BOOK = {
    // Starting position
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': [
        'e2e4', 'e4',  // King's Pawn
        'd2d4', 'd4',  // Queen's Pawn
        'g1f3', 'Nf3', // Reti
        'c2c4', 'c4'   // English
    ],
    
    // After 1.e4 (two common FEN variants: with EP square or without)
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1': [
        'e7e5', 'e5',    // King's Pawn
        'c7c5', 'c5',    // Sicilian
        'e7e6', 'e6',    // French
        'c7c6', 'c6',    // Caro-Kann
        'd7d5', 'd5',    // Scandinavian
        'g8f6', 'Nf6',   // Alekhine
        'd7d6', 'd6',    // Pirc
        'g7g6', 'g6'     // Modern
    ],

    // After 1.e4 (no en-passant target)
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1': [
        'e7e5', 'e5',    // King's Pawn
        'c7c5', 'c5',    // Sicilian
        'e7e6', 'e6',    // French
        'c7c6', 'c6',    // Caro-Kann
        'd7d5', 'd5',    // Scandinavian
        'g8f6', 'Nf6',   // Alekhine
        'd7d6', 'd6',    // Pirc
        'g7g6', 'g6'     // Modern
    ],
    
    // Scandinavian Defense: 1.e4 d5
    'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2': [
        'e4d5', 'exd5'   // Main line
    ],
    
    // Scandinavian: 1.e4 d5 2.exd5
    'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2': [
        'd8d5', 'Qxd5',  // Modern Scandinavian
        'g8f6', 'Nf6'    // Marshall Gambit
    ],
    
    // Scandinavian Modern: 1.e4 d5 2.exd5 Qxd5
    'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3': [
        'b1c3', 'Nc3',   // Main line
        'd2d4', 'd4'     // Center grab
    ],
    
    // Scandinavian Modern: 1.e4 d5 2.exd5 Qxd5 3.Nc3
    'rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 3': [
        'd5a5', 'Qa5',   // Most popular
        'd5d8', 'Qd8',   // Retreat
        'd5d6', 'Qd6'    // Center
    ],
    
    // King's Pawn Game: 1.e4 e5
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2': [
        'g1f3', 'Nf3',   // King's Knight
        'f2f4', 'f4',    // King's Gambit
        'b1c3', 'Nc3',   // Vienna
        'f1c4', 'Bc4'    // Bishop's Opening
    ],

    // King's Pawn Game (no EP variant)
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': [
        'g1f3', 'Nf3',
        'f2f4', 'f4',
        'b1c3', 'Nc3',
        'f1c4', 'Bc4'
    ],
    
    // King's Knight: 1.e4 e5 2.Nf3
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2': [
        'b8c6', 'Nc6',   // Most common
        'g8f6', 'Nf6',   // Petrov
        'd7d6', 'd6'     // Philidor
    ],
    
    // Ruy Lopez: 1.e4 e5 2.Nf3 Nc6 3.Bb5
    'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3': [
        'a7a6', 'a6',    // Morphy Defense
        'g8f6', 'Nf6',   // Berlin
        'd7d6', 'd6',    // Steinitz
        'f8c5', 'Bc5'    // Classical
    ],

    // Ruy Lopez alternative common: 3...Nf6 (Berlin), 4...O-O not stored (engine handles)
    
    // Italian Game: 1.e4 e5 2.Nf3 Nc6 3.Bc4
    'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3': [
        'f8c5', 'Bc5',   // Giuoco Piano
        'g8f6', 'Nf6',   // Two Knights
        'f8e7', 'Be7'    // Hungarian
    ],
    
    // Sicilian Defense: 1.e4 c5
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2': [
        'g1f3', 'Nf3',   // Open Sicilian
        'b1c3', 'Nc3',   // Closed Sicilian
        'd2d4', 'd4'     // Smith-Morra
    ],

    // Sicilian (no EP variant)
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': [
        'g1f3', 'Nf3',
        'b1c3', 'Nc3',
        'd2d4', 'd4'
    ],
    
    // French Defense: 1.e4 e6
    'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': [
        'd2d4', 'd4',    // Main line
        'd2d3', 'd3',    // King's Indian Attack
        'b1c3', 'Nc3'    // Paulsen
    ],
    
    // Caro-Kann: 1.e4 c6
    'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': [
        'd2d4', 'd4',    // Main line
        'b1c3', 'Nc3',   // Two Knights
        'd2d3', 'd3'     // Breyer
    ],
    
    // Queen's Pawn: 1.d4
    'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1': [
        'd7d5', 'd5',    // Closed games
        'g8f6', 'Nf6',   // Indian defenses
        'e7e6', 'e6',    // French-like
        'c7c5', 'c5'     // Benoni
    ],
    
    // Add more as needed...
};

// Check if move is in opening book for current position.
// Robustness: match on the first 4 FEN fields (placement, side, castling, ep)
// to reduce misses caused by halfmove/fullmove drift.
function isBookMove(fen, move) {
    if (!fen || !move) return false;

    const fenParts = fen.split(' ');
    if (fenParts.length < 4) return false;
    const key4 = fenParts.slice(0, 4).join(' ');

    const bookMoves = OPENING_BOOK[key4] || OPENING_BOOK[fen];
    if (!bookMoves) return false;

    const moveStr = move.from + move.to + (move.promotion || '');
    return bookMoves.includes(moveStr) || bookMoves.includes(move.san);
}

// Helper: add both full-FEN and key4-FEN variants to the OPENING_BOOK map.
function addFenVariants(fenFull, moves) {
    const parts = fenFull.split(' ');
    if (parts.length < 4) return;
    const key4 = parts.slice(0, 4).join(' ');
    OPENING_BOOK[key4] = moves;
    OPENING_BOOK[fenFull] = moves;
}

export { OPENING_BOOK, isBookMove, addFenVariants };
