var firmata = require('firmata');
var express = require('express');

var comPort = process.argv[2];
var serverPort = process.argv[3] || 5001;

if (!comPort) {
   console.error('Please specify a COM port.');
   console.error('e.g. For COM5, use "node individual.js 5".');
   process.exit();
}

var socket;

// Use consecutive pins starting from firstSensorPin, ending with lastSensorPin
var firstSensorPin = 0;
var lastSensorPin = 4;

var sensorThreshold = 20;
var stateChangeAttemptThreshold = 20;

/*****************************************************
 * ARDUINO/FIRMATA CODE GOES BELOW HERE
 *****************************************************/
console.log('Connecting to board...');
var board = new firmata("COM" + comPort, function () {
  console.log('Connnected to board.');

  var pinStates = [];
  var pinReads = [];

  function setupSensorPin(index) {
    pinStates[index] = false;
    pinReads[index] = 0;

    board.pinMode(index, board.MODES.INPUT);

    var stateChangeAttemptsLeft = stateChangeAttemptThreshold;
    var laststateChangeAttemptTime = 0;

    board.analogRead(index, function (data) {
      var newState = data > sensorThreshold;

      pinReads[index] = data;

      if (pinStates[index] !== newState) {
        laststateChangeAttemptTime = Date.now();
        if (--stateChangeAttemptsLeft === 0) {
          pinStates[index] = newState;
          stateChangeAttemptsLeft = stateChangeAttemptThreshold;
          socket && socket.emit('state', {pin: index, state: pinStates[index]});
        }
        else {
          console.log('Pin ' + index + ': ' + stateChangeAttemptsLeft + ' attempts left.');
        }
      }

      setInterval(function () {
        if (stateChangeAttemptsLeft < stateChangeAttemptThreshold &&
            Date.now() - laststateChangeAttemptTime > 500) {
          stateChangeAttemptsLeft = stateChangeAttemptThreshold;
          console.log('Reset stateChange attempts for pin ' + index + '.');
        }
      }, 50);
    });
  }

  // Setup sensorPins to be read from
  for (var i = firstSensorPin; i <= lastSensorPin; ++i) {
    setupSensorPin(i);
  }

  setInterval(function () {
    socket && socket.emit('pindata', pinReads);
  }, 50);
});
/*****************************************************
 * ARDUINO/FIRMATA CODE GOES ABOVE HERE
 *****************************************************/


// Set up connection to browser using express and socket.io
console.log('Starting web server...');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.get('/individual', function (req, res, next) {
   res.sendFile(__dirname + '/individual.html');
});

app.use('/assets', express.static(__dirname + '/assets'));

io.on('connection', function (s){
  socket = s;

  socket.emit('settings', {
    threshold: sensorThreshold
  });

  s.on('disconnect', function() {
    socket = null;
  });
});

server.listen(serverPort);
console.log('Listening on port ' + serverPort);