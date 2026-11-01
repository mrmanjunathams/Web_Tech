import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../core/auth';
import { Confirm } from '../core/confirm';
import { BlogPost, categoriesOf, compact, errorMessage, formatWhen, imageUrl, readingTime, storyWords } from '../core/api';
import { Posts } from '../core/posts';
import { Toast } from '../core/toast';
import { Avatar } from '../shared/avatar';
import { Reveal } from '../shared/effects';
import { PostCard } from '../shared/post-card';

@Component({
  selector: 'app-post',
  imports: [RouterLink, Avatar, PostCard, Reveal],
  host: { '(window:scroll)': 'onScroll()' },
  template: `
    <div class="read-progress" [style.transform]="'scaleX(' + progress() + ')'" aria-hidden="true"></div>

    @if (error()) {
      <section class="container-x page-head">
        <div class="empty glass">
          <span class="ms">sentiment_dissatisfied</span>
          <h3>{{ error() }}</h3>
          <a routerLink="/cate" class="btn-x">Explore other stories</a>
        </div>
      </section>
    } @else if (post(); as p) {
      <article class="reader">
        <header class="reader__hero">
          @if (cover(); as src) {
            <img class="reader__cover" [src]="src" alt="" fetchpriority="high" #coverImg
                 [class.is-loaded]="coverImg.complete" (load)="coverImg.classList.add('is-loaded')">
          }
          <div class="reader__shade"></div>
          <div class="reader__head container-narrow">
            <a routerLink="/cate" class="link-arrow link-arrow--back"><span class="ms">arrow_back</span>All stories</a>
            @if (p.status !== 'published') {
              <p class="reader__notice glass" role="status">
                <span class="ms">{{ p.status === 'draft' ? 'edit_note' : 'schedule' }}</span>
                {{ p.status === 'draft' ? 'This is a draft. Only you can see it.' : 'Scheduled for ' + when() + '. Only you can see it until then.' }}
                <a [routerLink]="['/writeblog']" [queryParams]="{ id: p._id }">Continue editing</a>
              </p>
            }
            <div class="chips-row">
              @for (c of cats(); track c) { <a class="chip chip--glass" routerLink="/cate" [queryParams]="{ q: c }">{{ c }}</a> }
            </div>
            <h1 class="display display--md reader__title">{{ p.title || 'Untitled draft' }}</h1>
            <div class="reader__byline">
              <app-avatar [name]="author()" [size]="44" />
              <div>
                <strong>{{ author() }}</strong>
                <span class="muted">{{ p.date || 'Not published yet' }} · {{ minutes() }} min read · {{ words() }} words@if (!p.featured) { · {{ fmt(p.views) }} views}</span>
              </div>
            </div>
          </div>
        </header>

        <div class="container-narrow reader__layout">
          <aside class="reader__actions" aria-label="Story actions">
            @if (!p.featured && p.status === 'published') {
              <button type="button" class="action-btn" [class.is-liked]="p.liked" [class.burst]="burst()" (click)="like()"
                      [attr.aria-pressed]="p.liked" aria-label="Like this story">
                <span class="ms">favorite</span><span>{{ fmt(p.likes) }}</span>
              </button>
            }
            @if (p.status === 'published') {
              <button type="button" class="action-btn" (click)="share()" aria-label="Share this story"><span class="ms">ios_share</span></button>
            }
            @if (isMine()) {
              <a class="action-btn" [routerLink]="['/writeblog']" [queryParams]="{ id: p._id }" aria-label="Edit this story" title="Edit"><span class="ms">edit</span></a>
              <button type="button" class="action-btn action-btn--danger" (click)="remove()" aria-label="Delete this story"><span class="ms">delete</span></button>
            }
          </aside>
          <div class="prose">
            <p class="prose__lead">{{ p.blogp1 }}</p>
            <!-- Sanitized by the API (allowlist) and again by Angular. -->
            <div class="prose__body" [innerHTML]="p.blogp2"></div>
            <div class="prose__end">✦ ✦ ✦</div>
            <div class="author-card glass">
              <app-avatar [name]="author()" [size]="56" />
              <div>
                <p class="eyebrow">Written by</p>
                <h3>{{ author() }}</h3>
                <p class="muted">Sharing stories on Bloggerbytes.</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      @if (related().length) {
        <section class="container-x section">
          <header class="section-head" reveal>
            <p class="eyebrow">Keep reading</p>
            <h2 class="h-xl">More like this</h2>
          </header>
          <div class="grid-cards">
            @for (r of related(); track r._id; let i = $index) { <app-post-card [post]="r" [reveal]="i * 80" /> }
          </div>
        </section>
      }
    } @else {
      <div class="skeleton skeleton--reader"></div>
    }
  `,
})
export class Post {
  private readonly posts = inject(Posts);
  private readonly auth = inject(Auth);
  private readonly toast = inject(Toast);
  private readonly confirm = inject(Confirm);
  private readonly router = inject(Router);

  protected readonly post = signal<BlogPost | null>(null);
  protected readonly others = signal<BlogPost[]>([]);
  protected readonly error = signal('');
  protected readonly progress = signal(0);
  protected readonly burst = signal(false);

  protected readonly cover = computed(() => (this.post()!.img ? imageUrl(this.post()!.img, 'lg') : ''));
  protected readonly author = computed(() => this.post()!.authName || this.post()!.auth);
  protected readonly when = computed(() => formatWhen(this.post()!.publishAt!));
  protected readonly cats = computed(() => categoriesOf(this.post()!.cate));
  protected readonly minutes = computed(() => readingTime(this.post()!));
  protected readonly words = computed(() => storyWords(this.post()!));
  protected readonly isMine = computed(() => !this.post()!.featured && this.post()!.auth === this.auth.user()?.username);
  protected readonly related = computed(() => {
    const p = this.post()!;
    const mine = new Set(categoriesOf(p.cate).map((c) => c.toLowerCase()));
    const score = (b: BlogPost) => categoriesOf(b.cate).filter((c) => mine.has(c.toLowerCase())).length;
    return this.others()
      .filter((b) => b._id !== p._id)
      .sort((a, b) => score(b) - score(a) || b.likes - a.likes)
      .slice(0, 3);
  });
  protected readonly fmt = compact;

  constructor() {
    inject(ActivatedRoute).paramMap.subscribe((params) => this.load(params.get('id')!));
    Promise.all([this.posts.featured(), this.posts.all()])
      .then(([f, a]) => this.others.set([...a, ...f]))
      .catch(() => {});
  }

  private async load(id: string): Promise<void> {
    this.post.set(null);
    this.error.set('');
    try {
      this.post.set(await this.posts.get(id));
      this.onScroll();
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not load this story.'));
    }
  }

  protected onScroll(): void {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    this.progress.set(max > 0 ? Math.min(1, window.scrollY / max) : 0);
  }

  // like/share/remove are only on screen once the story has loaded.
  protected async like(): Promise<void> {
    const p = this.post()!;
    if (!this.auth.user()) {
      this.toast.show('Sign in to like stories.', 'info');
      this.router.navigateByUrl('/login');
      return;
    }
    // Optimistic update; reconciled with the server's answer.
    const liked = !p.liked;
    this.post.set({ ...p, liked, likes: p.likes + (liked ? 1 : -1) });
    if (liked) {
      this.burst.set(true);
      setTimeout(() => this.burst.set(false), 700);
    }
    try {
      const res = await this.posts.like(p._id);
      // The reader may have moved on to another story meanwhile.
      this.post.update((cur) => (cur?._id === p._id ? { ...cur, ...res } : cur));
    } catch (err) {
      if (this.post()?._id === p._id) this.post.set(p);
      this.toast.error(errorMessage(err, 'Could not update your like.'));
    }
  }

  protected async share(): Promise<void> {
    const url = location.href;
    const title = this.post()!.title;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        this.toast.success('Link copied to clipboard.');
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  protected async remove(): Promise<void> {
    const p = this.post()!;
    const ok = await this.confirm.ask({ title: 'Delete this story?', text: `"${p.title || 'Untitled draft'}" will be gone for good.`, okLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await this.posts.remove(p._id);
      await this.auth.load();
      this.toast.success('Story deleted.');
      this.router.navigateByUrl('/myacc');
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not delete this story.'));
    }
  }
}
