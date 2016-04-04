bitplaycoin

====

Playcoin of bitcoin. Wallet and Miner work on browser. Implemented by socket.io signaling and WebRTC DataChannel.


ビットコインのおもちゃ銀行券です。ウォレットとマイナーがブラウザ上で動作します。socket.ioをシグナリングに利用したWebRTC DataChannelを用いてP2P取引を行います。

## Description

Playcoin of bitcoin. However, this program isn't have compatibility with bitcoin.
This program is made to help understand the blockchain and show traceability of bitcoin.


ビットコインのおもちゃ銀行券ですが、ビットコインとの互換性はありません。
このプログラムはblockchainの理解とビットコインの動きを可視化するために作られています。

## Need your help!

I am sorry for my poor English. Please revise.

英語がしょぼいので、修正に協力してもらえると助かります。

## VS. Bitcoin

* Not transfer. Need to connect each client directly. (Managed by signaling server)
* Use JSON.
* Fixed difficulty.(very fast)
* Lots of other things...


* 転送しません。それぞれのクライアントは相互に接続されている必要があります(シグナリングサーバーにより管理されます)
* JSONを使っています。バイトでパケット整形はしません。
* 難易度が固定になっています。(とても早いです)
* 他にもあるかと…

## Demo

* If you connect long time, A lot of Blocks chained. If newcommers coming at that time, him browsers will be freezed. **Please try it in a short time.**
* If you want to connect long time. please make your own room.
* If you play Demo with single PC. Please use different browser at each connections. (ex. firefox and Chrome.)
* Your public key was stored in local storage when you access first time. If you closed tab, then those key is left. When you connect second times from same browser. And if your transaction chains left to different browser, recalculate your balance from that chain.

* もし長時間接続した場合にはブロックチェーンが肥大して新規参加者のブラウザ停止する原因になります。**短時間でお願いします。**
* もし長時間接続を行いたい場合は自分の部屋を作った上で行ってください。
* もしデモを単一のPCで行う場合、FirefoxとChromeなど異なるブラウザ間でお試しください。
* あなたの公開鍵は初回アクセス時にローカルストレージに保存されています。タブを閉じても、次回接続時に誰かのブラウザにチェインが残っていた場合は残高をそのチェインから再計算します。

### main room
https://conf.space/bitplaycoin/

### sub room

1. https://conf.space/bitplaycoin/index.html?room=sub1
2. https://conf.space/bitplaycoin/index.html?room=sub2
3. https://conf.space/bitplaycoin/index.html?room=sub3
 
### create your own room "hoge"

https://conf.space/bitplaycoin/index.html?room=hoge 
 
### reset your public key

https://conf.space/bitplaycoin/index.html?reset=true

## Usage

1. Wait (Start with 0 balance. However, wait a few minutes. You will got reward of mining.)
2. Send to other (Balance will be reduce than your sent amount at that time. but no problem. When create new block, change will back to your wallet.)


1. 待つ (開始時は残高0ですが、しばらく待つとマイニングの報酬が得られるはずです)
2. 他人に送る (この時、残高は一時的に送金額より減りますが、ブロックが作成されたタイミングでお釣りとして帰ってきます。)


Try to click any boxes! Popup is explain about it.


適当に箱をクリックしてみてください。説明が表示されます。

## Licence

MIT

## Author

[tnoho](https://github.com/tnoho)