import { Component } from '@angular/core';
import { AppService } from '../services/app.service';

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  standalone: true
})
export class HomeComponent {
  constructor(public app: AppService) {
    app.redirect();
  }
}
