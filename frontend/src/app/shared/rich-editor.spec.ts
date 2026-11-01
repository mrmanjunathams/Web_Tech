import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { click, settle, text, type } from '../testing/helpers';
import { RichEditor, normalizeUrl } from './rich-editor';

@Component({
  imports: [RichEditor],
  template: `<app-rich-editor [(html)]="html" placeholder="Write here" (blurred)="blurs = blurs + 1" />`,
})
class Host {
  html = signal('<p>Hello world</p>');
  blurs = 0;
}

describe('normalizeUrl', () => {
  it('accepts web and mail links, adds https, rejects the rest', () => {
    expect(normalizeUrl('https://a.example/x')).toBe('https://a.example/x');
    expect(normalizeUrl('MAILTO:me@x.co')).toBe('MAILTO:me@x.co');
    expect(normalizeUrl('example.com/page')).toBe('https://example.com/page');
    expect(normalizeUrl('me@example.com')).toBe('mailto:me@example.com');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
    expect(normalizeUrl('not a link')).toBeNull();
  });
});

describe('RichEditor', () => {
  async function setup() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await settle(f);
    const editor = f.debugElement.children[0].componentInstance as RichEditor;
    const el = f.nativeElement as HTMLElement;
    const btn = (label: string) => el.querySelector<HTMLButtonElement>(`.rte__btn[aria-label="${label}"]`)!;
    return { f, el, editor, btn, tiptap: editor.editor! };
  }

  it('shows the content, counts words and reports edits as HTML', async () => {
    const { f, el, tiptap } = await setup();
    expect(el.querySelector('.tiptap')!.innerHTML).toContain('Hello world');
    expect(text(el, '.rte__foot span')).toBe('2 words · 11 characters');

    tiptap.commands.insertContentAt(tiptap.state.doc.content.size, '<p>One more</p>');
    await settle(f);
    expect(f.componentInstance.html()).toBe('<p>Hello world</p><p>One more</p>');
    expect(text(el, '.rte__foot span')).toBe('4 words · 19 characters');

    tiptap.commands.clearContent(true);
    expect(f.componentInstance.html()).toBe(''); // empty editor = empty string

    // Content set from outside replaces the editor's; the same content is left alone.
    f.componentInstance.html.set('<h2>New</h2>');
    await settle(f);
    expect(tiptap.getHTML()).toBe('<h2>New</h2>');
    tiptap.commands.insertContentAt(tiptap.state.doc.content.size, '<p></p><p></p>');
    tiptap.commands.insertContentAt(4, '!');
    await settle(f);
    expect(f.componentInstance.html()).toBe('<h2>New!</h2>'); // empty trailing lines aren't stored
    const selection = tiptap.state.selection.from;
    f.componentInstance.html.set('<h2>New!</h2>'); // same content: not reset (the cursor stays put)
    await settle(f);
    expect(tiptap.state.selection.from).toBe(selection);
    expect(text(el, '.rte__foot span')).toBe('1 word · 4 characters');
  });

  it('every toolbar button applies its formatting and lights up', async () => {
    const { f, el, btn, tiptap } = await setup();
    tiptap.commands.selectAll();
    for (const label of ['Bold', 'Italic', 'Underline', 'Strikethrough']) {
      btn(label).click();
      await settle(f);
    }
    expect(f.componentInstance.html()).toBe('<p><strong><em><s><u>Hello world</u></s></em></strong></p>');
    expect(btn('Bold').classList).toContain('is-active');
    btn('Clear formatting').click();
    expect(f.componentInstance.html()).toBe('<p>Hello world</p>');
    tiptap.commands.selectAll();
    btn('Inline code').click(); // code can't carry other formatting
    expect(f.componentInstance.html()).toBe('<p><code>Hello world</code></p>');
    btn('Clear formatting').click();

    const blocks: [string, string][] = [
      ['Heading', '<h2>Hello world</h2>'],
      ['Subheading', '<h3>Hello world</h3>'],
      ['Paragraph', '<p>Hello world</p>'],
      ['Bulleted list', '<ul><li><p>Hello world</p></li></ul>'],
      ['Numbered list', '<ol><li><p>Hello world</p></li></ol>'],
      ['Numbered list', '<p>Hello world</p>'],
      ['Quote', '<blockquote><p>Hello world</p></blockquote>'],
      ['Quote', '<p>Hello world</p>'],
      ['Code block', '<pre><code>Hello world</code></pre>'],
    ];
    for (const [label, html] of blocks) {
      tiptap.commands.setTextSelection(3); // cursor inside the text
      btn(label).click();
      await settle(f);
      expect(f.componentInstance.html()).toBe(html);
    }
    expect(btn('Code block').getAttribute('aria-pressed')).toBe('true');
    expect(btn('Quote').getAttribute('aria-pressed')).toBe('false');
    btn('Undo').click(); // quick successive edits are undone together
    expect(f.componentInstance.html()).not.toContain('<pre>');
    btn('Redo').click();
    expect(f.componentInstance.html()).toBe('<pre><code>Hello world</code></pre>');
    btn('Paragraph').click();
    btn('Divider').click();
    expect(f.componentInstance.html()).toContain('<hr>');
    expect(btn('Undo').getAttribute('aria-pressed')).toBeNull(); // not a toggle
    btn('Bold').dispatchEvent(new MouseEvent('mousedown', { cancelable: true })); // keeps the selection
    const link = el.querySelector('.rte__btn[aria-label="Link"]')!;
    const down = new MouseEvent('mousedown', { cancelable: true });
    link.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it('adds, edits and removes links, and validates them', async () => {
    const { f, el, tiptap } = await setup();
    const linkBtn = () => el.querySelector<HTMLButtonElement>('.rte__btn[aria-label="Link"]')!;

    // Selected text becomes a link.
    tiptap.commands.setTextSelection({ from: 1, to: 6 });
    linkBtn().click();
    await settle(f);
    expect(el.querySelector('.rte__link')).not.toBeNull();
    type(el, '.rte__link input', 'javascript:alert(1)');
    el.querySelector('.rte__link')!.dispatchEvent(new Event('submit'));
    await settle(f);
    expect(text(el, '.rte__link .field__error')).toContain('web address');
    type(el, '.rte__link input', 'example.com');
    f.detectChanges();
    expect(el.querySelector('.rte__link .field__error')).toBeNull();
    el.querySelector('.rte__link')!.dispatchEvent(new Event('submit'));
    await settle(f);
    expect(f.componentInstance.html()).toContain('<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">Hello</a>');

    // Reopening on a link shows its address, and it can be removed.
    tiptap.commands.setTextSelection(3);
    linkBtn().click();
    await settle(f);
    expect((el.querySelector('.rte__link input') as HTMLInputElement).value).toBe('https://example.com');
    click(el, '.rte__link button', 'Remove');
    await settle(f);
    expect(f.componentInstance.html()).toBe('<p>Hello world</p>');

    // Ctrl+K with nothing selected inserts the address as the link text.
    tiptap.commands.setTextSelection(tiptap.state.doc.content.size - 1);
    tiptap.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
    await settle(f);
    type(el, '.rte__link input', 'me@example.com');
    el.querySelector('.rte__link')!.dispatchEvent(new Event('submit'));
    await settle(f);
    expect(f.componentInstance.html()).toContain('href="mailto:me@example.com">me@example.com</a>');

    // Cancel and Escape close the link bar; other keys are ignored.
    linkBtn().click();
    await settle(f);
    click(el, '.rte__link .icon-btn');
    await settle(f);
    expect(el.querySelector('.rte__link')).toBeNull();
    linkBtn().click();
    await settle(f);
    el.querySelector('.rte__link input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle(f);
    expect(el.querySelector('.rte__link')).toBeNull();
    tiptap.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
  });

  it('focus mode and blur', async () => {
    const { f, el, tiptap } = await setup();
    click(el, '.rte__btn[aria-label="Focus mode"]');
    f.detectChanges();
    expect(el.querySelector('app-rich-editor')!.classList).toContain('rte--focus');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(el.querySelector('app-rich-editor')!.classList).not.toContain('rte--focus');
    tiptap.emit('blur', { editor: tiptap, event: new FocusEvent('blur'), transaction: tiptap.state.tr });
    expect(f.componentInstance.blurs).toBe(1);
    f.destroy();
    expect(tiptap.isDestroyed).toBe(true);
  });
});
