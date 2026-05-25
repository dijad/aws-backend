/** Scopes aligned with GET /notes?scope=… and approval tabs. */
export const NOTE_LIST_SCOPES = [
  'mine',
  'mentions',
  'received',
  'pending',
  'approved',
  'rejected',
] as const;

export type NoteListScope = (typeof NOTE_LIST_SCOPES)[number];

export interface NoteSyncPayload {
  note: unknown;
  add: NoteListScope[];
  remove: NoteListScope[];
}

export interface NoteSyncOptions {
  note: unknown;
  add?: NoteListScope[];
  remove?: NoteListScope[];
}
