#coding: utf-8
import os
import time
import threading
from importlib import import_module

from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from googletrans import Translator

_Options = {
    'firefox': getattr(import_module('selenium.webdriver.firefox.options'), 'Options'),
    'chrome': getattr(import_module('selenium.webdriver.chrome.options'), 'Options'),
}

_webdriver = {
    'firefox': getattr(import_module('selenium.webdriver'), 'Firefox'),
    'chrome': getattr(import_module('selenium.webdriver'), 'Chrome'),
}

def synchronized_with_attr(lock_name):

    def decorator(method):

        def synced_method(self, *args, **kws):
            lock = getattr(self, lock_name)
            with lock:
                return method(self, *args, **kws)

        return synced_method

    return decorator


class setInterval:
    def __init__(self, interval, action, fargs=(), fkwargs={}, *targs, **tkwargs) :
        self.interval = interval
        self.action = action
        self.event = threading.Event()
        thread = threading.Thread(target=self.__setInterval,
                                  args=fargs, kwargs=fkwargs,
                                  *targs, **tkwargs)
        thread.start()

    def __setInterval(self, *args, **kwargs) :
        nextTime= time.time() + self.interval
        while not self.event.wait(nextTime - time.time()):
            nextTime += self.interval
            self.action(*args, **kwargs)

    def cancel(self) :
        self.event.set()


class MessageHandler:
    script = """
window.extractOtherText = function(msg) {
        if (typeof(msg) == 'object') {
            msg = msg.textContent;
        }
        msg = msg.split('陌生人：');
        msg.shift();
        msg = msg.join('陌生人：');
        msg = msg.split(' (');
        msg.pop();
        msg = msg.join(' (');
        return msg;
}

window.extractMyText = function(msg) {
        if (typeof(msg) == 'object') {
            msg = msg.textContent;
        }
        msg = msg.split('我：');
        msg.shift();
        msg = msg.join('我：');
        msg = msg.split('已送達 (');
        msg.pop();
        msg = msg.join('已送達 (');
        return msg;
}

window.getText = () => {
    let otherTexts = document.querySelectorAll('.stranger.text');
    let msgs = []
    let mids = []


    for (let otherText of otherTexts) {
        msgs.push(extractOtherText(otherText))
        mids.push(parseInt(otherText.getAttribute('mid')))
    }
    return [msgs, mids];
}

window._clearInput = () => {
    messageInput.value = '';
}

window.send = (msg) => {
    if (document.querySelector('#sendButton input').value != "回報" && !isLeave()) {
        messageInput.value = msg;
        sendMessage();
    }
}

window.sendMsg = () => {
    if (document.querySelector('#sendButton input').value != "回報" && !isLeave()) {
        sendMessage();
    }
}

"""
    _instance = None
    _no_init = False
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, driver, force_init=False):
        if self._no_init and not force_init:
            return;
        MessageHandler._no_init = True

        self.lock = threading.Lock()

        self.driver = driver
        self.curr_index = 0
        self.curr_msg = None
        self.other_log_mid = -1
        self.other_msgs = []
        self.others_msgs = []

        self.__actions = {
            'echo': self.echo,
            'tran': self.tran,
        }
        self.driver.execute_script(self.script)
        self.translator = Translator()

        if not hasattr(self, 'action_interval'):
            self.action_interval = None
        if not hasattr(self, 'auto_record_interval'):
            self.auto_record_interval = None

    def update_msgs(self):
        otherTexts, other_mids = self.driver.execute_script("return getText();");
        for i, otherText in enumerate(otherTexts):
            if self.other_log_mid < other_mids[i]:
                self.other_msgs.append(otherText)
                self.other_log_mid = other_mids[i]

        if self.curr_index < len(self.other_msgs):
            self.curr_msg = self.other_msgs[self.curr_index]

    @synchronized_with_attr('lock')
    def action(self, method, *args, **kwargs):
        assert method in self.__actions, "Method '%s' does not exists" % method

        # the method to handle message
        if not self.driver.execute_script('return isLeave()'):
            self.update_msgs()
        if self.curr_index < len(self.other_msgs):
            res_msg = self.__actions[method](*args, **kwargs)
            self.send_message(res_msg)
            self.curr_index += 1

    def send_message(self, msg):
        # self.driver.execute_script(f'send("{msg}")')
        self.driver.execute_script('_clearInput()')
        #text_field = WebDriverWait(driver, 3).until(
        #            EC.presence_of_element_located((By.ID, 'messageInput')))
        wait_time = .2/len(msg)
        for word in msg:
            time.sleep(wait_time)
            word = word.replace('\\', '\\\\').replace('"', '\\"')
            self.driver.execute_script(f'messageInput.value += "{word}";')
        self.driver.execute_script('sendMsg()')

    def echo(self):
        return self.curr_msg

    def tran(self, dest='en'):
        return self.translator.translate(self.curr_msg, dest=dest).text

    @synchronized_with_attr('lock')
    def record(self):
        if len(self.other_msgs) != 0 and self.driver.execute_script('return isLeave()'):
            self.others_msgs.append(self.other_msgs)
            self.curr_index = 0
            self.curr_msg = None
            self.other_log_mid = -1
            self.other_msgs = []

    def action_trigger(self, method, fargs=(), fkwargs={}, interval=0.2, *targs, **tkwargs):
        if not self.action_interval:
            self.action_interval = setInterval(interval, self.action, fargs=(method, *fargs), fkwargs=fkwargs, name=f'{method}')
            print(f'start auto {method}')
        else:
            self.action_interval.cancel()
            self.action_interval = None
            print(f'stop auto {method}')

    def record_trigger(self):
        if not self.auto_record_interval:
            self.auto_record_interval = setInterval(0.4, self.record, name='record')
            print(f'start auto record')
        else:
            self.auto_record_interval.cancel()
            self.auto_record_interval = None
            print(f'stop auto record')


class WooControler:
    script = """

window.isLeave = () => {
    let systemTexts = document.querySelectorAll('.system.text');
    if (systemTexts.length <= 1) {
        return true;
    }

    systemTexts = systemTexts[systemTexts.length-2].textContent.split("離開");
    if (systemTexts.length >= 2 && systemTexts[1] == "了，請按") {
        return true;
    } else {
        return false;
    }
}

window.sendFirstMsg = (msg) => {
    if (typeof(this.sendFirstMsgInterval) == "undefined" &&
        document.querySelectorAll('.me.text').length == 0) {
        let self = this;
        this.sendFirstMsgInterval = setInterval(() => {
            let stopFlag = false;
            for (let sendedMsg of document.querySelectorAll('.me.text')) {
                if (extractMyText(sendedMsg) == msg) {
                    stopFlag = true;
                }
            }
            if (stopFlag || isLeave()) {
                clearInterval(self.sendFirstMsgInterval);
                self.sendFirstMsgInterval = undefined;
            } else {
                document.getElementById('messageInput').value = msg;
                sendMsg();
            }
        }, 4000);
    }
}

window.autoRestart = (msg) => {
    if (typeof(this.autoStartInterval) == "undefined") {
        let self = this;
        this.autoStartInterval = setInterval(() => {
            let systemTexts = document.querySelectorAll('.system.text');
            if (systemTexts[0].textContent == "系統訊息：WooTalk系統出了一些狀況，我們正在緊急維護中😅請稍後即可繼續聊天至粉絲專頁獲取更多相關資訊") {
                setTimeout(() => {
                    leave();
                }, 30000);
            } else if (systemTexts.length <= 1) {
                clickStartChat();
                if (typeof(msg) != "undefined") {
                    sendFirstMsg(msg)
                }
            } else {
                let checkleave = systemTexts[systemTexts.length-2].textContent.split("離開");
                if (checkleave.length >= 2 && checkleave[1] == "了，請按") {
                    leave();
                }
            }
        }, 2000);
        return "startAutoRestart";
    }
    if (this.autoStartInterval) {
        clearInterval(this.autoStartInterval);
        this.autoStartInterval = undefined;
        return "stopAutoRestart";
    }
}


window.block = () => {
    let blacklist = [
        "男",
        "男生",
        "女嗎?",
        "女?",
        "boy",
        "男人",
        "找色女",
        "妳好",
        "棒子",
        "找色母狗"
    ];

    let self = this;
    if (typeof(this.blockInterval) == "undefined") {
        this.blockInterval = setInterval(() => {
            let otherMsgsLen = document.querySelectorAll('.stranger.text').length
            if (otherMsgsLen > 0 && otherMsgsLen < 6) {
                let otherTexts = document.querySelectorAll('.stranger.text');
                msg = extractOtherText(otherTexts[otherTexts.length - 1])
                for (let i in blacklist) {
                    if (msg == blacklist[i]) {
                        leave();
                    }
                }
                for (let j in msg) {
                    if (msg[j] == "男") {
                        leave();
                    }
                }
                if (msg.length > 50) {
                    leave();
                }
            }
        }, 1000);
        return "startBlock"
    }
    if (this.blockInterval) {
        clearInterval(this.blockInterval);
        this.blockInterval = undefined;
        return "stopBlock";
    }
}

    """
    _instance = None
    _no_init = False
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, driver, force_init=False):
        if self._no_init and not force_init:
            return;
        WooControler._no_init = True

        self.driver = driver
        self.driver.execute_script(self.script)
        if not hasattr(self, 'self.auto_restart_interval'):
            self.auto_restart_interval = None
        if not hasattr(self, 'self.auto_block_interval'):
            self.auto_block_interval = None

    def click_start(self):
        start_btn = WebDriverWait(self.driver, 3).until(
                    EC.presence_of_element_located((By.ID, 'startButton')))
        ActionChains(self.driver).move_to_element_with_offset(start_btn, 10, 10).click().perform()

    def click_leave(self):
        # Not working
        leave_btn = WebDriverWait(self.driver, 3).until(
                    EC.presence_of_element_located((By.ID, 'changeButton')))
        ActionChains(self.driver).move_to_element_with_offset(leave_btn, 10, 10).click().perform()
        popyes = WebDriverWait(self.driver, 30).until(
                    EC.presence_of_element_located((By.ID, 'popup-yes')))
        ActionChains(self.driver).move_to_element_with_offset(popyes, 10, 10).click().perform()

    def restart_trigger(self, msg=None):
        msg = msg.replace('\\', '\\\\"').replace('"', '\\"')
        res = self.driver.execute_script(f'return autoRestart("{msg}")')
        print(res)

    def block_trigger(self):
        res = self.driver.execute_script('return block()')
        print(res)

    def leave(self):
        self.driver.execute_script('leave()')

    def is_leave(self):
        return self.driver.execute_script('return isLeave()')


if __name__ == '__main__':
    woo_url = "https://wootalk.today"
    driver_name = 'geckodriver-v0.26.0-win64.exe'
    path = os.path.join('driver', driver_name)
    browser = 'firefox'
    options = _Options[browser]()
    driver = _webdriver[browser](executable_path=path,
                               options=options)
    driver.get(woo_url)

    msgHl = MessageHandler(driver)
    wooCt = WooControler(driver)

    hello_msg = "\
你好，我是自動回覆機人第二代，相信不少人已經遇過第一代了吧，就是一堆顏文字那個，但這次我能將你所說的話翻成英文，\
當然其他語言也可以，雖然一樣沒用，但希望對您能有幫助"

    wooCt.restart_trigger(hello_msg)
    msgHl.record_trigger()
    msgHl.action_trigger('tran')