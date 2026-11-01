import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { account, blog, click, respond, settle, testProviders, text, type } from '../testing/helpers';
import { About } from './about';
import { Blog } from './blog';
import { Category } from './category';
import { Gallery } from './gallery';
import { Home } from './home';
import { Login } from './login';
import { Rewards } from './rewards';
import { Signup } from './signup';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', undefined);
  TestBed.configureTestingModule({ providers: testProviders([{ path: '**', children: [] }]) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function render<T>(cmp: import('@angular/core').Type<T>) {
  const f = TestBed.createComponent(cmp);
  f.detectChanges();
  await f.whenStable();
  return { f, el: f.nativeElement as HTMLElement };
}

describe('About', () => {
  it('renders the story and timeline', async () => {
    const { el } = await render(About);
    expect(el.querySelectorAll('.timeline-x li').length).toBe(4);
  });
});

describe('Home', () => {
  it('shows stats, the most-loved stories and topics; rotates the headline; parallax follows the mouse', async () => {
    vi.useFakeTimers();
    const { f, el } = await render(Home);
    respond('/stats', { blogs: 12, writers: 3, categories: 4, likes: 9 });
    respond('/BAdd', [
      blog({ title: 'Quiet', likes: 0, views: 1, cate: 'Zen' }),
      blog({ title: 'Loved', likes: 5 }),
      blog({ title: 'Seen', likes: 0, views: 9 }),
      blog({ title: 'Fourth' }),
    ]);
    await vi.advanceTimersByTimeAsync(0);
    f.detectChanges();
    expect(text(el, '.pill-label')).toContain('3 writers · 12 stories');
    expect([...el.querySelectorAll('.post-card__title')].map((e) => e.textContent)).toEqual(['Loved', 'Seen', 'Quiet']);
    expect(text(el, '.marquee')).toContain('Zen');
    expect(el.querySelector('.rotator__word.is-active')!.textContent).toBe('your way.');
    await vi.advanceTimersByTimeAsync(2600);
    f.detectChanges();
    expect(el.querySelector('.rotator__word.is-active')!.textContent).toBe('out loud.');

    const move = (pointerType: string) => {
      const e = new MouseEvent('pointermove', { clientX: window.innerWidth, clientY: 0 });
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      f.nativeElement.dispatchEvent(e);
      f.detectChanges();
    };
    move('touch');
    expect((el.querySelector('.hero__stage') as HTMLElement).style.getPropertyValue('--px')).toBe('0');
    move('mouse');
    expect((el.querySelector('.hero__stage') as HTMLElement).style.getPropertyValue('--px')).toBe('1');
    f.destroy();
    vi.useRealTimers();
  });

  it('copes with the API being down, and invites signed-in users to write', async () => {
    TestBed.inject(Auth).user.set(account());
    const { f, el } = await render(Home);
    respond('/stats', null, { status: 500 });
    respond('/BAdd', []);
    await settle(f);
    expect(text(el, '.pill-label')).toContain('0 writers');
    expect(text(el, '.grid-cards')).toContain('No stories yet');
    expect(el.querySelector('.hero__cta a')!.getAttribute('href')).toBe('/writeblog');
  });
});

describe('Blog', () => {
  it('shows featured stories and the latest community posts', async () => {
    const { f, el } = await render(Blog);
    respond('/blogs', [blog({ title: 'Lead', featured: true }), blog({ title: 'Side', featured: true })]);
    respond('/BAdd', [blog({ title: 'Fresh' })]);
    await settle(f);
    expect(text(el, '.magazine__lead .post-card__title')).toBe('Lead');
    expect(text(el, '.magazine__side')).toContain('Side');
    expect(text(el, '.grid-cards')).toContain('Fresh');
  });

  it('shows an error and empty states', async () => {
    const { f, el } = await render(Blog);
    respond('/blogs', { error: 'Server is down' }, { status: 500 });
    respond('/BAdd', []);
    await settle(f);
    expect(text(el, '.form-msg--error')).toBe('Server is down');
    expect(el.querySelector('.magazine__lead')).toBeNull();
    expect(text(el, '.grid-cards')).toContain('write the first post');
  });
});

describe('Category (Explore)', () => {
  const q = new BehaviorSubject(convertToParamMap({ q: 'travel' }));
  beforeEach(() => TestBed.overrideProvider(ActivatedRoute, { useValue: { queryParamMap: q } }));

  it('searches every field including rich text and author names, filters by topic, and sorts', async () => {
    const { f, el } = await render(Category);
    respond('/BAdd', [
      blog({ title: 'Beta', cate: 'Travel', likes: 1, views: 9 }),
      blog({ title: 'Alpha', cate: 'Art', likes: 5, views: 1, authName: 'Zed Writer', blogp2: '<p>secret word</p>' }),
      blog({ title: 'Gamma', cate: 'Travel | Art', likes: 5, views: 4 }),
    ]);
    await settle(f);
    const titles = () => [...el.querySelectorAll('.post-card__title')].map((e) => e.textContent);
    expect(titles()).toEqual(['Beta', 'Gamma']);
    expect(text(el, '.result-count')).toBe('2 stories for "travel"');

    type(el, '#search', 'zed');
    f.detectChanges();
    expect(titles()).toEqual(['Alpha']);
    expect(text(el, '.result-count')).toBe('1 story for "zed"');
    type(el, '#search', 'secret');
    f.detectChanges();
    expect(titles()).toEqual(['Alpha']);
    click(el, '.toolbar__search .icon-btn'); // clear
    f.detectChanges();
    expect(titles().length).toBe(3);

    const sort = (v: string) => {
      const s = el.querySelector('select')!;
      s.value = v;
      s.dispatchEvent(new Event('change'));
      f.detectChanges();
    };
    sort('loved');
    expect(titles()).toEqual(['Gamma', 'Alpha', 'Beta']);
    sort('viewed');
    expect(titles()).toEqual(['Beta', 'Gamma', 'Alpha']);
    sort('az');
    expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma']);
    sort('new');
    expect(titles()).toEqual(['Beta', 'Alpha', 'Gamma']);

    expect([...el.querySelectorAll('.chips-row .chip')].map((c) => c.textContent?.replace(/\d+/, '').trim())).toEqual(['All', 'Art', 'Travel']);
    click(el, '.chips-row .chip', 'Art');
    f.detectChanges();
    expect(titles()).toEqual(['Alpha', 'Gamma']);
    click(el, '.chips-row .chip', 'All');
    f.detectChanges();
    type(el, '#search', 'nothing at all');
    f.detectChanges();
    expect(text(el, '.empty h3')).toContain('No stories match');
    q.next(convertToParamMap({}));
    f.detectChanges();
    expect(titles().length).toBe(3);
  });

  it('shows load errors', async () => {
    const { f, el } = await render(Category);
    respond('/BAdd', null, { status: 0 });
    await settle(f);
    expect(text(el, '.form-msg--error')).toBe('Cannot reach the server. Is it running?');
  });
});

describe('Rewards', () => {
  it('shows the podium (with #1 in the middle), the ranking with you highlighted, and display names', async () => {
    TestBed.inject(Auth).user.set(account({ username: 'dee' }));
    const { f, el } = await render(Rewards);
    const rows = ['ann', 'bob', 'cat', 'dee', 'eve'].map((u, i) => ({ username: u, name: u.toUpperCase(), posts: i === 1 ? 1 : 2, likes: 10 - i, views: 3 }));
    respond('/leaderboard', rows);
    await settle(f);
    expect([...el.querySelectorAll('.podium h3')].map((e) => e.textContent)).toEqual(['BOB', 'ANN', 'CAT']);
    expect(text(el, '.podium')).toContain('1 story');
    expect(text(el, '.ranking li.is-me')).toContain('DEE');
    expect(text(el, '.ranking')).toContain('@eve');
  });

  it('shows an empty podium when nobody has published (or the API is down)', async () => {
    const { f, el } = await render(Rewards);
    respond('/leaderboard', null, { status: 500 });
    await settle(f);
    expect(text(el, '.empty h3')).toBe('The podium is empty');
  });

  it('omits the ranking list with three or fewer writers', async () => {
    const { f, el } = await render(Rewards);
    respond('/leaderboard', [{ username: 'a', name: 'A', posts: 1, likes: 1, views: 1 }]);
    await settle(f);
    expect(el.querySelector('.ranking')).toBeNull();
  });
});

describe('Gallery', () => {
  it('opens pictures in a lightbox, steps through them by button and keyboard, and closes', async () => {
    const { f, el } = await render(Gallery);
    respond('picyourpic/manifest.json', ['img1', 'img2', 'img3']);
    await settle(f);
    expect(el.querySelectorAll('.masonry__item').length).toBe(3);
    expect(el.querySelector('.masonry__item a')!.getAttribute('href')).toBe('/writeblog?img=img1');

    const key = (k: string) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
      f.detectChanges();
    };
    key('ArrowRight'); // nothing open: ignored
    click(el, '.masonry__open');
    f.detectChanges();
    expect(text(el, '.lightbox__bar span')).toBe('img1 · 1/3');
    click(el, '.lightbox__nav--prev');
    f.detectChanges();
    expect(text(el, '.lightbox__bar span')).toBe('img3 · 3/3');
    click(el, '.lightbox__nav--next');
    key('ArrowRight');
    expect(text(el, '.lightbox__bar span')).toBe('img2 · 2/3');
    key('ArrowLeft');
    key('Enter');
    expect(text(el, '.lightbox__bar span')).toBe('img1 · 1/3');
    click(el, '.lightbox__bar'); // clicks inside the bar don't close it
    f.detectChanges();
    click(el, '.lightbox img');
    f.detectChanges();
    expect(el.querySelector('.lightbox')).not.toBeNull();
    key('Escape');
    expect(el.querySelector('.lightbox')).toBeNull();
    click(el, '.masonry__open');
    f.detectChanges();
    click(el, '.lightbox__close');
    f.detectChanges();
    click(el, '.masonry__open');
    f.detectChanges();
    click(el, '.lightbox');
    f.detectChanges();
    expect(el.querySelector('.lightbox')).toBeNull();
  });

  it('works even if the manifest is missing', async () => {
    const { f, el } = await render(Gallery);
    respond('picyourpic/manifest.json', null, { status: 404 });
    await settle(f);
    expect(text(el, '.lead')).toContain('0 photographs');
    const g = f.componentInstance as unknown as { step: (d: number) => void; open: { (): number | null } };
    g.step(1); // nothing open: stays closed
    expect(g.open()).toBeNull();
  });
});

describe('Login', () => {
  it('signs in, greets by name and opens the dashboard; shows errors; toggles the password', async () => {
    const { f, el } = await render(Login);
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const toast = vi.spyOn(TestBed.inject(Toast), 'success');

    type(el, '#username', 'amy');
    type(el, '#password', 'wrong');
    f.detectChanges();
    await f.whenStable();
    click(el, '.icon-btn'); // show password
    f.detectChanges();
    expect((el.querySelector('#password') as HTMLInputElement).type).toBe('text');
    click(el, '.icon-btn');
    f.detectChanges();
    expect((el.querySelector('#password') as HTMLInputElement).type).toBe('password');

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(text(el, '#submit')).toContain('Signing in');
    el.querySelector('form')!.dispatchEvent(new Event('submit')); // double submit ignored
    respond('/loginuser', { error: 'Invalid username or password.' }, { status: 401 });
    await settle(f);
    expect(text(el, '.form-msg--error')).toBe('Invalid username or password.');

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    respond('/loginuser', {});
    await settle();
    respond('/myacc', account());
    await settle(f);
    expect(toast).toHaveBeenCalledWith('Welcome back, Amy Writer!');
    expect(nav).toHaveBeenCalledWith('/myacc');
  });

  it('greets by username if the account could not be loaded', async () => {
    const { f, el } = await render(Login);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const toast = vi.spyOn(TestBed.inject(Toast), 'success');
    type(el, '#username', 'amy');
    type(el, '#password', 'secret1');
    f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    respond('/loginuser', {});
    await settle();
    respond('/myacc', null, { status: 500 });
    await settle(f);
    expect(toast).toHaveBeenCalledWith('Welcome back, amy!');
  });
});

describe('Signup', () => {
  it('validates fields, rates the password, and creates the account with a name', async () => {
    const { f, el } = await render(Signup);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const toast = vi.spyOn(TestBed.inject(Toast), 'success');
    const field = (name: string, value: string) => {
      const input = type(el, `input[name="${name}"]`, value);
      input.dispatchEvent(new Event('blur'));
      f.detectChanges();
    };
    field('name', '   ');
    field('username', 'a b');
    field('email', 'nope');
    await f.whenStable();
    f.detectChanges();
    expect([...el.querySelectorAll('.field__error')].map((e) => e.textContent)).toEqual([
      'Please enter your name (up to 60 characters).', '3–30 characters: letters, numbers, . _ -', 'Please enter a valid email.',
    ]);
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);

    const strength = (pw: string) => {
      field('password', pw);
      return el.querySelector('.strength')?.getAttribute('data-level') ?? null;
    };
    expect(strength('')).toBeNull();
    expect(strength('abc')).toBe('0');
    expect(strength('abcdef')).toBe('1');
    expect(strength('abcdefghij')).toBe('2');
    expect(strength('Abcdefghij')).toBe('3');
    expect(strength('Abcdefgh1!')).toBe('4');
    expect(text(el, '.strength small')).toBe('Excellent');
    click(el, '.input-icon .icon-btn');
    f.detectChanges();
    expect((el.querySelector('input[name="password"]') as HTMLInputElement).type).toBe('text');
    click(el, '.input-icon .icon-btn');

    field('name', '  Asha Rao ');
    field('username', 'asha');
    field('email', 'asha@example.com');
    await f.whenStable();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit')); // ignored while busy
    expect(respond('/adduser', { error: 'That username is already registered.' }, { status: 409 }).body).toEqual({
      username: 'asha', name: 'Asha Rao', email: 'asha@example.com', password: 'Abcdefgh1!',
    });
    await settle(f);
    expect(text(el, '.form-msg--error')).toBe('That username is already registered.');

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    respond('/adduser', {});
    await settle();
    respond('/myacc', account());
    await settle(f);
    expect(toast).toHaveBeenCalledWith('Welcome to Bloggerbytes, Asha Rao!');
    expect(nav).toHaveBeenCalledWith('/myacc');
  });
});
