import { formatDate } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-write',
  imports: [FormsModule, RouterLink],
  templateUrl: './write.html',
})
export class Write {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly auth = inject(Auth);

  /** `date` holds the native date input's value (yyyy-mm-dd). */
  protected blog = { title: '', cate: '', date: '', img: '', blogp1: '', blogp2: '' };
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      // Stored like the existing blogs, e.g. "01-NOV-2026".
      const date = formatDate(this.blog.date, 'dd-MMM-yyyy', 'en-US').toUpperCase();
      await firstValueFrom(this.http.post('/addblog', { ...this.blog, date }));
      await this.auth.load();
      await this.router.navigateByUrl('/myacc');
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        await this.router.navigateByUrl('/login');
        return;
      }
      this.error.set(errorMessage(err, 'Could not post your blog. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
