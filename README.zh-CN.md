<div align="center">

# 航天仿生机器人视觉控制中心

中文 | [English](README.md)

</div>

> 微重力下面向卫星表面仿生黏附式滚动机器人运动控制研究 · 前端控制平台

这是一个为我们的机器人项目设计的集成化控制终端。主要实现远程控制与视觉反馈。 
通过 Web Serial api 使用蓝牙模块 (HC-05) 控制 STM32 主控的机器人小车，同时通过 WiFi 接收 OpenMV (OpenMV Cam H7 + ATWINC1500扩展板) 的实时视频回传。

---

## 项目团队

**指导单位** ：南京航空航天大学 
**指导教师** ：俞志伟 
**项目团队** ：王鸿泽、臧若松、刘灿、汤子豪、张蒋超

---

## 快速开始

如果你是第一次接触这个项目，按照下面的步骤来就行o(*￣▽￣*)ブ：

### 1. 安装 Node.js
+ 去 [Node.js 官网](https://nodejs.org/) 下载 **LTS 版本**（长期支持版）
+ 一路点“下一步”安装就行
+ 装完后，打开终端（Windows 搜 `cmd`，Mac 搜 `Terminal`），输入：

```bash
node -v
```

如果看到版本号（比如 v24.14.0），说明装好了

### 2. 下载代码
把整个项目文件夹下载到电脑里，比如放在 `D:\RobotControl` 或者桌面都行。

### 3. 安装依赖
在项目文件夹里打开终端（Windows 可以右键文件夹 → “在终端中打开”），然后输入：

```bash
npm install
```

### 4. 启动项目

```bash
npm run dev
```

终端会显示一个地址，一般是 [http://localhost:3000](http://localhost:3000)。按住Ctrl 键点击这个链接，或者在浏览器里输入这个地址，就能看到控制界面了。

> 如果显示在此系统上禁止运行脚本，先运行命令：` powershell -ExecutionPolicy Bypass`，之后再运行`npm run dev` 

---

## 参数配置
| 参数 | 值 |
| --- | --- |
| **OpenMV IP** | `http://192.168.43.203:8080` |
| **蓝牙波特率** | `9600` |
| **控制指令** | `w/a/s/d/q/m<数值>` |

## 怎么用
### 蓝牙连接（HC-05）
1. **电脑配对**：先在电脑的蓝牙设置里搜索并连接 HC-05（配对码通常是 `1234` 或 `0000`）
2. **网页连接**：在控制界面点击** “连接蓝牙”**，选择刚才配对的设备（名字可能叫 HC-05 或者一串蓝牙地址）
3. 连接成功后，状态灯会变绿

### WiFi 图传（OpenMV）
1. 确保 OpenMV 已经烧录了 WiFi 推流程序
2. 电脑和 OpenMV 连到同一个 WiFi 网络
3. 在控制界面输入 OpenMV 的 IP 地址（比如 [http://192.168.1.100:8080](http://192.168.1.100:8080)），点击电源图标开启视频流。

### 控制方式
| 方式 | 操作 |
| --- | --- |
| **键盘** | W/A/S/D 控制前后左右，松开自动停止 |
| **屏幕按钮** | 用鼠标点击方向键，松手即停 |
| **精确移动** | 输入距离（cm），点“移动”执行 |
| **紧急停止** | 点红色急停按钮，或按键盘任意方向键后再按一次（发送 q 指令） |

---

## 注意事项

### 浏览器兼容性
这个项目用到了 **Web Serial API** 来连接蓝牙，所以：

| 浏览器 | 是否支持 |
| --- | --- |
| Chrome | 支持 |
| Edge | 支持 |
| Safari | 不支持 |
| Firefox | 不支持 |


所以请用 **Chrome 或 Edge** 打开

### 常见问题
+ **连接蓝牙时找不到设备？**  
先确认电脑蓝牙已开启，HC-05 是否在配对模式（红色指示灯快闪）。配对成功后才能在网页里看到。
+ **视频流加载失败？**  
检查电脑和 OpenMV 是否在同一 WiFi 下，IP 地址是否正确（可以用浏览器直接访问 [http://IP:8080](http://IP:8080) 测试）。
+ **按键没反应？**  
看看右上角蓝牙状态灯是不是绿色的。如果是灰色，说明没连上。

---

## 项目结构
```bash
robot-vision-control-hub/
├── .gitignore           # Git 忽略规则
├── CHANGELOG.md         # 版本更新记录
├── LICENSE              # MIT 许可证
├── src/
│   ├── App.tsx          # 主界面组件（控制逻辑 + UI）
│   ├── main.tsx         # 入口文件
|   ├── config.ts        # 参数配置
│   └── index.css        # 全局样式（Tailwind + 自定义）
├── index.html           # HTML 模板
├── vite.config.ts       # Vite 构建配置
├── package.json         # 项目依赖
├── README.zh-CN.md
└── README.md      
```

---

## 技术栈

| 技术 | 用途 |
| --- | --- |
| React 19 | 前端框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Tailwind CSS | 样式设计 |
| Web Serial API | 蓝牙通信（HC-05） |
| MJPEG | WiFi 视频流（OpenMV） |

---

## STM32 代码逻辑示例

``` c
char rx_buffer[20];
int rx_index = 0;

void USART1_IRQHandler(void) {
    if(USART_GetITStatus(USART1, USART_IT_RXNE) != RESET) {
        char res = USART_ReceiveData(USART1);
        
        if (res == '\n') {
            rx_buffer[rx_index] = '\0';
            process_command(rx_buffer);
            rx_index = 0;
        } else {
            rx_buffer[rx_index++] = res;
        }
    }
}

void process_command(char* cmd) {
    if (cmd[0] == 'w') Move_Forward();
    else if (cmd[0] == 's') Move_Backward();
    else if (cmd[0] == 'a') Turn_Left();
    else if (cmd[0] == 'd') Turn_Right();
    else if (cmd[0] == 'q') Stop_Robot();
    else if (cmd[0] == 'm') {
        // 精准移动指令，例如 "m20" 代表前进 20cm
        int dist = atoi(cmd + 1); 
        Move_Distance(dist); // 正数前进，负数后退
    }
}
```

---

## 致谢

本项目为大学生创新创业训练计划项目成果，感谢指导老师的支持，以及团队成员的共同努力。

如有问题，欢迎联系

王鸿泽：`wanghongze@nuaa.edu.cn`
