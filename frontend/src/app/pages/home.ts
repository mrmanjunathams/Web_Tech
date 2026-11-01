import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../core/auth';
import { BlogPost, Stats, categoriesOf } from '../core/api';
import { Posts } from '../core/posts';
import { CountUp, Reveal, Tilt } from '../shared/effects';
import { PostCard } from '../shared/post-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, PostCard, Reveal, Tilt, CountUp],
  templateUrl: './home.html',
  host: { '(pointermove)': 'parallax($event)' },
})
export class Home implements OnDestroy {
  private readonly posts = inject(Posts);
  protected readonly auth = inject(Auth);

  protected readonly words = ['your way.', 'out loud.', 'beautifully.', 'fearlessly.'];
  protected readonly wordIndex = signal(0);
  private readonly timer = setInterval(() => this.wordIndex.update((i) => (i + 1) % this.words.length), 2600);

  protected readonly stats = signal<Stats | null>(null);
  protected readonly stories = signal<BlogPost[]>([]);
  protected readonly loading = signal(true);

  /** Most-loved stories first (likes, then views), falling back to the newest. */
  protected readonly trending = computed(() =>
    [...this.stories()].sort((a, b) => b.likes - a.likes || b.views - a.views).slice(0, 3)
  );
  protected readonly topics = computed(() => {
    const set = new Set(this.stories().flatMap((s) => categoriesOf(s.cate)));
    ['Travel', 'Art', 'Ocean', 'TechByte', 'Nature', 'Fashion', 'Office', 'Animals'].forEach((t) => set.add(t));
    return [...set];
  });

  /** Pointer position over the hero, -1..1, drives the floating card stack. */
  protected readonly px = signal(0);
  protected readonly py = signal(0);

  protected readonly heroCards = ['img11', 'img5', 'img9'];
  protected readonly features = [
    { icon: 'bolt', title: 'Publish in minutes', text: 'A focused two-pane editor with live preview and auto-saved drafts.', span: 'wide' },
    { icon: 'travel_explore', title: 'Instant search', text: 'Press Ctrl K anywhere to jump to any story, page or action.', span: '' },
    { icon: 'photo_library', title: 'Image Pool', text: 'Hand-picked photography, ready for your next cover.', span: '' },
    { icon: 'military_tech', title: 'Climb the leaderboard', text: 'Every like counts. The best writers rise to the top.', span: '' },
    { icon: 'contrast', title: 'Light & dark', text: 'A reading experience that adapts to you, day or night.', span: 'wide' },
  ];

  constructor() {
    Promise.all([this.posts.stats(), this.posts.all()])
      .then(([stats, stories]) => {
        this.stats.set(stats);
        this.stories.set(stories);
      })
      .catch(() => {})
      .finally(() => this.loading.set(false));
  }

  protected parallax(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    this.px.set((e.clientX / window.innerWidth) * 2 - 1);
    this.py.set((e.clientY / window.innerHeight) * 2 - 1);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
