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

  // ✅ Backend is running on HTTP port 5258
  base = 'http://localhost:5258/api';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  private normalizeGame(game: any) {
    return JSON.parse(JSON.stringify(game));
  }

  trackRow(index: number) {
    return index;
  }

  trackCell(index: number) {
    return index;
  }

  // ✅ FIXED METHOD (IMPORTANT)
  newGame(mode: string) {
    this.http.post(`${this.base}/games`, { mode }, {
      headers: { 'Content-Type': 'application/json' }
    })
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
      });
  }

  move(r: number, c: number) {
    if (this.game.status !== 'InProgress') return;

    this.http.post(`${this.base}/games/${this.game.id}/moves`,
      { row: r, column: c })
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
        this.loadScore();
      });
  }

  undo() {
    this.http.post(`${this.base}/games/${this.game.id}/undo`, {})
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
      });
  }

  resetGame() {
    this.http.post(`${this.base}/games/${this.game.id}/reset`, {})
      .subscribe(g => {
        this.game = this.normalizeGame(g);
        this.cdr.detectChanges();
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
        this.game = null;
        this.cdr.detectChanges();
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