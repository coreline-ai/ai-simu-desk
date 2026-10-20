export interface Comment {id:string;runId:string;authorId:string;name:string;body:string;createdAt:Date}
export interface Inbox {items:{id:string;runId:string;kind:'approval_requested'|'completed'|'failed'|'comment';prompt:string;readAt:Date|null;createdAt:Date}[];unread:number}
