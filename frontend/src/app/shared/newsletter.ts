import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api';
import { Posts } from '../core/posts';

@Component({
  selector: 'app-newsletter',
  imports: [FormsModule],
  template: `
    <form class="newsletter" #f="ngForm" (ngSubmit)="subscribe()" novalidate>
      <label class="visually-hidden" [for]="inputId">Email</label>
      <input [id]="inputId" name="email" type="email" class="input-x" placeholder="you@example.com"
             [(ngModel)]="email" required email autocomplete="email">
      <button class="btn-x" type="submit" [disabled]="f.invalid || loading()">
        {{ loading() ? 'Joining…' : 'Subscribe' }}<span class="ms">arrow_forward</span>
      </button>
    </form>
    @if (message()) {
      <p class="form-msg" [class.form-msg--error]="failed()">{{ message() }}</p>
    }
  `,
})
export class Newsletter {
  private readonly posts = inject(Posts);
  private static nextId = 0;

  protected readonly inputId = `newsletter-email-${Newsletter.nextId++}`;
  protected email = '';
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly failed = signal(false);

  protected async subscribe(): Promise<void> {
    this.loading.set(true);
    this.message.set('');
    try {
      await this.posts.subscribe(this.email);
      this.failed.set(false);
      this.message.set("You're in. Fresh stories, straight to your inbox.");
      this.email = '';
    } catch (err) {
      this.failed.set(true);
      this.message.set(errorMessage(err, 'Could not subscribe. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
