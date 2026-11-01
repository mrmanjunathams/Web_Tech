import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Account } from './api';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);

  /** Signed-in user, or null when signed out. */
  readonly user = signal<Account | null>(null);

  /** Fetches the signed-in user's account; resolves to null when signed out. */
  async load(): Promise<Account | null> {
    try {
      const account = await firstValueFrom(this.http.get<Account>('/myacc'));
      this.user.set(account);
      return account;
    } catch {
      this.user.set(null);
      return null;
    }
  }

  async signup(data: { username: string; email: string; password: string }): Promise<void> {
    await firstValueFrom(this.http.post('/adduser', data));
    await this.load();
  }

  async login(data: { username: string; password: string }): Promise<void> {
    await firstValueFrom(this.http.post('/loginuser', data));
    await this.load();
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/logout', {}));
    } finally {
      this.user.set(null);
    }
  }
}
