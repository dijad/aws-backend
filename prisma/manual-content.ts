/** TipTap JSON builders for seeding User Manual documents. */

type TNode = Record<string, unknown>;

function t(text: string, marks?: { type: string }[]): TNode {
  const node: TNode = { type: 'text', text };
  if (marks?.length) node.marks = marks;
  return node;
}

function paragraph(...nodes: TNode[]): TNode {
  return { type: 'paragraph', content: nodes };
}

function p(text: string): TNode {
  return paragraph(t(text));
}

function h(level: 2 | 3, text: string): TNode {
  return { type: 'heading', attrs: { level }, content: [t(text)] };
}

function bullet(items: string[]): TNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [p(item)],
    })),
  };
}

function ordered(items: string[]): TNode {
  return {
    type: 'orderedList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [p(item)],
    })),
  };
}

function doc(...blocks: TNode[]): { contentJson: TNode; contentText: string } {
  const contentJson: TNode = { type: 'doc', content: blocks };
  const contentText = blocks
    .flatMap((b) => extractText(b))
    .filter(Boolean)
    .join('\n\n');
  return { contentJson, contentText };
}

function extractText(node: TNode): string[] {
  if (node.type === 'text' && typeof node.text === 'string') return [node.text];
  if (Array.isArray(node.content)) {
    return node.content.flatMap((c) => extractText(c as TNode));
  }
  return [];
}

export interface ManualDocSeed {
  slug: string;
  title: string;
  contentJson: TNode;
  contentText: string;
}

export const GLOBAL_NOTES_MANUAL_DOCS: ManualDocSeed[] = [
  {
    slug: 'overview',
    title: 'Overview — What is AWS Workspace Notes?',
    ...doc(
      p(
        'AWS Workspace Notes is the application for sharing internal knowledge, coordinating approvals on notes, and managing system change requests (bug fixes and enhancements). Everything lives under the Notes and Requests areas in the left sidebar.',
      ),
      h(2, 'Purpose'),
      bullet([
        'Capture team knowledge and announcements as rich-text notes with @mentions and explicit recipients.',
        'Route notes through an approval step so only reviewed content is distributed.',
        'Submit structured change requests (System updates) that pass Developer and Administrator review before implementation.',
        'Maintain a living User Manual (this section) with searchable, publishable documentation.',
        'Notify people in real time when something needs their attention.',
      ]),
      h(2, 'Who uses it'),
      bullet([
        'Administrator — full access: users, roles, approvals, reviews, manual publishing, and all notes/requests.',
        'Project Manager — creates notes and system update requests; cannot approve notes or perform dev/admin review unless granted extra permissions.',
        'Developer — creates notes and requests, reviews requests as Developer, edits the manual, and marks approved work as completed.',
      ]),
      h(2, 'Main areas (sidebar)'),
      bullet([
        'User manual — standalone link; documentation you are reading now.',
        'Notes — Notes list and Approve notes (if you have approval permission).',
        'Requests — System updates list and Review inbox (for reviewers).',
        'Administration — Users and Roles & permissions (admins only).',
      ]),
      p(
        'Use the notification bell in the page header to jump directly to a note or request when you receive an alert.',
      ),
    ),
  },
  {
    slug: 'notes',
    title: 'Notes — Create, filter, and track',
    ...doc(
      p(
        'Notes are rich-text messages for internal communication. Every new note starts in Pending status until someone with approval rights approves or rejects it.',
      ),
      h(2, 'Opening Notes'),
      p('Go to Notes → Notes (or /global-notes). The list shows cards with author, title, excerpt, status badge, and any @mentions or recipients.'),
      h(2, 'List filters (tabs)'),
      bullet([
        'My notes — notes you authored.',
        'Mentioned — notes where you were @mentioned in the body (type @ in the editor to tag someone).',
        'Received — notes where you were added as a recipient (separate from mentions; used for distribution after approval).',
        'All — every note you are allowed to see (typically broader visibility for admins/approvers).',
      ]),
      h(2, 'Creating a note'),
      ordered([
        'Click New note (requires NOTE_CREATE).',
        'Enter a title (max 160 characters).',
        'Write content in the rich editor. Type @ followed by a name to mention users; mentioned users can be notified when the note is approved.',
        'Type # to cite another note inside the content. Select it from the suggestion list to insert a clickable #NoteTitle reference.',
        'Under Recipients, select one or more users who should receive the note after approval (multi-select). Recipients are not the same as mentions: mentions highlight people in the text; recipients define who gets the note in their Received tab.',
        'Click Submit for approval. The note stays Pending until reviewed.',
      ]),
      h(2, 'Link notes inside notes (#)'),
      ordered([
        'In the note editor, type # and then part of a note title.',
        'Choose a result from the dropdown with arrow keys + Enter, or click it.',
        'The reference is inserted as a #label token and rendered as a clickable link in note detail.',
        'When someone opens the note, they can click that #reference to navigate directly to the linked note.',
      ]),
      p(
        'Use #references to connect context between related notes (for example: decision note -> implementation note -> follow-up note).',
      ),
      h(2, 'Note statuses'),
      bullet([
        'Pending — awaiting approval; author can still open the note and add comments.',
        'Approved — visible to recipients and mentioned users; notifications are sent on approval.',
        'Rejected — author sees a rejection reason (private to the author); only they receive that feedback via a special comment type.',
      ]),
      h(2, 'Note detail page'),
      p('Open any card to see full content, author, timestamps, mentions, recipients, status, and a comment thread. The detail view is now split into clear sections: header, participants (mentions/recipients), content panel, actions, and comments. The author or an approver can add general comments. Rejection reasons appear highlighted in red and are labeled Rejection reason.'),
      h(2, 'Tips'),
      bullet([
        'Use mentions when you want someone referenced in the text; use recipients when you want them to reliably see the note after approval.',
        'Keep titles specific so approvers can scan the approvals queue quickly.',
        'Check Mentioned and Received tabs daily if you are not the author but need to stay informed.',
      ]),
    ),
  },
  {
    slug: 'approve-notes',
    title: 'Approve notes — Review queue',
    ...doc(
      p(
        'Users with the NOTE_APPROVE_REJECT permission see Approve notes under the Notes group. This is the operational queue for pending notes.',
      ),
      h(2, 'Queues'),
      bullet([
        'Pending — only notes waiting for a decision. Each card can show Approve and Reject actions without opening the detail page.',
        'All — full list of notes (same data as the main Notes page with scope=all) for context and history.',
      ]),
      h(2, 'Approving'),
      ordered([
        'Open Approve notes → Pending, or open a note detail while it is Pending.',
        'Read title, body, mentions, and recipients.',
        'Click Approve. The status becomes Approved; tagged users and recipients are notified.',
      ]),
      h(2, 'Rejecting'),
      ordered([
        'Click Reject on a card or on the detail page.',
        'Enter a mandatory rejection reason in the dialog. This reason is only visible to the author (stored as a REJECTION_REASON sub-note).',
        'Confirm Reject. The note status becomes Rejected; the author is notified.',
      ]),
      h(2, 'After decision'),
      p(
        'Approved notes appear in recipients’ Received tab and in Mentioned for @tagged users. Rejected notes remain visible to the author with the rejection reason. Approvers and the author can still add normal comments on the detail page when permitted.',
      ),
    ),
  },
  {
    slug: 'system-updates',
    title: 'System updates — Change requests',
    ...doc(
      p(
        'System updates are formal requests for bug fixes or enhancements. Each request is tied to a module (AWS Workspace Notes), has a type, priority, and description, and moves through Developer then Administrator review.',
      ),
      h(2, 'Opening System updates'),
      p('Go to Requests → System updates. Use All to see every request you can access, or Mine for requests you submitted.'),
      h(2, 'Search'),
      p('The search box filters the current list by title, description, module name, or requester name (client-side).'),
      h(2, 'Creating a request'),
      ordered([
        'Click New request (requires SYSTEM_UPDATE_CREATE).',
        'Type: Bug fix or Enhancement.',
        'Module: select AWS Workspace Notes (the product area affected).',
        'Title: short summary (max 160 characters).',
        'Priority: Low, Medium, High, or Critical.',
        'Description: steps to reproduce, expected behavior, business justification, or acceptance criteria.',
        'Submit. Status starts as Pending.',
      ]),
      h(2, 'Request detail'),
      p('Open a card to see full metadata, status badge, priority, type, comments, and review actions (depending on your role and the current status). Anyone involved can add normal comments; rejection reasons are stored separately and labeled.'),
      h(2, 'Status lifecycle'),
      ordered([
        'Pending — waiting for Developer review.',
        'DEV_APPROVED — Developer approved; waiting for Administrator review.',
        'DEV_REJECTED — Developer rejected (reason required).',
        'ADMIN_APPROVED — both reviews passed; ready for implementation.',
        'ADMIN_REJECTED — Administrator rejected (reason required).',
        'COMPLETED — Developer marked work done; a changelog entry is created for the module.',
      ]),
      h(2, 'Notifications'),
      p('Requesters and reviewers receive notifications on key transitions (new request, dev/admin approve or reject, completed). Use the bell icon or the Notifications page to open the linked request.'),
    ),
  },
  {
    slug: 'review-inbox',
    title: 'Review inbox — Dev and Admin workflow',
    ...doc(
      p(
        'Review inbox is for users with SYSTEM_UPDATE_REVIEW_AS_DEV and/or SYSTEM_UPDATE_REVIEW_AS_ADMIN. It centralizes requests that need action or tracking after review.',
      ),
      h(2, 'Tabs'),
      bullet([
        'To review — items in your inbox that still need a review action (scope=inbox).',
        'Ready to implement — approved by both Dev and Admin (ADMIN_APPROVED); waiting for a Developer to mark completed.',
        'Completed — finished requests; changelog entries are generated for the module.',
        'Rejected — requests rejected at Dev or Admin stage.',
      ]),
      h(2, 'Developer review (PENDING)'),
      p('On a Pending request, a Developer can Approve (moves to DEV_APPROVED) or Reject with a reason (DEV_REJECTED). Only users with SYSTEM_UPDATE_REVIEW_AS_DEV see these actions when status is Pending.'),
      h(2, 'Administrator review'),
      p('An Administrator can review when status is Pending or DEV_APPROVED. Approve moves toward ADMIN_APPROVED; Reject sets ADMIN_REJECTED. Admin can reject even after Dev approval if the change should not proceed.'),
      h(2, 'Complete (implementation done)'),
      ordered([
        'When status is ADMIN_APPROVED, a Developer uses Mark as completed on the request detail.',
        'Status becomes COMPLETED and completedAt is set.',
        'A changelog entry is auto-created on the AWS Workspace Notes module (visible on the manual module page sidebar).',
      ]),
      h(2, 'Best practices'),
      bullet([
        'Use Critical priority only for production outages or security issues.',
        'Put reproduction steps in the description for bug fixes.',
        'For enhancements, describe user benefit and scope so Admin review is fast.',
        'Use comments for clarification; use Reject with a clear reason when sending back.',
      ]),
    ),
  },
];
