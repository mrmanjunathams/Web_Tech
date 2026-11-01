import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPost, categoriesOf, compact, formatWhen, imageUrl, readingTime } from '../core/api';
import { Avatar } from './avatar';
import { Tilt } from './effects';

/**
 * Story card used across the site. `variant="hero"` is the large magazine-style card.
 * Links to the story by default; pass `link` to go elsewhere (e.g. the editor), or null for a plain card.
 */
@Component({
  selector: 'app-post-card',
  imports: [NgTemplateOutlet, RouterLink, Avatar, Tilt],
  template: `
    @if (target(); as to) {
      <a class="post-card glass" [class.post-card--hero]="variant() === 'hero'" [routerLink]="to" [queryParams]="query()" tilt="5"
         [attr.aria-label]="heading()">
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else {
      <div class="post-card glass" [class.post-card--hero]="variant() === 'hero'">
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    }

    <ng-template #body>
      @let p = post();
      <span class="spotlight" aria-hidden="true"></span>
      <figure class="post-card__media" [class.post-card__media--empty]="!p.img">
        @if (p.img) { <img [src]="image()" [alt]="''" loading="lazy"> }
        <span class="post-card__chips">
          @switch (p.status) {
            @case ('draft') { <span class="chip chip--status chip--draft">Draft</span> }
            @case ('scheduled') { <span class="chip chip--status chip--scheduled"><span class="ms">schedule</span>{{ when() }}</span> }
          }
          @for (c of cats(); track c) { <span class="chip chip--glass">{{ c }}</span> }
        </span>
      </figure>
      <div class="post-card__body">
        <p class="eyebrow">{{ p.date || 'Not published' }} · {{ minutes() }} min read</p>
        <h3 class="post-card__title">{{ heading() }}</h3>
        @if (p.blogp1) { <p class="post-card__excerpt">{{ p.blogp1 }}</p> }
        <div class="post-card__meta">
          <app-avatar [name]="p.authName || p.auth" [size]="28" />
          <span class="post-card__author">{{ p.authName || p.auth }}</span>
          @if (!p.featured) {
            <span class="post-card__stat" [class.is-liked]="p.liked" title="Likes"><span class="ms">favorite</span>{{ fmt(p.likes) }}</span>
            <span class="post-card__stat" title="Views"><span class="ms">visibility</span>{{ fmt(p.views) }}</span>
          } @else {
            <span class="chip chip--brand ms-auto">Featured</span>
          }
        </div>
      </div>
    </ng-template>
  `,
})
export class PostCard {
  readonly post = input.required<BlogPost>();
  readonly variant = input<'default' | 'hero'>('default');
  /** Router link; undefined = the story page, null = not a link. */
  readonly link = input<string | null | undefined>(undefined);
  /** Query params for `link` (e.g. { id } for the editor). */
  readonly query = input<Record<string, string> | null>(null);

  protected readonly target = computed(() => {
    const link = this.link();
    return link === undefined ? `/post/${this.post()._id}` : link;
  });
  protected readonly heading = computed(() => this.post().title || 'Untitled draft');
  protected readonly image = computed(() => imageUrl(this.post().img));
  protected readonly cats = computed(() => categoriesOf(this.post().cate).slice(0, 2));
  protected readonly minutes = computed(() => readingTime(this.post()));
  protected readonly when = computed(() => (this.post().publishAt ? formatWhen(this.post().publishAt!) : ''));
  protected readonly fmt = compact;
}
