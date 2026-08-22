import {
  Directive,
  ElementRef,
  Input,
  AfterViewInit,
  OnDestroy
} from '@angular/core';

declare const $: any;

@Directive({
  selector: '[appSummernote]',
  standalone: false
})
export class SummernoteDirective implements AfterViewInit, OnDestroy {
  @Input('appSummernote') options: {
    height?: number;
    toolbar?: 'simple' | 'complex';
    code?: string;
  } = {};

  constructor(private el: ElementRef) {}

  ngAfterViewInit(): void {
    const simpleToolbar = [
      ['style', ['bold', 'italic', 'underline']],
      ['para', ['ul', 'ol']]
    ];

    const complexToolbar = [
      ['style', ['style']],
      ['font', ['bold', 'italic', 'underline', 'clear']],
      ['fontname', ['fontname']],
      ['fontsize', ['fontsize']],
      ['color', ['color']],
      ['para', ['ul', 'ol', 'paragraph']],
      ['height', ['height']],
      ['insert', ['link', 'picture', 'video', 'table', 'hr']],
      ['view', ['fullscreen', 'codeview', 'help']]
    ];

    const config = {
      height: this.options.height || 200,
      toolbar: this.options.toolbar === 'complex' ? complexToolbar : simpleToolbar,
      callbacks: {
        onInit: () => {
          $(this.el.nativeElement).summernote('code', this.options.code || '');
        }
      }
    };

    $(this.el.nativeElement).summernote(config);
  }

  ngOnDestroy(): void {
    if ($ && $(this.el.nativeElement).data('summernote')) {
      $(this.el.nativeElement).summernote('destroy');
    }
  }
}