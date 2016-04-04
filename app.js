var express = require('express');
var app = express();
var http = require('http');
var http_server = http.Server(app);
var io = require('socket.io')(http_server);

app.use("/", express.static(__dirname + '/html'));

http_server.listen(3000);

var sid2room = {}
var rooms = {};
var Room = function(name) {
  this.name;
  this.id2sid = {};
  this.sid2id = {};
  this.id2name = {};
};
  
io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('ctrl', function(request){
    switch (request.type) {
      case 'join':
        joinRoom(socket, request);
        break;
      case 'message':
        transportMessage(socket, request);
        break;
    }
  });
  
  socket.on('disconnect', function(){
    console.log('user disconnected');
    var room_name = sid2room[socket.id];
    if(room_name) {
      var room = rooms[room_name];
      if(room) {
        var sender_id = room.sid2id[socket.id];
        if(sender_id) {
          delete room.id2name[sender_id]
          delete room.sid2id[sender_id]
          delete room.id2sid[socket.id]
          io.to(room_name).emit('ctrl', {
            'type': 'leave',
            'id': sender_id,
          });
          if(Object.keys(room.sid2id).length == 0) {
            delete rooms[room_name];
            console.log('delete room:' + room_name);
          }
        }
      }
      delete sid2room[socket.id];
    }
  });
});

function joinRoom(socket, request) {
  var room_name = request.room;
  var id = request.id;
  var name = request.name;
  console.log('join room:' + room_name + ' id:' + id + ' name:' + name + ' socket.id:' + socket.id);
  socket.join(room_name);
  io.to(room_name).emit('ctrl', {
    'type': 'newcomer',
    'id': id,
    'name': name
  });
  sid2room[socket.id] = room_name;
  var room = rooms[room_name];
  if(!room) {
    room = new Room(room_name);
    rooms[room_name] = room;
  }
  room.id2name[id] = name;
  room.sid2id[socket.id] = id;
  room.id2sid[id] = socket.id;
  
  var clients = [];
  for(var key in room.id2name) {
    clients.push({
      'id': key,
      'name': room.id2name[key]
    });
  }
  
  io.to(socket.id).emit('ctrl', {
    'type': 'clients',
    'clients': clients
  });
}

function transportMessage(socket, request) {
  var room_name = sid2room[socket.id];
  if (room_name == null || !rooms[room_name]) return;
  var room = rooms[room_name];
  var sender_id = room.sid2id[socket.id];
  var to = request.to;
  
  var response = request;
  response.from = sender_id;
  if (to == 'all') {
    io.broadcast.to(room_name).emit('ctrl', response);
  } else if (to != undefined) {
    var reciver_sid = room.id2sid[to];
    if (reciver_sid) {
      io.to(reciver_sid).emit('ctrl', response);
    }
  }
}