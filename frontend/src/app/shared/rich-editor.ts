import { Component, ElementRef, OnDestroy, afterNextRender, effect, inject, input, model, output, signal } from '@angular/core';
import { Editor } from '@tiptap/core';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';

/** Toolbar actions; `run` applies them, `active` lights the button up for the current selection. */
interface Tool {
  id: string;
  icon: string;
  label: string;
  keys?: string;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
}

/** Adds https:// to bare domains; rejects anything that isn't a web or mail link. */
export function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^(https?:\/\/|mailto:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null; // javascript:, data:, ...
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return /^[^\s]+\.[^\s]+$/.test(url) ? `https://${url}` : null;
}

/** Editor HTML as stored: no empty trailing paragraphs (e.g. left by pasting). */
export const cleanHtml = (html: string) => html.replace(/(<p><\/p>)+$/, '');

/**
 * Rich-text editor for story bodies (TipTap / ProseMirror). Produces HTML that the API sanitizes:
 * headings, bold/italic/underline/strike, inline code and code blocks, lists, quotes, dividers and links.
 * Markdown-style shortcuts work while typing ("## ", "- ", "1. ", "> ", "```", **bold**).
 */
@Component({
  selector: 'app-rich-editor',
  host: { class: 'rte', '[class.rte--focus]': 'focusMode()', '(document:keydown.escape)': 'focusMode.set(false)' },
  template: `
    <div class="rte__toolbar" role="toolbar" aria-label="Formatting">
      @for (group of groups; track $index) {
        <div class="rte__group">
          @for (t of group; track t.id) {
            <button type="button" class="rte__btn" [class.is-active]="isActive(t)" [attr.aria-pressed]="t.active ? isActive(t) : null"
                    [attr.aria-label]="t.label" [title]="t.label + (t.keys ? ' (' + t.keys + ')' : '')" [disabled]="!ready()"
                    (mousedown)="$event.preventDefault()" (click)="apply(t)">
              <span class="ms">{{ t.icon }}</span>
            </button>
          }
        </div>
      }
      <div class="rte__group">
        <button type="button" class="rte__btn" [class.is-active]="linkOpen() || isLink()" aria-label="Link" title="Link (Ctrl+K)"
                [disabled]="!ready()" (mousedown)="$event.preventDefault()" (click)="openLink()"><span class="ms">link</span></button>
        <button type="button" class="rte__btn" aria-label="Focus mode" [title]="focusMode() ? 'Exit focus mode (Esc)' : 'Focus mode'"
                [class.is-active]="focusMode()" (click)="focusMode.set(!focusMode())"><span class="ms">{{ focusMode() ? 'close_fullscreen' : 'open_in_full' }}</span></button>
      </div>
    </div>

    @if (linkOpen()) {
      <form class="rte__link" (submit)="$event.preventDefault(); saveLink()">
        <span class="ms">link</span>
        <input type="text" class="input-x" placeholder="Paste a link (https://…)" aria-label="Link address"
               [value]="linkUrl()" (input)="linkUrl.set($any($event.target).value); linkError.set('')" (keydown.escape)="closeLink()">
        <button type="submit" class="btn-x btn-x--sm">Apply</button>
        @if (isLink()) { <button type="button" class="btn-ghost btn-x--sm" (click)="removeLink()">Remove</button> }
        <button type="button" class="icon-btn" aria-label="Cancel" (click)="closeLink()"><span class="ms">close</span></button>
        @if (linkError()) { <small class="field__error">{{ linkError() }}</small> }
      </form>
    }

    <div class="rte__content prose" [attr.aria-label]="label()"></div>

    <div class="rte__foot muted">
      <span>{{ words() }} {{ words() === 1 ? 'word' : 'words' }} · {{ characters() }} characters</span>
      <span class="rte__hint">Tip: type <kbd>##</kbd> for a heading, <kbd>-</kbd> for a list, <kbd>&gt;</kbd> for a quote</span>
    </div>
  `,
})
export class RichEditor implements OnDestroy {
  /** HTML content; two-way bindable. */
  readonly html = model('');
  readonly placeholder = input('Tell your story…');
  readonly label = input('Story');
  /** Fires on blur, e.g. to save a draft. */
  readonly blurred = output<void>();

  protected readonly ready = signal(false);
  protected readonly focusMode = signal(false);
  protected readonly linkOpen = signal(false);
  protected readonly linkUrl = signal('');
  protected readonly linkError = signal('');
  protected readonly words = signal(0);
  protected readonly characters = signal(0);
  /** Bumped on every editor transaction so toolbar state re-renders. */
  private readonly version = signal(0);

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  editor?: Editor;

  protected readonly groups: Tool[][] = [
    [
      { id: 'undo', icon: 'undo', label: 'Undo', keys: 'Ctrl+Z', run: (e) => e.chain().focus().undo().run() },
      { id: 'redo', icon: 'redo', label: 'Redo', keys: 'Ctrl+Shift+Z', run: (e) => e.chain().focus().redo().run() },
    ],
    [
      { id: 'p', icon: 'notes', label: 'Paragraph', run: (e) => e.chain().focus().setParagraph().run(), active: (e) => e.isActive('paragraph') },
      { id: 'h2', icon: 'format_h2', label: 'Heading', keys: 'Ctrl+Alt+2', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
      { id: 'h3', icon: 'format_h3', label: 'Subheading', keys: 'Ctrl+Alt+3', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) },
    ],
    [
      { id: 'bold', icon: 'format_bold', label: 'Bold', keys: 'Ctrl+B', run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
      { id: 'italic', icon: 'format_italic', label: 'Italic', keys: 'Ctrl+I', run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
      { id: 'underline', icon: 'format_underlined', label: 'Underline', keys: 'Ctrl+U', run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive('underline') },
      { id: 'strike', icon: 'strikethrough_s', label: 'Strikethrough', keys: 'Ctrl+Shift+S', run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
      { id: 'code', icon: 'code', label: 'Inline code', keys: 'Ctrl+E', run: (e) => e.chain().focus().toggleCode().run(), active: (e) => e.isActive('code') },
    ],
    [
      { id: 'ul', icon: 'format_list_bulleted', label: 'Bulleted list', keys: 'Ctrl+Shift+8', run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
      { id: 'ol', icon: 'format_list_numbered', label: 'Numbered list', keys: 'Ctrl+Shift+7', run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
      { id: 'quote', icon: 'format_quote', label: 'Quote', keys: 'Ctrl+Shift+B', run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
      { id: 'codeblock', icon: 'data_object', label: 'Code block', keys: 'Ctrl+Alt+C', run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive('codeBlock') },
      { id: 'hr', icon: 'horizontal_rule', label: 'Divider', run: (e) => e.chain().focus().setHorizontalRule().run() },
    ],
    [{ id: 'clear', icon: 'format_clear', label: 'Clear formatting', run: (e) => e.chain().focus().unsetAllMarks().clearNodes().run() }],
  ];

  constructor() {
    afterNextRender(() => this.create());
    // Content set from outside (restoring a draft, opening a story to edit) replaces the editor's.
    effect(() => {
      const html = this.html();
      if (this.editor && html !== this.current()) this.editor.commands.setContent(html, { emitUpdate: false });
      if (this.editor) this.count();
    });
  }

  private create(): void {
    this.editor = new Editor({
      element: this.host.querySelector<HTMLElement>('.rte__content')!,
      content: this.html(),
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          // No automatic empty line after headings/code blocks: "select all" would include it.
          trailingNode: false,
          link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
        }),
        Placeholder.configure({ placeholder: () => this.placeholder() }),
        CharacterCount,
      ],
      editorProps: {
        attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': this.label() },
        handleKeyDown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            this.openLink();
            return true;
          }
          return false;
        },
      },
      onUpdate: () => this.html.set(this.current()),
      onTransaction: () => this.version.update((v) => v + 1),
      onBlur: () => this.blurred.emit(),
    });
    this.count();
    this.ready.set(true);
  }

  /** The editor's content as stored ('' when empty). */
  private current(): string {
    return this.editor!.isEmpty ? '' : cleanHtml(this.editor!.getHTML());
  }

  private count(): void {
    const storage = this.editor!.storage.characterCount;
    this.words.set(storage.words());
    this.characters.set(storage.characters());
  }

  protected isActive(t: Tool): boolean {
    this.version();
    return !!this.editor && !!t.active?.(this.editor);
  }

  protected isLink(): boolean {
    this.version();
    return !!this.editor?.isActive('link');
  }

  protected apply(t: Tool): void {
    t.run(this.editor!);
  }

  protected openLink(): void {
    this.linkUrl.set(this.editor?.getAttributes('link')['href'] ?? '');
    this.linkError.set('');
    this.linkOpen.set(true);
    queueMicrotask(() => this.host.querySelector<HTMLInputElement>('.rte__link input')?.focus());
  }

  protected closeLink(): void {
    this.linkOpen.set(false);
    this.editor?.commands.focus();
  }

  protected saveLink(): void {
    const href = normalizeUrl(this.linkUrl());
    if (!href) {
      this.linkError.set('Enter a web address (https://…) or an email address.');
      return;
    }
    const chain = this.editor!.chain().focus().extendMarkRange('link');
    // With no text selected, insert the address itself as the link text.
    if (this.editor!.state.selection.empty && !this.editor!.isActive('link')) {
      chain.insertContent({ type: 'text', text: href.replace(/^mailto:/, ''), marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    this.linkOpen.set(false);
  }

  protected removeLink(): void {
    this.editor!.chain().focus().extendMarkRange('link').unsetLink().run();
    this.linkOpen.set(false);
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}
