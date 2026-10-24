// Fixed imports keep all clients on the same deterministic scene schema.
import {profile as naraProfile} from './nara/profile.mjs';
import {sample as naraSample} from './nara/motion.mjs';
import {createProps as naraProps} from './nara/props.mjs';
import {profile as soraProfile} from './sora/profile.mjs';
import {sample as soraSample} from './sora/motion.mjs';
import {createProps as soraProps} from './sora/props.mjs';
import {profile as junProfile} from './jun/profile.mjs';
import {sample as junSample} from './jun/motion.mjs';
import {createProps as junProps} from './jun/props.mjs';
import {profile as minProfile} from './min/profile.mjs';
import {sample as minSample} from './min/motion.mjs';
import {createProps as minProps} from './min/props.mjs';
import {profile as leoProfile} from './leo/profile.mjs';
import {sample as leoSample} from './leo/motion.mjs';
import {createProps as leoProps} from './leo/props.mjs';
export const registry=Object.freeze({nara:Object.freeze({profile:naraProfile,sample:naraSample,createProps:naraProps}),sora:Object.freeze({profile:soraProfile,sample:soraSample,createProps:soraProps}),jun:Object.freeze({profile:junProfile,sample:junSample,createProps:junProps}),min:Object.freeze({profile:minProfile,sample:minSample,createProps:minProps}),leo:Object.freeze({profile:leoProfile,sample:leoSample,createProps:leoProps})});
