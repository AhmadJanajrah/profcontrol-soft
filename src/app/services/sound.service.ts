import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {

  private play(path: string) {
    try {
      const audio = new Audio(path);

      audio.load();

      audio.play().catch(err => {
        // Browser blocked sound, file missing, or other playback error
      });
    } catch (err) {
      // Any unexpected JS errors
    }
  }

  click() {
    this.play('assets/sounds/click.wav');
  }

  addItem() {
    this.play('assets/sounds/add_item.wav');
  }

  success() {
    this.play('assets/sounds/success.wav');
  }

  error() {
    this.play('assets/sounds/error.wav');
  }

  notification() {
    this.play('assets/sounds/notification.wav');
  }

  trash() {
    this.play('assets/sounds/trash.wav');
  }
}
