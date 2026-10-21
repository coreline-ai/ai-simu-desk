export const GUEST_ID='simu-desk-public-guest';
export const GUEST_PREFIX='simu-desk-guest-';
export const GUEST_LIMIT=5,GUEST_TTL_MS=2*60*60*1000;
export const isGuestId=(id:string)=>id===GUEST_ID||id.startsWith(GUEST_PREFIX);
