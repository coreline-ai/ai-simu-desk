import {createRemote} from "../server/remote.js";
let runtime:ReturnType<typeof createRemote>|undefined;
export default {
  async fetch(request:Request):Promise<Response> {
    try {
      const ready=await(runtime??=createRemote().catch(error=>{runtime=undefined;throw error;}));
      return await ready.app.fetch(request);
    } catch {
      // Never expose connection strings, credentials or provider startup errors.
      return Response.json({error:"원격 서버 설정 또는 DB 연결을 확인해 주세요.",code:"SERVICE_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
    }
  },
};
