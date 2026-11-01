import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogPost, categoriesOf, errorMessage, textOf } from '../core/api';
import { Posts } from '../core/posts';
import { Reveal } from '../shared/effects';
import { PostCard } from '../shared/post-card';

type Sort = 'new' | 'loved' | 'viewed' | 'az';

/** "Explore": every community story with instant search, topic chips and sorting. */
@Component({
  selector: 'app-category',
  imports: [RouterLink, PostCard, Reveal],
  template: `
    <section class="container-x page-head">
      <p class="eyebrow" reveal>Explore</p>
      <h1 class="display display--md" reveal="60">Find your next <span class="text-grad">favourite read</span></h1>
    </section>

    <section class="container-x">
      <div class="toolbar glass" reveal="100">
        <label class="toolbar__search">
          <span class="ms">search</span>
          <input id="search" type="search" placeholder="Search titles, writers, topics…" [value]="search()"
                 (input)="search.set($any($event.target).value)" aria-label="Search stories">
          @if (search()) {
            <button type="button" class="icon-btn" aria-label="Clear search" (click)="search.set('')"><span class="ms">close</span></button>
          }
        </label>
        <label class="toolbar__sort">
          <span class="ms">sort</span>
          <select [value]="sort()" (change)="sort.set($any($event.target).value)" aria-label="Sort stories">
            <option value="new">Newest</option>
            <option value="loved">Most loved</option>
            <option value="viewed">Most viewed</option>
            <option value="az">A → Z</option>
          </select>
        </label>
      </div>

      <div class="chips-row" role="group" aria-label="Topics" reveal="140">
        <button type="button" class="chip chip--toggle" [class.is-on]="!search()" (click)="search.set('')">All</button>
        @for (t of topics(); track t.name) {
          <button type="button" class="chip chip--toggle" [class.is-on]="search().toLowerCase() === t.name.toLowerCase()"
                  (click)="search.set(t.name)">{{ t.name }}<span class="chip__count">{{ t.count }}</span></button>
        }
      </div>

      @if (error()) { <p class="form-msg form-msg--error">{{ error() }}</p> }
      <p class="result-count muted">
        @if (!loading()) { {{ filtered().length }} {{ filtered().length === 1 ? 'story' : 'stories' }}@if (search()) { for "{{ search() }}"} }
      </p>
      <div class="grid-cards">
        @if (loading()) {
          @for (s of [1, 2, 3, 4, 5, 6]; track s) { <div class="skeleton skeleton--card"></div> }
        } @else {
          @for (d of filtered(); track d._id; let i = $index) {
            <app-post-card [post]="d" [reveal]="(i % 3) * 80" />
          } @empty {
            <div class="empty glass">
              <span class="ms">search_off</span>
              <h3>No stories match "{{ search() }}"</h3>
              <p class="muted">Try another topic — or write the story you were looking for.</p>
              <a routerLink="/writeblog" class="btn-x">Write it</a>
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class Category {
  private readonly posts = inject(Posts);
  protected readonly blogs = signal<BlogPost[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly sort = signal<Sort>('new');

  protected readonly topics = computed(() => {
    const counts = new Map<string, number>();
    for (const b of this.blogs()) for (const c of categoriesOf(b.cate)) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = q
      ? this.blogs().filter((b) => [b.cate, b.title, b.auth, b.authName, b.date, b.blogp1, textOf(b.blogp2)].some((v) => v?.toLowerCase().includes(q)))
      : [...this.blogs()];
    switch (this.sort()) {
      case 'loved': return list.sort((a, b) => b.likes - a.likes || b.views - a.views);
      case 'viewed': return list.sort((a, b) => b.views - a.views);
      case 'az': return list.sort((a, b) => a.title.localeCompare(b.title));
      default: return list;
    }
  });

  constructor() {
    // Topic links elsewhere use ?q=<topic>.
    inject(ActivatedRoute).queryParamMap.subscribe((p) => this.search.set(p.get('q') ?? ''));
    this.posts.all()
      .then((data) => this.blogs.set(data))
      .catch((err) => this.error.set(errorMessage(err, 'Could not load stories.')))
      .finally(() => this.loading.set(false));
  }
}
