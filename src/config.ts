/**
 * 机器人控制中心 - 硬件配置
 * 
 * 修改这里的配置后，重新启动项目即可生效
 */

export const HARDWARE_CONFIG = {
  // 蓝牙配置
  bluetooth: {
    baudRate: 9600,           // HC-05 默认波特率
    commandSuffix: '\n',      // 指令结尾符，STM32 用来识别一条指令结束
  },
  
  // WiFi 图传配置
  wifi: {
    OpenMV_Ip: 'http://192.168.43.203:8080',  // OpenMV IP
    frameRate: 30,                            // 帧率（仅显示用，实际参考硬件）
    resolution: '640x480',                    // 分辨率（仅显示用，实际参考硬件）
  },
  
  // 控制指令定义
  commands: {
    forward: 'w',
    backward: 's',
    left: 'a',
    right: 'd',
    stop: 'q',
    moveDistance: 'm',        // 精确移动指令前缀，如 m20
  }
};