class wooControler {
  constructor() {
    this.debug = [];
    this.bot = 0;

    this.myTexts = [];
    this.otherTexts = [];
    this.texts = [];

    this.historyMyTexts = [];
    this.historyOtherTexts = [];
    this.historyTexts = [];

    this.recordOtherId = 0;
    this.otherId = 0;

    this.replyMid = -1;

    this.sendFirstTextFlag = false;
    this.blockListId = 0;
    this.appendAutostartCheckBox();
    this.appendAutoReplyCheckBox();
    this.appendBlockCheckBox();
    this.appendBlockList();
    this.autoRecord();
    document.querySelector('#checkbox-autostart').onclick = () => {
      this.autoStart();
    }
    document.querySelector('#checkbox-autoReply').onclick = () => {
      this.autoReply();
    }
    document.querySelector('#checkbox-block').onclick = () => {
      this.block();
    }
    document.querySelector('#add-block-list').onclick = () => {
      this.appendBlockList();
    }
  }

  resetText() {
    this.myTexts = [];
    this.otherTexts = [];
    this.replyMid = -1;
  }

  extractOtherText(text) {
    if(typeof text === 'object') {
      text = text.textContent;
    }
    text = text.slice('陌生人：'.length, -1);
    text = text.slice(0, text.lastIndexOf(' ('));
    return text;
  }

  extractMyText(text) {
    if(typeof text === 'object') {
      text = text.textContent;
    }
    text = text.slice('我：'.length, -1);
    text = text.slice(0, text.lastIndexOf('已'));
    return text;
  }

  _clearInput() {
    messageInput.value = '';
  }

  send(text) {
    if(document.querySelector('#sendButton input').value !== "回報" && this.isChat()) {
      messageInput.value = text;
      document.querySelector('#sendButton input').click()
    }
  }

  sendBotReply(otherId, text) {
    if(otherId != this.otherId) { return; }
    if(document.querySelector('#sendButton input').value !== "回報" && this.isChat()) {
      messageInput.value = text;
      document.querySelector('#sendButton input').click()
    }
  }

  sendMsg() {
    if (document.querySelector('#sendButton input').value !== "回報" && this.isChat()) {
      document.querySelector('#sendButton input').click()
    }
  }

  isTitle() {
    let systemTexts = document.querySelectorAll('.system.text');
    if(systemTexts.length === 1) {
      let otherTexts = document.querySelectorAll('.stranger.text');
      let myTexts = document.querySelectorAll('.my.text');
      if(otherTexts.length === 0 &&
        myTexts.length === 0) {
        return true;
      }
    } else {
      return false;
    }
  }

  isWait() {
    let systemTexts = document.querySelectorAll('.system.text');
    if(systemTexts.length === 3 &&
      systemTexts[0].textContent === "系統訊息：粉絲專頁 | 尋人啟事 | App下載") {
      return true;
    } else {
      return false;
    }
  }

  isChat() {
    let systemTexts = document.querySelectorAll('.system.text');
    if(systemTexts.length >= 2) {
      let systemTextSp = systemTexts[systemTexts.length-2].textContent.split("離開");
      if (systemTextSp[1] === "了，請按") {
        return false;
      }
    }
    if(systemTexts.length >= 3 &&
      (systemTexts[0].textContent === "系統訊息：加密連線完成，開始聊天囉！" ||
        systemTexts[2].textContent === "系統訊息：加密連線完成，開始聊天囉！")) {
      return true;
    }

    if(systemTexts.length >= 1) {
      let otherTexts = document.querySelectorAll('.stranger.text');
      let myTexts = document.querySelectorAll('.my.text');
      if(otherTexts.length > 0 || myTexts.length > 0) {
        return true;
      }
    }
    return false;
  }

  isLeave() {
    let systemTexts = document.querySelectorAll('.system.text');
    if(systemTexts.length >= 2) {
      let systemTextSp = systemTexts[systemTexts.length - 2].textContent.split("離開")
      if (systemTextSp[1] === "了，請按") {
        this.updateRecord();
        return true;
      }
    }
    return false;
  }

  leaveChat() {
    document.querySelector('#changeButton > input').click();
    let ensureText = document.querySelector('#ensureText');
    if(ensureText !== null) {
      ensureText.value = 'leave';
    }
    document.querySelector('#popup-yes').click();
  }

  sendFirstText = () => {
    if(this.sendFirstTextInterval === void 0 &&
      document.querySelectorAll('.me.text').length === 0) {
      const self = this;
      this.sendFirstTextInterval = setInterval(() => {
        let firstText = document.querySelector('#first-text').value
        let stopFlag = false;
        for(let sendedText of document.querySelectorAll('.me.text')) {
          if(self.extractMyText(sendedText) === firstText) {
            stopFlag = true;
          }
        }
        if(stopFlag || self.isTitle() || self.isLeave()) {
          clearInterval(self.sendFirstTextInterval);
          self.sendFirstTextInterval = undefined;
        } else {
          document.getElementById('messageInput').value = firstText;
          self.sendMsg();
        }
      }, 300);
    }
  }

  updateRecord() {
    if(this.myTexts.length == 0 && this.otherTexts.length && !this.isChat()) { return; }
    let myTexts = [];
    document.querySelectorAll('.me.text').forEach(e => myTexts.push({'mid':+e.getAttribute('mid'), 'text':this.extractMyText(e.textContent)}));
    let otherTexts = [];
    document.querySelectorAll('.stranger.text').forEach(e => otherTexts.push({'mid':+e.getAttribute('mid'), 'text':this.extractOtherText(e.textContent)}));

    if(myTexts.length !== 0) {
      let lastMidOfMyText;
      if(this.myTexts.length !== 0) {
        lastMidOfMyText = this.myTexts[this.myTexts.length - 1].mid;
      } else {
        lastMidOfMyText = -1;
      }
      for(let msg of myTexts) {
        if(msg.mid > lastMidOfMyText) {
          this.myTexts.push(msg);
        }
      }
    }

    if(otherTexts.length !== 0) {
      let lastMidOfOtherText;
      if(this.otherTexts.length !== 0) {
        lastMidOfOtherText = this.otherTexts[this.otherTexts.length - 1].mid;
      } else {
        lastMidOfOtherText = -1;
      }
      for(let msg of otherTexts) {
        if(msg.mid > lastMidOfOtherText) {
          this.otherTexts.push(msg);
        }
      }
    }
  }

  autoRecord() {
    const self = this;
    this.recordInterval = setInterval(() => {
      self.updateRecord();
      if((!self.isChat()) && (self.myTexts.length || self.otherTexts.length)) {
        self.historyMyTexts.push(self.myTexts);
        self.historyOtherTexts.push(self.otherTexts);
        self.resetText();
        self.leaveChat();
      }
    }, 1000);
  }

  autoStart() {
    if(this.autoStartInterval === void 0) {
      const self = this;
      this.autoStartInterval = setInterval(() => {
        let systemTexts = document.querySelectorAll('.system.text');
        if(systemTexts[0].textContent === "系統訊息：WooTalk系統出了一些狀況，我們正在緊急維護中U+0001F605請稍後即可繼續聊天至粉絲專頁獲取更多相關資訊") {
          self.sendFirstTextFlag = false;
          setTimeout(() => {
            self.leaveChat();
          }, 30000);
        } else if (self.isTitle()) {
          document.querySelector('#startButton').click()
          let firstText = document.querySelector('#first-text').value;
          self.otherId = self.historyOtherTexts.length;
          if(firstText) { self.sendFirstTextFlag = true; }
        } else if(self.isWait() || self.isChat()) {
          if (self.sendFirstTextFlag) {
            self.sendFirstTextFlag = false;
            self.sendFirstText();
          }
        } else {
          self.sendFirstTextFlag = false;
          clearInterval(self.sendFirstTextInterval);
          self.sendFirstTextInterval = undefined;
          self.leaveChat();
        }
      }, 2500);
      console.log("start autoStart");
      return "start autoStart";
    }

    if(this.autoStartInterval) {
      //document.querySelector('#first-text').style.display = "none"
      clearInterval(this.sendFirstTextInterval);
      this.sendFirstTextInterval = undefined;
      clearInterval(this.autoStartInterval);
      this.autoStartInterval = undefined;
      console.log("stop autoStart");
      return "stop autoStart";
    }
  }

  block() {
    const self = this;
    if (this.blockInterval === void 0) {
      this.blockInterval = setInterval(() => {
        let otherMsgsLen = document.querySelectorAll('.stranger.text').length;
        let scanSize = document.querySelector('#block-scan-size').value;
        let breakFlag = false;

        if(!scanSize) { scanSize = 0; }
        let otherTextObjs = document.querySelectorAll('.stranger.text');
        let blockListLabels = document.querySelectorAll('.block-list');
        if(self.isChat() && document.querySelector('.loadMoreButton').style.display == 'none') {
          for(let blockListLabel of blockListLabels) {
            let blockText = blockListLabel.querySelector('.block-text').value;
            for(let i = 0; i < otherTextObjs.length && i < scanSize; i++) {
              let otherText = self.extractOtherText(otherTextObjs[i]);
              for(let radio of blockListLabel.querySelectorAll('.block-radio')) {
                if(radio.checked) {
                  if(radio.value === "equivalent") {
                    if(otherText.includes(blockText)) {
                      self.leaveChat();
                      breakFlag = true;
                    }
                  }
                  if(radio.value === "inclusion") {
                    if(blockText === otherText) {
                      self.leaveChat();
                      breakFlag = true;
                    }
                  }
                }
                if(breakFlag) break;
              }
              if(breakFlag) break;
            }
            if(breakFlag) break;
          }
        }
      }, 500);
      console.log("start block");
      return "start block";
    }
    if (this.blockInterval) {
      clearInterval(this.blockInterval);
      this.blockInterval = undefined;
      console.log("stop block")
      return "stop block";
    }
  }

  getBotUrl(text) {
    this.bot = 0;
    if(this.bot == 0) {
      return `https://api.ownthink.com/bot?appid=xiaosi&userid=user&spoken=${text}`;
    } else {
      return `https://api.qingyunke.com/api.php?key=free&appid=0&msg=${text}`;
    }
  }

  parseBotResponse(res) {
    let resJson;
    let resText;
    if(this.bot == 0) {
      resJson = JSON.parse(res);
      resText = resJson.data.info.text.replace('小思', '我');
    } else {
      resJson = JSON.parse(res);
      resText = resJson.content.replace('菲菲', '我');
    }
    return [resJson, resText];
  }

  botReply(text, callback, args) {
    if(text == '?') { text = '??'; }
    const self = this;
    const request = new XMLHttpRequest();

    if(Math.floor(Math.random() * 4) == 0) {
      this.bot = (this.bot == 0) ? 1 : 0;
    }
    let url = this.getBotUrl(text);

    request.open('get', url, true);
    request.send();
    request.onreadystatechange = () => {
      if(request.readyState === 4) {
        let [resJson, resText] = self.parseBotResponse(request.response)
        if(callback !== void 0) {
          if(args !== void 0) {
            callback(resText, ...args);
          } else {
            callback(resText);
          }
        }
      }
    }
  }

  translator(text, dest, callback, args) {
    const self = this;
    const request = new XMLHttpRequest();
	  request.open('get', `https://api.zhconvert.org/convert?converter=${dest}&text=${text}`, true);
	  request.send();
	  request.onreadystatechange = () => {
      if(request.readyState === 4) {
        const resJson = JSON.parse(request.response);
        const resText = resJson.data.text;
        if(callback !== void 0) {
          if(args !== void 0) {
            callback(resText, ...args);
          } else {
            callback(resText);
          }
        }
      }
	  }
  }

  autoReply() {
    const request = new XMLHttpRequest();
    const url = "https://example.com"
    const self = this;
    if(self.autoReplyInterval === void 0) {
      /* Test if CORS is allowed */
      request.open('get', url, true);
      request.send();
      request.onreadystatechange = () => {
        if(request.readyState === 4) {
          if(request.status === 200) {
            /* CORS is allowed */
            const maxReplyQueue = 1;
            self.updateRecord();
            if (self.otherTexts.length) {
              self.replyMid = self.otherTexts[self.otherTexts.length - 1].mid;
            }
            self.autoReplyInterval = setInterval(() => {
              self.updateRecord();
              const otherId = self.otherId;
              const replyQuery = self.otherTexts.slice(self.otherTexts.length - maxReplyQueue, self.otherTexts.length);
              for (let otherTextObj of replyQuery) {
                const {mid, text} = otherTextObj;
                if(mid > self.replyMid) {
                  self.replyMid = mid;
                  self.translator(
                    text, 'China',
                    (...args) => { self.botReply(...args); },
                    [
                      (...args) => { self.translator(...args) },
                      [
                        'Taiwan',
                        (...args) => { self.sendBotReply(otherId, ...args); }
                      ]
                    ]
                  );
                }
              }
            }, 1000);
            console.log("start autoReply");
          }
          else {
            /* Cors is not allowed */
            document.querySelector("#checkbox-autoReply").checked = false
            clearInterval(this.autoReplyInterval);
            self.autoReplyInterval = undefined;
            console.log("stop autoReply")
            alert("CORS is not allowed")
          }
        }
      }
      return;
    }

    if(this.autoReplyInterval) {
      clearInterval(this.autoReplyInterval);
      this.autoReplyInterval = undefined;
      console.log("stop autoReply")
      return "stop autoReply";
    }
  }
  
  appendBlockList = () => {
    const blockList = `
    <br>
    <i class="material-icons" onclick="document.querySelector('#block-list${this.blockListId}').remove()" style="cursor: pointer;">remove</i>
    <input type="radio" class="block-radio" name="block-list${this.blockListId}-style" value="equivalent" style="-webkit-appearance: radio;" checked><label>包含</label>
    <input type="radio" class="block-radio" name="block-list${this.blockListId}-style" value="inclusion" style="-webkit-appearance: radio;"><label>等於</label>
    <input type="text" class="block-text" maxlength=500 placeholder="此訊息自動退出" style="width: 42%; border-style:ridge; border-width:1px; border-color: gray;">
  `;
    let label = document.createElement('label');
    label.className = "block-list";
    label.id = `block-list${this.blockListId}`;
    label.style.fontSize = '6px';
    label.innerHTML += blockList;
    document.querySelector('#block-list-container').appendChild(label);
    this.blockListId += 1;
  }

  appendAutostartCheckBox = () => {
    const autostartCheckBox = `
    <li>
      <a href="#">
        <label for="checkbox-autostart">
          <i class="material-icons">sms</i>
          <span>自動開始聊天</span>
        </label>
        <span class="right"> <input type="checkbox" class="ios8-switch" id="checkbox-autostart">
          <label for="checkbox-autostart"></label>
        </span>
        <textarea id="first-text" rows=3 cols=500 maxlength="500" placeholder="自動送出第一則訊息" style="width: 100%;"></textarea>
      </a>
    </li>
  `;
    document.querySelector('.snap-drawer.snap-drawer-left ul:last-of-type').innerHTML += autostartCheckBox;
  }

  appendAutoReplyCheckBox = () => {
    const autoReplyCheckBox = `
    <li>
      <a href="#">
        <label for="checkbox-autoReply">
          <i class="material-icons">mms</i>
          <span>自動回復最後一則訊息</span>
        </label>
        <span class="right"> <input type="checkbox" class="ios8-switch" id="checkbox-autoReply">
          <label for="checkbox-autoReply"></label>
        </span>
      </a>
    </li>
  `;
    document.querySelector('.snap-drawer.snap-drawer-left ul:last-of-type').innerHTML += autoReplyCheckBox;
  }

  appendEmojiList = () => {
    const emojilist = `
    <li>
      <div>
        <a>快樂</a>
      </div>
      <div>
        <a>(･ω´･ )</a><a>(･ω´･ )</a><a>(･ω´･ )</a>
      </div>
    </li>
  `;
    document.querySelector('.snap-drawer.snap-drawer-left ul:last-of-type').innerHTML += emojilist;
  }

  appendBlockCheckBox = () => {
    const blockCheckBox = `
    <li>
      <a href="#">
        <label for="checkbox-block">
          <<i class="material-icons">block</i>
          <span>當前 <input id="block-scan-size" type="text" maxlength=4 style="width: 14%; border-style:ridge; border-width:1px; border-color: gray"> 則訊息</span>
        </label>
        <span class="right"> <input type="checkbox" name="block-trigger" class="ios8-switch" id="checkbox-block">
          <label for="checkbox-block"></label>
        </span>
        <div id="block-list-container">
          <label for="add-block-list">
            <i class="material-icons" id="add-block-list" style="cursor: pointer;">add</i>
          </label>
          <span style="color: grey;">新增封鎖語句</span>
        </div>
      </a>
    </li>
  `;
    document.querySelector('.snap-drawer.snap-drawer-left ul:last-of-type').innerHTML += blockCheckBox;
  }
}


let wooct = new wooControler()
