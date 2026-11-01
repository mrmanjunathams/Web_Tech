import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogPost, errorMessage } from '../core/api';
import { Newsletter } from '../shared/newsletter';

@Component({
  selector: 'app-category',
  imports: [RouterLink, Newsletter],
  templateUrl: './category.html',
})
export class Category {
  protected readonly blogs = signal<BlogPost[]>([]);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly expanded = signal(new Set<string>());
  protected readonly categories = ['Blog', 'Life Style', 'Travel', 'Fashion'];

  /** Blogs whose text matches the search, like AngularJS's `filter: search`. */
  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.blogs();
    return this.blogs().filter((b) =>
      [b.cate, b.title, b.auth, b.date, b.blogp1, b.blogp2].some((v) => v?.toLowerCase().includes(q))
    );
  });

  constructor() {
    // Footer tags link here with ?q=<tag>.
    inject(ActivatedRoute).queryParamMap.subscribe((p) => this.search.set(p.get('q') ?? ''));
    inject(HttpClient).get<BlogPost[]>('/BAdd').subscribe({
      next: (data) => this.blogs.set(data),
      error: (err) => this.error.set(errorMessage(err, 'Could not load blogs.')),
    });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected toggle(id: string): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
}
