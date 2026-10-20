const separator = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
const cells = line => line.trim().replace(/^\||\|$/g,"").split("|").map(s=>s.trim());
export function answerBlocks(text) {
  const lines=text.split("\n"),blocks=[];let plain=[];
  const flush=()=>{if(plain.length){blocks.push({type:"text",text:plain.join("\n")});plain=[];}};
  for(let i=0;i<lines.length;i++){
    if(lines[i].includes("|")&&separator(lines[i+1]??"")){
      flush();const header=cells(lines[i]),rows=[];i++;
      while(i+1<lines.length&&lines[i+1].includes("|")&&!separator(lines[i+1])){
        const row=cells(lines[i+1]);if(row.length!==header.length)break;rows.push(row);i++;
      }
      blocks.push({type:"table",header,rows});
    }else plain.push(lines[i]);
  }
  flush();return blocks;
}
const rendered=new WeakMap();
export function renderAnswer(host,text) {
  if(rendered.get(host)===text)return;
  rendered.set(host,text);
  const fragment=document.createDocumentFragment();
  for(const block of answerBlocks(text)){
    if(block.type==="text"){const section=document.createElement("div");section.className="answer-prose";section.textContent=block.text;fragment.append(section);continue;}
    const wrap=document.createElement("div");wrap.className="answer-table-wrap";wrap.tabIndex=0;wrap.setAttribute("role","region");wrap.setAttribute("aria-label","업무 결과 표");
    const table=document.createElement("table"),head=document.createElement("thead"),header=document.createElement("tr"),body=document.createElement("tbody");
    for(const value of block.header){const cell=document.createElement("th");cell.scope="col";cell.textContent=value;header.append(cell);}
    head.append(header);table.append(head,body);
    for(const values of block.rows){const row=document.createElement("tr");for(const value of values){const cell=document.createElement("td");cell.textContent=value;row.append(cell);}body.append(row);}
    wrap.append(table);fragment.append(wrap);
  }
  host.replaceChildren(fragment);
}
