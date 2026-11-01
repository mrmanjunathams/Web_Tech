import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Auth } from '../core/auth';
import { Confirm } from '../core/confirm';
import { Toast } from '../core/toast';
import { account, blog, click, http, respond, settle, testProviders, text, type } from '../testing/helpers';
import { AUTOSAVE_MS, LOCAL_DRAFT_KEY, Write, toLocalInput, toggleTopic } from './write';

const full = { title: 'My trip', cate: 'Travel', img: 'img2', blogp1: 'It began.', blogp2: '<p>And ended.</p>' };

describe('write helpers', () => {
  it('toLocalInput and toggleTopic', () => {
    expect(toLocalInput(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05T07:03');
    expect(toggleTopic('', 'Art')).toBe('Art');
    expect(toggleTopic('Art | Travel', 'art')).toBe('Travel');
  });
});

describe('Write (studio)', () => {
  let query: Record<string, string> = {};
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  /** Same page, new query (as when the router reuses the studio). */
  const navigateTo = (q: Record<string, string>) => params.next(convertToParamMap(q));

  beforeEach(() => {
    query = {};
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ...testProviders([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useFactory: () => {
            params = new BehaviorSubject(convertToParamMap(query));
            return { snapshot: { queryParamMap: convertToParamMap(query) }, queryParamMap: params };
          },
        },
      ],
    });
    TestBed.inject(Auth).user.set(account());
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Renders the studio and answers its start-up requests. */
  async function render(opts: { story?: unknown; images?: string[]; all?: unknown } = {}) {
    const f = TestBed.createComponent(Write);
    f.detectChanges();
    if (query['id']) respond(`/posts/${query['id']}`, opts.story ?? blog({ _id: query['id'] }), opts.story === 404 ? { status: 404 } : {});
    respond('picyourpic/manifest.json', opts.images ?? ['img1', 'img2']);
    respond('/BAdd', opts.all ?? [blog({ cate: 'Travel | Art' }), blog({ cate: 'Travel' })]);
    await settle(f);
    const el = f.nativeElement as HTMLElement;
    const cmp = f.componentInstance as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fill = async (fields: Partial<typeof full>) => {
      for (const [k, v] of Object.entries(fields)) cmp[k].set(v);
      await settle(f);
    };
    return { f, el, cmp, fill, router: TestBed.inject(Router) };
  }

  it('new story: checklist, preview card, topics, cover picker, and publish now', async () => {
    query = { img: 'img1' };
    const { f, el, cmp, fill, router } = await render();
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(text(el, '.status-chip')).toBe('New story');
    expect(el.querySelector('.studio-cover img')!.getAttribute('src')).toBe('picyourpic/opt/img1-1800.webp');
    expect([...el.querySelectorAll('.checklist li.done')].map((l) => l.textContent)).toEqual(['A cover image']);
    expect((el.querySelector('#post') as HTMLButtonElement).disabled).toBe(true);
    expect(text(el, '.studio__side .post-card__title')).toBe('Your headline goes here');
    expect(text(el, '.studio__byline')).toContain('Amy Writer');

    // Cover: remove, pick from the picker.
    click(el, '[aria-label="Remove cover"]');
    f.detectChanges();
    click(el, '#add-cover');
    f.detectChanges();
    click(el, '.cover-picker .image-picker__item[aria-label="img2"]');
    f.detectChanges();
    expect(el.querySelector('.cover-picker')).toBeNull();
    click(el, '.studio-cover__actions .btn-ghost');
    f.detectChanges();
    click(el, '.cover-picker [aria-label="Close"]');
    click(el, '.studio-cover__actions .btn-ghost');
    f.detectChanges();
    click(el, '.palette-backdrop');
    f.detectChanges();
    expect(el.querySelector('.cover-picker')).toBeNull();

    // Topics: suggestions, typed, duplicates and removal.
    expect([...el.querySelectorAll('.studio__panel:first-child .chip')].map((c) => c.textContent?.trim())).toEqual(['+ Travel', '+ Art']);
    click(el, '.chip', '+ Travel');
    f.detectChanges();
    type(el, '#topic', 'travel');
    el.querySelector('.topic-add')!.dispatchEvent(new Event('submit'));
    type(el, '#topic', 'Food | Drink');
    el.querySelector('.topic-add')!.dispatchEvent(new Event('submit'));
    type(el, '#topic', '  ');
    el.querySelector('.topic-add')!.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(cmp['cate']()).toBe('Travel | Food Drink');
    click(el, '[aria-label="Remove topic Food Drink"]');
    f.detectChanges();
    expect(cmp['cate']()).toBe('Travel');

    // Title, opening and body via the inputs.
    type(el, '#title', 'My trip');
    type(el, '#blog_p1', 'It began.');
    await fill({ blogp2: '<p>And ended.</p>' });
    expect(text(el, '.studio-bar__count')).toBe('4 words · 1 min');
    expect(el.querySelectorAll('.checklist li.done').length).toBe(5);

    // Preview mode shows the story as readers will.
    click(el, '.studio-bar__actions .btn-ghost', 'Preview');
    f.detectChanges();
    expect(text(el, '.studio__preview-read h1')).toBe('My trip');
    expect(el.querySelector('.studio__preview-read .prose__body p')!.textContent).toBe('And ended.');
    click(el, '.studio-bar__actions .btn-ghost', 'Edit');
    f.detectChanges();

    click(el, '#post');
    f.detectChanges();
    expect(text(el, '#post')).toContain('Publishing');
    const sent = respond('/addblog', blog({ _id: 'n1', status: 'published' }), { method: 'POST' });
    expect(sent.body).toEqual({ ...full, img: 'img2', status: 'published', publishAt: null });
    await settle(f);
    respond('/myacc', account());
    await settle(f);
    expect(nav).toHaveBeenCalledWith([], { queryParams: { id: 'n1' }, replaceUrl: true });
    expect(nav).toHaveBeenCalledWith(['/post', 'n1']);
  });

  it('unsaved new stories are kept in the browser, restored, and can be cleared', async () => {
    vi.useFakeTimers();
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ title: 'Saved idea', blogp2: '<p>body</p>' }));
    const { f, el, cmp, fill } = await render();
    expect(cmp['title']()).toBe('Saved idea');
    expect(cmp['cate']()).toBe('');
    expect(el.querySelector('#save-draft')).not.toBeNull();

    await fill({ title: 'Better idea' });
    expect(text(el, '.studio-bar__save')).toContain('Editing');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    f.detectChanges();
    expect(JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY)!).title).toBe('Better idea');
    expect(text(el, '.studio-bar__save')).toContain('Saved in this browser');

    // Clear (after confirming).
    const ask = vi.spyOn(TestBed.inject(Confirm), 'ask').mockResolvedValueOnce(false);
    click(el, '.studio__danger .btn-ghost');
    await settle(f);
    expect(cmp['title']()).toBe('Better idea');
    ask.mockResolvedValueOnce(true);
    click(el, '.studio__danger .btn-ghost');
    await settle(f);
    expect(ask.mock.calls[1][0].title).toBe('Clear this draft?');
    expect(cmp['title']()).toBe('');
    expect(localStorage.getItem(LOCAL_DRAFT_KEY)).toBeNull();
    expect((el.querySelector('.studio__danger .btn-ghost') as HTMLButtonElement).disabled).toBe(true);

    // Only content worth keeping is stored; storage errors are ignored.
    await fill({ img: 'img1' });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(localStorage.getItem(LOCAL_DRAFT_KEY)).toBeNull();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    await fill({ title: 'x' });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    vi.spyOn(TestBed.inject(Confirm), 'ask').mockResolvedValueOnce(true);
    click(el, '.studio__danger .btn-ghost');
    await settle(f);
    set.mockRestore();
    remove.mockRestore();
  });

  it('ignores a corrupt local draft and an empty one', async () => {
    localStorage.setItem(LOCAL_DRAFT_KEY, '{oops');
    const a = await render();
    expect(a.cmp['title']()).toBe('');
  });

  it('restores a partial local draft', async () => {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ cate: 'Art', img: 'img1', blogp1: 'x' }));
    const { cmp } = await render();
    expect([cmp['title'](), cmp['cate'](), cmp['blogp2']()]).toEqual(['', 'Art', '']);
  });

  it('deleting a story without a title names it "Untitled"', async () => {
    query = { id: 'u1' };
    const { el } = await render({ story: blog({ _id: 'u1', title: '', status: 'draft' }) });
    const ask = vi.spyOn(TestBed.inject(Confirm), 'ask').mockResolvedValue(false);
    click(el, '.studio__danger .btn-ghost');
    await settle();
    expect(ask.mock.calls[0][0].text).toBe('"Untitled" will be gone for good.');
  });

  it('saves drafts to the server, then autosaves them, and Ctrl+S saves', async () => {
    vi.useFakeTimers();
    const { f, el, cmp, fill } = await render();
    const success = vi.spyOn(TestBed.inject(Toast), 'success');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect((el.querySelector('#save-draft') as HTMLButtonElement).disabled).toBe(true); // nothing written yet

    await fill({ title: 'Draft one' });
    click(el, '#save-draft');
    f.detectChanges();
    expect(text(el, '.studio-bar__save')).toContain('Saving');
    expect(respond('/addblog', blog({ _id: 'd1', status: 'draft', title: 'Draft one' })).body).toMatchObject({ title: 'Draft one', status: 'draft' });
    await settle(f);
    respond('/myacc', account());
    expect(success).toHaveBeenCalledWith('Draft saved. Finish it whenever you like.');
    f.detectChanges();
    expect(text(el, '.status-chip')).toBe('Draft');
    expect(text(el, '.studio-bar__save')).toContain('Saved');

    // Saving again with no changes does nothing.
    click(el, '#save-draft');
    http().expectNone('/posts/d1');

    // Typing autosaves quietly.
    await fill({ blogp1: 'More words' });
    expect(text(el, '.studio-bar__save')).toContain('Editing');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS);
    expect(respond('/posts/d1', blog({ _id: 'd1', status: 'draft' }), { method: 'PATCH' }).body).toMatchObject({ blogp1: 'More words', status: 'draft' });
    await settle(f);
    respond('/myacc', account());
    expect(success).toHaveBeenCalledTimes(1);

    // Ctrl+S saves the draft now.
    await fill({ blogp1: 'Even more' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    respond('/posts/d1', blog({ _id: 'd1', status: 'draft' }), { method: 'PATCH' });
    await settle(f);
    respond('/myacc', account());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true })); // other shortcuts ignored
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(cmp['busy']()).toBe('');
  });

  it('schedules a story for later, with validation', async () => {
    const { f, el, fill, router } = await render();
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fill(full);
    click(el, '.studio-bar__actions .btn-ghost', 'Schedule');
    f.detectChanges();
    const input = el.querySelector('#schedule-at') as HTMLInputElement;
    expect(new Date(input.value).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000); // defaults to tomorrow

    for (const bad of ['', 'garbage', '2001-01-01T10:00']) {
      type(el, '#schedule-at', bad);
      el.querySelector('.schedule-dialog')!.dispatchEvent(new Event('submit'));
      await settle(f);
      expect(text(el, '.schedule-dialog .form-msg--error')).toContain('Pick a time in the future');
    }
    const when = toLocalInput(new Date(Date.now() + 3 * 24 * 3600_000));
    type(el, '#schedule-at', when);
    el.querySelector('.schedule-dialog')!.dispatchEvent(new Event('submit'));
    const sent = respond('/addblog', blog({ _id: 's1', status: 'scheduled', publishAt: new Date(when).toISOString() }));
    expect(sent.body).toMatchObject({ status: 'published', publishAt: new Date(when).toISOString() });
    await settle(f);
    respond('/myacc', account());
    await settle(f);
    expect(nav).toHaveBeenCalledWith('/myacc');

    // Cancel and backdrop close the dialog.
    click(el, '.studio-bar__actions .btn-ghost', 'Reschedule');
    f.detectChanges();
    click(el, '.schedule-dialog .btn-ghost');
    f.detectChanges();
    click(el, '.studio-bar__actions .btn-ghost', 'Reschedule');
    f.detectChanges();
    expect((el.querySelector('#schedule-at') as HTMLInputElement).value).toBe(when); // existing schedule
    expect(text(el, '#schedule-confirm')).toBe('Reschedule');
    click(el, '.palette-backdrop');
    f.detectChanges();
    expect(el.querySelector('.schedule-dialog')).toBeNull();
  });

  it('edits a published story: update, unpublish, delete, and asks before leaving with changes', async () => {
    query = { id: 'p1' };
    const live = blog({ _id: 'p1', ...full, status: 'published', date: '01-NOV-2026', likes: 4, views: 9 });
    const { f, el, cmp, fill, router } = await render({ story: live });
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    expect(text(el, '.status-chip')).toContain('Published');
    expect(text(el, '.studio__byline')).toContain('01-NOV-2026');
    expect(el.querySelector('#save-draft')).toBeNull();
    expect((el.querySelector('#update') as HTMLButtonElement).disabled).toBe(true); // nothing changed
    expect(await cmp['canLeave']()).toBe(true);

    await fill({ title: 'Better title' });
    expect(text(el, '.studio-bar__save')).toContain('Unsaved changes');
    const ask = vi.spyOn(TestBed.inject(Confirm), 'ask').mockResolvedValueOnce(false);
    expect(await cmp['canLeave']()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    // Ctrl+S on a live story = Update.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', metaKey: true }));
    expect(respond('/posts/p1', { ...live, title: 'Better title' }, { method: 'PATCH' }).body).toEqual({ ...full, title: 'Better title' });
    await settle(f);
    respond('/myacc', account());
    await settle(f);
    expect(text(el, '.studio-bar__save')).toContain('Saved');

    // Update button, failing.
    await fill({ title: 'Third' });
    click(el, '#update');
    respond('/posts/p1', { error: 'Missing fields: cate' }, { method: 'PATCH', status: 400 });
    await settle(f);
    expect(text(el, '.form-msg--error')).toBe('Missing fields: cate');

    // Move to drafts (after confirming).
    ask.mockResolvedValueOnce(false);
    click(el, '.studio-bar__actions .btn-ghost', 'Move to drafts');
    await settle(f);
    ask.mockResolvedValueOnce(true);
    click(el, '.studio-bar__actions .btn-ghost', 'Move to drafts');
    await settle(f);
    respond('/posts/p1', { ...live, status: 'draft' }, { method: 'PATCH' });
    await settle(f);
    respond('/myacc', account());
    await settle(f);
    expect(text(el, '.status-chip')).toBe('Draft');

    // Delete: failure, then success.
    ask.mockResolvedValueOnce(true);
    click(el, '.studio__danger .btn-ghost');
    await settle(f);
    expect(ask.mock.calls.at(-1)![0].text).toBe('"Third" will be gone for good.');
    respond('/posts/p1', null, { method: 'DELETE', status: 500 });
    await settle(f);
    ask.mockResolvedValueOnce(true);
    click(el, '.studio__danger .btn-ghost');
    await settle(f);
    respond('/posts/p1', {}, { method: 'DELETE' });
    await settle(f);
    respond('/myacc', account());
    await settle(f);
    expect(nav).toHaveBeenCalledWith('/myacc');
    expect(await cmp['canLeave']()).toBe(true); // nothing left to save
  });

  it('a scheduled story can be rescheduled or published now; drafts flush on leave', async () => {
    query = { id: 's1' };
    const soon = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
    const { f, el, cmp, fill, router } = await render({ story: blog({ _id: 's1', ...full, title: '', status: 'scheduled', publishAt: soon }) });
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(text(el, '.status-chip')).toContain('Scheduled');
    cmp['openSchedule']();
    f.detectChanges();
    expect((el.querySelector('#schedule-at') as HTMLInputElement).value).toBe(toLocalInput(new Date(soon)));
    cmp['scheduleOpen'].set(false);

    // Back to draft, then leaving flushes pending changes.
    vi.spyOn(TestBed.inject(Confirm), 'ask').mockResolvedValueOnce(true);
    click(el, '.studio-bar__actions .btn-ghost', 'Move to drafts');
    await settle(f);
    respond('/posts/s1', blog({ _id: 's1', ...full, status: 'draft', publishAt: '2001-01-01T00:00:00Z' }), { method: 'PATCH' });
    await settle(f);
    respond('/myacc', account());
    cmp['openSchedule'](); // past time on record: defaults to tomorrow
    expect(new Date(cmp['scheduleAt']()).getTime()).toBeGreaterThan(Date.now());
    cmp['scheduleOpen'].set(false);
    await fill({ title: 'Named now' });
    const leaving = cmp['canLeave']();
    respond('/posts/s1', blog({ _id: 's1', status: 'draft' }), { method: 'PATCH' });
    await settle();
    respond('/myacc', account());
    expect(await leaving).toBe(true);

    // Publish now from a draft.
    const nav = vi.spyOn(router, 'navigate');
    await fill({ title: 'Final' });
    click(el, '#post');
    respond('/posts/s1', blog({ _id: 's1', status: 'published' }), { method: 'PATCH' });
    await settle(f);
    respond('/myacc', account());
    await settle(f);
    expect(nav).toHaveBeenCalledWith(['/post', 's1']);
  });

  it('a new story with unsaved text is kept locally when leaving or closing the tab', async () => {
    const { cmp, fill } = await render();
    await fill({ title: 'Typed' });
    window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
    expect(JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY)!).title).toBe('Typed');
    localStorage.clear();
    expect(await cmp['canLeave']()).toBe(true);
    expect(JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY)!).title).toBe('Typed');
    await fill({ title: '' });
    window.dispatchEvent(new Event('beforeunload', { cancelable: true })); // nothing dirty
    cmp['busy'].set('saving');
    await fill({ title: 'x' });
    expect(await cmp['canLeave']()).toBe(true); // a save is in flight
  });

  it('a session that ended while saving keeps the work and asks to sign in', async () => {
    const { f, fill, router } = await render();
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const error = vi.spyOn(TestBed.inject(Toast), 'error');
    await fill(full);
    (f.componentInstance as unknown as { publish: () => Promise<void> }).publish();
    respond('/addblog', null, { status: 401 });
    await settle(f);
    expect(error).toHaveBeenCalledWith('Your session ended. Sign in again; your draft is kept in this browser.');
    expect(JSON.parse(localStorage.getItem(LOCAL_DRAFT_KEY)!).title).toBe('My trip');
    expect(nav).toHaveBeenCalledWith('/login');
  });

  it('busy and incomplete stories ignore publish, update and save', async () => {
    const { cmp, fill } = await render();
    await cmp['publish']();
    await cmp['update']();
    await cmp['saveDraft']();
    http().expectNone('/addblog');
    await fill(full);
    cmp['busy'].set('saving');
    await cmp['publish']();
    await cmp['update']();
    await cmp['saveDraft']();
    http().expectNone('/addblog');
  });

  it('reused page: "Write" while editing a draft saves it, then starts a fresh story', async () => {
    query = { id: 'd1' };
    const { f, cmp, fill } = await render({ story: blog({ _id: 'd1', title: 'Draft', status: 'draft' }) });
    navigateTo({ id: 'd1' }); // our own address update: nothing happens
    await settle(f);
    expect(cmp['title']()).toBe('Draft');

    await fill({ title: 'Draft, edited' });
    navigateTo({});
    respond('/posts/d1', blog({ _id: 'd1', status: 'draft' }), { method: 'PATCH' }); // saved first
    await settle(f);
    respond('/myacc', account());
    await settle(f);
    expect(cmp['saved']()).toBeNull();
    expect(cmp['title']()).toBe('');
    expect(cmp['status']()).toBe('new');
  });

  it('reused page: "Write" on a new story keeps what you typed', async () => {
    const { f, cmp, fill } = await render();
    await fill({ title: 'Typing away' });
    navigateTo({});
    await settle(f);
    expect(cmp['title']()).toBe('Typing away');
  });

  it('reused page: opening another story, or a new one with a cover', async () => {
    query = { id: 'd1' };
    const { f, cmp } = await render({ story: blog({ _id: 'd1', title: 'First', status: 'draft' }) });
    navigateTo({ id: 'd2' });
    await settle(f);
    respond('/posts/d2', blog({ _id: 'd2', title: 'Second', status: 'draft' }));
    await settle(f);
    expect(cmp['title']()).toBe('Second');
    navigateTo({ id: 'd2', img: 'img3' });
    await settle(f);
    expect(cmp['saved']()).toBeNull();
    expect(cmp['img']()).toBe('img3');
  });

  it('reused page: unsaved edits to a live story need confirmation, and cancelling stays put', async () => {
    query = { id: 'p1' };
    const { f, cmp, fill, router } = await render({ story: blog({ _id: 'p1', ...full, status: 'published' }) });
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fill({ title: 'Edited live title' });
    vi.spyOn(TestBed.inject(Confirm), 'ask').mockResolvedValueOnce(false);
    navigateTo({});
    await settle(f);
    expect(nav).toHaveBeenCalledWith([], { queryParams: { id: 'p1' }, replaceUrl: true });
    expect(cmp['title']()).toBe('Edited live title');
  });

  it("someone else's story, or a missing one, can't be opened", async () => {
    query = { id: 'x1' };
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const error = vi.spyOn(TestBed.inject(Toast), 'error');
    await render({ story: blog({ _id: 'x1', auth: 'someone-else' }) });
    expect(error).toHaveBeenCalledWith("That story can't be edited.");
    expect(nav).toHaveBeenCalledWith('/myacc');
  });

  it('signed out (session lost): the byline says "you", and suggestions/images may be unavailable', async () => {
    TestBed.inject(Auth).user.set(null);
    const f = TestBed.createComponent(Write);
    f.detectChanges();
    respond('picyourpic/manifest.json', null, { status: 404 });
    respond('/BAdd', null, { status: 500 });
    await settle(f);
    expect(text(f.nativeElement, '.studio__byline')).toContain('By you');
    expect(f.nativeElement.querySelector('.studio__panel .small')).toBeNull();
    f.destroy();
  });
});
