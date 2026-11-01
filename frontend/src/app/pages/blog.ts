import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPost, errorMessage } from '../core/api';
import { Posts } from '../core/posts';
import { Reveal } from '../shared/effects';
import { PostCard } from '../shared/post-card';

@Component({
  selector: 'app-blog',
  imports: [RouterLink, PostCard, Reveal],
  template: `
    <section class="container-x page-head">
      <p class="eyebrow" reveal>Editor's picks</p>
      <h1 class="display display--md" reveal="60">Featured <span class="text-grad">stories</span></h1>
      <p class="lead" reveal="120">Hand-picked reads from across Bloggerbytes, plus the freshest posts from our community.</p>
    </section>

    <section class="container-x">
      @if (error()) { <p class="form-msg form-msg--error">{{ error() }}</p> }
      @if (loading()) {
        <div class="skeleton skeleton--hero"></div>
      } @else {
        <div class="magazine">
          @if (lead(); as l) { <app-post-card class="magazine__lead" [post]="l" variant="hero" reveal /> }
          <div class="magazine__side">
            @for (p of rest(); track p._id; let i = $index) { <app-post-card [post]="p" [reveal]="i * 90" /> }
          </div>
        </div>
      }
    </section>

    <section class="container-x section">
      <header class="section-head" reveal>
        <p class="eyebrow">Fresh from the community</p>
        <h2 class="h-xl">Latest posts</h2>
        <a routerLink="/cate" class="link-arrow">Explore everything <span class="ms">arrow_forward</span></a>
      </header>
      <div class="grid-cards">
        @for (p of latest(); track p._id; let i = $index) {
          <app-post-card [post]="p" [reveal]="i * 70" />
        } @empty {
          @if (!loading()) { <p class="muted">Nothing here yet — <a routerLink="/writeblog">write the first post</a>.</p> }
        }
      </div>
    </section>
  `,
})
export class Blog {
  private readonly posts = inject(Posts);
  protected readonly featured = signal<BlogPost[]>([]);
  protected readonly community = signal<BlogPost[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly lead = computed(() => this.featured()[0]);
  protected readonly rest = computed(() => this.featured().slice(1, 3));
  protected readonly latest = computed(() => this.community().slice(0, 6));

  constructor() {
    Promise.all([this.posts.featured(), this.posts.all()])
      .then(([f, c]) => {
        this.featured.set(f);
        this.community.set(c);
      })
      .catch((err) => this.error.set(errorMessage(err, 'Could not load stories.')))
      .finally(() => this.loading.set(false));
  }
}
