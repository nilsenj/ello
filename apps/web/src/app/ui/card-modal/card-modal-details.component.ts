import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

import type { PanelName } from './card-modal.service';

@Component({
    standalone: true,
    selector: 'card-modal-details',
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './card-modal-details.component.html',
    styleUrls: ['./card-modal.component.css'],
})
export class CardModalDetailsComponent {
    readonly tCardDetails = $localize`:@@cardModalDetails.title:Card details`;
    readonly tLabels = $localize`:@@cardModalDetails.labels:Labels`;
    readonly tDates = $localize`:@@cardModalDetails.dates:Dates`;
    readonly tStart = $localize`:@@cardModalDetails.start:Start`;
    readonly tDue = $localize`:@@cardModalDetails.due:Due`;
    readonly tMembers = $localize`:@@cardModalDetails.members:Members`;
    readonly tChecklists = $localize`:@@cardModalDetails.checklists:Checklists`;
    readonly tPlanning = $localize`:@@cardModalDetails.planning:Planning`;
    readonly tRisk = $localize`:@@cardModalDetails.risk:Risk`;
    readonly tEst = $localize`:@@cardModalDetails.estimate:Est`;
    readonly tAttachments = $localize`:@@cardModalDetails.attachments:Attachments`;
    @Input({ required: true }) labelCount!: number;
    @Input({ required: true }) hasStart!: boolean;
    @Input({ required: true }) hasDue!: boolean;
    @Input({ required: true }) memberCount!: number;
    @Input({ required: true }) checklistCount!: number;
    @Input({ required: true }) hasPlanning!: boolean;
    @Input({ required: true }) hasAttachments!: boolean;
    @Input({ required: true }) attachmentCount!: number;
    @Input({ required: true }) currentPriority!: string | '';
    @Input({ required: true }) currentRisk!: string | '';
    @Input({ required: true }) currentEstimate!: number | '';

    @Input({ required: true }) TagIcon!: any;
    @Input({ required: true }) CalendarIcon!: any;
    @Input({ required: true }) UsersIcon!: any;
    @Input({ required: true }) ListChecksIcon!: any;
    @Input({ required: true }) GaugeIcon!: any;
    @Input({ required: true }) PaperclipIcon!: any;

    @Output() openPanel = new EventEmitter<PanelName>();
}
