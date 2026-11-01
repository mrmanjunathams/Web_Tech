import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Fades/slides the element in the first time it scrolls into view. `reveal="120"` delays it in ms. */
@Directive({ selector: '[reveal]', host: { class: 'reveal' } })
export class Reveal implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly reveal = input<string | number>('');
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const delay = Number(this.reveal()) || 0;
    if (delay) this.el.style.transitionDelay = `${delay}ms`;
    if (typeof IntersectionObserver === 'undefined') {
      this.el.classList.add('is-visible');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.el.classList.add('is-visible');
          this.observer?.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    this.observer.observe(this.el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

/**
 * 3D tilt toward the pointer plus a spotlight that follows it.
 * Exposes --rx/--ry (degrees) and --mx/--my (px) for CSS; see .tilt in styles.css.
 */
@Directive({
  selector: '[tilt]',
  host: { class: 'tilt', '(pointermove)': 'move($event)', '(pointerleave)': 'reset()' },
})
export class Tilt {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly tilt = input<string | number>('');

  protected move(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const max = Number(this.tilt()) || 7;
    this.el.style.setProperty('--mx', `${x}px`);
    this.el.style.setProperty('--my', `${y}px`);
    if (reducedMotion()) return;
    this.el.style.setProperty('--rx', `${((y / r.height) - 0.5) * -2 * max}deg`);
    this.el.style.setProperty('--ry', `${((x / r.width) - 0.5) * 2 * max}deg`);
  }

  protected reset(): void {
    this.el.style.setProperty('--rx', '0deg');
    this.el.style.setProperty('--ry', '0deg');
  }
}

/** Counts up from 0 to the value when it scrolls into view. */
@Directive({ selector: '[countUp]' })
export class CountUp implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly countUp = input.required<number>();
  private observer?: IntersectionObserver;
  private frame = 0;
  private started = false;

  ngOnInit(): void {
    this.el.textContent = '0';
    if (typeof IntersectionObserver === 'undefined') return this.run();
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        this.observer?.disconnect();
        this.run();
      }
    });
    this.observer.observe(this.el);
  }

  /** Re-runs when the value arrives after the element became visible. */
  ngOnChanges(): void {
    if (this.started) this.run();
  }

  private run(): void {
    this.started = true;
    cancelAnimationFrame(this.frame);
    const target = this.countUp() || 0;
    if (reducedMotion()) {
      this.el.textContent = target.toLocaleString();
      return;
    }
    const start = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      this.el.textContent = Math.round(target * eased).toLocaleString();
      if (t < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }
}
