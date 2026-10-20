import {build} from 'esbuild';
import {mkdir,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';

const output='product/dist';
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const page=(title,content)=>'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title)+' · AI Simu Desk</title><link rel="stylesheet" href="/assets/start.css"></head><body><header class="site-header"><a class="brand" href="/start">▥ &nbsp;simu<span>desk</span></a><nav><a href="/">내 스튜디오 ↗</a></nav></header><main class="library">'+content+'</main><footer>AI SIMU DESK · DEVELOPMENT LIBRARY</footer></body></html>';

export async function buildLibrary(remote=false){
  let hub=await readFile('product/public/start.html','utf8');
  if(remote)hub=hub.replace('현재는 이 컴퓨터의 로컬 웹으로 실행 중입니다. 외부 기기에서 접속하는 공개 HTTPS 주소는 Vercel 프로젝트와 PostgreSQL 연결 후 제공할 수 있어요.','이 서버에 연결된 제품과 시각 데모를 둘러볼 수 있어요. 원격 실행 환경과 배포 설정은 아래 안내에서 확인하세요.');
  await writeFile(output+'/start.html',hub);
  await copyFile('product/public/start.css',output+'/assets/start.css');
  await mkdir(output+'/library',{recursive:true});
  let groups='';
  for(const [folder,label] of [['docs','분석과 기능별 검증'],['dev-plan','단계별 개발 계획'],['prompts','데모·에셋 생성 프롬프트']]){
    const paths=(await readdir(folder,{withFileTypes:true})).filter(entry=>entry.isFile()&&entry.name.endsWith('.md')).map(entry=>entry.name).sort();
    await mkdir(output+'/library/'+folder,{recursive:true});
    let entries='';
    for(const name of paths){
      const source=await readFile(folder+'/'+name,'utf8');
      const title=source.match(/^#\s+(.+)$/m)?.[1]??name;
      const target=name.replace(/\.md$/,'.html');
      await writeFile(output+'/library/'+folder+'/'+target,page(title,'<a class="back" href="/library/">← 개발 기록 목록</a><h1>'+escape(title)+'</h1><p class="caption">원본 문서 · '+escape(folder+'/'+name)+'</p><pre>'+escape(source)+'</pre>'));
      entries+='<li><a href="/library/'+folder+'/'+target+'">'+escape(title)+' ↗</a></li>';
    }
    // Asset prompts are plain text files and are also safe to show as escaped source.
    if(folder==='prompts'){
      await mkdir(output+'/library/prompts/assets',{recursive:true});
      for(const name of (await readdir('prompts/assets')).filter(name=>name.endsWith('.txt')).sort()){
        const target=name.replace(/\.txt$/,'.html');
        const source=await readFile('prompts/assets/'+name,'utf8');
        await writeFile(output+'/library/prompts/assets/'+target,page(name,'<a class="back" href="/library/">← 개발 기록 목록</a><h1>'+escape(name)+'</h1><pre>'+escape(source)+'</pre>'));
        entries+='<li><a href="/library/prompts/assets/'+target+'">에셋 프롬프트 · '+escape(name)+' ↗</a></li>';
      }
    }
    groups+='<section><h2>'+label+'</h2><ul>'+entries+'</ul></section>';
  }
  await writeFile(output+'/library/index.html',page('개발 기록','<a class="back" href="/start">← 전체 둘러보기</a><p class="eyebrow">FROM IDEA TO WORKING SPACE</p><h1>스튜디오를 만들어온 기록</h1><p>분석·계획·검증 문서와 생성 프롬프트의 원본을 모았습니다. 문서별 작성 시점에 따라 이전 버전의 설명이 포함되어 있어요.</p>'+groups));
  for(const folder of ['demo','pilot-3d']){
    const dest=output+'/demos/'+folder;
    await mkdir(dest+'/assets',{recursive:true});
    for(const name of await readdir(folder+'/assets')){
      if(!/\.(png|glb|json|txt)$/.test(name)||/candidate|atlas-v1/.test(name))continue;
      await copyFile(folder+'/assets/'+name,dest+'/assets/'+name);
    }
    await copyFile(folder+'/styles.css',dest+'/styles.css');
    let html=await readFile(folder+'/index.html','utf8');
    html=html.replaceAll('../demo/preview.html','../demo/').replace('../docs/3d-pilot-qa.md','/library/docs/3d-pilot-qa.html');
    if(folder==='demo')html=html.replace('./src/app.mjs','./src/app.js').replace('<div class="topbar-right">','<div class="topbar-right"><a class="quiet-button" href="/start">전체 둘러보기 ↗</a>');
    else html=html.replace('<nav aria-label="데모 탐색">','<nav aria-label="데모 탐색"><a href="/start">전체 둘러보기 ↗</a>');
    await writeFile(dest+'/index.html',html);
    await build({entryPoints:[folder+'/src/app.mjs'],outfile:dest+(folder==='demo'?'/src/app.js':'/dist/app.js'),bundle:true,format:'esm',minify:true,target:['es2022'],legalComments:'linked'});
  }
}
