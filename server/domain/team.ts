export const TEAM = [
 {id:'nara',name:'나라',role:'기획',prefix:'Nara',color:'#86a27d'},
 {id:'sora',name:'소라',role:'디자인',prefix:'Sora',color:'#bc8c74'},
 {id:'jun',name:'준',role:'개발',prefix:'Jun',color:'#607e91'},
 {id:'min',name:'민',role:'QA',prefix:'Min',color:'#9682ac'},
 {id:'leo',name:'레오',role:'정리',prefix:'Leo',color:'#c59c58'},
] as const;
export type TeamId=typeof TEAM[number]['id'];
export const TEAM_NAMES=Object.fromEntries(TEAM.map(p=>[p.id,p.name])) as Record<TeamId,string>;
