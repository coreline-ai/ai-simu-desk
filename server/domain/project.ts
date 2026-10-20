import {AppError} from './contracts.js';
export const TASK_TEMPLATES = [
 {id:'plan',name:'기획안 만들기',agentId:'nara',prompt:'첫 화면 개선 계획을 2주, 1명, 무료 도구 조건으로 3개 항목으로 제안해 줘.'},
 {id:'build',name:'개발 계획 검토',agentId:'jun',prompt:'로그인과 DB 연결 개발 계획을 구현 순서와 검증 기준을 포함해 4개 항목으로 만들어 줘.'},
 {id:'copy',name:'안내 문구 초안',agentId:'nara',prompt:'서비스를 처음 사용하는 사람을 위한 안내 문구의 제목과 본문 초안을 작성해 줘.'},
] as const;
export interface ProjectSettings {workspaceId:string;version:number;goal:string;audience:string;technology:string;exclusions:string;updatedAt?:Date}
export function parseProject(value:unknown) {
 const v=value as Record<string,unknown>;
 if(!v||!Number.isSafeInteger(v.version)||Number(v.version)<0)throw new AppError(400,'설정 버전을 확인해 주세요.');
 const out={} as Record<'goal'|'audience'|'technology'|'exclusions',string>;
 for(const key of ['goal','audience','technology','exclusions'] as const){
  if(typeof v[key]!=='string'||v[key].length>300)throw new AppError(400,'프로젝트 조건은 항목당 300자 이내로 입력해 주세요.');
  out[key]=v[key].trim();
 }
 return {...out,version:Number(v.version)};
}
