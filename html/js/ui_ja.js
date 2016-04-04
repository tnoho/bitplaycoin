$('.has-popover').popover({trigger:'focus'});

$('.prev_block').popover({
    title:'prev_block',
    content: '一つ前のブロックから生成されたハッシュ値が入っています',
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
        content: '一つ前のブロックから生成されたハッシュ値が入っています。' + block.prev_block,
        trigger:'focus',
        placement:'bottom',
        html : true,
        container: 'body'});
    $('#block-merkle-' + i).popover({
        title:'merkle_root',
        content: 'Blockに含まれるすべての取引からツリー状に合算したハッシュ値が入っています。' + block.merkle_root,
        trigger:'focus',
        placement:'bottom',
        html : true,
        container: 'body'});
    $('#block-time-' + i).popover({
        title:'timestamp',
        content: 'ブロックが生成された時間が入っています。' + timestamp_full,
        trigger:'focus',
        placement:'bottom',
        html : true,
        container: 'body'});
    $('#block-nonce-' + i).popover({
        title:'nonce',
        content: 'このブロックのハッシュ値を先頭 ' + powTask + ' にするため付加された値です。(PoW)' + block.nonce,
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
            content: '送金先のアドレスが含まれています。自分向けは濃い青色になっています。',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
        $('#txout-value-' + i).popover({
            title:'value',
            content: '送金額です。釣り銭(TxIn総額-送金額)は自分への送金になっています。' +
                'さらに釣り銭を引いた時の差額は手数料(TxIn総額-送金額-釣り銭)です。',
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
            content: '自分がCoinを受け取った時のTransactionのハッシュです。',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
        $('#txin-index-' + i).popover({
            title:'index',
            content: '上記のハッシュのTransactionにおいて、今回利用したTxOutの番号です。',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
        $('#txin-sign-' + i).popover({
            title:'signature_script',
            content: '署名スクリプトです。bitcoinの場合は署名と利用したTxOutのアドレスにおける公開鍵が含まれます。' +
                '今回利用したTxOutのアドレスと、これに含まれる公開鍵のアドレス計算値が一致することを確認した上で、' +
                '(このTransaction + 今回利用したTxOutのアドレス)をハッシュ化した値が公開鍵で署名されていることを確認します',
            trigger:'focus',
            placement:'bottom',
            html : true,
            container: 'body'});
    }
    if(tx.tx_in.length == 0) {
        $('#div-txin').append(
            'Miningの成功報酬の場合はTxInがありません。'
        );
    }
    $('#modal-transaction').modal('show');
}