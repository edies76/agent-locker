// Sound notification utilities for approval events

class SoundManager {
  private static instance: SoundManager | null = null
  private enabled: boolean = true
  private audioContext: AudioContext | null = null

  private constructor() {
    // Initialize AudioContext on first user interaction
    if (typeof window !== 'undefined') {
      this.enabled = localStorage.getItem('agent-lock-sounds') !== 'false'
    }
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager()
    }
    return SoundManager.instance
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext && typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return this.audioContext!
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('agent-lock-sounds', enabled ? 'true' : 'false')
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  // Play a beep sound with specified frequency and duration
  private playTone(frequency: number, duration: number, volume: number = 0.3) {
    if (!this.enabled || typeof window === 'undefined') return

    try {
      const ctx = this.getAudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(volume, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch (error) {
      console.warn('Failed to play sound:', error)
    }
  }

  // New pending approval arrived
  newApproval() {
    // Two-tone ascending notification
    this.playTone(440, 0.1, 0.2) // A4
    setTimeout(() => this.playTone(554.37, 0.15, 0.2), 100) // C#5
  }

  // High/Critical risk approval (urgent sound)
  criticalApproval() {
    // Three quick beeps
    this.playTone(880, 0.08, 0.25) // A5
    setTimeout(() => this.playTone(880, 0.08, 0.25), 120)
    setTimeout(() => this.playTone(880, 0.12, 0.25), 240)
  }

  // Approval success
  approved() {
    // Pleasant ascending chord
    this.playTone(523.25, 0.1, 0.15) // C5
    setTimeout(() => this.playTone(659.25, 0.15, 0.15), 80) // E5
  }

  // Rejection
  rejected() {
    // Descending tone
    this.playTone(440, 0.1, 0.15) // A4
    setTimeout(() => this.playTone(349.23, 0.15, 0.15), 80) // F4
  }

  // Keyboard interaction feedback (subtle)
  keyPress() {
    this.playTone(800, 0.03, 0.1)
  }
}

export const soundManager = SoundManager.getInstance()
