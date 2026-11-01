import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { Auth } from './core/auth';
import { Confirm } from './core/confirm';
import { Theme } from './core/theme';
import { account, click, http, settle, text } from './testing/helpers';

/** Answers every open API request (with an empty but valid response by default; 404 for '/posts/x'). */
function answerAll(body: (url: string) => unknown = () => []) {
  for (const r of http().match(() => true)) {
    if (r.request.url === '/posts/x') r.flush({ error: 'Blog not found.' }, { status: 404, statusText: 'Not Found' });
    else r.flush(body(r.request.url) as never);
  }
}

describe('App shell', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined);
    TestBed.configureTestingModule({ providers: [...appConfig.providers, provideHttpClientTesting()] });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Keeps answering API calls until the navigation finishes. */
  async function navigate(nav: Promise<boolean>, body: (url: string) => unknown): Promise<boolean> {
    let done = false;
    nav.finally(() => (done = true));
    for (let i = 0; i < 20 && !done; i++) {
      await settle();
      answerAll(body);
    }
    return nav;
  }

  async function boot(user: ReturnType<typeof account> | null) {
    const f = TestBed.createComponent(App);
    f.detectChanges();
    const me = http().expectOne('/myacc');
    if (user) me.flush(user);
    else me.flush({ error: 'Please sign in first.' }, { status: 401, statusText: 'Unauthorized' });
    await settle(f);
    return { f, el: f.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  it('signed out: sign-in links, menus, search, theme, scroll state', async () => {
    const { f, el } = await boot(null);
    expect(text(el, '.nav-x__actions')).toContain('Sign in');
    expect(el.querySelector('.user-menu')).toBeNull();

    // Search opens the palette (desktop and mobile buttons).
    click(el, '.search-trigger');
    f.detectChanges();
    expect(el.querySelector('.palette')).not.toBeNull();
    answerAll();
    click(el, '.palette-backdrop');
    click(el, '.icon-btn[aria-label="Search"]');
    f.detectChanges();
    expect(el.querySelector('.palette')).not.toBeNull();

    // Theme toggle.
    const theme = TestBed.inject(Theme);
    const before = theme.mode();
    click(el, '.nav-x__actions .icon-btn[aria-label^="Switch to"]');
    expect(theme.mode()).not.toBe(before);
    f.detectChanges();
    click(el, '.nav-x__actions .icon-btn[aria-label^="Switch to"]');
    f.detectChanges();

    // Mobile sheet.
    click(el, '[aria-label="Open menu"]');
    f.detectChanges();
    expect(text(el, '.mobile-sheet')).toContain('Create account');
    click(el, '.mobile-sheet__close');
    f.detectChanges();
    expect(el.querySelector('.mobile-sheet')).toBeNull();

    // Header shrinks on scroll.
    Object.defineProperty(window, 'scrollY', { value: 40, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    f.detectChanges();
    expect(el.querySelector('.nav-x')!.classList).toContain('is-scrolled');
  });

  it('signed in: account menu with display name, navigation closes menus, logout', async () => {
    const { f, el, router } = await boot(account({ name: 'Asha Rao' }));
    expect(el.querySelector('.user-menu .avatar')!.textContent).toBe('AR');

    click(el, '.user-menu__trigger');
    f.detectChanges();
    expect(text(el, '.user-menu__name')).toContain('Asha Rao');
    expect(text(el, '.user-menu__name small')).toBe('@amy · amy@example.com');
    click(el, '.user-menu__panel'); // clicks inside the panel keep it open
    f.detectChanges();
    expect(el.querySelector('.user-menu__panel')).not.toBeNull();
    document.dispatchEvent(new MouseEvent('click'));
    f.detectChanges();
    expect(el.querySelector('.user-menu__panel')).toBeNull();

    click(el, '.user-menu__trigger');
    click(el, '[aria-label="Open menu"]');
    f.detectChanges();
    await router.navigateByUrl('/aboutme');
    await settle(f);
    expect(el.querySelector('.mobile-sheet')).toBeNull();
    expect(el.querySelector('.user-menu__panel')).toBeNull();

    click(el, '.user-menu__trigger');
    f.detectChanges();
    click(el, '#logout-menu');
    http().expectOne('/logout').flush({});
    await settle(f);
    expect(TestBed.inject(Auth).user()).toBeNull();
    expect(router.url).toBe('/');

    // Log out from the mobile sheet too.
    TestBed.inject(Auth).user.set(account());
    f.detectChanges();
    click(el, '[aria-label="Open menu"]');
    f.detectChanges();
    click(el, '.mobile-sheet a', 'Log out');
    http().expectOne('/logout').flush({});
    await settle(f);
    expect(TestBed.inject(Auth).user()).toBeNull();
  });

  it('every route loads its page; the editor saves drafts before you leave', async () => {
    const { f, router } = await boot(account());
    expect(routes.length).toBe(12);
    for (const path of ['/blog', '/cate', '/post/x', '/rewards', '/gallery', '/aboutme', '/login', '/signup', '/myacc', '/', '/nowhere']) {
      expect(await navigate(router.navigateByUrl(path), (url) => (url === '/myacc' ? account() : url === '/stats' ? {} : []))).toBe(true);
    }
    expect(router.url).toBe('/');

    // The studio: unsaved edits to a live story need confirmation before leaving.
    vi.spyOn(TestBed.inject(Confirm), 'ask').mockResolvedValue(false);
    const live = { _id: 'p1', auth: 'amy', title: 'Live', cate: 'A', img: 'img1', blogp1: 'x', blogp2: '<p>y</p>', status: 'published' };
    expect(await navigate(router.navigateByUrl('/writeblog?id=p1'), (url) => (url === '/myacc' ? account() : url === '/posts/p1' ? live : []))).toBe(true);
    await settle(f);
    answerAll((url) => (url === '/posts/p1' ? live : []));
    await settle(f);
    const outlet = f.debugElement.query(By.directive(RouterOutlet)).injector.get(RouterOutlet);
    const studio = outlet.component as { title: { set: (v: string) => void } };
    studio.title.set('Changed');
    await settle(f);
    expect(await router.navigateByUrl('/')).toBe(false); // stayed
  });
});
