import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// エミュレーター用のIPアドレス
const EMULATOR_IP = '10.0.2.2';

// 実機用のPC IPアドレス（環境変数から取得、なければユーザーに設定を促す）
// ビルド時に設定: VITE_PC_IP=192.168.1.100 npm run build
const PC_IP = import.meta.env.VITE_PC_IP || 'PLEASE_SET_PC_IP';

// 実機かエミュレーターかを判定
// PC_IPが設定されていれば実機、そうでなければエミュレーター
const useRealDevice = PC_IP !== 'PLEASE_SET_PC_IP';

export const API_BASE_URL = isNative
    ? (useRealDevice ? `http://${PC_IP}:3001` : `http://${EMULATOR_IP}:3001`)  // Android実機またはエミュレーター
    : 'http://localhost:3001';      // PCブラウザから接続

// WebSocket URL (ws:// protocol)
export const WS_BASE_URL = isNative
    ? (useRealDevice ? `ws://${PC_IP}:3001` : `ws://${EMULATOR_IP}:3001`)
    : 'ws://localhost:3001';

console.log('[CONFIG] API_BASE_URL:', API_BASE_URL);
console.log('[CONFIG] WS_BASE_URL:', WS_BASE_URL);
console.log('[CONFIG] Platform:', Capacitor.getPlatform());
console.log('[CONFIG] isNativePlatform:', Capacitor.isNativePlatform());
console.log('[CONFIG] Using Real Device:', useRealDevice);
