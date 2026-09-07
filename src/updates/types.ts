export interface UpdateState {
    currentVersion: string; mode: 'installed' | 'portable' | 'development';
    phase: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
    version: string; notes: string; percent: number; message: string; checkedAt: string;
    config: { url: string; automatic: boolean };
}
