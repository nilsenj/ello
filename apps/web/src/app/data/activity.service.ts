import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Activity } from "../types";

import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class ActivityService {
    constructor(private api: ApiBaseService) { }

    async getBoardActivity(boardId: string, limit = 20, offset = 0): Promise<Activity[]> {
        return this.api.get<Activity[]>(`/api/boards/${boardId}/activity?limit=${limit}&offset=${offset}`);
    }
}
