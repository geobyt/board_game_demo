;
jQuery(function($){    
    'use strict';

    var IO = {

        // connect the Socket.IO client to the Socket.IO server
        init: function() {
            IO.socket = io.connect();
            IO.bindEvents();
        },

        // events socket.io will listen to
        bindEvents : function() {
            IO.socket.on('connected', IO.onConnected );
            IO.socket.on('newGameCreated', IO.onNewGameCreated );
            IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom );
            IO.socket.on('beginNewGame', IO.beginNewGame );
            IO.socket.on('newBoardData', IO.onNewBoardData);
            IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
            IO.socket.on('error', IO.error );
        },

        // The client successfully connected
        onConnected : function() {
            // Cache a copy of the client's socket.IO session ID on the App
            App.mySocketId = IO.socket.socket.sessionid;
        },

        // A new game has been created and a random game ID has been generated.
        // data: { gameId: thisGameId, mySocketId: this.id }
        onNewGameCreated : function(data) {
            App.Host.gameInit(data);
        },

        // event for player joining room
        playerJoinedRoom : function(data) {
            App[App.myRole].updateWaitingScreen(data);
        },

        // 2 players have joined, start the countdown
        beginNewGame : function(data) {
            App[App.myRole].gameCountdown(data);
        },

        // register the board data with host and player screens
        onNewBoardData : function(data) {
            if (App.myRole === 'Player') {
                App.Player.newBoard(data);
            }
            else {
                App.Host.newBoard(data);
            }
        },

        // Player solved a word, if this is a host adjust the score
        hostCheckAnswer : function(data) {
            if(App.myRole === 'Host') {
                App.Host.checkAnswer(data);
            }
        },

        // popup an error message
        error : function(data) {
            alert(data.message);
        }

    };

    var App = {

        // gameId, which is identical to the ID of the Socket.IO Room used for the players and host to communicate
        gameId: 0,

        // 'Player' or 'Host'
        myRole: '',

        // The Socket.IO socket object identifier. This is unique for each player and host. It is generated when
        // the browser initially connects to the server when the page loads for the first time.
        mySocketId: '',

        /* *************************************
         *                Setup                *
         * *********************************** */

        // called when page loads
        init: function () {
            App.cacheElements();
            App.showInitScreen();
            App.bindEvents();

            // Initialize the fastclick library
            FastClick.attach(document.body);
        },

        // creates references to on-screen elements
        cacheElements: function () {
            App.$doc = $(document);

            // Templates
            App.$gameArea = $('#gameArea');
            App.$templateIntroScreen = $('#intro-screen-template').html();
            App.$templateNewGame = $('#create-game-template').html();
            App.$templateJoinGame = $('#join-game-template').html();
            App.$hostGameCountdown = $('#host-game-countdown-template').html();
            App.$hostGameInProgress = $('#host-game-in-progress-template').html();
            App.$playerGameInProgress = $('#player-game-in-progress-template').html();
        },

        // click handlers for the various buttons that appear on-screen.
        bindEvents: function () {
            // Host
            App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);

            // Player
            App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
            App.$doc.on('click', '#btnStart',App.Player.onPlayerStartClick);
            App.$doc.on('click', '.content',App.Player.onPlayerTileClick);
            App.$doc.on('click', '#btnSolveWord', App.Player.onPlayerSolveClick);
        },

        /* *************************************
         *             Game Logic              *
         * *********************************** */

        // intro screen
        showInitScreen: function() {
            App.$gameArea.html(App.$templateIntroScreen);
        },


        /* *******************************
           *         HOST CODE           *
           ******************************* */
        Host : {

            // player data
            players : [],

            // count of players joined
            numPlayersInRoom: 0,

            // handler for Start button
            onCreateClick: function () {
                console.log('Clicked "Create A Game"');
                IO.socket.emit('hostCreateNewGame');
            },

            // host screen is displayed for the first time
            gameInit: function (data) {
                App.gameId = data.gameId;
                App.mySocketId = data.mySocketId;
                App.myRole = 'Host';
                App.Host.numPlayersInRoom = 0;

                App.Host.displayNewGameScreen();
            },

            // screen showing unique game id
            displayNewGameScreen : function() {
                // Fill the game screen with the appropriate HTML
                App.$gameArea.html(App.$templateNewGame);

                // Display the URL on screen
                $('#gameURL').text(window.location.href);

                // Show the gameId / room id on screen
                $('#spanNewGameCode').text(App.gameId);
            },

            // Update the Host screen when the first player joins
            // if 2 players join - start the game
            updateWaitingScreen: function(data) {
                // Update host screen
                $('#playersWaiting')
                    .append('<p/>')
                    .text('Player ' + data.playerName + ' joined the game.');

                // Store the new player's data on the Host.
                App.Host.players.push(data);

                // Increment the number of players in the room
                App.Host.numPlayersInRoom += 1;

                // If two players have joined, start the game
                if (App.Host.numPlayersInRoom === 2) {
                    // Let the server know that two players are present.
                    IO.socket.emit('hostRoomFull',App.gameId);
                }
            },

            // Show the countdown screen
            gameCountdown : function() {
                // Prepare the game screen with new HTML
                App.$gameArea.html(App.$hostGameCountdown);
                //App.doTextFit('#countdown');

                // Begin the on-screen countdown timer
                var $secondsLeft = $('#countdown');
                App.countDown( $secondsLeft, 5, function(){
                    IO.socket.emit('hostCountdownFinished', App.gameId);
                });
            },

            // Initialize and show the board screen
            newBoard: function(data) {
                App.$gameArea.html(App.$hostGameInProgress);

                // Display the players' names on screen
                $('#player1Score')
                    .find('.playerName')
                    .html(App.Host.players[0].playerName);

                $('#player2Score')
                    .find('.playerName')
                    .html(App.Host.players[1].playerName);

                // Set the Score section on screen to 0 for each player.
                $('#player1Score').find('.score').attr('id',App.Host.players[0].mySocketId);
                $('#player2Score').find('.score').attr('id',App.Host.players[1].mySocketId);

                for(var i = 0; i < data.board.length; i++) {
                    for(var j = 0; j < data.board[i].length; j++) {
                        $('#square_' + i + "_" + j).text(data.board[i][j]);
                    }
                }
            },

            // adjust the score of a player who solved a word
            checkAnswer : function(data) {
                // Get the player's score
                var $pScore = $('#' + data.playerId);

                // 5 points for correct word, -3 for incorrect
                if (data.wordExists) {
                   $pScore.text(+$pScore.text() + 5);
                }
                else {
                    $pScore.text(+$pScore.text() - 3);
                }               
            },
        },


        /* *****************************
           *        PLAYER CODE        *
           ***************************** */
        Player : {

            // socket ID of the Host
            hostSocketId: '',

            // player's name
            myName: '',

            // the word being formed by player
            currentWord: '',

            // click handler for Join button
            onJoinClick: function () {
                // Display the Join Game HTML on the player's screen.
                App.$gameArea.html(App.$templateJoinGame);
            },

            // click handler for Start button
            onPlayerStartClick: function() {
                // collect data to send to the server
                var data = {
                    gameId : +($('#inputGameId').val()),
                    playerName : $('#inputPlayerName').val() || 'anon'
                };

                // Send the gameId and playerName to the server
                IO.socket.emit('playerJoinGame', data);

                // Set the appropriate properties for the current player.
                App.myRole = 'Player';
                App.Player.myName = data.playerName;
            },

            // click handler for individual letter tile being clicked ont he board
            onPlayerTileClick: function() {
                var $btn = $(this);
                var answer = $btn.val();

                if (!$btn.parent().hasClass("selected")) {
                    $btn.parent().addClass("selected");
                    App.Player.currentWord += answer;
                }
            },

            // Update a player's screen to show waiting message
            updateWaitingScreen : function(data) {
                if(IO.socket.socket.sessionid === data.mySocketId){
                    App.myRole = 'Player';
                    App.gameId = data.gameId;

                    $('#playerWaitingMessage')
                        .append('<p/>')
                        .text('Joined Game ' + data.gameId + '. Please wait for game to begin.');
                }
            },

            // display get ready message for players
            gameCountdown : function(hostData) {
                App.Player.hostSocketId = hostData.mySocketId;
                $('#gameArea')
                    .html('<div class="gameOver">Get Ready!</div>');
            },

            // display the game board from data
            newBoard: function(data) {
                App.$gameArea.html(App.$playerGameInProgress);

                for(var i = 0; i < data.board.length; i++) {
                    for(var j = 0; j < data.board[i].length; j++) {
                        $('#square_' + i + "_" + j).text(data.board[i][j]).val(data.board[i][j]);
                    }
                }
            },

            // player clicked solve button
            onPlayerSolveClick: function() {
                // Send the player info and tapped word to the server so the host can check the answer.
                var data = {
                    gameId: App.gameId,
                    playerId: App.mySocketId,
                    answer: App.Player.currentWord
                }
                IO.socket.emit('playerAnswer', data);

                App.Player.currentWord = '';
                for(var i = 0; i < 4; i++) {
                    for(var j = 0; j < 4; j++) {
                        $('#square_' + i + "_" + j).parent().removeClass("selected");
                    }
                }
            },

            newTiles : function(data) {
                App.$gameArea.html(App.$playerGameInProgress);
            },
        },


        /* **************************
                  UTILITY CODE
           ************************** */

        // countdown timer before the game begins
        countDown : function( $el, startTime, callback) {

            // Display the starting time on the screen.
            $el.text(startTime);

            // Start a 1 second timer
            var timer = setInterval(countItDown, 1000);

            // Decrement the displayed timer value
            function countItDown(){
                startTime -= 1
                $el.text(startTime);

                if( startTime <= 0 ){
                    // Stop the timer and trigger the callback.
                    clearInterval(timer);
                    callback();
                    return;
                }
            }

        },
    };

    IO.init();
    App.init();

}($));
