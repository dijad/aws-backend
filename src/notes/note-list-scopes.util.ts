import { NoteStatus } from '@prisma/client';
import { NoteListScope } from '../notifications/note-sync.types';

/** List/sync scopes to clear when a note is soft-deleted. */
export function noteListScopesForSync(note: {
  status: NoteStatus;
  mentions: { userId: string }[];
  recipients: { userId: string }[];
}): NoteListScope[] {
  const scopes = new Set<NoteListScope>(['mine']);
  if (note.status === 'PENDING') scopes.add('pending');
  if (note.status === 'APPROVED') {
    scopes.add('approved');
    scopes.add('mentions');
    scopes.add('received');
  }
  if (note.status === 'REJECTED') scopes.add('rejected');
  return [...scopes];
}
