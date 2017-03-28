var io;
var gameSocket;

// Init game function to start the 
exports.initGame = function(sio, socket) {
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { });

    // Host Events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
}

// Create a word dictionary
function loadDictionary() {
    var natural = require("natural");
    var fs = require("fs");

    // build a trie from words in a dictionary
    var dictionary = "dictionary.txt";
    dictionaryTrie = new natural.Trie(false);

    console.time("building trie");
    fs.readFile(dictionary, {"encoding":"ascii"}, function (err, data) {
      if (err) throw err;

      var words = data.split("\r\n");
      var size = data.replace("\r\n", "").trim().length;
      console.log(words.length + " Words (" + size + " characters) Added.");
      dictionaryTrie.addStrings(words);

      console.timeEnd("building trie");
      console.log(dictionaryTrie.getSize());
    });
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

// the Create game button was clicked
function hostCreateNewGame() {
    // Create a unique Socket.IO Room
    var thisGameId = ( Math.random() * 100000 ) | 0;

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});

    // Join the Room and wait for the players
    this.join(thisGameId.toString());

    loadDictionary();
};

// Two players have joined, alert the host
function hostPrepareGame(gameId) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : gameId
    };

    //console.log("All Players Present. Preparing game...");
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

// The Countdown has finished, start the game
function hostStartGame(gameId) {
    console.log('Game Started.');
    sendBoard(gameId);
};

/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */

// Player joined the room
function playerJoinGame(data) {
    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // If the room exists...
    if( room != undefined ){
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        sock.join(data.gameId);

        console.log('Player ' + data.playerName + ' joining game: ' + data.gameId );

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
    }
}

// Player clicked on the Solve button
function playerAnswer(data) {
    console.log('Player ID: ' + data.playerId + ' solved a word: ' + data.answer);
	console.log('word in trie: ' + dictionaryTrie.contains(data.answer));

    //check the word
    data.wordExists = dictionaryTrie.contains(data.answer);

    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}

/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */

// Create a game board
function sendBoard(gameId) {
    var numLetters = letterPool.length;
    var board = new Array(4);
    for (var i = 0; i < 4; i++) {
        board[i] = new Array(4);
    }

    for(var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
            //generate random number between 0 and num letters
            var ranNumber = Math.floor(Math.random() * numLetters);

            board[i][j] = letterPool[ranNumber];
        }
    }

    var boardData = {
        board : board
    };

    io.sockets.in(gameId).emit('newBoardData', boardData);
}

var dictionaryTrie;

var letterPool = [
    'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e',
    'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a',
    'i', 'i', 'i', 'i', 'i', 'i', 'i', 'i', 'i',
    'o', 'o', 'o', 'o', 'o', 'o', 'o', 'o',
    'n', 'n', 'n', 'n', 'n', 'n',
    'r', 'r', 'r', 'r', 'r', 'r',
    't', 't', 't', 't', 't', 't',
    'l', 'l', 'l', 'l',
    's', 's', 's', 's',
    'u', 'u', 'u', 'u',
    'd', 'd', 'd', 'd',
    'g', 'g', 'g',
    'b', 'b',
    'c', 'c',
    'm', 'm',
    'p', 'p',
    'f', 'f',
    'h', 'h',
    'v', 'v',
    'w', 'w',
    'y', 'y',
    'k',
    'j',
    'x',
    'q',
    'z'
 ]