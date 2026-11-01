import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/api';

@Component({
  selector: 'app-newsletter',
  imports: [FormsModule],
  template: `
    <form #f="ngForm" (ngSubmit)="subscribe()" novalidate>
      <div class="form-floating mb-3">
        <input [id]="inputId" name="email" type="email" class="form-control" placeholder="you@example.com"
               style="color:#17bebb;" [(ngModel)]="email" required email>
        <label style="color:#17bebb;" [for]="inputId">Email</label>
      </div>
      @if (message()) {
        <p [class.text-danger]="failed()" [class.text-success]="!failed()" style="text-align:center">{{ message() }}</p>
      }
      <button style="margin:0 0 0 30%; background:#17bebb;color:#fff;" class="btn btn-bb"
              type="submit" name="action" [disabled]="f.invalid || loading()">Subscribe
        <i class="material-icons align-middle ms-1">send</i>
      </button>
    </form>
  `,
})
export class Newsletter {
  private readonly http = inject(HttpClient);
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
      await firstValueFrom(this.http.post('/subscribe', { email: this.email }));
      this.failed.set(false);
      this.message.set('Thanks for subscribing!');
      this.email = '';
    } catch (err) {
      this.failed.set(true);
      this.message.set(errorMessage(err, 'Could not subscribe. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
