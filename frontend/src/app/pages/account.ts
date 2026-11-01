import { Component, ViewEncapsulation, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-account',
  imports: [RouterLink],
  templateUrl: './account.html',
  styleUrl: './account.css',
  // account.css styles <body> and shared classes, as card.css did; it is removed again when leaving the page.
  encapsulation: ViewEncapsulation.None,
})
export class Account {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
