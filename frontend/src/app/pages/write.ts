import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { skip } from 'rxjs';
import { Auth } from '../core/auth';
import { BlogInput, BlogPost, BlogStatus, categoriesOf, displayName, errorMessage, formatWhen, imageUrl, readingTime, storyWords, textOf } from '../core/api';
import { Confirm } from '../core/confirm';
import { Posts } from '../core/posts';
import { Toast } from '../core/toast';
import { PostCard } from '../shared/post-card';
import { RichEditor } from '../shared/rich-editor';

/** Unsaved new story, kept in the browser until it is saved as a draft on the server. */
export const LOCAL_DRAFT_KEY = 'bb-draft';
/** Server drafts are saved this long after the last keystroke. */
export const AUTOSAVE_MS = 2000;

interface Fields {
  title: string;
  cate: string;
  img: string;
  blogp1: string;
  blogp2: string;
}

const EMPTY: Fields = { title: '', cate: '', img: '', blogp1: '', blogp2: '' };

/** `datetime-local` value for a Date, in local time. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Adds or removes a topic in a "A | B" string (case-insensitive). */
export function toggleTopic(cate: string, topic: string): string {
  const list = categoriesOf(cate);
  const i = list.findIndex((c) => c.toLowerCase() === topic.toLowerCase());
  if (i >= 0) list.splice(i, 1);
  else list.push(topic);
  return list.join(' | ');
}

/**
 * The studio: write a story with a rich-text editor, save it as a draft, publish now or schedule it,
 * and edit stories later (/writeblog?id=…). New stories can start from the Image Pool (/writeblog?img=…).
 */
@Component({
  selector: 'app-write',
  imports: [RouterLink, PostCard, RichEditor],
  templateUrl: './write.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)', '(document:keydown)': 'onKey($event)' },
})
export class Write implements OnDestroy {
  private readonly posts = inject(Posts);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(Toast);
  private readonly confirm = inject(Confirm);
  protected readonly auth = inject(Auth);

  // Each field is a signal so the preview, checklist and autosave react as you type.
  protected readonly title = signal('');
  protected readonly cate = signal('');
  protected readonly img = signal('');
  protected readonly blogp1 = signal('');
  protected readonly blogp2 = signal('');

  /** The story on the server (null until first saved). */
  protected readonly saved = signal<BlogPost | null>(null);
  protected readonly loadingStory = signal(false);
  protected readonly busy = signal<'' | 'saving' | 'publishing'>('');
  protected readonly error = signal('');
  protected readonly savedAt = signal<Date | null>(null);
  /** Content as last saved, to tell whether there are unsaved changes. */
  private readonly baseline = signal<Fields>(EMPTY);

  protected readonly images = signal<string[]>([]);
  protected readonly suggestions = signal<string[]>([]);
  protected readonly preview = signal(false);
  protected readonly pickerOpen = signal(false);
  protected readonly scheduleOpen = signal(false);
  protected readonly scheduleAt = signal('');
  protected readonly topicInput = signal('');

  protected readonly fields = computed<Fields>(() => ({
    title: this.title(), cate: this.cate(), img: this.img(), blogp1: this.blogp1(), blogp2: this.blogp2(),
  }));
  protected readonly dirty = computed(() => JSON.stringify(this.fields()) !== JSON.stringify(this.baseline()));
  /** Content last kept in this browser (new stories only). */
  private readonly localCopy = signal('');
  /** Changes not saved anywhere yet (drives the status text). */
  protected readonly unsaved = computed(() => this.dirty() && (!!this.saved() || JSON.stringify(this.fields()) !== this.localCopy()));
  protected readonly status = computed<BlogStatus | 'new'>(() => this.saved()?.status ?? 'new');
  /** Drafts (and stories not yet saved) save themselves; live and scheduled stories change only on "Update". */
  protected readonly autosaves = computed(() => this.status() === 'new' || this.status() === 'draft');
  protected readonly words = computed(() => storyWords({ blogp1: this.blogp1(), blogp2: this.blogp2() }));
  protected readonly minutes = computed(() => readingTime({ blogp1: this.blogp1(), blogp2: this.blogp2() }));
  protected readonly topics = computed(() => categoriesOf(this.cate()));
  protected readonly checks = computed(() => [
    { label: 'A headline', done: !!this.title().trim() },
    { label: 'At least one topic', done: this.topics().length > 0 },
    { label: 'A cover image', done: !!this.img() },
    { label: 'An opening paragraph', done: !!this.blogp1().trim() },
    { label: 'Your story', done: !!textOf(this.blogp2()).trim() },
  ]);
  protected readonly ready = computed(() => this.checks().every((c) => c.done));
  protected readonly hasContent = computed(() => !!(this.title().trim() || this.blogp1().trim() || this.blogp2()));
  protected readonly author = computed(() => {
    const u = this.auth.user();
    return u ? displayName(u) : 'you';
  });
  protected readonly previewPost = computed<BlogPost>(() => ({
    _id: this.saved()?._id ?? 'preview',
    auth: this.auth.user()?.username ?? 'you',
    authName: this.author(),
    title: this.title() || 'Your headline goes here',
    cate: this.cate() || 'Topic',
    date: this.saved()?.date || 'TODAY',
    img: this.img() || 'img20',
    blogp1: this.blogp1() || 'Your opening paragraph appears on story cards…',
    blogp2: this.blogp2(),
    status: 'published',
    publishAt: null,
    likes: this.saved()?.likes ?? 0,
    liked: false,
    views: this.saved()?.views ?? 0,
  }));
  protected readonly minSchedule = computed(() => toLocalInput(new Date(Date.now() + 5 * 60_000)));
  protected readonly maxSchedule = toLocalInput(new Date(Date.now() + 365 * 24 * 3600_000));
  protected readonly imageUrl = imageUrl;
  protected readonly formatWhen = formatWhen;

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.start(this.route.snapshot.queryParamMap);
    // The router reuses this page when only the query changes (e.g. "Write" while editing a draft),
    // so follow those changes. Our own "remember the id" update matches the open story and is ignored.
    this.route.queryParamMap.pipe(skip(1)).subscribe((params) => this.switchTo(params));

    this.posts.images().then((list) => this.images.set(list)).catch(() => {});
    this.posts.all()
      .then((all) => {
        const counts = new Map<string, number>();
        for (const b of all) for (const c of categoriesOf(b.cate)) counts.set(c, (counts.get(c) ?? 0) + 1);
        this.suggestions.set([...counts].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 12));
      })
      .catch(() => {});

    // Autosave: unsaved new stories to this browser, drafts to the server.
    effect(() => {
      const fields = this.fields();
      if (!this.dirty() || !untracked(this.autosaves) || untracked(this.loadingStory)) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.autosave(fields), AUTOSAVE_MS);
    });
  }

  /** Opens the story in `?id=`, or a new one (restored from this browser, cover from `?img=`). */
  private start(params: ParamMap): void {
    const id = params.get('id');
    if (id) this.open(id);
    else this.restoreLocal();
    const pick = params.get('img');
    if (pick) this.img.set(pick);
  }

  /** Moves to another story (or a new one) within the same page, saving or confirming first. */
  private async switchTo(params: ParamMap): Promise<void> {
    const current = this.saved();
    if (params.get('id') === (current?._id ?? null) && !params.get('img')) return;
    if (!(await this.canLeave())) {
      // Stay on the story being edited.
      await this.router.navigate([], { queryParams: { id: current!._id }, replaceUrl: true });
      return;
    }
    clearTimeout(this.timer);
    this.saved.set(null);
    this.savedAt.set(null);
    this.error.set('');
    this.preview.set(false);
    this.setFields(EMPTY);
    this.start(params);
  }

  /** Loads one of your stories for editing. */
  private async open(id: string): Promise<void> {
    this.loadingStory.set(true);
    try {
      const story = await this.posts.get(id);
      if (story.auth !== this.auth.user()?.username) throw new Error('not yours');
      this.adopt(story);
    } catch {
      this.toast.error("That story can't be edited.");
      await this.router.navigateByUrl('/myacc');
    } finally {
      this.loadingStory.set(false);
    }
  }

  /** Takes a saved story as the current content. */
  private adopt(story: BlogPost): void {
    this.setFields({ title: story.title, cate: story.cate, img: story.img, blogp1: story.blogp1, blogp2: story.blogp2 });
    this.saved.set(story);
  }

  /** Replaces the content and treats it as saved. */
  private setFields(f: Fields): void {
    this.title.set(f.title);
    this.cate.set(f.cate);
    this.img.set(f.img);
    this.blogp1.set(f.blogp1);
    this.blogp2.set(f.blogp2);
    this.baseline.set(f);
  }

  private restoreLocal(): void {
    try {
      const d = JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY) ?? 'null');
      if (!d) return;
      this.title.set(d.title ?? '');
      this.cate.set(d.cate ?? '');
      this.img.set(d.img ?? '');
      this.blogp1.set(d.blogp1 ?? '');
      // Older local drafts stored the body as plain text.
      this.blogp2.set(d.blogp2 ?? '');
    } catch {
      /* ignore bad drafts */
    }
  }

  private async autosave(fields: Fields): Promise<void> {
    if (this.saved()) await this.saveDraft(true);
    else this.saveLocal(fields);
  }

  private saveLocal(fields: Fields): void {
    if (!this.hasContent()) return;
    try {
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(fields));
      this.localCopy.set(JSON.stringify(fields));
      this.savedAt.set(new Date());
    } catch {
      /* storage unavailable */
    }
  }

  /** Saves as a draft on the server (creating it the first time). `quiet` = autosave, no toast. */
  protected async saveDraft(quiet = false): Promise<void> {
    if (this.busy() || !this.hasContent()) return;
    if (this.saved() && !this.dirty() && this.status() === 'draft') return;
    await this.save({ ...this.fields(), status: 'draft' }, quiet ? '' : 'Draft saved. Finish it whenever you like.', 'saving');
  }

  /** Publishes now, or at the chosen time when `scheduled`. */
  protected async publish(scheduled = false): Promise<void> {
    if (this.busy() || !this.ready()) return;
    let publishAt: string | null = null;
    if (scheduled) {
      const when = new Date(this.scheduleAt());
      if (!this.scheduleAt() || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        this.error.set('Pick a time in the future to schedule your story.');
        return;
      }
      publishAt = when.toISOString();
    }
    const story = await this.save(
      { ...this.fields(), status: 'published', publishAt },
      scheduled ? `Scheduled for ${formatWhen(publishAt!)}.` : 'Your story is live!',
      'publishing'
    );
    if (!story) return;
    this.scheduleOpen.set(false);
    if (story.status === 'published') await this.router.navigate(['/post', story._id]);
    else await this.router.navigateByUrl('/myacc');
  }

  /** Saves changes to a live or scheduled story without changing its status. */
  protected async update(): Promise<void> {
    if (this.busy() || !this.ready()) return;
    await this.save(this.fields(), 'Changes saved.', 'saving');
  }

  /** Takes a live or scheduled story back to drafts. */
  protected async unpublish(): Promise<void> {
    const ok = await this.confirm.ask({ title: 'Move to drafts?', text: 'Readers will no longer see this story until you publish it again.', okLabel: 'Move to drafts' });
    if (ok) await this.save({ ...this.fields(), status: 'draft' }, 'Moved to your drafts.', 'saving');
  }

  /** Deletes the story (or just the local draft, if it was never saved). */
  protected async discard(): Promise<void> {
    const story = this.saved();
    const ok = await this.confirm.ask({
      title: story ? 'Delete this story?' : 'Clear this draft?',
      text: story ? `"${this.title() || 'Untitled'}" will be gone for good.` : 'Everything you have written here will be cleared.',
      okLabel: story ? 'Delete' : 'Clear',
      danger: true,
    });
    if (!ok) return;
    clearTimeout(this.timer);
    if (story) {
      try {
        await this.posts.remove(story._id);
      } catch (err) {
        this.toast.error(errorMessage(err, 'Could not delete this story.'));
        return;
      }
      this.baseline.set(this.fields()); // nothing left to lose
      await this.auth.load();
      this.toast.success('Story deleted.');
      await this.router.navigateByUrl('/myacc');
      return;
    }
    this.clearLocal();
    this.setFields(EMPTY);
    this.savedAt.set(null);
  }

  private async save(input: BlogInput, message: string, kind: 'saving' | 'publishing'): Promise<BlogPost | null> {
    clearTimeout(this.timer);
    this.busy.set(kind);
    this.error.set('');
    const sent = this.fields();
    try {
      const current = this.saved();
      const story = current ? await this.posts.update(current._id, input) : await this.posts.create(input);
      this.saved.set(story);
      this.baseline.set(sent);
      this.savedAt.set(new Date());
      await (current ? null : this.firstSaved(story));
      if (message) this.toast.success(message);
      this.auth.load();
      return story;
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.toast.error('Your session ended. Sign in again; your draft is kept in this browser.');
        this.saveLocal(sent);
        this.baseline.set(sent);
        await this.router.navigateByUrl('/login');
        return null;
      }
      this.error.set(errorMessage(err, 'Could not save your story. Please try again.'));
      return null;
    } finally {
      this.busy.set('');
    }
  }

  /** A new story now exists on the server: drop the browser copy and remember its id in the address. */
  private async firstSaved(story: BlogPost): Promise<void> {
    this.clearLocal();
    await this.router.navigate([], { queryParams: { id: story._id }, replaceUrl: true });
  }

  private clearLocal(): void {
    try {
      localStorage.removeItem(LOCAL_DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  protected toggleTopic(topic: string): void {
    this.cate.set(toggleTopic(this.cate(), topic));
  }

  protected addTopic(): void {
    const t = this.topicInput().replace(/[|\s]+/g, ' ').trim(); // "|" separates topics
    if (t && !this.topics().some((c) => c.toLowerCase() === t.toLowerCase())) this.cate.set([...this.topics(), t].join(' | '));
    this.topicInput.set('');
  }

  protected chooseCover(name: string): void {
    this.img.set(name);
    this.pickerOpen.set(false);
  }

  protected openSchedule(): void {
    const at = this.saved()?.publishAt;
    this.scheduleAt.set(at && new Date(at) > new Date() ? toLocalInput(new Date(at)) : toLocalInput(new Date(Date.now() + 24 * 3600_000)));
    this.error.set('');
    this.scheduleOpen.set(true);
  }

  /** Ctrl/⌘+S saves (draft, or update for live stories). */
  protected onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (this.autosaves()) this.saveDraft();
      else this.update();
    }
  }

  /** Closing the tab: unsaved new stories are written to this browser; server-side changes need a prompt. */
  protected onBeforeUnload(e: BeforeUnloadEvent): void {
    if (!this.dirty()) return;
    if (this.saved()) e.preventDefault();
    else this.saveLocal(this.fields());
  }

  /**
   * Called before navigating away. Pending draft changes are saved first; unsaved edits to a live or
   * scheduled story need confirmation.
   */
  async canLeave(): Promise<boolean> {
    if (!this.dirty() || this.busy()) return true;
    clearTimeout(this.timer);
    if (!this.saved()) {
      this.saveLocal(this.fields());
      return true;
    }
    if (this.autosaves()) {
      await this.saveDraft(true);
      return true;
    }
    return this.confirm.ask({ title: 'Leave without saving?', text: 'Your latest changes to this story have not been saved.', okLabel: 'Leave', danger: true });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
