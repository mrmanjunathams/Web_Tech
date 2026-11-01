import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  template: `
    <section>
      <div class="fcont">
        <div class="form-cont">
          <h2>Sign Up to know.</h2>
          <p>more about you.</p>
          <a routerLink="/login">Already registered? Sign In</a>
        </div>
        <div class="form">
          <h1>Sign Up</h1>
          <form #f="ngForm" (ngSubmit)="submit()" novalidate>
            <input type="text" name="username" placeholder="Username" [(ngModel)]="username" #u="ngModel"
                   required minlength="3" maxlength="30" pattern="[A-Za-z0-9_.\\-]+" autocomplete="username">
            @if (u.dirty && u.invalid) { <span style="color:red">3-30 characters: letters, numbers, . _ -</span> }
            <input type="email" name="email" placeholder="Email" [(ngModel)]="email" #e="ngModel" required email autocomplete="email">
            @if (e.dirty && e.errors?.['required']) { <span style="color:red">Required</span> }
            @if (e.dirty && e.errors?.['email']) { <span style="color:red">Please enter a valid email.</span> }
            <input type="password" name="password" placeholder="Password" [(ngModel)]="password" #p="ngModel"
                   required minlength="6" maxlength="128" autocomplete="new-password">
            @if (p.dirty && p.invalid) { <span style="color:red">At least 6 characters.</span> }
            @if (error()) { <p class="text-danger">{{ error() }}</p> }
            <input type="submit" name="submit" [value]="loading() ? 'Signing up...' : 'SignUp'" [disabled]="f.invalid || loading()">
          </form>
          <a routerLink="/login">Already registered? Sign In</a>
        </div>
      </div>
    </section>
  `,
})
export class Signup {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected username = '';
  protected email = '';
  protected password = '';
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signup({ username: this.username, email: this.email, password: this.password });
      await this.router.navigateByUrl('/myacc');
    } catch (err) {
      this.error.set(errorMessage(err, 'Sign up failed. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
