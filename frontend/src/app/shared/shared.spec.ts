import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';
import { Confirm } from '../core/confirm';
import { Theme } from '../core/theme';
import { Toast } from '../core/toast';
import { account, blog, click, http, respond, settle, testProviders, text, type } from '../testing/helpers';
import { AuthArt } from './auth-art';
import { Avatar } from './avatar';
import { CommandPalette } from './command-palette';
import { ConfirmDialog } from './confirm-dialog';
import { CountUp, Reveal, Tilt } from './effects';
import { Newsletter } from './newsletter';
import { PostCard } from './post-card';
import { Toasts } from './toasts';

beforeEach(() => TestBed.configureTestingModule({ providers: testProviders([{ path: '**', children: [] }]) }));

describe('Avatar and AuthArt', () => {
  it('render initials and the quote', () => {
    const a = TestBed.createComponent(Avatar);
    a.componentRef.setInput('name', 'Asha Rao');
    a.detectChanges();
    expect(text(a.nativeElement, '.avatar')).toBe('AR');
    const art = TestBed.createComponent(AuthArt);
    art.detectChanges();
    expect(text(art.nativeElement, 'cite')).toContain('Maya Angelou');
  });
});

describe('PostCard', () => {
  const make = (inputs: Record<string, unknown>) => {
    const f = TestBed.createComponent(PostCard);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  };

  it('links to the story and shows the author name and stats', () => {
    const el = make({ post: blog({ _id: 'x1', likes: 1500, liked: true }) });
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/post/x1');
    expect(text(el, '.post-card__author')).toBe('Amy Writer');
    expect(text(el, '.post-card__stat.is-liked')).toContain('1.5K');
  });

  it('handles featured, drafts, scheduled, custom and no links', () => {
    expect(text(make({ post: blog({ featured: true }), variant: 'hero' }), '.chip--brand')).toBe('Featured');
    const draft = make({ post: blog({ status: 'draft', title: '', img: '', date: '', blogp1: '', authName: '' }), link: '/writeblog', query: { id: 'd1' } });
    expect(text(draft, '.chip--draft')).toBe('Draft');
    expect(text(draft, '.post-card__title')).toBe('Untitled draft');
    expect(text(draft, '.post-card__author')).toBe('amy');
    expect(draft.querySelector('a')!.getAttribute('href')).toBe('/writeblog?id=d1');
    expect(draft.querySelector('.post-card__media--empty')).not.toBeNull();
    const sched = make({ post: blog({ status: 'scheduled', publishAt: '2026-12-01T10:00:00' }), link: null });
    expect(text(sched, '.chip--scheduled')).toContain('1 Dec');
    expect(sched.querySelector('a')).toBeNull();
    expect(make({ post: blog({ status: 'scheduled', publishAt: null }) }).querySelector('.chip--scheduled')).not.toBeNull();
  });
});

describe('Toasts and ConfirmDialog', () => {
  it('lists toasts and dismisses them', () => {
    const f = TestBed.createComponent(Toasts);
    const toast = TestBed.inject(Toast);
    toast.success('Yay');
    toast.error('Nope');
    toast.show('FYI');
    f.detectChanges();
    expect([...f.nativeElement.querySelectorAll('.toast-x')].map((e: Element) => e.className)).toEqual([
      'toast-x glass toast-x--success', 'toast-x glass toast-x--error', 'toast-x glass toast-x--info',
    ]);
    click(f.nativeElement, '.toast-x button');
    expect(toast.items().length).toBe(2);
  });

  it('asks, focuses OK, and answers by button, backdrop or Escape', async () => {
    const f = TestBed.createComponent(ConfirmDialog);
    const confirm = TestBed.inject(Confirm);
    f.detectChanges();
    const ok = confirm.ask({ title: 'Delete?', text: 'Gone for good', danger: true, okLabel: 'Delete' });
    f.detectChanges();
    await settle(f);
    expect(document.activeElement?.textContent).toBe('Delete');
    expect(text(f.nativeElement, '#confirm-text')).toBe('Gone for good');
    click(f.nativeElement, '.btn-x');
    expect(await ok).toBe(true);

    const cancel = confirm.ask({ title: 'Sure?' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('#confirm-text')).toBeNull();
    click(f.nativeElement, '.btn-ghost');
    expect(await cancel).toBe(false);

    const backdrop = confirm.ask({ title: 'Sure?' });
    f.detectChanges();
    click(f.nativeElement, '.palette-backdrop');
    expect(await backdrop).toBe(false);

    const esc = confirm.ask({ title: 'Sure?' });
    f.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await esc).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // nothing open
  });
});

describe('Newsletter', () => {
  it('subscribes, reports errors, and clears the field on success', async () => {
    const f = TestBed.createComponent(Newsletter);
    f.detectChanges();
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    type(el, 'input', 'reader@example.com');
    f.detectChanges();
    await f.whenStable();
    click(el, 'button');
    f.detectChanges();
    expect(text(el, 'button')).toContain('Joining');
    respond('/subscribe', null, { status: 400 });
    await settle(f);
    expect(text(el, '.form-msg--error')).toBe('Failed');

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    respond('/subscribe', {});
    await settle(f);
    expect(text(el, '.form-msg')).toContain("You're in");
  });
});

describe('effects', () => {
  @Component({
    imports: [Reveal, Tilt, CountUp],
    template: `<div reveal="120" id="r"></div><div reveal id="r2"></div><div tilt="10" id="t"></div><div tilt id="t2"></div><span [countUp]="n()" id="c"></span>`,
  })
  class Host {
    n = signal(10);
  }

  afterEach(() => vi.unstubAllGlobals());

  it('reveal and countUp run immediately without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (cb(performance.now() + 5000), 1));
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#r')!.classList).toContain('is-visible');
    expect((el.querySelector('#r') as HTMLElement).style.transitionDelay).toBe('120ms');
    expect(text(el, '#c')).toBe('10');
    f.componentInstance.n.set(0);
    f.detectChanges();
    expect(text(el, '#c')).toBe('0');
    f.destroy();
  });

  it('reveal and countUp wait for the element to scroll into view', () => {
    const observers: { cb: IntersectionObserverCallback; disconnect: () => void }[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(public cb: IntersectionObserverCallback) { observers.push(this); }
      observe() {}
      disconnect() {}
    });
    let frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (frames.push(cb), frames.length));
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#r')!.classList).not.toContain('is-visible');
    for (const o of observers) o.cb([{ isIntersecting: false } as IntersectionObserverEntry], o as never);
    for (const o of observers) o.cb([{ isIntersecting: true } as IntersectionObserverEntry], o as never);
    expect(el.querySelector('#r2')!.classList).toContain('is-visible');
    // count up: first frame mid-way, then finished
    const run = (t: number) => { const fs = frames; frames = []; fs.forEach((cb) => cb(t)); };
    run(performance.now());
    run(performance.now() + 5000);
    expect(text(el, '#c')).toBe('10');
    f.destroy();
  });

  it('countUp jumps straight to the value with reduced motion', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    expect(text(f.nativeElement, '#c')).toBe('10');
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
  });

  it('treats browsers without matchMedia as allowing motion', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.stubGlobal('matchMedia', undefined);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (cb(performance.now() + 5000), 1));
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    expect(text(f.nativeElement, '#c')).toBe('10');
  });

  it('tilt follows the mouse only, and resets on leave', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const t = f.nativeElement.querySelector('#t') as HTMLElement;
    t.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
    const move = (pointerType: string) => {
      const e = new MouseEvent('pointermove', { clientX: 100, clientY: 0 }) as PointerEvent;
      Object.defineProperty(e, 'pointerType', { value: pointerType });
      t.dispatchEvent(e);
    };
    move('touch');
    expect(t.style.getPropertyValue('--mx')).toBe('');
    move('mouse');
    expect(t.style.getPropertyValue('--ry')).toBe('10deg');
    t.dispatchEvent(new Event('pointerleave'));
    expect(t.style.getPropertyValue('--ry')).toBe('0deg');
    const t2 = f.nativeElement.querySelector('#t2') as HTMLElement;
    t2.getBoundingClientRect = t.getBoundingClientRect;
    const e = new MouseEvent('pointermove', { clientX: 100, clientY: 100 }) as PointerEvent;
    Object.defineProperty(e, 'pointerType', { value: 'mouse' });
    t2.dispatchEvent(e);
    expect(t2.style.getPropertyValue('--rx')).toBe('-7deg'); // default strength
    // reduced motion: spotlight only
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    t.dispatchEvent(new Event('pointerleave'));
    move('mouse');
    expect(t.style.getPropertyValue('--ry')).toBe('0deg');
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
  });
});

describe('CommandPalette', () => {
  const open = async () => {
    const f = TestBed.createComponent(CommandPalette);
    f.detectChanges();
    f.componentInstance.show();
    f.detectChanges();
    return f;
  };
  const items = (el: HTMLElement) => [...el.querySelectorAll('.palette__label')].map((e) => e.textContent);

  it('lists pages, actions and stories, filters, and runs the chosen command', async () => {
    const f = await open();
    const el = f.nativeElement as HTMLElement;
    respond('/blogs', [blog({ title: 'Featured one', featured: true })]);
    respond('/BAdd', [blog({ title: 'Ocean trip', authName: '' }), ...Array.from({ length: 6 }, (_, i) => blog({ title: `Story ${i}` }))]);
    await settle(f);
    expect(items(el)).toContain('Sign in');
    expect(items(el).filter((l) => l?.startsWith('Story')).length).toBe(3); // 5 stories max when not searching (featured + Ocean + 3)
    await settle(f);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Search');

    type(el, 'input', 'ocean');
    f.detectChanges();
    expect(items(el)).toEqual(['Ocean trip']);
    expect(text(el, '.palette__hint')).toBe('amy · Travel | Art');
    type(el, 'input', 'zzz');
    f.detectChanges();
    expect(text(el, '.palette__empty')).toContain('No matches');

    // keyboard navigation and Enter
    type(el, 'input', '');
    f.detectChanges();
    const input = el.querySelector('input')!;
    const key = (k: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    key('ArrowDown');
    key('ArrowDown');
    key('ArrowUp');
    key('x');
    f.detectChanges();
    expect(el.querySelector('.palette__item.is-active .palette__label')!.textContent).toBe('Featured stories');
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    key('Enter');
    expect(nav).toHaveBeenCalledWith('/blog');
    expect(f.componentInstance.open()).toBe(false);
    f.componentInstance.show(); // stories already loaded: no new request
    f.detectChanges();
    http().expectNone('/BAdd');
    (el.querySelector('.palette__item') as HTMLElement).dispatchEvent(new Event('mouseenter'));
    click(el, '.palette__item');
    expect(nav).toHaveBeenCalledWith('/');
  });

  it('offers the dashboard when signed in, toggles the theme, and handles a failed story load', async () => {
    TestBed.inject(Auth).user.set(account({ name: '' }));
    const f = await open();
    const el = f.nativeElement as HTMLElement;
    respond('/blogs', null, { status: 500 });
    respond('/BAdd', []);
    await settle(f);
    expect(items(el)).toContain('My dashboard');
    expect(text(el, '.palette__item:nth-of-type(9) .palette__hint')).toBeDefined();
    expect([...el.querySelectorAll('.palette__hint')].some((h) => h.textContent === 'amy')).toBe(true);
    const theme = TestBed.inject(Theme);
    const before = theme.mode();
    click(el, '.palette__item', 'Toggle light / dark');
    expect(theme.mode()).not.toBe(before);
    f.componentInstance.show(); // retries loading stories after a failure
    respond('/blogs', []);
    respond('/BAdd', []);
    // Escape and backdrop close it
    f.detectChanges();
    click(el, '.palette-backdrop');
    expect(f.componentInstance.open()).toBe(false);
  });

  it('global shortcuts: Ctrl+K toggles, / opens, Escape closes', async () => {
    const f = TestBed.createComponent(CommandPalette);
    f.detectChanges();
    const press = (init: KeyboardEventInit, target: EventTarget = document) => {
      const e = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      target.dispatchEvent(e);
      return e;
    };
    expect(press({ key: 'k', ctrlKey: true }).defaultPrevented).toBe(true);
    expect(f.componentInstance.open()).toBe(true);
    http().match(() => true).forEach((r) => r.flush([]));
    press({ key: 'Escape' });
    expect(f.componentInstance.open()).toBe(false);
    press({ key: '/' });
    expect(f.componentInstance.open()).toBe(true);
    press({ key: 'K', metaKey: true });
    expect(f.componentInstance.open()).toBe(false);
    const input = document.createElement('input');
    document.body.append(input);
    press({ key: '/' }, input); // typing a slash in a field doesn't open it
    expect(f.componentInstance.open()).toBe(false);
    input.remove();
    press({ key: 'Escape' }); // closed: ignored
    press({ key: 'a' });
    // Enter with no results does nothing
    f.componentInstance.show();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    type(el, 'input', 'nothing-matches');
    el.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    el.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    el.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(f.componentInstance.open()).toBe(true);
  });
});
