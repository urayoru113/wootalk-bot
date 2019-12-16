#coding: utf-8
import os
import time

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def start(driver):
    start_btn = WebDriverWait(driver, 3).until(
            EC.presence_of_element_located((By.ID, 'startButton')))
    start_btn.click()

def leave(driver):
    leave_btn = WebDriverWait(driver, 3).until(
            EC.presence_of_element_located((By.ID, 'changeButton')))
    leave_btn.click()
    try:
        driver.implicitly_wait(0.3)
        ensure_text = driver.find_element_by_id('ensureText')
        ensure_text.send_keys('leave')
    except Exception as e:
        pass
    yes_btn = WebDriverWait(driver, 2).until(
            EC.presence_of_element_located((By.ID, 'popup-yes')))
    yes_btn.click()

def send(driver, msg):
    textfiled = WebDriverWait(driver, 3).until(
            EC.presence_of_element_located((By.ID, 'messageInput')))
    textfiled.clear()
    for m in msg:
        textfiled.send_keys(m)
        time.sleep(0.2)
    send_btn = driver.find_element_by_css_selector('#sendButton input')
    if send_btn.get_attribute('value') != '回報':
        send_btn.click()

def restart(driver):
    try:
        leave(driver)
    except Exception as e:
        print(e)
    time.sleep(1.5)
    try:
        start(driver)
    except Exception as e:
        print(e)
 
def refresh(driver):
    driver.refresh();

def executor(driver, comment):
    inp = comment
    print(inp)
    try:
        if inp == 'start':
            start(driver)
        elif inp == 'leave':
            leave(driver)
        elif inp == 'restart':
            restart(driver)
        elif inp == 'F5' or inp == 'f5':
            refresh(driver)
        else:
            send(driver, inp)
    except Exception as e:
        print(e)

def run():
    woo_url = "https://wootalk.today"
    driver_name = 'chromedriver.exe'
    path = os.path.join('driver', driver_name)
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    driver = webdriver.Chrome(executable_path=path,
                              chrome_options=chrome_options)
    driver.implicitly_wait(5)
    driver.get(woo_url)
    # bahamut crawler    
    baha_url = "https://forum.gamer.com.tw/C.php?page=5000&bsn=60076&snA=5454950&tnum=29"
    prev_floor = 0
    """
    while True:
        res = requests.get(baha_url)
        soup = BeautifulSoup(res.text, 'html.parser')
        section = soup.select('.c-section__main.c-post')[-1]
        floor = section.select_one('.floor').text.split()[0]
        if floor != prev_floor:
            prev_floor = floor
            comment = section.select_one('.c-article__content')
            if comment:
                for seq in comment.text.split():
                    executor(driver, seq)
        driver.save_screenshot(os.path.join('image', 'screenshot.png'))
        time.sleep(1)
    """

    while True:
        msg = input()
        driver.save_screenshot(os.path.join('image', 'screenshot.png'))
        executor(driver, msg)

        
if __name__ == '__main__':
    run()