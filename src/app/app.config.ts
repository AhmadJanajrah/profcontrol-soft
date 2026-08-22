import { ApplicationConfig, importProvidersFrom, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor';

// Third-party modules that provide SERVICES
import { NgIdleKeepaliveModule } from '@ng-idle/keepalive';

// App services
import { AppService } from './services/app.service';
import { FloorService } from './services/floor.service';
import { SoundService } from './services/sound.service';
import { AuthGuard } from './services/auth.guard';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),

    // Service-based modules only
    importProvidersFrom(
      NgIdleKeepaliveModule.forRoot()
    ),

    // Global services
    AppService,
    FloorService,
    SoundService,
    AuthGuard, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          })
  ]
};
