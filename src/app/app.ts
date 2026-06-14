import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import Swal, { SweetAlertResult } from 'sweetalert2';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class AppComponent {

  game: any;
  score: any;
  soundEnabled = true;
  timerDuration = 5;
  timerRemaining = 5;
  timerPercent = 100;
  timerState: 'running' | 'stopped' = 'stopped';
  private timerInterval: number | null = null;
  private audioContext: AudioContext | null = null;

  // ✅ Backend is running on HTTP port 5258
  base = 'http://localhost:5258/api';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  private normalizeGame(game: any) {
    return JSON.parse(JSON.stringify(game));
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;

    if (this.soundEnabled) {
      this.playSound('start');
    }
  }

  private ensureAudioContext() {
    if (!this.audioContext) {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      this.audioContext = new AudioCtor();
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  private playTone(frequency: number, duration = 0.08, type: OscillatorType = 'sine', delay = 0, volume = 0.12) {
    if (!this.soundEnabled) return;
    this.ensureAudioContext();
    if (!this.audioContext) return;

    const start = this.audioContext.currentTime + delay;
    const gain = this.audioContext.createGain();
    const oscillator = this.audioContext.createOscillator();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);

    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private playSequence(notes: Array<{freq: number; dur: number; type?: OscillatorType; delay?: number; vol?: number}>) {
    for (const note of notes) {
      this.playTone(note.freq, note.dur, note.type ?? 'triangle', note.delay ?? 0, note.vol ?? 0.12);
    }
  }

  private playSound(effect: 'move' | 'xMove' | 'oMove' | 'start' | 'undo' | 'reset' | 'back' | 'win' | 'draw') {
    if (!this.soundEnabled) return;

    switch (effect) {
      case 'move':
        this.playSequence([
          { freq: 440, dur: 0.06, type: 'triangle' },
          { freq: 660, dur: 0.08, type: 'triangle', delay: 0.06 }
        ]);
        break;
      case 'xMove':
        this.playSequence([
          { freq: 610, dur: 0.06, type: 'triangle' },
          { freq: 740, dur: 0.08, type: 'triangle', delay: 0.06 }
        ]);
        break;
      case 'oMove':
        this.playSequence([
          { freq: 280, dur: 0.08, type: 'square' },
          { freq: 220, dur: 0.1, type: 'square', delay: 0.08 }
        ]);
        break;
      case 'start':
        this.playSequence([
          { freq: 300, dur: 0.08, type: 'triangle' },
          { freq: 360, dur: 0.08, type: 'triangle', delay: 0.08 },
          { freq: 420, dur: 0.12, type: 'triangle', delay: 0.16 }
        ]);
        break;
      case 'undo':
        this.playSequence([
          { freq: 500, dur: 0.1, type: 'sine' },
          { freq: 360, dur: 0.12, type: 'sine', delay: 0.1 }
        ]);
        break;
      case 'reset':
      case 'back':
        this.playTone(220, 0.14, 'sine');
        break;
      case 'win':
        this.playSequence([
          { freq: 660, dur: 0.1, type: 'triangle' },
          { freq: 880, dur: 0.1, type: 'triangle', delay: 0.08 },
          { freq: 1040, dur: 0.18, type: 'triangle', delay: 0.16 }
        ]);
        break;
      case 'draw':
        this.playSequence([
          { freq: 520, dur: 0.14, type: 'sine' },
          { freq: 460, dur: 0.14, type: 'sine', delay: 0.1 }
        ]);
        break;
    }
  }

  private playOutcomeSound(game: any) {
    if (!game) return;
    if (game.status === 'Won') {
      this.playSound('win');
    } else if (game.status === 'Draw') {
      this.playSound('draw');
    }
  }

  private playMoveSound(game: any, previousCurrentPlayer: string) {
    if (!game) return;
    const currentMovePlayer = previousCurrentPlayer;
    if (currentMovePlayer === 'X') {
      this.playSound('xMove');
    } else {
      this.playSound('oMove');
    }
  }

  get timerRingStyle() {
    const color = this.game?.currentPlayer === 'X' ? '#2196f3' : '#f44336';
    return {
      background: `conic-gradient(${color} ${this.timerPercent}%, rgba(255,255,255,0.1) 0)`
    };
  }

  private startTurnTimer() {
    this.stopTurnTimer();
    this.timerRemaining = this.timerDuration;
    this.timerPercent = 100;
    this.timerState = 'running';
    this.cdr.detectChanges();

    this.timerInterval = window.setInterval(() => {
      if (!this.game || this.game.status !== 'InProgress') {
        this.stopTurnTimer();
        return;
      }

      this.timerRemaining = Math.max(0, this.timerRemaining - 0.1);
      this.timerPercent = Math.round((this.timerRemaining / this.timerDuration) * 100);
      this.cdr.detectChanges();

      if (this.timerRemaining <= 0) {
        this.stopTurnTimer();
        this.onTimerExpired();
      }
    }, 100) as unknown as number;
  }

  private stopTurnTimer() {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerState = 'stopped';
  }

  private onTimerExpired() {
    if (!this.game || this.game.status !== 'InProgress') return;
    this.skipTurn();
  }

  private skipTurn() {
    if (!this.game) return;
    this.http.post<any>(`${this.base}/games/${this.game.id}/skip`, {})
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
        if (this.game.status === 'InProgress') {
          this.startTurnTimer();
        }
      });
  }

  trackRow(index: number) {
    return index;
  }

  trackCell(index: number) {
    return index;
  }

  // ✅ FIXED METHOD (IMPORTANT)
  newGame(mode: string) {
    this.http.post<any>(`${this.base}/games`, { mode }, {
      headers: { 'Content-Type': 'application/json' }
    })
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
        this.playSound('start');
        this.startTurnTimer();
      });
  }

  move(r: number, c: number) {
    if (this.game.status !== 'InProgress') return;

    const previousCurrentPlayer = this.game.currentPlayer;

    this.http.post<any>(`${this.base}/games/${this.game.id}/moves`,
      { row: r, column: c })
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
        this.loadScore();
        this.playMoveSound(g, previousCurrentPlayer);
        this.playOutcomeSound(g);
        if (g.status === 'InProgress') {
          this.startTurnTimer();
        }
      });
  }

  undo() {
    this.http.post<any>(`${this.base}/games/${this.game.id}/undo`, {})
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
        this.playSound('undo');
        if (g.status === 'InProgress') {
          this.startTurnTimer();
        }
      });
  }

  resetGame() {
    this.http.post(`${this.base}/games/${this.game.id}/reset`, {})
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
        this.playSound('reset');
      });
  }

  backToMenu() {
    const hasStarted = this.game?.moves?.length > 0 || this.game?.status !== 'InProgress';

    if (!hasStarted) {
      this.game = null;
      this.cdr.detectChanges();
      return;
    }

    Swal.fire({
      title: 'Discard current game?',
      text: 'If you go back to the main menu, your current progress will be lost.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, discard',
      cancelButtonText: 'No, keep playing',
      reverseButtons: true,
      focusCancel: true
    }).then((result: SweetAlertResult) => {
      if (result.isConfirmed) {
        this.stopTurnTimer();
        this.game = null;
        this.cdr.detectChanges();
        this.playSound('back');
      }
    });
  }

  loadScore() {
    this.http.get(`${this.base}/scoreboard`)
      .subscribe(s => {
        this.score = s;
        this.cdr.detectChanges();
      });
  }

  resetScore() {
    this.http.post(`${this.base}/scoreboard/reset`, {})
      .subscribe(() => this.loadScore());
  }

  ngOnInit() {
    this.loadScore();
  }
}