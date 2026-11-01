import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Auth } from '../core/auth';
import { Confirm } from '../core/confirm';
import { Toast } from '../core/toast';
import { account, blog, click, http, respond, settle, testProviders, text } from '../testing/helpers';
import { Post } from './post';

describe('Post (reader)', () => {
  const params = new BehaviorSubject(convertToParamMap({ id: 'p1' }));

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined);
    params.next(convertToParamMap({ id: 'p1' }));
    TestBed.configureTestingModule({
      providers: [...testProviders([{ path: '**', children: [] }]), { provide: ActivatedRoute, useValue: { paramMap: params } }],
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function open(story = blog({ _id: 'p1' }), others: { featured?: unknown; all?: unknown } = {}) {
    const f = TestBed.createComponent(Post);
    f.detectChanges();
    respond('/posts/p1', story);
    respond('/blogs', others.featured ?? [blog({ _id: 'f1', featured: true, cate: 'Food' })]);
    respond('/BAdd', others.all ?? [story, blog({ _id: 'r1', title: 'Related', cate: 'Art', likes: 1 }), blog({ _id: 'r2', cate: 'Other', likes: 9 })]);
    await settle(f);
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('renders the story with the author name, rich body, stats and related stories', async () => {
    const { el } = await open(blog({ _id: 'p1', views: 1200, blogp2: '<h2>Day one</h2><p>Went <em>far</em>.</p>' }));
    expect(text(el, '.reader__byline strong')).toBe('Amy Writer');
    expect(text(el, '.reader__byline .muted')).toContain('1.2K views');
    expect(el.querySelector('.prose__body h2')!.textContent).toBe('Day one');
    expect(el.querySelector('.prose__body em')).not.toBeNull();
    expect(text(el, '.author-card h3')).toBe('Amy Writer');
    expect([...el.querySelectorAll('.grid-cards .post-card__title')].map((e) => e.textContent)).toEqual(['Related', 'A trip', 'A trip']);
    expect(el.querySelector('.reader__notice')).toBeNull();
    const cover = el.querySelector('.reader__cover') as HTMLImageElement;
    cover.dispatchEvent(new Event('load'));
    expect(cover.classList).toContain('is-loaded');
    expect(el.querySelector('[aria-label="Edit this story"]')).toBeNull(); // not signed in
  });

  it('featured stories have no likes or views; missing author names fall back to the username', async () => {
    const { el } = await open(blog({ _id: 'p1', featured: true, authName: '', img: '' }), { all: [], featured: [] });
    expect(el.querySelector('.section .grid-cards')).toBeNull(); // nothing related
    expect(el.querySelector('[aria-label="Like this story"]')).toBeNull();
    expect(text(el, '.reader__byline strong')).toBe('amy');
    expect(el.querySelector('.reader__cover')).toBeNull();
    expect(text(el, '.reader__byline .muted')).not.toContain('views');
  });

  it('shows the author their draft or scheduled story with a way back to the editor', async () => {
    TestBed.inject(Auth).user.set(account());
    const { el } = await open(blog({ _id: 'p1', status: 'draft', title: '', date: '' }));
    expect(text(el, '.reader__notice')).toContain('This is a draft');
    expect(text(el, 'h1')).toBe('Untitled draft');
    expect(text(el, '.reader__byline .muted')).toContain('Not published yet');
    expect(el.querySelector('.reader__notice a')!.getAttribute('href')).toBe('/writeblog?id=p1');
    expect(el.querySelector('[aria-label="Share this story"]')).toBeNull();
    expect(el.querySelector('[aria-label="Like this story"]')).toBeNull();
    expect(el.querySelector('[aria-label="Edit this story"]')).not.toBeNull();
  });

  it('still works when related stories cannot be loaded', async () => {
    const f = TestBed.createComponent(Post);
    f.detectChanges();
    respond('/posts/p1', blog({ _id: 'p1' }));
    respond('/blogs', null, { status: 500 });
    respond('/BAdd', []);
    await settle(f);
    expect(text(f.nativeElement, 'h1')).toBe('A trip');
  });

  it('scheduled notice', async () => {
    const { el } = await open(blog({ _id: 'p1', status: 'scheduled', publishAt: '2026-12-24T18:00:00' }));
    expect(text(el, '.reader__notice')).toContain('Scheduled for');
    expect(text(el, '.reader__notice')).toContain('24 Dec');
  });

  it('like: asks to sign in, then toggles optimistically and reconciles', async () => {
    const { f, el } = await open();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const info = vi.spyOn(TestBed.inject(Toast), 'show');
    click(el, '[aria-label="Like this story"]');
    expect(info).toHaveBeenCalledWith('Sign in to like stories.', 'info');
    expect(nav).toHaveBeenCalledWith('/login');

    TestBed.inject(Auth).user.set(account({ username: 'reader' }));
    click(el, '[aria-label="Like this story"]');
    f.detectChanges();
    expect(text(el, '[aria-label="Like this story"]')).toBe('favorite1');
    expect(el.querySelector('.action-btn.burst')).not.toBeNull();
    respond('/posts/p1/like', { likes: 3, liked: true });
    await settle(f);
    expect(text(el, '[aria-label="Like this story"]')).toBe('favorite3');
    await new Promise((r) => setTimeout(r, 750)); // the heart animation ends
    f.detectChanges();
    expect(el.querySelector('.action-btn.burst')).toBeNull();

    // Unlike fails: rolled back, with an error.
    const error = vi.spyOn(TestBed.inject(Toast), 'error');
    click(el, '[aria-label="Like this story"]');
    respond('/posts/p1/like', { error: 'Blog not found.' }, { status: 404 });
    await settle(f);
    expect(text(el, '[aria-label="Like this story"]')).toBe('favorite3');
    expect(error).toHaveBeenCalledWith('Blog not found.');
  });

  it('a like answer arriving after moving to another story is ignored', async () => {
    TestBed.inject(Auth).user.set(account({ username: 'reader' }));
    const { f, el } = await open();
    click(el, '[aria-label="Like this story"]');
    params.next(convertToParamMap({ id: 'p2' }));
    respond('/posts/p2', blog({ _id: 'p2', title: 'Second', likes: 7 }));
    await settle(f);
    respond('/posts/p1/like', { likes: 1, liked: true });
    await settle(f);
    expect(text(el, 'h1')).toBe('Second');
    expect(text(el, '[aria-label="Like this story"]')).toBe('favorite7');
    click(el, '[aria-label="Like this story"]');
    params.next(convertToParamMap({ id: 'p3' }));
    respond('/posts/p3', blog({ _id: 'p3', title: 'Third' }));
    await settle(f);
    respond('/posts/p2/like', null, { status: 500 });
    await settle(f);
    expect(text(el, 'h1')).toBe('Third');
  });

  it('share uses the share sheet, or copies the link', async () => {
    const { el } = await open();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    click(el, '[aria-label="Share this story"]');
    await settle();
    expect(share).toHaveBeenCalledWith({ title: 'A trip', url: location.href });
    share.mockRejectedValueOnce(new Error('dismissed'));
    click(el, '[aria-label="Share this story"]');
    await settle();

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const success = vi.spyOn(TestBed.inject(Toast), 'success');
    click(el, '[aria-label="Share this story"]');
    await settle();
    expect(writeText).toHaveBeenCalledWith(location.href);
    expect(success).toHaveBeenCalledWith('Link copied to clipboard.');
  });

  it('the author can delete after confirming', async () => {
    TestBed.inject(Auth).user.set(account());
    const { f, el } = await open(blog({ _id: 'p1', title: '' }));
    const confirm = TestBed.inject(Confirm);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const ask = vi.spyOn(confirm, 'ask').mockResolvedValueOnce(false);
    click(el, '[aria-label="Delete this story"]');
    await settle(f);
    expect(ask.mock.calls[0][0].text).toBe('"Untitled draft" will be gone for good.');
    http().expectNone('/posts/p1');

    ask.mockResolvedValueOnce(true);
    click(el, '[aria-label="Delete this story"]');
    await settle();
    respond('/posts/p1', { error: 'Nope' }, { method: 'DELETE', status: 403 });
    await settle(f);

    ask.mockResolvedValueOnce(true);
    click(el, '[aria-label="Delete this story"]');
    await settle();
    respond('/posts/p1', {}, { method: 'DELETE' });
    await settle();
    respond('/myacc', account());
    await settle(f);
    expect(nav).toHaveBeenCalledWith('/myacc');
  });

  it('shows load errors and tracks reading progress', async () => {
    const f = TestBed.createComponent(Post);
    f.detectChanges();
    respond('/posts/p1', { error: 'Blog not found.' }, { status: 404 });
    http().match(() => true).forEach((r) => r.flush([]));
    await settle(f);
    expect(text(f.nativeElement, '.empty h3')).toBe('Blog not found.');

    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 2000, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect((f.nativeElement.querySelector('.read-progress') as HTMLElement).style.transform).toBe('scaleX(1)');
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 0, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect((f.nativeElement.querySelector('.read-progress') as HTMLElement).style.transform).toBe('scaleX(0)');
  });
});
