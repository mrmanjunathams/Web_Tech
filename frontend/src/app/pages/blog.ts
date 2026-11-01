import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPost, errorMessage } from '../core/api';
import { Newsletter } from '../shared/newsletter';

@Component({
  selector: 'app-blog',
  imports: [RouterLink, Newsletter],
  templateUrl: './blog.html',
})
export class Blog {
  protected readonly blogs = signal<BlogPost[]>([]);
  protected readonly error = signal('');
  /** Indexes of blogs whose second paragraph is expanded. */
  protected readonly expanded = signal(new Set<number>());

  constructor() {
    inject(HttpClient).get<BlogPost[]>('/blogs').subscribe({
      next: (data) => this.blogs.set(data),
      error: (err) => this.error.set(errorMessage(err, 'Could not load blogs.')),
    });
  }

  protected toggle(i: number): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  }
}
