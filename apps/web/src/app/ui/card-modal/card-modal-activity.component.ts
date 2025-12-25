import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    standalone: true,
    selector: 'card-modal-activity',
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './card-modal-activity.component.html',
    styleUrls: ['./card-modal.component.css'],
})
export class CardModalActivityComponent {
    @Input({ required: true }) activities!: any[];
    @Input({ required: true }) formatActivity!: (act: any) => string;
    @Input({ required: true }) ActivityIcon!: any;
    readonly tActivity = $localize`:@@cardModalActivity.title:Activity`;
    readonly tUserFallback = $localize`:@@cardModalActivity.userFallback:User`;
    readonly tUserInitial = $localize`:@@cardModalActivity.userInitial:U`;
    readonly tNoActivity = $localize`:@@cardModalActivity.noActivity:No activity yet.`;
}
