/**
 * 项目名称：微重力下面向卫星表面仿生黏附式滚动机器人运动控制研究
 * 软件名称：航天仿生机器人视觉控制终端（前端）
 * 功能：
 *   - 通过 Web Serial API 连接 HC-05 蓝牙模块，发送指令给小车的 STM32 主控
 *   - 通过 WiFi 加载 OpenMV 的 MJPEG 视频流
 *   - 支持键盘（WASD）和屏幕按钮控制，通过视觉实现精确移动指定距离
 * 作者：王鸿泽
 * 贡献者：张蒋超、刘灿、汤子豪、臧若松
 * 日期：2026.02
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bluetooth, 
  Wifi, 
  Gamepad2, 
  Settings, 
  Activity, 
  Terminal, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Power,
  RefreshCw,
  Eye,
  Zap,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HARDWARE_CONFIG } from './config';

// 日志条目结构
interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'command';
}

export default function App() {

  // 锁定状态：当执行精确移动时，暂时锁定键盘输入，避免指令冲突
  const [isCalculating, setIsCalculating] = useState(false);

  // 定义指令数组，方便后续维护和扩展
  const movementKeys = [
    HARDWARE_CONFIG.commands.forward,
    HARDWARE_CONFIG.commands.backward,
    HARDWARE_CONFIG.commands.left,
    HARDWARE_CONFIG.commands.right
  ];

  // ----- 连接状态 -----
  const [isBtConnected, setIsBtConnected] = useState(false);
  const [isWifiConnected, setIsWifiConnected] = useState(false);
  const [btPort, setBtPort] = useState<any>(null);
  const [wifiUrl, setWifiUrl] = useState(HARDWARE_CONFIG.wifi.OpenMV_Ip); // OpenMV IP
  
  // ----- 控制状态 -----
  const [distance, setDistance] = useState('');
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // ----- DOM引用 -----
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ----- 日志管理 -----
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setLogs(prev => [newLog, ...prev]);
  }, []);

  // ----- 日志导出 -----
  const exportLogsToCSV = useCallback(() => {
    if (logs.length === 0) {
      addLog('当前没有日志可以导出', 'error');
      return;
    }

    // 添加 BOM 头，防止 Excel 打开 CSV 时中文乱码
    const BOM = '\uFEFF';
    // 定义 CSV 表头
    let csvContent = BOM + "时间戳,日志类型,日志内容\n";

    // 反转数组，让导出的日志按照时间从早到晚排序（可选）
    const reversedLogs = [...logs].reverse();

    // 遍历日志，生成 CSV 数据
    reversedLogs.forEach(log => {
      // 处理内容中可能包含的逗号或双引号
      const safeMessage = `"${log.message.replace(/"/g, '""')}"`;
      csvContent += `${log.timestamp},${log.type},${safeMessage}\n`;
    });

    // 创建 Blob 对象并生成下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // 生成名为 Robot_Telemetry_Log_XXX.csv 的文件
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `Robot_Telemetry_Log_${dateStr}.csv`;

    // 模拟点击进行下载
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addLog(`日志已导出: ${fileName}`, 'success');
  }, [logs, addLog]);

  // 连接蓝牙（通过 Web Serial API 连接 HC-05 模块）
  const connectBluetooth = async () => {
    try {
      if (!('serial' in navigator)) {
        addLog('当前浏览器不支持 Web Serial API', 'error');
        return;
      }

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: HARDWARE_CONFIG.bluetooth.baudRate });
      setBtPort(port);
      
      const writer = port.writable.getWriter();
      writerRef.current = writer;
      
      setIsBtConnected(true);
      addLog('蓝牙连接成功！', 'success');
    } catch (err) {
      addLog(`蓝牙连接失败: ${err}`, 'error');
    }
  };

  const disconnectBluetooth = async () => {
    if (writerRef.current) {
      await writerRef.current.releaseLock();
      writerRef.current = null;
    }
    if (btPort) {
      await btPort.close();
      setBtPort(null);
    }
    setIsBtConnected(false);
    addLog('蓝牙已断开连接', 'info');
  };

  // 发送指令到 STM32
  const sendCommand = useCallback(async (cmd: string) => {
    if (!writerRef.current) {
      addLog('未连接蓝牙，无法发送指令', 'error');
      return;
    }
    
    try {
      const encoder = new TextEncoder();
      await writerRef.current.write(encoder.encode(cmd + HARDWARE_CONFIG.bluetooth.commandSuffix)); // 添加指定结尾符便于解析
      addLog(`Sent: ${cmd}`, 'command');
    } catch (err) {
      addLog(`指令发送失败： ${err}`, 'error');
    }
  }, [addLog]);

  // 精确移动：发送 m(指定符号)+距离 指令，STM32 负责解析正负实现前进后退
  const handleDistanceMove = async () => {
    if (!distance || isNaN(Number(distance))) {
      addLog('Invalid distance value', 'error');
      return;
    }
    const targetDist = Number(distance);
    const direction = targetDist > 0 ? HARDWARE_CONFIG.commands.forward : HARDWARE_CONFIG.commands.backward;
    
    // --- PC端解算模块 ---
    // 简化模型：时间 = 距离 / 线速度
    // 线速度 V = 2*pi*r / 60
    const wheelRadius = HARDWARE_CONFIG.robot_physical_params.wheel_radius;
    const rpm = HARDWARE_CONFIG.robot_physical_params.default_speed_rpm;
    const velocity = (2 * Math.PI * wheelRadius * rpm) / 60; // cm/s
    const durationMs = Math.abs((targetDist / velocity) * 1000);

    setIsCalculating(true); // 锁定控制
    addLog(`[INFO] PC解算: 移动 ${targetDist}cm, 预估耗时 ${Math.round(durationMs)}ms`, 'info');

    try {
      // 1. 下发移动指令
      await sendCommand(direction);
      
      // 2. 模拟前端位置环等待
      setTimeout(async () => {
        await sendCommand(HARDWARE_CONFIG.commands.stop);
        setIsCalculating(false);
        addLog(`[SUCCESS] 移动完成，到达目标位置`, 'success');
      }, durationMs);

    } catch (err) {
      setIsCalculating(false);
      addLog(`解算执行异常: ${err}`, 'error');
    }
    
    setDistance('');
  };

  // 键盘控制（WASD 控制方向，松开停止）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || isCalculating) return; // 如果正在解算移动，屏蔽键盘输入，避免冲突
      // 避免在输入框内触发
      if (e.target instanceof HTMLInputElement) return;

      const key = e.key.toLowerCase();
      if (movementKeys.includes(key)) {
        if (!activeKeys.has(key)) {
          const newKeys = new Set(activeKeys);
          newKeys.add(key);
          setActiveKeys(newKeys);
          sendCommand(key);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      const key = e.key.toLowerCase();
      if (movementKeys.includes(key)) {
        const newKeys = new Set(activeKeys);
        newKeys.delete(key);
        setActiveKeys(newKeys);
        sendCommand(HARDWARE_CONFIG.commands.stop); // 停止指令
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeKeys, sendCommand]);

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-white font-sans overflow-hidden p-4 gap-4">
      {/* 左侧控制面板 */}
      <div className="w-80 flex flex-col gap-4">
        {/* 连接设置区域 */}
        <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Settings size={14} /> 连接设置
            </h2>
            <div className="flex gap-1">
              <div className={`w-2 h-2 rounded-full ${isBtConnected ? 'bg-green-500 status-glow' : 'bg-zinc-700'}`} />
              <div className={`w-2 h-2 rounded-full ${isWifiConnected ? 'bg-blue-500 status-glow' : 'bg-zinc-700'}`} />
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={isBtConnected ? disconnectBluetooth : connectBluetooth}
              className={`w-full py-3 rounded-xl flex items-center justify-center gap-3 transition-all ${
                isBtConnected 
                ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' 
                : 'bg-green-600/10 text-green-500 border border-green-500/30 hover:bg-green-600/20'
              }`}
            >
              <Bluetooth size={18} />
              <span className="font-medium">{isBtConnected ? '断开蓝牙 HC-05' : '连接蓝牙'}
              </span>
            </button>

            <div className="relative">
              <input 
                type="text" 
                value={wifiUrl}
                onChange={(e) => setWifiUrl(e.target.value)}
                placeholder="OpenMV IP 地址"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 pl-10 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              <Wifi size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <button 
                onClick={() => setIsWifiConnected(!isWifiConnected)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                  isWifiConnected ? 'text-blue-500' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <Power size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* 精确移动面板 */}
        <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Zap size={14} /> 精确移动 (cm)
          </h2>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDistanceMove()}
                placeholder="距离 (cm)"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-green-500/50 transition-colors font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono">CM</span>
            </div>
            <button 
              onClick={handleDistanceMove}
              disabled={!isBtConnected || isCalculating} // 执行中禁用
              className={`px-4 rounded-xl transition-all ${
                isCalculating 
                ? 'bg-orange-600/20 text-orange-500 border-orange-500/30' 
                : 'bg-green-600/10 text-green-500 border-green-500/30 hover:bg-green-600/20'
              }`}
            >
              {isCalculating ? '执行中...' : '出发！'}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono leading-tight">
            + 前进, - 后退. （通过正负号区分）
          </p>
        </section>

        {/* 控制台输出 */}
        <section className="glass-panel rounded-2xl p-5 flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              <Terminal size={12} /> 控制台输出
            </div>
            <button 
              onClick={exportLogsToCSV}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800/40 hover:bg-zinc-800 hover:text-blue-400 transition-colors cursor-pointer group border border-transparent hover:border-blue-500/30"
              title="导出 CSV 文件"
            >
              <Download size={10} className="group-hover:-translate-y-0.5 transition-transform" />
              <span>导出日志</span>
            </button>
            <div className="flex-1 bg-black/40 rounded-xl p-3 font-mono text-[11px] overflow-y-auto space-y-1 scrollbar-hide">
              {logs.slice(0, 50).map(log => (
                <div key={log.id} className="flex gap-2 leading-relaxed">
                  <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                  <span className={
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'command' ? 'text-blue-400' :
                    'text-zinc-300'
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </section>
      </div>

      {/* 主视图：视频画面 + 控制按钮 */}
      <main className="flex-1 flex flex-col gap-4">
        <div className="flex-1 glass-panel rounded-3xl relative overflow-hidden group">
          {/* Scanline Effect */}
          <div className="scanline" />
          
          {/* Video Placeholder / Stream */}
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
            {isWifiConnected ? (
              <img 
                src={`${wifiUrl}/stream`} 
                alt="OpenMV 视频流" 
                className="w-full h-full object-contain"
                onError={() => {
                  addLog('WiFi 视频流加载失败，请检查地址。。。', 'error');
                  setIsWifiConnected(false);
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-zinc-700">
                <Eye size={64} strokeWidth={1} />
                <p className="font-mono text-sm uppercase tracking-widest">视频流无影无踪</p>
                <button 
                  onClick={() => setIsWifiConnected(true)}
                  className="px-6 py-2 rounded-full border border-zinc-800 text-xs hover:bg-zinc-900 transition-colors"
                >
                  初始化 Wifi 图传
                </button>
              </div>
            )}
          </div>

          {/* 画面信息 HUD */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
            <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-tighter">实时画面</span>
            </div>
            <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-[10px] font-mono uppercase tracking-tighter text-zinc-400">分辨率: </span>
              <span className="text-[10px] font-mono uppercase tracking-tighter">{HARDWARE_CONFIG.wifi.resolution} @ {HARDWARE_CONFIG.wifi.frameRate}fps</span>
            </div>
          </div>
        </div>

        {/* 底部控制栏 */}
        <div className="h-48 flex gap-4">
          {/* 方向键 */}
          <div className="glass-panel rounded-3xl p-6 flex items-center justify-center gap-4 w-64">
            <div className="grid grid-cols-3 gap-2">
              <div />
              <ControlBtn 
                icon={<ChevronUp />} 
                active={activeKeys.has(HARDWARE_CONFIG.commands.forward)} 
                onPress={() => sendCommand(HARDWARE_CONFIG.commands.forward)} 
                onRelease={() => sendCommand(HARDWARE_CONFIG.commands.stop)}
              />
              <div />
              <ControlBtn 
                icon={<ChevronLeft />} 
                active={activeKeys.has(HARDWARE_CONFIG.commands.left)} 
                onPress={() => sendCommand(HARDWARE_CONFIG.commands.left)} 
                onRelease={() => sendCommand(HARDWARE_CONFIG.commands.stop)}
              />
              <ControlBtn 
                icon={<ChevronDown />} 
                active={activeKeys.has(HARDWARE_CONFIG.commands.backward)} 
                onPress={() => sendCommand(HARDWARE_CONFIG.commands.backward)} 
                onRelease={() => sendCommand(HARDWARE_CONFIG.commands.stop)}
              />
              <ControlBtn 
                icon={<ChevronRight />} 
                active={activeKeys.has(HARDWARE_CONFIG.commands.right)} 
                onPress={() => sendCommand(HARDWARE_CONFIG.commands.right)} 
                onRelease={() => sendCommand(HARDWARE_CONFIG.commands.stop)}
              />
            </div>
          </div>

          {/* 操作指南 */}
          <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col justify-center gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-[10px] font-mono uppercase text-zinc-500">键盘映射</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] font-mono border border-zinc-700 text-green-500">W/S</span>
                  <span className="text-[10px] font-mono text-zinc-400">前进 / 后退</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] font-mono border border-zinc-700 text-green-500">A/D</span>
                  <span className="text-[10px] font-mono text-zinc-400">左转 / 右转</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-[10px] font-mono uppercase text-zinc-500">使用说明</h3>
              <p className="text-[10px] font-mono text-zinc-400 leading-tight">
                • 松开按键自动停止（发送 指定停止符号） <br/>
                • 输入距离后点击“出发！”执行精确运动 <br/>
                • 红色急停按钮立即停止
              </p>
            </div>
          </div>

          {/* 紧急停止按钮 */}
          <div className="w-32 glass-panel rounded-3xl p-6 flex flex-col items-center justify-center gap-2">
            <button 
              onClick={() => sendCommand(HARDWARE_CONFIG.commands.stop)}
              className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
            >
              <Gamepad2 size={24} />
            </button>
            <span className="text-[10px] font-mono uppercase text-red-500">急停</span>
          </div>
        </div>
      </main>

      {/* 👇 在这里添加底部作者栏 */}
      <footer className="fixed bottom-2 left-0 right-0 text-center pointer-events-none z-10">
        <div className="inline-block bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full text-[10px] font-mono text-zinc-400 border border-white/10">
          航天仿生机器人视觉控制终端 v1.0 | 
          王鸿泽 · 张蒋超 · 刘灿 · 汤子豪 · 臧若松 | 
          南京航空航天大学
        </div>
      </footer>
    </div>
  );
}

// 方向按钮组件
function ControlBtn({ icon, active, onPress, onRelease }: { icon: React.ReactNode, active: boolean, onPress: () => void, onRelease: () => void }) {
  return (
    <button 
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
        active 
        ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]' 
        : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
      }`}
    >
      {icon}
    </button>
  );
}
