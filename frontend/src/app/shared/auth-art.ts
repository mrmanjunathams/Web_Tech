import { Component, input } from '@angular/core';

/** Decorative side panel for the sign-in / sign-up screens. */
@Component({
  selector: 'app-auth-art',
  template: `
    <div class="auth-art" aria-hidden="true">
      <div class="auth-art__mesh"></div>
      <img class="auth-art__img auth-art__img--a" src="picyourpic/opt/img5-800.webp" alt="">
      <img class="auth-art__img auth-art__img--b" src="picyourpic/opt/img11-800.webp" alt="">
      <img class="auth-art__img auth-art__img--c" src="picyourpic/opt/img9-800.webp" alt="">
      <blockquote class="auth-art__quote glass">
        <p>{{ quote() }}</p>
        <cite>— {{ by() }}</cite>
      </blockquote>
    </div>
  `,
})
export class AuthArt {
  readonly quote = input('There is no greater agony than bearing an untold story inside you.');
  readonly by = input('Maya Angelou');
}
