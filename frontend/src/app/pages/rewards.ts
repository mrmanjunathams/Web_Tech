import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../core/auth';
import { Leader, compact } from '../core/api';
import { Posts } from '../core/posts';
import { Avatar } from '../shared/avatar';
import { Reveal, Tilt } from '../shared/effects';

/** Leaderboard: writers ranked by likes received, plus the badges they can earn. */
@Component({
  selector: 'app-rewards',
  imports: [RouterLink, Avatar, Reveal, Tilt],
  template: `
    <section class="container-x page-head">
      <p class="eyebrow" reveal>Rewards</p>
      <h1 class="display display--md" reveal="60">The <span class="text-grad">leaderboard</span></h1>
      <p class="lead" reveal="120">Writers ranked by the love their stories receive. Every like moves you up.</p>
    </section>

    <section class="container-x">
      @if (loading()) {
        <div class="skeleton skeleton--hero"></div>
      } @else if (leaders().length) {
        <div class="podium">
          @for (l of podium(); track l.username) {
            <div class="podium__place glass" [class]="'podium__place podium__place--' + l.rank" tilt="6" reveal>
              <span class="spotlight" aria-hidden="true"></span>
              <span class="podium__medal">{{ medals[l.rank - 1] }}</span>
              <app-avatar [name]="l.name" [size]="l.rank === 1 ? 84 : 64" />
              <h3>{{ l.name }}</h3>
              <p class="muted mono small">&#64;{{ l.username }}</p>
              <p class="podium__score"><span class="ms">favorite</span>{{ fmt(l.likes) }}</p>
              <p class="muted mono">{{ l.posts }} {{ l.posts === 1 ? 'story' : 'stories' }} · {{ fmt(l.views) }} views</p>
            </div>
          }
        </div>
        @if (others().length) {
          <ol class="ranking glass" start="4">
            @for (l of others(); track l.username) {
              <li [class.is-me]="l.username === auth.user()?.username">
                <span class="ranking__pos mono">#{{ l.rank }}</span>
                <app-avatar [name]="l.name" [size]="36" />
                <strong>{{ l.name }} <small class="muted mono">&#64;{{ l.username }}</small></strong>
                <span class="muted mono">{{ l.posts }} stories</span>
                <span class="ranking__likes"><span class="ms">favorite</span>{{ fmt(l.likes) }}</span>
              </li>
            }
          </ol>
        }
      } @else {
        <div class="empty glass">
          <span class="ms">emoji_events</span>
          <h3>The podium is empty</h3>
          <p class="muted">Publish a story and claim the first spot.</p>
          <a routerLink="/writeblog" class="btn-x">Write now</a>
        </div>
      }
    </section>

    <section class="container-x section">
      <header class="section-head" reveal>
        <p class="eyebrow">Badges</p>
        <h2 class="h-xl">Milestones worth chasing</h2>
      </header>
      <div class="badges">
        @for (b of badges; track b.name; let i = $index) {
          <div class="badge-card glass" tilt="5" [reveal]="i * 70">
            <span class="spotlight" aria-hidden="true"></span>
            <span class="badge-card__icon" [style.--h]="b.hue"><span class="ms">{{ b.icon }}</span></span>
            <h3>{{ b.name }}</h3>
            <p class="muted">{{ b.rule }}</p>
          </div>
        }
      </div>
    </section>
  `,
})
export class Rewards {
  protected readonly auth = inject(Auth);
  protected readonly loading = signal(true);
  protected readonly leaders = signal<(Leader & { rank: number })[]>([]);
  // Display order puts #1 in the middle.
  protected readonly podium = computed(() => {
    const [a, b, c] = this.leaders();
    return [b, a, c].filter(Boolean);
  });
  protected readonly others = computed(() => this.leaders().slice(3));
  protected readonly medals = ['🥇', '🥈', '🥉'];
  protected readonly fmt = compact;
  protected readonly badges = [
    { icon: 'edit', name: 'First Draft', rule: 'Publish your first story.', hue: 178 },
    { icon: 'local_fire_department', name: 'On Fire', rule: 'Publish five stories.', hue: 20 },
    { icon: 'favorite', name: 'Crowd Pleaser', rule: 'Collect 25 likes across your stories.', hue: 335 },
    { icon: 'visibility', name: 'Page Turner', rule: 'Reach 500 views.', hue: 255 },
    { icon: 'workspace_premium', name: 'Legend', rule: 'Finish a month at #1.', hue: 45 },
  ];

  constructor() {
    inject(Posts).leaderboard()
      .then((rows) => this.leaders.set(rows.map((r, i) => ({ ...r, rank: i + 1 }))))
      .catch(() => {})
      .finally(() => this.loading.set(false));
  }
}
