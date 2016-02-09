var firmata = require('firmata');
var express = require('express');

var comPort = process.argv[2];

if (!comPort) {
   console.error('Please specify a COM port.');
   console.error('e.g. For COM5, use "node main.js 5".');
   process.exit();
}

var socket;
var state = false;

var board = new firmata("COM" + comPort, function () {
   var lastData;

   board.pinMode(8, board.MODES.INPUT);

   board.digitalRead(8, function (data) {
     lastData = Date.now();
   });

   setInterval(function () {
      var now = Date.now();
      var lastState = state;
      state = now - lastData > 50;

      if (state !== lastState) {
        socket && socket.emit('state', state);
      }
   }, 10);
});

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.get('/', function (req, res, next) {
   res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (s){
  socket = s;
  s.on('disconnect', function() {
    socket = null;
  });
});

server.listen(5000);