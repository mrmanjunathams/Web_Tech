import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../core/auth';
import { Confirm } from '../core/confirm';
import { BlogPost, BlogStatus, displayName, errorMessage, formatWhen, storyWords } from '../core/api';
import { Posts } from '../core/posts';
import { Toast } from '../core/toast';
import { Avatar } from '../shared/avatar';
import { CountUp, Reveal } from '../shared/effects';
import { PostCard } from '../shared/post-card';

const TABS: { id: BlogStatus; label: string; icon: string; empty: string }[] = [
  { id: 'published', label: 'Published', icon: 'public', empty: 'Pick a cover, write your story, hit publish. It takes five minutes.' },
  { id: 'scheduled', label: 'Scheduled', icon: 'schedule', empty: 'Stories you schedule appear here until they go live.' },
  { id: 'draft', label: 'Drafts', icon: 'edit_note', empty: 'Save a draft any time and finish it later. Drafts are private.' },
];

@Component({
  selector: 'app-account',
  imports: [RouterLink, DatePipe, Avatar, PostCard, CountUp, Reveal],
  template: `
    @if (auth.user(); as user) {
      <section class="container-x page-head page-head--compact">
        <div class="profile glass" reveal>
          <div class="profile__glow" aria-hidden="true"></div>
          <app-avatar [name]="name()" [size]="88" />
          <div class="profile__info">
            <p class="eyebrow">Dashboard</p>
            @if (editing()) {
              <form class="name-edit" (submit)="$event.preventDefault(); saveName()">
                <input id="name-input" class="input-x" maxlength="60" aria-label="Your name" placeholder="Your name"
                       [value]="nameDraft()" (input)="nameDraft.set($any($event.target).value)" (keydown.escape)="editing.set(false)">
                <button type="submit" class="btn-x btn-x--sm" [disabled]="!nameDraft().trim() || savingName()">Save</button>
                <button type="button" class="btn-ghost btn-x--sm" (click)="editing.set(false)">Cancel</button>
              </form>
            } @else {
              <h1 class="display display--sm profile__name">
                {{ name() }}
                <button type="button" id="edit-name" class="icon-btn" aria-label="Edit your name" title="Edit your name" (click)="startEdit()"><span class="ms">edit</span></button>
              </h1>
            }
            <p class="muted">&#64;{{ user.username }} · <a [href]="'mailto:' + user.email">{{ user.email }}</a>
              @if (user.createdAt) { · Joined {{ user.createdAt | date: 'MMM yyyy' }} }</p>
          </div>
          <div class="profile__actions">
            <a routerLink="/writeblog" class="btn-x"><span class="ms">edit_square</span>New story</a>
            <button type="button" id="logout" class="btn-ghost" (click)="logout()"><span class="ms">logout</span>Log out</button>
          </div>
        </div>

        @if (!user.name) {
          <p class="banner glass" role="status">
            <span class="ms">badge</span>
            Add your name so readers know who wrote your stories. Until then we show your username.
            <button type="button" class="btn-x btn-x--sm" (click)="startEdit()">Add your name</button>
          </p>
        }

        <div class="stat-tiles">
          @for (s of tiles(); track s.label; let i = $index) {
            <div class="stat-tile glass" [reveal]="i * 70">
              <span class="ms">{{ s.icon }}</span>
              <span class="stat-tile__num" [countUp]="s.value"></span>
              <span class="muted">{{ s.label }}</span>
            </div>
          }
        </div>
      </section>

      <section class="container-x section section--tight">
        <header class="section-head">
          <p class="eyebrow">Your work</p>
          <h2 class="h-xl">{{ user.blogs.length ? 'Your stories' : 'Your first story awaits' }}</h2>
        </header>
        <div class="tabs" role="tablist" aria-label="Your stories">
          @for (t of tabs; track t.id) {
            <button type="button" role="tab" class="tab" [class.is-on]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">
              <span class="ms">{{ t.icon }}</span>{{ t.label }}<span class="chip__count">{{ counts()[t.id] }}</span>
            </button>
          }
        </div>
        <div class="grid-cards" role="tabpanel">
          @for (b of shown(); track b._id; let i = $index) {
            <div class="owned" [reveal]="(i % 3) * 70">
              <app-post-card [post]="b" [link]="b.status === 'published' ? undefined : '/writeblog'" [query]="b.status === 'published' ? null : { id: b._id }" />
              @if (b.status === 'scheduled') { <p class="owned__note muted"><span class="ms">schedule</span>Goes live {{ when(b) }}</p> }
              @if (b.status === 'draft' && b.updatedAt) { <p class="owned__note muted"><span class="ms">history</span>Edited {{ b.updatedAt | date: 'd MMM, HH:mm' }}</p> }
              <div class="owned__actions">
                <a class="icon-btn" [routerLink]="['/writeblog']" [queryParams]="{ id: b._id }" [attr.aria-label]="'Edit ' + (b.title || 'draft')" title="Edit"><span class="ms">edit</span></a>
                <button type="button" class="icon-btn owned__delete" (click)="remove(b)" [attr.aria-label]="'Delete ' + (b.title || 'draft')" title="Delete">
                  <span class="ms">delete</span>
                </button>
              </div>
            </div>
          } @empty {
            <div class="empty glass">
              <span class="ms">draw</span>
              <h3>{{ tab() === 'published' ? 'Nothing published yet' : tab() === 'scheduled' ? 'Nothing scheduled' : 'No drafts' }}</h3>
              <p class="muted">{{ emptyText() }}</p>
              <a routerLink="/writeblog" class="btn-x">Write a story</a>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class Account {
  protected readonly auth = inject(Auth);
  private readonly posts = inject(Posts);
  private readonly toast = inject(Toast);
  private readonly confirm = inject(Confirm);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  protected readonly tab = signal<BlogStatus>('published');
  protected readonly editing = signal(false);
  protected readonly nameDraft = signal('');
  protected readonly savingName = signal(false);

  protected readonly name = computed(() => displayName(this.auth.user()!));
  // The page only renders (and reads this) while signed in.
  private readonly blogs = computed(() => this.auth.user()!.blogs);
  protected readonly counts = computed(() => {
    const c: Record<BlogStatus, number> = { published: 0, scheduled: 0, draft: 0 };
    for (const b of this.blogs()) c[b.status]++;
    return c;
  });
  protected readonly shown = computed(() => this.blogs().filter((b) => b.status === this.tab()));
  protected readonly emptyText = computed(() => TABS.find((t) => t.id === this.tab())!.empty);
  /** Numbers for live stories only. */
  protected readonly tiles = computed(() => {
    const live = this.blogs().filter((b) => b.status === 'published');
    return [
      { icon: 'article', label: 'Stories', value: live.length },
      { icon: 'favorite', label: 'Likes received', value: live.reduce((n, b) => n + b.likes, 0) },
      { icon: 'visibility', label: 'Views', value: live.reduce((n, b) => n + b.views, 0) },
      { icon: 'notes', label: 'Words written', value: this.blogs().reduce((n, b) => n + storyWords(b), 0) },
    ];
  });

  constructor() {
    // Opening the dashboard right after saving a draft shows the drafts tab.
    const c = this.counts();
    if (!c.published && c.draft) this.tab.set('draft');
  }

  protected when(b: BlogPost): string {
    return formatWhen(b.publishAt!);
  }

  protected startEdit(): void {
    this.nameDraft.set(this.auth.user()!.name);
    this.editing.set(true);
  }

  protected async saveName(): Promise<void> {
    this.savingName.set(true);
    try {
      await this.auth.rename(this.nameDraft().trim());
      this.editing.set(false);
      this.toast.success('Name updated.');
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not update your name.'));
    } finally {
      this.savingName.set(false);
    }
  }

  protected async remove(b: BlogPost): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Delete this story?', text: `"${b.title || 'Untitled draft'}" will be gone for good.`, okLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await this.posts.remove(b._id);
      await this.auth.load();
      this.toast.success('Story deleted.');
    } catch (err) {
      this.toast.error(errorMessage(err, 'Could not delete this story.'));
    }
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.toast.success('Signed out. See you soon!');
    await this.router.navigateByUrl('/');
  }
}
