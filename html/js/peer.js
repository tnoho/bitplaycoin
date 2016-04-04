var PeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
var IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
var bandwidth = 5000;
var chunkSize = 16384;
var config = { iceServers: [
        { "urls": "stun:stun.l.google.com:19302" }
    ] };

var RTCPeerHandler = (function () {
    function RTCPeerHandler() {
        this.peers = {};
    }
    RTCPeerHandler.prototype.createNewPeer = function (id) {
        this.peers[id] = new RTCPeer(id, true, this.localStream);
        this.peers[id].sendOffer();
    };
    RTCPeerHandler.prototype.messageHandler = function (message) {
        var body = message.body;
        if (body.type == 'offer') {
            this.peers[message.from] = new RTCPeer(message.from, false, this.localStream);
            this.peers[message.from].gotOffer(body);
        }
        else if (body.type == 'answer') {
            this.peers[message.from].setRemoteDescription(body);
        }
        else if (body.candidate) {
            this.peers[message.from].addIceCandidate(body);
        }
    };
    RTCPeerHandler.prototype.dataSend = function (id, message) {
        this.peers[id].dataChannelSendMessage(message);
    };
    RTCPeerHandler.prototype.deletePeer = function (id) {
        this.peers[id].dispose();
        delete this.peers[id];
    };
    return RTCPeerHandler;
})();

var RTCPeer = (function() {
    function RTCPeer(id, initiator, localStream) {
        var _this = this;
        this.queueRemoteChandidate = [];
        this.sdpRecived = false;
        this.id = id;
        this.initiator = initiator;
        this.peerConnection = new PeerConnection(config, null);
        this.peerConnection.onicecandidate = function (e) { return _this.iceCallback(e); };
        this.sendBuffer = [];
        this.receiveBuffer = '';
    }
    RTCPeer.prototype.sendOffer = function () {
        var _this = this;
        this.dataChannel = this.peerConnection.createDataChannel('dataChannel', {
            "ordered": true
        });
        this.dataChannel.onmessage = function (e) { return _this.dataChannelOnMessage(e); };
        this.dataChannel.onopen = function () { return _this.dataChannelOnOpen(); };
        this.dataChannel.onclose =function () { return _this.dataChannelOnClose(); };
        this.peerConnection.createOffer(function (offer) {
            _this.gotLocalDescription(offer);
        }, function (error) {
            _this.gotError('fail createOffer');
        });
    };
    RTCPeer.prototype.gotOffer = function (description) {
        var _this = this;
        this.peerConnection.ondatachannel = function (e) {
                _this.dataChannel = e.channel;
                _this.dataChannel.onmessage = function (e) { return _this.dataChannelOnMessage(e); };
                _this.dataChannel.onopen = function () { return _this.dataChannelOnOpen(); };
                _this.dataChannel.onclose =function () { return _this.dataChannelOnClose(); };
                _this.dataChannel.onbufferedamountlow =function () { return _this.dataChannelOnBufferedAmountLow(); };
             };
        this.setRemoteDescriptionExec(description, function () {
            _this.sdpRecived = true;
            _this.peerConnection.createAnswer(function (answer) {
                _this.gotLocalDescription(answer);
            }, function (error) {
                _this.gotError('fail createAnswer');
            }, null);
        });
    };
    RTCPeer.prototype.gotLocalDescription = function (description) {
        var _this = this;
        description.sdp = description.sdp.replace(/b=AS:([0-9]+)/g, 'b=AS:'+bandwidth);
        console.log('gotLocalDescription:' + description.sdp);
        this.peerConnection.setLocalDescription(description, function () {
            sendCtrlDirectMessage(_this.id, description);
            if (!_this.initiator) {
                _this.drainCandidate();
            }
        }, function (error) {
            _this.gotError('fail setLocalDescription:' + description.sdp);
        });
    };
    RTCPeer.prototype.setRemoteDescription = function (description) {
        var _this = this;
        this.setRemoteDescriptionExec(description, function () {
            _this.sdpRecived = true;
            _this.drainCandidate();
        });
    };
    RTCPeer.prototype.setRemoteDescriptionExec = function (description, callback) {
        var _this = this;
        console.log('setRemoteDescriptionExec:' + description.sdp);
        this.peerConnection.setRemoteDescription(new SessionDescription(description), callback, function (error) {
            _this.gotError('fail setRemoteDescription:' + description);
        });
    };
    RTCPeer.prototype.drainCandidate = function () {
        if (this.queueRemoteChandidate.length > 0) {
            for (var i = 0; i < this.queueRemoteChandidate.length; i++) {
                this.addIceCandidateExec(this.queueRemoteChandidate[i]);
            }
            this.queueRemoteChandidate = [];
        }
    };
    RTCPeer.prototype.addIceCandidate = function (candidate) {
        if (this.sdpRecived) {
            this.addIceCandidateExec(candidate);
        }
        else {
            this.queueRemoteChandidate.push(candidate);
        }
    };
    RTCPeer.prototype.addIceCandidateExec = function (candidate) {
        var _this = this;
        this.peerConnection.addIceCandidate(new IceCandidate(candidate), function () { }, function (error) {
            _this.gotError('fail addIceCandidate:' + candidate);
        });
    };
    RTCPeer.prototype.iceCallback = function (event) {
        if (event.candidate) {
            sendCtrlDirectMessage(this.id, event.candidate);
        }
    };
    RTCPeer.prototype.dataChannelOnOpen = function () {
        if (typeof this.dataChannel.bufferedAmountLowThreshold === 'number') {
            console.log('Using the bufferedamountlow event for flow control');
            this.usePolling = false;
            this.bufferFullThreshold = chunkSize / 2;
            this.dataChannel.bufferedAmountLowThreshold = this.bufferFullThreshold;
        } else {
            this.usePolling = true;
            this.bufferFullThreshold = chunkSize * 5;
        }
        this.dataChannelEnable = true;
        OnOpen(this.id);
    };
    RTCPeer.prototype.dataChannelOnClose = function () {
        this.dataChannelEnable = false;
    };
    RTCPeer.prototype.dataChannelOnMessage = function (e) {
        if(e.data.substring(e.data.length - 1) == '\0') {
            this.receiveBuffer += e.data.substring(0, e.data.length - 1);
            OnMessage(this.id, this.receiveBuffer);
            this.receiveBuffer = '';
        } else {
            this.receiveBuffer += e.data;
        }
    };
    RTCPeer.prototype.dataChannelSendMessage = function (message) {
        message += '\0';
        if(message <= chunkSize) {
            this.sendBuffer.push(message);
        } else {
            for(var i = 0; i <= message.length; i += chunkSize) {
                this.sendBuffer.push(message.substring(i, i + chunkSize));
            }
        }
        
        var _this = this;
        setTimeout(function() {
                _this.dataChannelOnBufferedAmountLow();
            }, 0);
    };
    RTCPeer.prototype.dataChannelOnBufferedAmountLow = function () {
        while (this.sendBuffer.length > 0) {
            if (this.dataChannel.bufferedAmount > this.bufferFullThreshold) {
                var _this = this;
                if (this.usePolling) {
                    setTimeout(function() {
                            _this.dataChannelOnBufferedAmountLow();
                        }, 250);
                } else {
                    this.listener = function() {
                        _this.dataChannel.removeEventListener('bufferedamountlow', _this.listener);
                        _this.dataChannelOnBufferedAmountLow();
                    };
                    this.dataChannel.addEventListener('bufferedamountlow', this.listener);
                }
                return;
            }
            this.dataChannel.send(this.sendBuffer.shift());  
        }
    };
    RTCPeer.prototype.dispose = function () {
        this.peerConnection.close();
        this.peerConnection = null;
    };
    RTCPeer.prototype.gotError = function (error) {
        console.log('RTCPeer id:' + this.id + ' error:' + error);
    };
    return RTCPeer;
})();