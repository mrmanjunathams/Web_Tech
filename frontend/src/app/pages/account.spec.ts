import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';
import { Confirm } from '../core/confirm';
import { Toast } from '../core/toast';
import { account, blog, click, respond, settle, testProviders, text, type } from '../testing/helpers';
import { Account } from './account';

describe('Account (dashboard)', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined);
    TestBed.configureTestingModule({ providers: testProviders([{ path: '**', children: [] }]) });
  });
  afterEach(() => vi.unstubAllGlobals());

  async function render(user = account()) {
    TestBed.inject(Auth).user.set(user);
    const f = TestBed.createComponent(Account);
    f.detectChanges();
    await f.whenStable();
    return { f, el: f.nativeElement as HTMLElement };
  }

  const stories = [
    blog({ _id: 'p1', title: 'Live one', likes: 2, views: 10, blogp1: 'one two', blogp2: '<p>three</p>' }),
    blog({ _id: 's1', title: 'Soon', status: 'scheduled', publishAt: '2026-12-01T09:00:00', likes: 0 }),
    blog({ _id: 'd1', title: '', status: 'draft', updatedAt: '2026-11-01T08:30:00Z' }),
    blog({ _id: 'd2', title: 'No edit time', status: 'draft' }),
  ];

  it('shows the profile, live-only stats, and stories by tab', async () => {
    const { f, el } = await render(account({ blogs: stories }));
    expect(text(el, '.profile__name')).toContain('Amy Writer');
    expect(text(el, '.profile__info .muted')).toContain('@amy');
    expect(el.querySelector('.banner')).toBeNull();
    const tiles = [...el.querySelectorAll('.stat-tile .muted')].map((e) => e.textContent);
    expect(tiles).toEqual(['Stories', 'Likes received', 'Views', 'Words written']);
    expect([...el.querySelectorAll('.tab .chip__count')].map((e) => e.textContent)).toEqual(['1', '1', '2']);

    expect(text(el, '.grid-cards .post-card__title')).toBe('Live one');
    expect(el.querySelector('.grid-cards a.post-card')!.getAttribute('href')).toBe('/post/p1');
    click(el, '.tab', 'Scheduled');
    f.detectChanges();
    expect(text(el, '.owned__note')).toContain('Goes live');
    expect(el.querySelector('.grid-cards a.post-card')!.getAttribute('href')).toBe('/writeblog?id=s1');
    click(el, '.tab', 'Drafts');
    f.detectChanges();
    expect([...el.querySelectorAll('.post-card__title')].map((e) => e.textContent)).toEqual(['Untitled draft', 'No edit time']);
    expect(el.querySelectorAll('.owned__note').length).toBe(1);
    expect(el.querySelector('[aria-label="Edit draft"]')!.getAttribute('href')).toBe('/writeblog?id=d1');
  });

  it('opens on drafts when there is nothing published, and explains empty tabs', async () => {
    const { f, el } = await render(account({ blogs: [blog({ status: 'draft' })], createdAt: undefined }));
    expect(el.querySelector('.tab.is-on')!.textContent).toContain('Drafts');
    expect(text(el, '.profile__info .muted')).not.toContain('Joined');
    click(el, '.tab', 'Published');
    f.detectChanges();
    expect(text(el, '.empty h3')).toBe('Nothing published yet');
    click(el, '.tab', 'Scheduled');
    f.detectChanges();
    expect(text(el, '.empty h3')).toBe('Nothing scheduled');
    expect(text(el, '.empty p')).toContain('schedule');
    const empty = await render(account());
    expect(text(empty.el, 'h2')).toBe('Your first story awaits');
    click(empty.el, '.tab', 'Drafts');
    empty.f.detectChanges();
    expect(text(empty.el, '.empty h3')).toBe('No drafts');
  });

  it('accounts without a name are prompted to add one, and can rename', async () => {
    const { f, el } = await render(account({ name: '' }));
    expect(text(el, '.profile__name')).toContain('amy');
    expect(text(el, '.banner')).toContain('Add your name');
    click(el, '.banner .btn-x');
    f.detectChanges();
    const input = el.querySelector('#name-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect((el.querySelector('.name-edit button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(el.querySelector('.name-edit')).toBeNull();

    click(el, '#edit-name');
    f.detectChanges();
    type(el, '#name-input', '  Amy W  ');
    f.detectChanges();
    el.querySelector('.name-edit')!.dispatchEvent(new Event('submit'));
    expect(respond('/myacc', { error: 'Please enter your name (up to 60 characters).' }, { method: 'PATCH', status: 400 }).body).toEqual({ name: 'Amy W' });
    await settle(f);
    expect(el.querySelector('.name-edit')).not.toBeNull(); // still editing after an error

    const success = vi.spyOn(TestBed.inject(Toast), 'success');
    el.querySelector('.name-edit')!.dispatchEvent(new Event('submit'));
    respond('/myacc', account({ name: 'Amy W' }), { method: 'PATCH' });
    await settle(f);
    expect(text(el, '.profile__name')).toContain('Amy W');
    expect(success).toHaveBeenCalledWith('Name updated.');
    click(el, '#edit-name');
    f.detectChanges();
    click(el, '.name-edit .btn-ghost');
    f.detectChanges();
    expect(el.querySelector('.name-edit')).toBeNull();
  });

  it('deletes stories after confirming, and logs out', async () => {
    const { f, el } = await render(account({ blogs: stories }));
    const ask = vi.spyOn(TestBed.inject(Confirm), 'ask').mockResolvedValueOnce(false);
    click(el, '.owned__delete');
    await settle(f);
    ask.mockResolvedValueOnce(true);
    const error = vi.spyOn(TestBed.inject(Toast), 'error');
    click(el, '.owned__delete');
    await settle();
    respond('/posts/p1', null, { method: 'DELETE', status: 500 });
    await settle(f);
    expect(error).toHaveBeenCalledWith('Failed'); // the API's message

    click(el, '.tab', 'Drafts');
    f.detectChanges();
    ask.mockResolvedValueOnce(true);
    click(el, '.owned__delete');
    await settle();
    expect(ask.mock.calls.at(-1)![0].text).toBe('"Untitled draft" will be gone for good.');
    respond('/posts/d1', {}, { method: 'DELETE' });
    await settle();
    respond('/myacc', account({ blogs: stories.slice(0, 1) }));
    await settle(f);
    expect([...el.querySelectorAll('.tab .chip__count')].map((e) => e.textContent)).toEqual(['1', '0', '0']);

    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    click(el, '#logout');
    respond('/logout', {});
    await settle(f);
    expect(nav).toHaveBeenCalledWith('/');
    expect(el.querySelector('.profile')).toBeNull();
  });
});
