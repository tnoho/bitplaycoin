$('.has-popover').popover({trigger:'focus'});

$('.prev_block').popover({
    title:'prev_block',
    content: 'previous block hash.',
    trigger:'focus',
    placement:'bottom'});

function uiBlockAllRemove() {
    $('#ul-block').empty();
}

function uiAddBlock(block, i, hash) {
    var atLast = false;
    if($('#ul-block')[0].scrollWidth <= $('#ul-block')[0].scrollLeft + $('#ul-block')[0].clientWidth + 30) {
        atLast = true;
    }
    
    var timestamp_full = new Date(block.timestamp * 1000).toString();
    var timestamp = timestamp_full.substring(4, timestamp_full.indexOf('GMT') - 1);
    $('#ul-block').append(
            '<li class="span-block"><div class="panel panel-danger">' +
            '<div class="panel-heading block-panel-heading clickable" id="block-header-' + i +'"><h5 class="panel-title">' + 
            i + ' : ' + hash.substring(0, 9) + '...</h5></div>' +
            '<div class="panel-body block-panel-body" id="block-body-' + i +'"><div class="btn-group-vertical" role="group">' +
            '<a tabindex="0" type="button" class="btn btn-default btn-xs" id="block-prev-' + i +'">' + 
            block.prev_block.substring(0, timestamp.length - 3) + '...</a>' +
            '<a tabindex="0" type="button" class="btn btn-default btn-xs" id="block-merkle-' + i +'">' + 
            block.merkle_root.substring(0, timestamp.length - 3) + '...</a>' +
            '<a tabindex="0" type="button" class="btn btn-default btn-xs" id="block-time-' + i +'">' + timestamp + '</a>' +
            '<a tabindex="0" type="button" class="btn btn-default btn-xs" id="block-nonce-' + i +'">' + block.nonce + '</a>' +
            '</div></div></div></li>'
        );

    if(atLast) {
        $('#ul-block')[0].scrollLeft = $('#ul-block')[0].scrollWidth;
    }
    
    $('#block-header-' + i).on('click', function (e) {
        for(var j = 0; j < blockChain.length; j++) {
            $('#block-body-' + j).removeClass('block-panel-body-selected');
        }
        refreshTXList(i, hash, block);
        $('#block-body-' + i).addClass('block-panel-body-selected');
    });
    
    $('#block-prev-' + i).popover({
        title:'prev_block',
        content: 'previous block hash. ' + block.prev_block,
        trigger:'focus',
        placement:'bottom',
        html : true,
        container: 'body'});
    $('#block-merkle-' + i).popover({
        title:'merkle_root',
        content: 'this hash is calculated from all of transactions in the Block. ' + block.merkle_root,
        trigger:'focus',
        placement:'bottom',
        html : true,
        container: 'body'});
    $('#block-time-' + i).popover({
        title:'timestamp',
        content: 'Time of generate the block. ' + timestamp_full,
        trigger:'focus',
        placement:'bottom',
        html : true,
        container: 'body'});
    $('#block-nonce-' + i).popover({
        title:'nonce',
        content: 'Additional value for the head of this block hash changed to ' + powTask + '. (PoW)' + block.nonce,
        trigger:'focus',
        placement:'bottom',
        html : true,
        container: 'body'});
}

function refreshTXList(i, hash, block) {
    $('#h3-tx')[0].innerHTML = "Transactions  Block " + i + " : " + hash;
    $('#div-txlist').empty();
    for(i = 0; i < block.txn.length; i++) {
        var tx = block.txn[i];
        var value = 0;
        var mine = false;
        for(var j = 0; j < tx.tx_out.length; j++) {
            var out = tx.tx_out[j];
            value += Math.round(parseFloat(out.value) * 100000000);
            for(var k = 0; k < keystore.length; k++) {
                if(keystore[k].address == out.pk_script) {
                    mine = true;
                }
            }
        }
        
        var txhash = sha256(sha256(JSON.stringify(tx)));
        $('#div-txlist').append(
            '<a href="#" class="list-group-item' + ((mine) ? ' list-group-item-info' : '') +
            '" id="a-tx-' + i + '"><span class="badge">$ ' +
            (value / 100000000) + '</span>' + txhash + '</a>'
        );
        
        $('#a-tx-' + i)[0].onclick = (function (txhash, tx) {
            return function (){setTxModalDetails(txhash, tx)}})(txhash, tx);
    }
}

function setTxModalDetails(hash, tx) {
    $('#modal-tx-title')[0].innerHTML = "Transaction " + hash;
    var i;
    $('#div-txout').empty();
    for(i = 0; i < tx.tx_out.length; i++) {
        var txout = tx.tx_out[i];
        var mine = false;
        for(var k = 0; k < keystore.length; k++) {
            if(keystore[k].address == txout.pk_script) {
                mine = true;
            }
        }
        $('#div-txout').append(
            '<div class="btn-group-vertical full-width spacer-double" role="group">' +
            '<a tabindex="0" type="button" class="btn ' + ((mine) ? 'btn-primary' : 'btn-info') + 
            ' btn-xs ellipsis" id="txout-pk-' + i + '">' + txout.pk_script + '</a>' +
            '<a tabindex="0" type="button" class="btn btn-default btn-xs ellipsis" id="txout-value-' + i + '">' + txout.value + '</a>' +
            '</div>'
        );
        $('#txout-pk-' + i).popover({
            title:'pk_script',
            content: 'Destination address. My address is shown dark blue.',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
        $('#txout-value-' + i).popover({
            title:'value',
            content: 'remittance. the change is remittance for own self. the change (sum of TxIn - remittance) is remittance for own self.' +
                'the other rest(sum of TxIn - remittance - change) is transaction fee.',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
    }
    $('#div-txin').empty();
    for(i = 0; i < tx.tx_in.length; i++) {
        var txin = tx.tx_in[i];
        $('#div-txin').append(
            '<div class="btn-group-vertical full-width spacer-double" role="group">' +
            '<a tabindex="0" type="button" class="btn btn-info btn-xs ellipsis" id="txin-hash-' + i + '">' + txin.hash + '</a>' +
            '<a tabindex="0" type="button" class="btn btn-default btn-xs ellipsis" id="txin-index-' + i + '">' + txin.index + '</a>' +
            '<a tabindex="0" type="button" class="btn btn-default btn-xs ellipsis" id="txin-sign-' + i + '">' + txin.signature_script + '</a>' +
            '</div>'
        );
        
        $('#txin-hash-' + i).popover({
            title:'hash',
            content: 'Hash of transaction that the coin was recieved.',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
        $('#txin-index-' + i).popover({
            title:'index',
            content: 'This value is index of TxOut inside above transaction that, point the source of coin.',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
        $('#txin-sign-' + i).popover({
            title:'signature_script',
            content: 'Signature script. In case of bitcoin. This script include Electronic signature and Public Key of above TxOut Address.' +
                'Address of calculated from Public Key must agree with the above TxOut address.' +
                'hash(This Transaction + above TxOut address) was electronic signed. this sign is checked by public key.',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
    }
    if(tx.tx_in.length == 0) {
        $('#div-txin').append(
            'Mining reward transaction do not have TxIn.'
        );
    }
    $('#modal-transaction').modal('show');
}