import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {Activity} from "../types";

@Injectable({ providedIn: 'root' })
export class ActivityService {
    constructor(private http: HttpClient) { }

    async getBoardActivity(boardId: string, limit = 20, offset = 0): Promise<Activity[]> {
        return firstValueFrom(
            this.http.get<Activity[]>(`/api/boards/${boardId}/activity`, {
                params: { limit, offset }
            })
        );
    }
}
