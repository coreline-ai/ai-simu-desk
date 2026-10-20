// Bounded line comparison; whitespace is preserved and content stays text-only.
export function compareLines(before,after) {
 const a=before.split('\n').slice(0,400),b=after.split('\n').slice(0,400);
 const lengths=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)lengths[i][j]=a[i]===b[j]?lengths[i+1][j+1]+1:Math.max(lengths[i+1][j],lengths[i][j+1]);
 const left=[],right=[];let i=0,j=0;
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){left.push({text:a[i++],changed:false});right.push({text:b[j++],changed:false});}
  else if(i<a.length&&(j===b.length||lengths[i+1][j]>=lengths[i][j+1]))left.push({text:a[i++],changed:true});
  else right.push({text:b[j++],changed:true});
 }
 return {left,right,removed:left.filter(l=>l.changed).length,added:right.filter(l=>l.changed).length,truncated:before.split('\n').length>400||after.split('\n').length>400};
}
