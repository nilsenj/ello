import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterIcon, LucideAngularModule, SearchIcon, TagIcon, UserIcon } from 'lucide-angular';

@Component({
    selector: 'kanban-filters',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './kanban-filters.component.html',
    styleUrls: ['./kanban-filters.component.css'],
})
export class KanbanFiltersComponent {
    @Input() filter = '';
    @Input() activeLabel = '';
    @Input() activeMemberId = '';
    @Input() activeOverdue = false;
    @Input() labels: Array<{ id: string; name: string; color?: string }> = [];
    @Input() members: Array<{ id: string; name?: string; email?: string }> = [];

    @Input() tFilterPlaceholder = '';
    @Input() tAllLabels = '';
    @Input() tLabelDefault = '';
    @Input() tAllMembers = '';
    @Input() tMemberDefault = '';
    @Input() tFilters = '';
    @Input() tSearchCards = '';
    @Input() tSearchPlaceholder = '';
    @Input() tLabel = '';
    @Input() tMember = '';
    @Input() tClearFilters = '';
    @Input() tOverdueFilter = '';

    @Output() filterChange = new EventEmitter<string>();
    @Output() activeLabelChange = new EventEmitter<string>();
    @Output() activeMemberIdChange = new EventEmitter<string>();
    @Output() activeOverdueChange = new EventEmitter<boolean>();
    @Output() menuOpened = new EventEmitter<void>();

    showLabelDropdown = false;
    showMemberDropdown = false;
    showFilterMenu = false;
    showMobileLabelDropdown = false;
    showMobileMemberDropdown = false;

    filterMenuTop = 0;
    filterMenuLeft = 0;
    private readonly filterMenuWidth = 280;
    private readonly filterMenuMargin = 12;

    readonly FilterIcon = FilterIcon;
    readonly SearchIcon = SearchIcon;
    readonly UserIcon = UserIcon;
    readonly TagIcon = TagIcon;

    toggleLabelDropdown() {
        this.showLabelDropdown = !this.showLabelDropdown;
        this.showMemberDropdown = false;
    }

    toggleMemberDropdown() {
        this.showMemberDropdown = !this.showMemberDropdown;
        this.showLabelDropdown = false;
    }

    closeAllDropdowns() {
        this.showLabelDropdown = false;
        this.showMemberDropdown = false;
    }

    toggleFilterMenu() {
        this.showFilterMenu = !this.showFilterMenu;
        if (this.showFilterMenu) {
            this.closeMobileDropdowns();
            this.menuOpened.emit();
            this.positionFilterMenu();
        }
    }

    closeFilterMenu() {
        this.showFilterMenu = false;
        this.closeMobileDropdowns();
    }

    toggleMobileLabelDropdown() {
        this.showMobileLabelDropdown = !this.showMobileLabelDropdown;
        if (this.showMobileLabelDropdown) this.showMobileMemberDropdown = false;
    }

    toggleMobileMemberDropdown() {
        this.showMobileMemberDropdown = !this.showMobileMemberDropdown;
        if (this.showMobileMemberDropdown) this.showMobileLabelDropdown = false;
    }

    private closeMobileDropdowns() {
        this.showMobileLabelDropdown = false;
        this.showMobileMemberDropdown = false;
    }

    private positionFilterMenu() {
        const trigger = document.querySelector<HTMLButtonElement>('[data-filter-trigger]');
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const left = Math.min(rect.left, window.innerWidth - this.filterMenuWidth - this.filterMenuMargin);
        this.filterMenuLeft = Math.max(this.filterMenuMargin, Math.round(left));
        this.filterMenuTop = Math.max(this.filterMenuMargin, Math.round(rect.bottom + 8));
    }

    activeLabelName() {
        if (!this.activeLabel) return this.tAllLabels;
        return this.labels.find(l => l.id === this.activeLabel)?.name || this.tLabelDefault;
    }

    activeMemberName() {
        if (!this.activeMemberId) return this.tAllMembers;
        const m = this.members.find(m => m.id === this.activeMemberId);
        return m?.name || m?.email || this.tMemberDefault;
    }

    activeMemberInitials() {
        if (!this.activeMemberId) return '';
        const m = this.members.find(m => m.id === this.activeMemberId);
        const name = (m?.name || m?.email || 'M').trim();
        return name.slice(0, 2).toUpperCase();
    }

    colorOf(labelId: string) {
        return this.labels.find(lb => lb.id === labelId)?.color ?? '#ccc';
    }

    onFilterChange(value: string) {
        this.filterChange.emit(value);
    }

    updateActiveLabel(value: string) {
        this.activeLabelChange.emit(value || '');
    }

    updateActiveMember(value: string) {
        this.activeMemberIdChange.emit(value || '');
    }

    setOverdue(value: boolean) {
        this.activeOverdueChange.emit(value);
    }

    clearAll() {
        this.filterChange.emit('');
        this.activeLabelChange.emit('');
        this.activeMemberIdChange.emit('');
        this.activeOverdueChange.emit(false);
        this.closeAllDropdowns();
        this.closeMobileDropdowns();
    }
}
