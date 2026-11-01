import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { imageUrl } from '../core/api';
import { Posts } from '../core/posts';
import { Reveal } from '../shared/effects';

/** The Image Pool: browse covers, open them full-size, and start a story with one. */
@Component({
  selector: 'app-gallery',
  imports: [RouterLink, Reveal],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <section class="container-x page-head">
      <p class="eyebrow" reveal>Image Pool</p>
      <h1 class="display display--md" reveal="60">Every story needs <span class="text-grad">a stunning cover</span></h1>
      <p class="lead" reveal="120">{{ images().length }} photographs, free to use on Bloggerbytes. Click one to look closer — or start writing with it.</p>
    </section>

    <section class="container-x">
      <div class="masonry">
        @for (name of images(); track name; let i = $index) {
          <figure class="masonry__item" [reveal]="(i % 4) * 60">
            <button type="button" class="masonry__open" (click)="open.set(i)" [attr.aria-label]="'View ' + name">
              <img [src]="url(name)" [alt]="name" loading="lazy">
            </button>
            <figcaption>
              <span class="mono">{{ name }}</span>
              <a class="chip chip--glass" routerLink="/writeblog" [queryParams]="{ img: name }"><span class="ms">edit</span>Use as cover</a>
            </figcaption>
          </figure>
        }
      </div>
    </section>

    @if (current(); as name) {
      <div class="lightbox" role="dialog" aria-modal="true" [attr.aria-label]="name" (click)="open.set(null)">
        <img [src]="url(name, 'lg')" [alt]="name" (click)="$event.stopPropagation()">
        <button type="button" class="icon-btn lightbox__close" aria-label="Close" (click)="open.set(null)"><span class="ms">close</span></button>
        <button type="button" class="icon-btn lightbox__nav lightbox__nav--prev" aria-label="Previous" (click)="step(-1, $event)"><span class="ms">chevron_left</span></button>
        <button type="button" class="icon-btn lightbox__nav lightbox__nav--next" aria-label="Next" (click)="step(1, $event)"><span class="ms">chevron_right</span></button>
        <div class="lightbox__bar glass" (click)="$event.stopPropagation()">
          <span class="mono">{{ name }} · {{ open()! + 1 }}/{{ images().length }}</span>
          <a class="btn-x btn-x--sm" routerLink="/writeblog" [queryParams]="{ img: name }"><span class="ms">edit</span>Write with this</a>
        </div>
      </div>
    }
  `,
})
export class Gallery {
  protected readonly images = signal<string[]>([]);
  protected readonly open = signal<number | null>(null);
  protected readonly current = computed(() => {
    const i = this.open();
    return i === null ? null : this.images()[i];
  });
  protected readonly url = imageUrl;

  constructor() {
    inject(Posts).images().then((list) => this.images.set(list)).catch(() => {});
  }

  protected step(dir: number, e?: Event): void {
    e?.stopPropagation();
    const n = this.images().length;
    this.open.update((i) => (i === null ? null : (i + dir + n) % n));
  }

  protected onKey(e: KeyboardEvent): void {
    if (this.open() === null) return;
    if (e.key === 'Escape') this.open.set(null);
    else if (e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'ArrowLeft') this.step(-1);
  }
}
