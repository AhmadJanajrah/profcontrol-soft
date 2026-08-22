import { Directive, ElementRef, HostListener, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appDragScroll]',
  standalone: false
})
export class DragScrollDirective implements OnDestroy {
  private isDown = false;
  private startX = 0;
  private startY = 0;
  private scrollLeft = 0;
  private scrollTop = 0;

  constructor(private el: ElementRef) {}

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent) {
    this.isDown = true;
    this.el.nativeElement.style.cursor = 'grabbing';
    this.startX = e.pageX - this.el.nativeElement.offsetLeft;
    this.startY = e.pageY - this.el.nativeElement.offsetTop;
    this.scrollLeft = this.el.nativeElement.scrollLeft;
    this.scrollTop = this.el.nativeElement.scrollTop;
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.isDown = false;
    this.el.nativeElement.style.cursor = 'grab';
  }

  @HostListener('mouseup')
  onMouseUp() {
    this.isDown = false;
    this.el.nativeElement.style.cursor = 'grab';
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.isDown) return;
    e.preventDefault();
    const x = e.pageX - this.el.nativeElement.offsetLeft;
    const y = e.pageY - this.el.nativeElement.offsetTop;
    const walkX = (x - this.startX) * 2;
    const walkY = (y - this.startY) * 2;
    this.el.nativeElement.scrollLeft = this.scrollLeft - walkX;
    this.el.nativeElement.scrollTop = this.scrollTop - walkY;
  }

  ngOnDestroy() {
    this.el.nativeElement.style.cursor = '';
  }
}