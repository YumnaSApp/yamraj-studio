import { requireOptionalNativeModule } from 'expo';

export type HindiVoice = { id: string; name: string; gender: 'male' | 'female' | 'other'; enhanced: boolean };
export type ExportClip = { path: string; text: string; speaker: string; duration: number; start?: number; emoji?: string };
export type ExportOptions = {
  image?: string | null;
  video?: string | null;
  videoDuration?: number;
  videoVolume?: number;
  clips: ExportClip[];
  music: 'None' | 'Funny' | 'Horror' | 'Dramatic';
  musicVolume: number;
  voiceVolume: number;
  sfx: { kind: string; time: number }[];
  captions: boolean;
  showSpeaker: boolean;
  hookText: string;
  endCard: boolean;
  endCardHandle: string;
  watermark: boolean;
  videoStart?: number;
  captionColor?: string;
  overlays?: { text: string; start: number; end: number; y: number; size: number }[];
};

type NativeModuleType = {
  documentsPath(): string;
  readJSON(name: string): string | null;
  writeJSON(name: string, text: string): boolean;
  deleteFile(path: string): void;
  hindiVoices(): HindiVoice[];
  speak(text: string, pitch: number, rate: number, voiceId: string | null, preferMale: boolean): void;
  stopSpeaking(): void;
  renderSpeech(text: string, pitch: number, rate: number, voiceId: string | null, preferMale: boolean, echo: boolean, effect?: string | null): Promise<{ path: string; duration: number }>;
  startRecording(): Promise<boolean>;
  downloadFile(url: string, ext: string): Promise<string>;
  joinVideos(paths: string[]): Promise<{ path: string; duration: number }>;
  stopRecording(effect?: string | null): Promise<{ path: string; duration: number } | null>;
  playFile(path: string): void;
  stopPlayback(): void;
  playMusic(kind: string): Promise<void>;
  playSFX(kind: string): Promise<void>;
  pickImage(): Promise<string | null>;
  pickVideo(): Promise<{ path: string; duration: number; thumbnail: string } | null>;
  exportVideo(options: ExportOptions): Promise<{ path: string; absolutePath: string; duration: number }>;
  proStatus(): Promise<{ isPro: boolean; price: string }>;
  buyPro(): Promise<{ isPro: boolean; message: string }>;
  restorePro(): Promise<{ isPro: boolean; message: string }>;
  addListener(event: 'onExportProgress', listener: (e: { progress: number }) => void): { remove(): void };
};

const mod = requireOptionalNativeModule<NativeModuleType>('YamrajNative');
export const nativeReady = !!mod;
export default (mod ?? new Proxy({}, { get: () => () => { throw new Error('Voice engine missing in this build'); } })) as NativeModuleType;
