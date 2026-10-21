import {ease} from '../sample/motion.mjs';
export const ROLE_VARIANTS={nara:['기획 메모','메모 다시 읽기','핵심에 밑줄'],sora:['태블릿 스케치','방향을 바꿔 스케치','화면과 스케치 비교'],jun:['코드 화면 설명','다른 코드 영역 설명','손을 내리고 화면 확인'],min:['체크리스트 확인','항목별 체크','앞 항목 재확인'],leo:['문서 정리','문서 모서리 정렬','문서 들어 내용 확인']};
export function roleVariation(id,variant,t){const phase=t%2.4,pause=phase>1.4,stroke=phase<1.2?ease(phase/1.2):phase<1.6?1:1-ease((phase-1.6)/.5),lift=phase<1.2?0:phase<1.6?.014*ease((phase-1.2)/.4):phase<2.1?.014:.014*(1-ease((phase-2.1)/.3));
 if(!variant)return{};
 if(id==='nara')return variant===1?{x:Math.sin(phase*5)*.012*ease(phase/.15)*(1-ease((phase-1.2)/.3)),z:0,reading:pause}:{x:-.035+.07*stroke,z:.016,lift,reading:pause};
 if(id==='sora')return variant===1?{x:-.028+.056*stroke,z:-.024+.048*stroke,lift}:{x:-.024+.048*stroke,z:Math.sin(stroke*Math.PI)*.012,lift,reading:pause};
 if(id==='min'){const q=t/1.35,index=Math.floor(q),order=variant===1?[0,1,2,3]:[0,1,0,2],a=order[Math.max(0,index-1)%4],b=order[index%4],u=ease((q%1)/.3);return{x:Math.sin(t*6)*.009,z:(a+(b-a)*u)*.025,lift:.012*Math.sin(Math.PI*u),reading:pause};}
 if(id==='jun')return variant===1?{x:Math.sin(t*1.4)*.045,y:.025,z:.012}:{x:0,y:-.08*Math.sin(Math.PI*Math.min(1,t/5.4)),z:-.05*Math.sin(Math.PI*Math.min(1,t/5.4)),reading:true};
 return variant===1?{x:Math.sin(t*1.5)*.018,y:-.035,z:.01}:{x:Math.sin(t*.7)*.018,y:.045*Math.sin(Math.PI*Math.min(1,t/5.4)),z:-.025,reading:true};
}
