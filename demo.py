import tkinter as tk
import random
import threading
import time 

def show_warm_tip():
    #创建窗口
    window=tk.Tk()

    #获取屏幕宽高
    screen_width=window.winfo_screenwidth()
    screen_height=window.winfo_screenheight()

    #随即窗口位置
    window_width=250
    widow_height=60
    x=random.randrange(0,screen_width-window_width)
    y=random.randrange(0,screen_height-widow_height)

    #设置窗口标题和大小位置
    window.title("宝宝")
    window.geometry(f"{window_width}x{widow_height}+{x}+{y}")

    #提示文字列表
    tips=[
        '多喝热水哦~',
        '注意休息哦~',
        '天气冷了，记得加衣服哦~',
        '记得吃早餐哦~',
        '记得按时吃饭哦~',
        '记得按时睡觉哦~',
        '记得按时运动哦~',
        '梦想成真',
        '顺顺利利',
        '爱你！',
    ]

    tip=random.choice(tips)

    #多样的背景颜色
    bg_colors=[
        'lightpink','skyblue','lightgreen','lightyellow',
        'lavender','plum','coral','bisque','aquamarine','azure','beige','mistyrose','honeydew','lavenderblush','oldlace'
    ]
    bg=random.choice(bg_colors)

    #创建标签并显示文字
    tk.Label(
        window,
        text=tip,
        bg=bg,
        font=('KaiTi',16),
        width=30,
        height=3
    ).pack()

    #窗口置顶显示
    window.attributes('-topmost',True)
    window.mainloop()

#创建线程列表
threads=[]

#窗口数量
for i in range(10):
    t=threading.Thread(target=show_warm_tip)
    threads.append(t)
    time.sleep(0.005)
    threads[i].start()
