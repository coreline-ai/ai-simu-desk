import{lstat}from'node:fs/promises';
export async function assertMutableOutput(){
 const output=await lstat('product/dist').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(output?.isSymbolicLink())throw new Error('Managed release files are immutable. Build all pages safely with npm run build:product, or run the standalone builder in an isolated workspace.');
}
