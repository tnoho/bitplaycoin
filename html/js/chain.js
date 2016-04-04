var roomname = 'main';
var ownid;
var ownaddress;
var clients = {};
var socket = io();
var peerHandler = new RTCPeerHandler();
var storage = localStorage;
var balance = 0;
var nonceFinder;

var blockChain = [];
var currentBlock = null;
var wallet = [];
var keystore = [];
var powTask = '00';

window.onload = function()
{
    var urlVals = getUrlVars();
    if(isset(urlVals.reset) && urlVals.reset) {
        localStorage.removeItem("key_store");
		log("Reset local storage");
	}
    if(isset(urlVals.room)) {
        roomname = urlVals.room;
	}
    if(!storage.getItem('key_store')) {
        initiator();
    } else {
        log('Welcome back to datachannel chain!');
        startConnection();
    }
};

// from : http://qiita.com/Evolutor_web/items/c9b940f752883676b35d
function getUrlVars(){
	var vars = {};
	var param = location.search.substring(1).split('&');
	for(var i = 0; i < param.length; i++) {
		var keySearch = param[i].search(/=/);
		var key = '';
		if(keySearch != -1) key = param[i].slice(0, keySearch);
		var val = param[i].slice(param[i].indexOf('=', 0) + 1);
		if(key !== '') vars[key] = decodeURI(val);
	}
	return vars;
}

function isset( data ){
	return ( typeof( data ) != 'undefined' );
}

function key2id(key) {
    key = "04" + key;
    key = sha256(key);
    key = RMDstring(key);
    key = "00" + key;
    key = key + sha256(sha256(key)).substring(0, 8);
    var base58Check = "";
    for(var i = 0; i < key.length; i+=6) {
        base58Check += base58.encode(parseInt(key.substring(i, i+6), 16));
    }
    return base58Check;
}

function initiator() {
    log('Welcome to datachannel chain!');
    log('Generating your key pair and balance...');
    
    var ecdsa = new KJUR.crypto.ECDSA({'curve': 'secp256r1'});
    var keypair = ecdsa.generateKeyPairHex();
    var publicKey = keypair.ecpubhex;
    var store = [];
    store.push({
       'address': key2id(publicKey),
       'public_key': publicKey,
       'private_key': keypair.ecprvhex
    });
    storage.setItem('key_store', JSON.stringify(store));
        
    log('Generated!');
    startConnection();
}

function startConnection() {
    keystore = JSON.parse(storage.getItem('key_store'));
    
    ownaddress = keystore[0].address;
    log(keystore[0].private_key);
    log('Your private key is');
    log(keystore[0].public_key);
    log('Your public key is');
    
    document.getElementById("a-id").innerHTML = "id: " + ownaddress;
    log('startConnection');
    
    updateBalance(0);
    createNewBlock('0');
    
    ownid = ownaddress;
    socket.emit('ctrl', {
        'type': 'join',
        'room': roomname,
        'id': ownid,
        'name': ownaddress
    });
}

function updateBalance(value) {
    document.getElementById("span-balance").innerHTML = (value / 100000000).toString();
}

function recalcurateMyBalance() {
    wallet = [];
    balance = 0;
    for(var i = 0; i < blockChain.length; i++) {
        var block = blockChain[i];
        for(var j = 0; j < block.txn.length; j++) {
            var tx = block.txn[j];
            for(var k = 0; k < tx.tx_out.length; k++) {
                for(var l = 0; l < keystore.length; l++) {
                    if(keystore[l].address == tx.tx_out[k].pk_script) {
                        var hash = sha256(JSON.stringify(tx));
                        if(!spendCheck(hash, k)) {
                            balance += Math.round(parseFloat(tx.tx_out[k].value) * 100000000);
                            wallet.push({
                                    'balance': Math.round(parseFloat(tx.tx_out[k].value) * 100000000),
                                    'tx': JSON.parse(JSON.stringify(tx)),
                                    'index': k,
                                    'block_no': i
                                });
                        }
                        break;
                    }
                }
            }
        }
    }
    updateBalance(balance);
}

socket.on('ctrl', function (response) {
    switch (response.type) {
        case 'newcomer':
            if (response.id != ownid) {
                clients[response.id] = response.name;
                refreshClientList();
                log(response.name + ' joined!');
                peerHandler.createNewPeer(response.id);
            }
            break;
        case 'clients':
            clients = {};
            for (var i in response.clients) {
                var client = response.clients[i];
                clients[client.id] = client.name;
            }
            refreshClientList();
            break;
        case 'message':
            if (response.from != ownid) {
                peerHandler.messageHandler(response);
            }
            break;
        case 'leave':
            log(clients[response.id] + ' leaved!');
            peerHandler.deletePeer(response.id);
            delete clients[response.id];
            refreshClientList();
            break;
    }
});

function refreshClientList() {
    if (!($('#input-sendto').val() in clients)) {
        $('#button-sendto').html('None' + ' <span class="caret"></span>');
        $('#input-sendto').val('none');
    }
    var ul = $("#dropdown-menu-sendto");
    ul.empty();
    for (var id in clients) {
        if (id == ownid)
            continue;
        ul.append('<li><a href="#" data-value="' + id + '">' + clients[id] + '</a></li>');
    }
    $("#dropdown-menu-sendto li a").click(function () {
        $('#button-sendto').html($(this).text() + ' <span class="caret"></span>');
        $('#input-sendto').val($(this).attr("data-value"));
    });
}

function log(message) {
    NotifyMessage(message);
}

var Block = (function () {
    function Block (prev_block) {
        this.prev_block = prev_block;
        this.merkle_root = '';
        this.timestamp = Math.round((new Date()).getTime() / 1000);
        this.nonce = 0;
        this.txn = [];
    }
    Block.prototype.appendTx = function (tx) {
        this.txn.push(tx);
        this.calcMerkleHash();
        this.stopFindNonce();
        this.startFindNonce();
    }
    Block.prototype.calcMerkleHash = function () {
        var tempArray1 = [];
        for (var i = 0; i < this.txn.length; i++) {
            tempArray1.push(sha256(sha256(JSON.stringify(this.txn[i]))));
        }
        var tempArray2 = [];
        while (true) {
            tempArray1.sort();
            for (var i = 0; i < tempArray1.length; i += 2) {
                if(tempArray1[i] && tempArray1[i + 1]) {
                    tempArray2.push(sha256(sha256(tempArray1[i] + tempArray1[i + 1])));
                } else {
                    tempArray2.push(sha256(sha256(tempArray1[i] + tempArray1[i])));
                }
            }
            if(tempArray2.length == 1) {
                break;
            }
            tempArray1 = tempArray2;
            tempArray2 = [];
        }
        this.merkle_root = tempArray2[0];
        log("merkle_root calculated from " + this.txn.length +
            " transactions : " + this.merkle_root);
        $('#mining-block-merkle')[0].innerHTML = this.merkle_root;
    };
    Block.prototype.getHeader = function () {
        return {
            'prev_block': this.prev_block,
            'merkle_root': this.merkle_root,
            'timestamp': this.timestamp,
            'nonce': this.nonce
        };
    };
    Block.prototype.startFindNonce = function () {
        var _this = this;
        
        var timestamp_full = (new Date(this.timestamp * 1000)).toString();
        var timestamp_trimed = timestamp_full.substring(4, timestamp_full.indexOf('GMT') - 1);
        $('#mining-block-prev')[0].innerHTML = this.prev_block;
        $('#mining-block-time')[0].innerHTML = timestamp_trimed;
        
        this.nonce = Math.floor( Math.random() * 100001 );
        nonceFinder = setInterval(function () {
            _this.nonce++;
            var header = _this.getHeader();
            var headerHash = sha256(JSON.stringify(header));
            $('#mining-block-title')[0].innerHTML = blockChain.length + " : " + headerHash;
            $('#mining-block-nonce')[0].innerHTML = _this.nonce;
            if(headerHash.lastIndexOf(powTask, 0) == 0) {
                log("Nonce found! nonce:" + _this.nonce +
                    " headerHash: " + headerHash);
                log("find block header is " + JSON.stringify(header));
                if(($('#modal-transaction').data('bs.modal') || {}).isShown != true) {
                    $('#a-yeah').popover('show');
                    setInterval(function () {$('#a-yeah').popover('hide');}, 2000);
                }
                clearInterval(nonceFinder);
                nonceFinder = null;
                
                broadcastData({
                    'type': 'block',
                    'block': currentBlock
                });
                
                currentBlock.myIncomeToWallet();
                uiAddBlock(currentBlock, blockChain.length, headerHash);
                blockChain.push(JSON.parse(JSON.stringify(currentBlock)));
                createNewBlock(headerHash);
            }
        },100);
    };
    Block.prototype.stopFindNonce = function () {
        if(nonceFinder) {
            clearInterval(nonceFinder);
            nonceFinder = null;
        }
    };
    Block.prototype.deserialize = function (json) {
        this.prev_block = json.prev_block;
        this.merkle_root = json.merkle_root;
        this.timestamp = json.timestamp;
        this.nonce = json.nonce;
        for(var i = 0; i < json.txn.length; i++) {
            var tx = new TX();
            tx.deserialize(json.txn[i]);
            this.txn.push(tx);
        }
    };
    Block.prototype.myIncomeToWallet = function () {
        for(var i = 0; i < this.txn.length; i++) {
            var tx = this.txn[i];
            for(var j = 0; j < tx.tx_out.length; j++) {
                var out = tx.tx_out[j];
                for(var k = 0; k < keystore.length; k++) {
                    if(keystore[k].address == out.pk_script) {
                        balance += Math.round(parseFloat(out.value) * 100000000);
                        wallet.push({ 
                                'balance': Math.round(parseFloat(out.value) * 100000000), 
                                'tx': JSON.parse(JSON.stringify(tx)),
                                'index': j,
                                'block_no': blockChain.length
                            });
                        break;
                    }
                }
            }
        }
        updateBalance(balance);
    };
    return Block;
})();

function checkTX(tx) {
    if(tx.tx_in.length == 0) {
        return 0;
    }
    var largeAll = true;
    var priority = 0;
    var in_sum = 0;
    var out_sum = 0;
    var hash_internal_origin = createTxHashInternal(tx);
    var checked_count = 0;
    var i;
    for(i = 0; i < tx.tx_out.length; i++) {
        if(0 > tx.tx_out[i].value || tx.tx_out[i].value > 21000000) {
            log('!!!Invalid value!!! value:' + tx.tx_out[i].value);
            return -1;
        }
        out_sum += Math.round(tx.tx_out[i].value * 100000000);
        if(tx.tx_out[i].value < 0.01 * 100000000) {
            largeAll = false;
        }
    }
    for(i = 0; i < tx.tx_in.length; i++) {
        var hash = tx.tx_in[i].hash;
        var index = tx.tx_in[i].index;
        var sign_script = tx.tx_in[i].signature_script.split('|');
        var publicKey = sign_script[0];
        var signeture = sign_script[1];
        if(spendCheck(hash, index)) {
            log('!!!Double spend!!! hash:' + hash + ' index:' + index);
            return -1;
        }
        for(var j = 0; j < blockChain.length; j++) {
            var block = blockChain[j];
            for(var k = 0; k < block.txn.length; k++) {
                var prevTX = block.txn[k];
                if(hash == sha256(JSON.stringify(prevTX))) {
                    var balance =  Math.round(prevTX.tx_out[index].value * 100000000);
                    priority += balance * (blockChain.length - j);
                    in_sum += balance;
                    var address = prevTX.tx_out[index].pk_script;
                    if(key2id(publicKey) != address) {
                        log('!!!Address is not match!!! key2id(publicKey):' + key2id(publicKey) + ' address:' + address);
                        return -1;
                    }
                    
                    var hash_internal = $.extend(true, [], hash_internal_origin);
                    hash_internal.tx_in[i].signature_script = address;
                    
                    var signature = new KJUR.crypto.Signature({'alg': 'SHA256withECDSA', 'prov': 'cryptojs/jsrsa'});
                    signature.initVerifyByPublicKey({'ecpubhex': publicKey, 'eccurvename': 'secp256r1'});
                    signature.updateString(sha256(sha256(JSON.stringify(hash_internal))));
                    if(signature.verify(signeture)) {
                        checked_count++;
                    } else {
                        log('!!!Sign is not match!!! signeture:' + signeture + ' address:' + address);
                        return -1;
                    }
                }
            }
        }
    }
    if (tx.tx_in.length != checked_count) {
        log('!!!Invalid IN is not enough!!! tx_in.length:' + tx.tx_in.length + ' checked_count:' + checked_count);
        return -1;
    }
    if (out_sum > in_sum) {
        log('!!!Invalid IN value is not enough!!! out_sum:' + out_sum / 100000000 + ' checked_count:' + in_sum / 100000000);
        return -1;
    }
    var requireFee = 0;
    var fee = Math.round(in_sum - out_sum) / 100000000;
    priority /= (JSON.stringify(tx.tx_in)).length;
    var txLength = (JSON.stringify(tx)).length;
    if(57600000 <= priority || txLength <= 1000 || largeAll) {
        requireFee = 0;
    } else {
        requireFee = Math.round(Math.ceil(txLength / 1000) * 0.0001 * 100000000) / 100000000;
    }
    if(fee => requireFee) {
        log('Valid TX fee is :' + fee);
        return fee;
    } else {
        log('!!!Invalid fee is not enough!!! requireFee:' + requireFee + ' fee:' + fee);
        return -1;
    }
}
    
function spendCheck(hash, index) {
    for(var j = 0; j < blockChain.length; j++) {
        var block = blockChain[j];
        for(var k = 0; k < block.txn.length; k++) {
            var tx = block.txn[k];
            for(var l = 0; l < tx.tx_in.length; l++) {
                if(hash == tx.tx_in[l].hash && index == tx.tx_in[l].index) {
                    return true;
                }
            }
        }
    }
    return false;
}

function spendCheckCurrentBlock(hash, index) {
    for(var k = 0; k < currentBlock.txn.length; k++) {
        var tx = currentBlock.txn[k];
        for(var l = 0; l < tx.tx_in.length; l++) {
            if(hash == tx.tx_in[l].hash && index == tx.tx_in[l].index) {
                currentBlock.txn.splice(k, 1);
                return true;
            }
        }
    }
    return false;
}

function createNewBlock(prevHeaderHash) {
    if (currentBlock) {
        currentBlock.stopFindNonce();
    }
    currentBlock = new Block(prevHeaderHash);
    var tx = new TX();
    tx.appendOut(blockHeight2Reward(blockChain.length), ownaddress);
    currentBlock.appendTx(tx);
}

function blockHeight2Reward(height) {
    return 50 * Math.pow(0.5, Math.floor(height / 210000));
}

var TX = (function () {
    function TX () {
        this.tx_in = [];
        this.tx_out = [];
        this.lock_time = (new Date()).getTime();
    }

    var TxIn = (function () {
        function TxIn (hash, index, signature_script) {
            //The hash of the referenced transaction.
            this.hash = hash;
            //Use out index number
            this.index = index;
            //Computational Script for confirming transaction authorization.
            this.signature_script = signature_script;
            //not used by bitcoin
            this.sequence = 0;
        }
        return TxIn;
    })();

    var TxOut = (function () {
        function TxOut (value, pk_script) {
            //Transaction Value
            this.value = value;
            //the public key 
            this.pk_script = pk_script;
        }
        return TxOut;
    })();
    
    TX.prototype.deserialize = function (json) {
        this.lock_time = json.lock_time;
        var i;
        for(i = 0; i < json.tx_in.length; i++) {
            this.tx_in.push(new TxIn(
                json.tx_in[i].hash, json.tx_in[i].index, json.tx_in[i].signature_script));
        }
        for(i = 0; i < json.tx_out.length; i++) {
            this.tx_out.push(new TxOut(
                json.tx_out[i].value, json.tx_out[i].pk_script));
        }
    }
    
    TX.prototype.appendIn = function (tx, index) {
        var hash = sha256(JSON.stringify(tx));
        this.tx_in.push(new TxIn(hash, index, tx.tx_out[index].pk_script));
    }
    
    TX.prototype.appendOut = function (value, pk_script) {
        this.tx_out.push(new TxOut(value, pk_script));
    }
    
    TX.prototype.finalize = function () {
        var hash_internal_origin = createTxHashInternal(this);
        
        for(i = 0; i < this.tx_in.length; i++) {
            var hash_internal = $.extend(true, [], hash_internal_origin);
            var address = this.tx_in[i].signature_script;
            var publicKey;
            var privateKey;
            for(var j = 0; j < keystore.length; j++) {
                if(keystore[j].address == address) {
                    publicKey = keystore[j].public_key;
                    privateKey = keystore[j].private_key;
                    break;
                }
            }
            if(publicKey == null || privateKey == null) {
                return false;
            }
            hash_internal.tx_in[i].signature_script = address;
            
            var signature = new KJUR.crypto.Signature({'alg': 'SHA256withECDSA'});
            signature.initSign({'ecprvhex': privateKey, 'eccurvename': 'secp256r1'});
            signature.updateString(sha256(sha256(JSON.stringify(hash_internal))));
            var signature = signature.sign();
            
            this.tx_in[i].signature_script = publicKey + '|' + signature
        }
        return true;
    }
    
    return TX;
})();

function createTxHashInternal(tx) {
    var tx_in = [];
    var i;
    for(i = 0; i < tx.tx_in.length; i++) {
        tx_in.push({
            'hash': tx.tx_in[i].hash,
            'index': tx.tx_in[i].index
        });
    }

    return {
        'tx_in': tx_in,
        'tx_out': tx.tx_out,
        'lock_time': tx.lock_time
    };
}

function OnOpen(id) {
    sendGetHeaders(id);
}

function sendGetHeaders(id) {
    peerHandler.dataSend(id, JSON.stringify({
            'type': 'get_headers',
            'block_locator': createBlockLocater()
        }));
}

function sendHeaders(id, block_locator) {
    var headers = [];
    var i = selectStartBlockIndex(block_locator);
    while(i < blockChain.length) {
        var block = blockChain[i];
        headers.push({
                'prev_block': block.prev_block,
                'merkle_root': block.merkle_root,
                'timestamp': block.timestamp,
                'nonce': block.nonce
            });
        i++;
    }
    peerHandler.dataSend(id, JSON.stringify({
        'type': 'headers',
        'headers': headers }));
}

function sendGetBlocks(id, block_locator) {
    peerHandler.dataSend(id, JSON.stringify({
            'type': 'get_blocks',
            'block_locator': block_locator,
            'hash_stop': 0
        }));
}

function createBlockLocater(index) {
    var hashArray = [];
    var i = (index == null) ? blockChain.length - 1 : index;
    var step = 1;
    while(1 < i) {
        if(blockChain[i] != null && 'prev_block' in blockChain[i]) {
            hashArray.push(blockChain[i].prev_block);
        }
        i -= step;
        step *= 2;
    }
    hashArray.push('0')
    return hashArray;
}

function selectStartBlockIndex(block_locator) {
    if(block_locator == null) {
        return 0;
    }
    var i;
    for(i = blockChain.length - 1; i >= 0; i--) {
        for(var j = 0; j < block_locator.length; j++) {
            if(block_locator[j] == blockChain[i].prev_block) {
                return i;
            }
        }
    }
    return 0;
}

function OnMessage(id, message) {
    log(message);
    var jsonMsg = JSON.parse(message);
    switch (jsonMsg.type) {
        case 'transaction':
            setTimeout(function () {
                var fee = checkTX(jsonMsg.transaction);
                if(currentBlock && fee >= 0) {
                    var tx = new TX();
                    tx.deserialize(jsonMsg.transaction);
                    for(var i = 0; i < tx.tx_in.length; i++) {
                        var hash = tx.tx_in[i].hash;
                        var index = tx.tx_in[i].index;
                        if(spendCheckCurrentBlock(hash, index)) {
                            log('!!!Double spend!!! hash:' + hash + ' index:' + index);
                            return;
                        }
                    }
                    currentBlock.txn[0].tx_out[0].value += fee;
                    currentBlock.appendTx(tx);
                }
            }, 0);
            break;
        case 'get_headers':
            sendHeaders(id, jsonMsg.block_locator);
            break;
        case 'headers':
            var recivedHeaders = [];
            if(jsonMsg.headers.length == 0) {
                break;
            }
            var first_prev_block = jsonMsg.headers[0].prev_block;
            for(var i = 0; i < blockChain.length; i++) {
                if(first_prev_block == blockChain[i].prev_block) {
                    break
                }
                recivedHeaders.push(blockChain[i]);
            }
            for(var i = 0; i < jsonMsg.headers.length; i++) {
                recivedHeaders.push(jsonMsg.headers[i]);
            }
            if(recivedHeaders.length > blockChain.length) {
                var prev_block = 0;
                var i;
                for(i = 0; i < blockChain.length; i++) {
                    if(recivedHeaders[i].prev_block != blockChain[i].prev_block) {
                        break;
                    }
                    prev_block = blockChain[i].prev_block
                }
                if(i > blockChain.length) {
                    i = 0;
                }
                sendGetBlocks(id, createBlockLocater(i));
            }
            break;
        case 'get_blocks':
            var blocks = [];
            var i = selectStartBlockIndex(jsonMsg.block_locator);
            while(i < blockChain.length) {
                blocks.push(blockChain[i]);
                i++;
            }
            peerHandler.dataSend(id, JSON.stringify({
                'type': 'inv_block',
                'blocks': blocks }));
            break;
        case 'inv_block':
            setTimeout(function () {
                var recivedChain = [];
                var first_prev_block = jsonMsg.blocks[0].prev_block;
                for(var i = 0; i < blockChain.length; i++) {
                    if(first_prev_block == blockChain[i].prev_block) {
                        break
                    }
                    recivedChain.push(blockChain[i]);
                }
                for(var i = 0; i < jsonMsg.blocks.length; i++) {
                    recivedChain.push(jsonMsg.blocks[i]);
                }
                if(recivedChain.length > blockChain.length) {
                    if(checkAllBlocksChained(recivedChain)) {
                        log("All blocks chained! override own chain.");
                        blockChain = recivedChain;
                        uiBlockAllRemove();
                        for(var i = 0; i < blockChain.length; i++) {
                            uiAddBlock(blockChain[i], i,
                                (blockChain[i+1])?blockChain[i+1].prev_block : 
                                sha256(JSON.stringify({
                                        'prev_block': blockChain[i].prev_block,
                                        'merkle_root': blockChain[i].merkle_root,
                                        'timestamp': blockChain[i].timestamp,
                                        'nonce': blockChain[i].nonce
                                    })));
                        }
                        var newBlock = new Block('');
                        newBlock.deserialize(recivedChain[recivedChain.length - 1]);
                        var header = newBlock.getHeader();
                        var headerHash = sha256(JSON.stringify(header));
                        createNewBlock(headerHash);
                        recalcurateMyBalance();
                    } else {
                        log("blocks not chained!");
                    }
                }
            }, 0);
            break;
        case 'block':
            setTimeout(function () {
                var newBlock = new Block('');
                newBlock.deserialize(jsonMsg.block);
                if (currentBlock && currentBlock.prev_block != '' && 
                        currentBlock.prev_block != newBlock.prev_block) {
                    log("ignore new block : prev_block incorrect.");
                    sendGetHeaders(id);
                    return;
                }
                var header = newBlock.getHeader();
                log("new block header is " + JSON.stringify(header));
                var headerHash = sha256(JSON.stringify(header));
                log("new block hash is " + headerHash);
                var currentReward = 0;
                var calcReward = blockHeight2Reward(blockChain.length) * 100000000;
                for (var i = 0; i < newBlock.txn.length; i++) {
                    var tx = newBlock.txn[i];
                    var fee = checkTX(tx);
                    if(fee == -1) {
                        log("ignore new block : invalid TX included.");
                        return;
                    }
                    calcReward += Math.round(fee * 100000000);
                    if(tx.tx_in.length == 0) {
                        for (var j = 0; j < tx.tx_out.length; j++) {
                            currentReward += Math.round(tx.tx_out[j].value * 100000000);
                        }
                    }
                }
                calcReward = Math.round(calcReward) / 100000000;
                currentReward = Math.round(currentReward) / 100000000;
                if(currentReward != calcReward) {
                    log("ignore new block : reward mismatch. calcurate reward:" 
                        + calcReward + " current reward:" + currentReward);
                    return;
                }
                if(headerHash.lastIndexOf(powTask, 0) == 0) {
                    log("accept new block");
                    newBlock.myIncomeToWallet();
                    uiAddBlock(newBlock, blockChain.length, headerHash);
                    blockChain.push(jsonMsg.block);
                    createNewBlock(headerHash);
                } else {
                    log("ignore new block : hash is not match");
                }
            }, 0);
            break;
    }
}

function checkAllBlocksChained(receivedBlockChain) {
    var allBlocksChained = true;
    if(receivedBlockChain.length >= 2) {
        for(var i = 1; i < receivedBlockChain.length; i++) {
            var prevBlock = receivedBlockChain[i - 1];
            var prevBlockHash = sha256(JSON.stringify({
                    'prev_block': prevBlock.prev_block,
                    'merkle_root': prevBlock.merkle_root,
                    'timestamp': prevBlock.timestamp,
                    'nonce': prevBlock.nonce
                }));
            if(receivedBlockChain[i].prev_block != prevBlockHash) {
                allBlocksChained = false;
            }
        }
    }
    return allBlocksChained;
}

function NotifyMessage(message) {
    var divHistory = document.getElementById("div-history");
    var divPost = document.createElement('div');
    divPost.innerHTML = message;
    divHistory.insertBefore(divPost, divHistory.firstChild);
}

function sendCtrlDirectMessage(to, body) {
    socket.emit('ctrl', {
        'type': 'message',
        'to': to,
        'body': body
    });
}

$("#form-send").submit(function (event) {
    event.preventDefault();
    setTimeout(function () {
        remittance();
    }, 0);
});

function remittance() {
    var toId =  $('#input-sendto').val();
    if (toId == 'none') {
        return;
    }
    var strValue = $('#input-value').val()
    if(strValue == null || strValue.length == 0) {
        return;
    }
    var value = parseFloat(strValue) * 100000000;
    if(isNaN(value) || value <= 0) {
        return;
    }
    
    wallet.sort(function (a, b) {
       if(a.balance < b.balance) return -1;
       if(a.balance > b.balance) return 1;
        return 0;
    })
    
    var i;
    var fee = 0;
    var prevFee = -1;
    var balanceSum = 0;
    while(true) {
        var tx = new TX();
        tx.appendOut(value / 100000000, clients[toId]);
        
        balanceSum = 0;
        var priority = 0;
        var largeAll = true;
        
        if(value < 0.01 * 100000000) {
            largeAll = false;
        }
        for(i = 0; i < wallet.length; i++) {
            var waBalance = parseFloat(wallet[i].balance);
            balanceSum += waBalance;
            priority += waBalance * (blockChain.length - parseInt(wallet[i].block_no));
            tx.appendIn(wallet[i].tx, wallet[i].index);
            if(balanceSum >= value + fee) {
                break;
            }
        }
        if(balanceSum < value + fee) {
            return;
        }
        
        if(balanceSum - value - fee > 0) {
            var change = Math.round(balanceSum - value - fee);
            tx.appendOut(change / 100000000, ownaddress);
            if(change < 0.01 * 100000000) {
                largeAll = false;
            }
        }
        
        if(!tx.finalize()) {
            return;
        }
        
        priority /= (JSON.stringify(tx.tx_in)).length;
        
        var txLength = (JSON.stringify(tx)).length;
        if(57600000 <= priority || txLength <= 1000 || largeAll) {
            break;
        }
        
        fee = Math.round(Math.ceil(txLength / 1000) * (0.0001 * 100000000));
        
        if(prevFee == fee) {
            break;
        } else {
            prevFee = fee;
        }
    }
    
    wallet.splice(0, i + 1);
    balance -= balanceSum;
    updateBalance(balance);
        
    broadcastData({
        'type': 'transaction',
        'transaction': tx
    });
    
    if(currentBlock) {
        currentBlock.txn[0].tx_out[0].value += fee / 100000000;
        currentBlock.appendTx(tx);
    }
    $('#input-value').val('');
}

function broadcastData(message) {
    log(JSON.stringify(message));
    for(var id in clients) {
        if (id == ownid)
            continue;
        peerHandler.dataSend(id, JSON.stringify(message));
    }
}

function generateUUID() {
    var uuid = "", i, random;
    for (i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0;
        if (i == 8 || i == 12 || i == 16 || i == 20) {
            uuid += "-";
        }
        uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
    }
    return uuid;
}