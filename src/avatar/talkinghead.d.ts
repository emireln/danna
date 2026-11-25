// Types for the parts of TalkingHead that Danna uses (MIT, Mika Suominen, @met4citizen/talkinghead). The package ships
// JavaScript without types, so only the calls made in src/avatar are declared here.
declare module '@met4citizen/talkinghead' {
  export interface TalkingHeadOptions {
    audioCtx?: AudioContext | null;
    lipsyncModules?: string[];
    lipsyncLang?: string;
    cameraView?: 'full' | 'mid' | 'upper' | 'head';
    cameraDistance?: number;
    cameraRotateEnable?: boolean;
    cameraPanEnable?: boolean;
    cameraZoomEnable?: boolean;
    avatarMood?: string;
    avatarIdleEyeContact?: number;
    avatarIdleHeadMove?: number;
    avatarSpeakingEyeContact?: number;
    avatarSpeakingHeadMove?: number;
    modelPixelRatio?: number;
    modelFPS?: number;
    mixerGainSpeech?: number | null;
  }

  export interface AvatarOptions {
    url: string;
    body?: 'M' | 'F';
    lipsyncLang?: string;
    avatarMood?: string;
    baseline?: Record<string, number>;
  }

  export interface StreamOptions {
    sampleRate?: number;
    lipsyncLang?: string;
    lipsyncType?: 'visemes' | 'blendshapes' | 'words';
    waitForAudioChunks?: boolean;
    mood?: string;
  }

  export interface StreamChunk {
    audio?: ArrayBuffer | Uint8Array | Int16Array | Float32Array;
    words?: string[];
    wtimes?: number[];
    wdurations?: number[];
  }

  export interface SpeechInput {
    audio: AudioBuffer;
    words: string[];
    wtimes: number[];
    wdurations: number[];
    markers?: Array<() => void>;
    mtimes?: number[];
  }

  export class TalkingHead {
    constructor(node: HTMLElement, options?: TalkingHeadOptions);
    /** The lip-sync processors by language. A language is added once its module is loaded. */
    lipsync: Record<string, unknown>;
    showAvatar(avatar: AvatarOptions, onprogress?: (event: ProgressEvent) => void): Promise<void>;
    streamStart(
      options?: StreamOptions,
      onAudioStart?: () => void,
      onAudioEnd?: () => void,
      onSubtitles?: (node: unknown) => void,
    ): Promise<void>;
    streamAudio(chunk: StreamChunk): void;
    streamNotifyEnd(): void;
    streamInterrupt(): void;
    streamStop(): void;
    speakAudio(input: SpeechInput, options?: { lipsyncLang?: string; isRaw?: boolean }): void;
    stopSpeaking(): void;
    setMood(mood: string): void;
    playGesture(name: string, duration?: number, mirror?: boolean, transitionMs?: number): void;
    stopGesture(transitionMs?: number): void;
    lookAtCamera(durationMs: number): void;
    makeEyeContact(durationMs: number): void;
    setView(view: 'full' | 'mid' | 'upper' | 'head', options?: Record<string, number>): void;
    start(): void;
    stop(): void;
    dispose(): void;
  }
}
