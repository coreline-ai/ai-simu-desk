import{createRequire}from'node:module';import{homedir}from'node:os';import{join}from'node:path';import{existsSync}from'node:fs';
const require=createRequire(import.meta.url);
export async function launchBrowser(){
 let playwright;try{playwright=require('playwright');}catch{playwright=require(process.env.STUDIO_PLAYWRIGHT_PATH??join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
 const executablePath=process.env.STUDIO_CHROME_PATH??(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
 return playwright.chromium.launch({headless:true,chromiumSandbox:true,...(executablePath?{executablePath}:{})});
}
export const qaOrigin=process.env.STUDIO_QA_ORIGIN??'http://127.0.0.1:4191';
