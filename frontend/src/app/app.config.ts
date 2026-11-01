import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // Hash URLs (/#/blog) keep page routes separate from the API paths served by Express.
    provideRouter(routes, withHashLocation(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
  ],
};
