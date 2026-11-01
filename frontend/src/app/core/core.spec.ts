import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { account, blog, http, respond, testProviders } from '../testing/helpers';
import {
  categoriesOf, compact, displayName, errorMessage, formatWhen, hueOf, imageUrl, initials, readingTime, storyWords, textOf, wordCount,
} from './api';
import { apiInterceptor } from './api.interceptor';
import { Auth } from './auth';
import { authGuard } from './auth.guard';
import { Confirm } from './confirm';
import { Posts } from './posts';
import { Theme } from './theme';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('api helpers', () => {
  it('errorMessage prefers the API message, then network, then the fallback', () => {
    expect(errorMessage(new HttpErrorResponse({ error: { error: 'Bad' }, status: 400 }), 'x')).toBe('Bad');
    expect(errorMessage(new HttpErrorResponse({ status: 0 }), 'x')).toBe('Cannot reach the server. Is it running?');
    expect(errorMessage(new HttpErrorResponse({ status: 500 }), 'x')).toBe('x');
    expect(errorMessage(new Error('boom'), 'x')).toBe('x');
  });

  it('text helpers', () => {
    expect(displayName({ name: 'Amy', username: 'amy' })).toBe('Amy');
    expect(displayName({ name: '', username: 'amy' })).toBe('amy');
    expect(imageUrl('img1')).toBe('picyourpic/opt/img1-800.webp');
    expect(imageUrl('img1', 'lg')).toBe('picyourpic/opt/img1-1800.webp');
    expect(categoriesOf(' A | B |')).toEqual(['A', 'B']);
    expect(textOf('<h2>Hi</h2><p>there <b>you</b></p>')).toBe('Hithere you');
    expect(textOf('')).toBe('');
    expect(wordCount('one two', ' three ')).toBe(3);
    expect(storyWords({ blogp1: 'a b', blogp2: '<p>c d e</p>' })).toBe(5);
    expect(readingTime({ blogp1: 'x', blogp2: '' })).toBe(1);
    expect(readingTime({ blogp1: Array(500).fill('w').join(' '), blogp2: '' })).toBe(3);
    expect(initials('Asha Rao')).toBe('AR');
    expect(initials('***')).toBe('?');
    expect(hueOf('amy')).toBeGreaterThanOrEqual(0);
    expect(compact(1500)).toBe('1.5K');
    expect(formatWhen('2026-11-03T09:30:00')).toMatch(/3 Nov/);
  });
});

describe('apiInterceptor', () => {
  it('adds credentials to API paths only', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()] });
    const client = TestBed.inject(HttpClient);
    firstValueFrom(client.get('/myacc'));
    firstValueFrom(client.get('picyourpic/manifest.json'));
    const api = http().expectOne('/myacc');
    const asset = http().expectOne('picyourpic/manifest.json');
    expect(api.request.withCredentials).toBe(true);
    expect(asset.request.withCredentials).toBe(false);
    api.flush({});
    asset.flush([]);
  });
});

describe('Posts', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: testProviders() }));
  afterEach(() => http().verify());

  it('calls every endpoint', async () => {
    const posts = TestBed.inject(Posts);
    const b = blog();
    const calls: [Promise<unknown>, string, string, unknown][] = [
      [posts.all(), 'GET', '/BAdd', [b]],
      [posts.featured(), 'GET', '/blogs', []],
      [posts.get('a b'), 'GET', '/posts/a%20b', b],
      [posts.like('x'), 'POST', '/posts/x/like', { likes: 1, liked: true }],
      [posts.remove('x'), 'DELETE', '/posts/x', {}],
      [posts.create({ title: 't', status: 'draft' }), 'POST', '/addblog', b],
      [posts.update('x', { title: 't' }), 'PATCH', '/posts/x', b],
      [posts.stats(), 'GET', '/stats', {}],
      [posts.images(), 'GET', 'picyourpic/manifest.json', ['img1']],
      [posts.leaderboard(), 'GET', '/leaderboard', []],
      [posts.subscribe('a@b.co'), 'POST', '/subscribe', {}],
    ];
    for (const [, method, url, body] of calls) expect(respond(url, body, { method }).method).toBe(method);
    const results = await Promise.all(calls.map((c) => c[0]));
    expect(results[0]).toEqual([b]);
  });
});

describe('Auth', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: testProviders() }));

  it('loads, signs up, logs in, renames and logs out', async () => {
    const auth = TestBed.inject(Auth);

    const load = auth.load();
    respond('/myacc', null, { status: 401 });
    expect(await load).toBeNull();
    expect(auth.user()).toBeNull();

    const signup = auth.signup({ username: 'amy', name: 'Amy', email: 'a@b.co', password: 'secret1' });
    expect(respond('/adduser', {}).body).toEqual({ username: 'amy', name: 'Amy', email: 'a@b.co', password: 'secret1' });
    await Promise.resolve();
    respond('/myacc', account());
    await signup;
    expect(auth.user()?.name).toBe('Amy Writer');

    const login = auth.login({ username: 'amy', password: 'secret1' });
    respond('/loginuser', {});
    await Promise.resolve();
    respond('/myacc', account({ name: 'Amy' }));
    await login;
    expect(auth.user()?.name).toBe('Amy');

    const rename = auth.rename('New Name');
    expect(respond('/myacc', account({ name: 'New Name' }), { method: 'PATCH' }).body).toEqual({ name: 'New Name' });
    await rename;
    expect(auth.user()?.name).toBe('New Name');

    const logout = auth.logout();
    respond('/logout', null, { status: 500 }); // still signs out locally
    await logout;
    expect(auth.user()).toBeNull();
  });
});

describe('authGuard', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: testProviders() }));

  it('lets signed-in users through and sends others to sign in', async () => {
    const run = () => TestBed.runInInjectionContext(() => authGuard({} as never, {} as never)) as Promise<unknown>;
    const yes = run();
    respond('/myacc', account());
    expect(await yes).toBe(true);
    const no = run();
    respond('/myacc', null, { status: 401 });
    expect(TestBed.inject(Router).serializeUrl((await no) as never)).toBe('/login');
  });
});

describe('Confirm', () => {
  it('resolves the pending question, and a new question cancels the old one', async () => {
    const confirm = TestBed.inject(Confirm);
    const first = confirm.ask({ title: 'One' });
    expect(confirm.request()).toEqual({ title: 'One', text: '', okLabel: 'Confirm', danger: false });
    const second = confirm.ask({ title: 'Two', danger: true });
    expect(await first).toBe(false);
    confirm.answer(true);
    expect(await second).toBe(true);
    expect(confirm.request()).toBeNull();
    confirm.answer(false); // nothing pending: no-op
  });
});

describe('Theme', () => {
  afterEach(() => localStorage.clear());

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const theme = TestBed.inject(Theme);
    TestBed.tick();
    return theme;
  };

  it('follows the saved choice, toggles and persists it', () => {
    localStorage.setItem('bb-theme', 'light');
    const theme = create();
    expect(theme.mode()).toBe('light');
    theme.toggle();
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('bb-theme')).toBe('dark');
    theme.toggle();
    expect(theme.mode()).toBe('light');
  });

  it('defaults to the OS preference', () => {
    expect(create().mode()).toBe('dark'); // matchMedia(light) is false in the test setup
    vi.mocked(window.matchMedia).mockReturnValueOnce({ matches: true } as MediaQueryList);
    localStorage.setItem('bb-theme', 'neon');
    expect(create().mode()).toBe('light');
  });

  it('survives storage being unavailable', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(create().mode()).toBe('dark');
    get.mockRestore();
    set.mockRestore();
  });
});
