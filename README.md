<div align="center">

# Aerospace Bionic Robotics Vision Control Center

[中文](README.zh-CN.md) | English

</div>

> Study on Motion Control of Biomimetic Adhesive Rolling Robot for Satellite Surface in Microgravity · Front-End Control Platform

This is an integrated control terminal designed for our robotics project, primarily enabling remote control and visual feedback. 
It uses the Web Serial API to control a robot car powered by an STM32 microcontroller via a Bluetooth module (HC-05), while simultaneously receiving real-time video streams from OpenMV (OpenMV Cam H7 with ATWINC1500 expansion board) over Wi-Fi.

---

## Project team

**Supervising Institution**: Nanjing University of Aeronautics and Astronautics 
**Supervisor**: Yu Zhiwei 
**Project Team**: Wang Hongze, Zang Ruosong, Liu Can, Tang Zihao, Zhang Jiangchao

---

## Getting Started 
If this is your first time working with this project, just follow the steps below: o(*￣▽￣*)ブ 
### 1. Install Node.js 
+ Go to the [Node.js official website](https://nodejs.org/) and download the **LTS version** (Long Term Support)
+ Simply click "Next" through the installation process
+ After installation, open the terminal (search for `cmd` on Windows, or `Terminal` on Mac), and enter: 
```bash
node -v
```

If you see a version number (e.g., v24.14.0), it means the installation is complete.

### 2. Download the code 
Download the entire project folder to your computer, for example, place it in `D:\RobotControl` or on your desktop. 
### 3. Install Dependencies 
Open the terminal in the project folder (on Windows, right-click the folder → "Open in Terminal"), then enter: 
```bash
npm install
```

### 4. Launch the Project 
```bash
npm run dev
```

The terminal will display an address, usually [http://localhost:3000](http://localhost:3000). Hold down the Ctrl key and click the link, or enter this address in your browser to view the control interface. 

> If you see a message indicating that scripts are disabled on this system, first run the command: `powershell -ExecutionPolicy Bypass`, then run `npm run dev`.

---

## Parameter Configuration

| Parameter               | Value                        |
| ----------------------- | ---------------------------- |
| **OpenMV IP**           | `http://192.168.43.203:8080` |
| **Bluetooth Baud Rate** | `9600`                       |
| **Control Command**     | `w/a/s/d/q/m<value>`         |

## How to use

### Bluetooth connection（HC-05）

1. **Computer Pairing**: First, search for and connect to the HC-05 in your computer's Bluetooth settings (the pairing code is usually `1234` or `0000`).  
2. **Web Connection**: In the control interface, click **"Connect Bluetooth"**, then select the device you just paired (it may appear as HC-05 or a string of Bluetooth address).  
3. Once connected successfully, the status light will turn green. 

### WiFi Video Transmission (OpenMV) 

1. Ensure the OpenMV has been programmed with the WiFi streaming firmware.  
2. Connect your computer and the OpenMV to the same WiFi network.  
3. Enter the OpenMV's IP address in the control interface (e.g., [http://192.168.1.100:8080](http://192.168.1.100:8080)), then click the power icon to start the video stream.

### Control method

| Method               | Operation                                                    |
| -------------------- | ------------------------------------------------------------ |
| **Keyboard**         | Use W/A/S/D to control forward, backward, left, and right; release to stop automatically |
| **Screen Buttons**   | Click the arrow keys with the mouse; release to stop immediately |
| **Precise Movement** | Enter distance (cm), then click "Move" to execute            |
| **Emergency Stop**   | Click the red emergency stop button, or press any direction key twice (sends 'q' command) |

---

## Notes 
### Browser Compatibility 
This project uses the **Web Serial API** to connect via Bluetooth, so: 
| Browser | Supported     |
| ------- | ------------- |
| Chrome  | Supported     |
| Edge    | Supported     |
| Safari  | Not supported |
| Firefox | Not supported |

So please open it using **Chrome or Edge**

+ ### Frequently Asked Questions 
  + **Can't find the device when connecting via Bluetooth? **
  First, make sure your computer's Bluetooth is turned on and that the HC-05 is in pairing mode (red LED blinking rapidly). The device will only appear on the webpage after successful pairing.  
  + **Video stream failed to load? **
  Check if the computer and OpenMV are on the same WiFi network, and verify that the IP address is correct (you can test by directly accessing [http://IP:8080](http://IP:8080) in a browser).  
  + **No response from buttons? **
  Check if the Bluetooth status light in the upper right corner is green. If it's gray, that means it's not connected.

---

## Project Structure

```bash
robot-vision-control-hub/
├── .gitignore           # Git ignore rules  
├── CHANGELOG.md         # Version update history  
├── LICENSE              # MIT License ├── src/
│   ├── App.tsx          # Main interface component (control logic + UI)  
│   ├── main.tsx         # Entry file  
|   ├── config.ts        # Configuration parameters  
│   └── index.css        # Global styles (Tailwind + custom) 
├── index.html           # HTML template  
├── vite.config.ts       # Vite build configuration  
├── package.json         # Project dependencies  
├── README.zh-CN.md
└── README.md            
```

---

## Technology Stack

| Technology     | Application                     |
| -------------- | ------------------------------- |
| React 19       | Frontend framework              |
| TypeScript     | Type safety                     |
| Vite           | Build tool                      |
| Tailwind CSS   | Styling                         |
| Web Serial API | Bluetooth communication (HC-05) |
| MJPEG          | WiFi video streaming (OpenMV)   |

---

## STM32 Code Logic Example

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
        // Precise movement commands, such as "m20" meaning move forward 20 cm
        int dist = atoi(cmd + 1); 
        Move_Distance(dist); // Positive numbers move forward, negative numbers move backward.
    }
}
```

---

## Acknowledgments

This project is the outcome of a university student innovation and entrepreneurship training program. We gratefully acknowledge the support of our advisor and the dedicated efforts of all team members. 
For any questions, please feel free to contact us. 
Wang Hongze: `wanghongze@nuaa.edu.cn`