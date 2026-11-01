import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BlogInput, BlogPost, Leader, Stats } from './api';

/** Blog API calls. */
@Injectable({ providedIn: 'root' })
export class Posts {
  private readonly http = inject(HttpClient);

  /** Live blogs, newest first. */
  all = () => firstValueFrom(this.http.get<BlogPost[]>('/BAdd'));
  featured = () => firstValueFrom(this.http.get<BlogPost[]>('/blogs'));
  get = (id: string) => firstValueFrom(this.http.get<BlogPost>(`/posts/${encodeURIComponent(id)}`));
  like = (id: string) => firstValueFrom(this.http.post<{ likes: number; liked: boolean }>(`/posts/${id}/like`, {}));
  remove = (id: string) => firstValueFrom(this.http.delete(`/posts/${id}`));
  /** Publish now, schedule (future publishAt) or save a draft (status 'draft'). */
  create = (blog: BlogInput) => firstValueFrom(this.http.post<BlogPost>('/addblog', blog));
  /** Edit your own story (content, draft/publish, schedule). */
  update = (id: string, changes: BlogInput) => firstValueFrom(this.http.patch<BlogPost>(`/posts/${id}`, changes));
  stats = () => firstValueFrom(this.http.get<Stats>('/stats'));
  /** Image Pool picture names, from a static manifest so the gallery works even if the API is down. */
  images = () => firstValueFrom(this.http.get<string[]>('picyourpic/manifest.json'));
  leaderboard = () => firstValueFrom(this.http.get<Leader[]>('/leaderboard'));
  subscribe = (email: string) => firstValueFrom(this.http.post('/subscribe', { email }));
}
