import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Renderer2
} from '@angular/core';

declare const bootstrap: any;

@Directive({
  selector: '[appTooltip]',
  standalone: false
})
export class TooltipDirective implements OnInit, AfterViewInit, OnDestroy {

  @Input('appTooltip') tooltipTitle = '';

  private tooltipInstance: any;
  private longPressTimeout: any;
  private removeListeners: (() => void)[] = [];

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    const el = this.el.nativeElement;

    el.setAttribute('title', this.tooltipTitle);
    el.setAttribute('data-bs-toggle', 'tooltip');
    el.setAttribute('aria-label', this.tooltipTitle);
  }

  ngAfterViewInit(): void {
    const el = this.el.nativeElement;

    // Manual trigger only
    this.tooltipInstance = new bootstrap.Tooltip(el, {
      trigger: 'manual',
      container: 'body',
      boundary: 'window'
    });

    /* ---------- Desktop hover ---------- */
    this.removeListeners.push(
      this.renderer.listen(el, 'mouseenter', () => {
        this.tooltipInstance.show();
      }),
      this.renderer.listen(el, 'mouseleave', () => {
        this.tooltipInstance.hide();
      })
    );

    /* ---------- Mobile long press ---------- */
    this.removeListeners.push(
      this.renderer.listen(el, 'touchstart', () => {
        this.longPressTimeout = setTimeout(() => {
          this.tooltipInstance.show();
        }, 500);
      }),

      this.renderer.listen(el, 'touchend', () => {
        clearTimeout(this.longPressTimeout);
        setTimeout(() => {
          this.tooltipInstance.hide();
        }, 1200);
      }),

      this.renderer.listen(el, 'touchcancel', () => {
        clearTimeout(this.longPressTimeout);
        this.tooltipInstance.hide();
      })
    );

    /* ---------- Prevent click / focus triggers ---------- */
    this.removeListeners.push(
      this.renderer.listen(el, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }),
      this.renderer.listen(el, 'focus', () => {
        this.tooltipInstance.hide();
      })
    );

    /* ---------- Hide on scroll ---------- */
    this.removeListeners.push(
      this.renderer.listen('window', 'scroll', () => {
        this.tooltipInstance.hide();
      })
    );
  }

  ngOnDestroy(): void {
    this.removeListeners.forEach(fn => fn());
    this.tooltipInstance?.dispose();
  }
}