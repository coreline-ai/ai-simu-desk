import type {Config} from "./config.js";
import type {StudioDatabase} from "./db/types.js";
import {createStudio} from "./db/studio-store.js";
import {createSharedPresence} from "./db/shared-presence.js";
import {createAuth} from "./adapters/auth.js";
import {composeFakeAnswer} from "./adapters/fake-ai.js";
import {createHttp} from "./http.js";
import {createSceneStore} from './db/scene-store.js';

// Both hosts use the same request-driven execution and persistent presence.
// Only connection provisioning and the HTTP listener belong to the host.
export function createRuntime(database:StudioDatabase,config:Config) {
  const studio=createStudio(database,{answer:composeFakeAnswer,delayMs:config.fakeDelayMs});
  const app=createHttp(createAuth(database,config),config,studio,()=>{},createSharedPresence(database),undefined,createSceneStore(database));
  app.get("/api/worker-health",c=>c.json({status:"ok",provider:"fake",execution:"request-driven"}));
  return app;
}
