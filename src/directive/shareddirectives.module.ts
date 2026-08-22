import { NgModule } from '@angular/core';

// Directives
import { TooltipDirective } from '../directive/tooltip.directive';
import { CleaveNumberDirective } from '../directive/cleavenumber.directive';
import { SummernoteDirective } from '../directive/summernote.directive';
import { IntegerOnlyDirective } from '../directive/intnumber.directive';
import { DragScrollDirective } from '../directive/dragscroll.directive';

@NgModule({
  declarations: [
    TooltipDirective,
    CleaveNumberDirective,
    SummernoteDirective,
    IntegerOnlyDirective,
    DragScrollDirective
  ],
  exports: [
    TooltipDirective,
    CleaveNumberDirective,
    SummernoteDirective,
    IntegerOnlyDirective,
    DragScrollDirective
  ]
})
export class SharedDirectivesModule {}