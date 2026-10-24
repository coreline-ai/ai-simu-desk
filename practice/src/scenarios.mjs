export const ACTORS=Object.freeze(['nara','sora','jun','min','leo']);
export const SPEEDS=Object.freeze([.5,1,1.5,2]);
export const CATEGORIES=Object.freeze({all:'전체',work:'업무',together:'협업',rest:'휴식',day:'하루 흐름'});
// Add declarative entries here; executable actions stay in the small allowlist below.
export const SCENARIOS=Object.freeze([
 {id:'roles',label:'각자의 업무',group:'work',quick:true,summary:'다섯 동료가 각자의 리듬으로 일합니다.'},
 {id:'cup',label:'선택 동료의 커피',group:'rest',quick:true,summary:'책상에서 컵을 들고 마신 뒤 제자리에 놓습니다.'},
 {id:'daily',label:'자유로운 하루',group:'day',quick:true,summary:'업무·이동·대화·휴식을 자율적으로 이어갑니다.'},
 {id:'role',label:'선택 동료의 업무',group:'work',summary:'한 동료의 생각·작업·확인 리듬을 살펴봅니다.'},
 {id:'pair',label:'둘이 소파에서 대화',group:'together',summary:'선택 동료와 상대가 소파로 이동해 대화하고 돌아옵니다.',peer:true},
 {id:'meeting',label:'짧은 팀 회의',group:'together',summary:'선택 동료를 포함한 세 명이 모여 진행 상황을 확인합니다.'},
 {id:'board',label:'함께 보드 검토',group:'together',summary:'다섯 동료가 보드 앞에서 검토하고 자리로 돌아옵니다.'},
 {id:'visit',label:'동료에게 자료 전달',group:'together',summary:'상대의 자리로 찾아가 자료를 전하고 복귀합니다.',peer:true},
 {id:'window',label:'창가에서 생각 정리',group:'rest',summary:'선택 동료가 창가에서 잠시 쉬고 업무 자리로 돌아옵니다.'},
 {id:'rest',label:'가벼운 스트레칭',group:'rest',summary:'선택 동료가 자신의 스타일로 몸과 손목을 풉니다.'},
 {id:'glasses',label:'준의 안경 정돈',group:'work',summary:'준이 안경 테를 고쳐 쓰고 손을 편하게 내립니다.',fixed:'jun'},
 {id:'focus',label:'집중하는 오전',group:'day',summary:'각자 업무 → 3인 회의 → 짧은 휴식 → 업무 복귀',sequence:'focus'},
 {id:'review',label:'함께 검토하는 오후',group:'day',summary:'초안 작업 → 4인 회의 → 보드 검토 → 결과 정리',sequence:'review'},
 {id:'break',label:'커피와 재충전',group:'day',summary:'스트레칭 → 커피 순환 → 소파·창가 휴식 → 업무 복귀',sequence:'break'}
].map(row=>Object.freeze(row)));
export function selectionFor(id,actor='nara',peer='jun'){
 const entry=SCENARIOS.find(s=>s.id===id);if(!entry)throw Error('지원하지 않는 시나리오입니다.');
 if(!ACTORS.includes(actor)||!ACTORS.includes(peer)||entry.peer&&actor===peer)throw Error('서로 다른 두 동료를 선택해 주세요.');
 const participants=entry.fixed?[entry.fixed]:entry.peer?[actor,peer]:['roles','daily','board'].includes(id)||entry.sequence?[...ACTORS]:id==='meeting'?[actor,...ACTORS.filter(p=>p!==actor)].slice(0,3):[actor];
 return Object.freeze({entry,actor:entry.fixed??actor,peer,participants:Object.freeze(participants)});
}
export function launch(s,selection){
 const {entry,actor,peer,participants}=selection;
 if(entry.sequence)return s.startScenario(entry.sequence);
 switch(entry.id){
  case 'daily':return s.startDemo();
  case 'roles':return ACTORS.map(id=>s.startRole(id,{variant:s.personalities?.variantFor(id)})).every(Boolean);
  case 'role':return s.startRole(actor,{variant:s.personalities?.variantFor(actor)});
  case 'cup':return s.startCup(actor);
  case 'pair':return s.startSofaPair([actor,peer]);
  case 'meeting':return s.startMeeting([...participants]);
  case 'board':return s.startReview([...participants]);
  case 'visit':return s.startVisit(actor,peer,{transfer:true});
  case 'window':return s.startWindow(actor);
  case 'rest':return s.startRest(actor);
  case 'glasses':return s.personalMotion?.glasses.start()??false;
  default:return false;
 }
}
export function settled(s){return ACTORS.every(id=>s.idle(id))&&!s.personalMotion?.glasses.active&&!s.scenario?.current&&!s.personalities?.pending.size;}
export class ScenarioPlayer{
 constructor(s,onChange=()=>{}){this.s=s;this.onChange=onChange;this.phase='idle';this.current=null;this.pending=null;this.lastSelection=null;this.error='';this.returnAt=0;this.key='';this.disposed=false;}
 snapshot(){const sequence=this.current?.entry.sequence?this.s.scenario?.current:null;return{phase:this.phase,id:this.current?.entry.id??null,pending:this.pending?.entry.id??null,label:this.current?.entry.label??'업무 자리',participants:[...(this.current?.participants??[])],step:sequence?sequence.index+1:null,total:sequence?4:null,stage:sequence?.stage??null,error:this.error,canRestart:!!this.lastSelection};}
 emit(){const state=this.snapshot(),key=JSON.stringify(state);if(key!==this.key){this.key=key;this.onChange(state);}}
 returnHome(){if(this.phase!=='returning'){this.s.setAuto(false);this.s.cancelAll();this.phase='returning';this.returnAt=this.s.time;}this.emit();}
 request(id,actor,peer){if(this.disposed)return false;const next=selectionFor(id,actor,peer);this.pending=next;this.lastSelection=next;this.error='';this.returnHome();this.tick();return true;}
 stop(){if(this.disposed)return;this.pending=null;this.error='';this.returnHome();this.tick();}
 restart(){const saved=this.lastSelection;if(!saved||this.disposed)return false;return this.request(saved.entry.id,saved.actor,saved.peer);}
 tick(){
  if(this.disposed)return;
  if(this.phase==='returning'){
   if(!settled(this.s)){if(this.s.time-this.returnAt>180)this.error='복귀가 지연되고 있습니다. 강제 이동하지 않고 정리를 기다립니다.';this.emit();return;}
   this.current=null;
   if(!this.pending){this.phase=this.error?'error':'idle';this.emit();return;}
   const next=this.pending;this.pending=null;this.current=next;this.phase='playing';
   let ok=false;try{ok=launch(this.s,next);}catch{ok=false;}
   if(!ok){this.error='시작 조건이 맞지 않아 활동을 정리합니다. 복귀 후 다시 시작해 주세요.';this.returnHome();return;}
  }else if(this.phase==='playing'&&this.current?.entry.id!=='daily'&&settled(this.s)){
   this.phase='complete';
  }
  this.emit();
 }
 dispose(){this.disposed=true;this.pending=null;this.onChange=()=>{};}
}
