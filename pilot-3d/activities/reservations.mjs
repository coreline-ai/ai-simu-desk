// Atomic claims: a caller either owns every requested resource or none.
export class Reservations {
  owners = new Map();
  waiting = [];
  acquire(actor, resources) {
    if (resources.some(key => this.owners.has(key) && this.owners.get(key) !== actor)) return false;
    for (const key of resources) this.owners.set(key, actor);
    return true;
  }
  request(actor,resources,priority=1){
    if(!this.waiting.some(q=>q.actor===actor))this.waiting.push({actor,resources:[...resources],priority});
    const eligible=this.waiting.filter(q=>q.resources.every(k=>!this.owners.has(k)||this.owners.get(k)===q.actor)).sort((a,b)=>a.priority-b.priority)[0];
    if(eligible?.actor!==actor)return false;this.waiting=this.waiting.filter(q=>q.actor!==actor);return this.acquire(actor,resources);
  }
  releaseKeys(actor,keys){for(const key of keys)if(this.owners.get(key)===actor)this.owners.delete(key);}
  transfer(from,to,keys){if(!keys.every(key=>this.owners.get(key)===from))return false;for(const key of keys)this.owners.set(key,to);return true;}
  release(actor) { this.waiting=this.waiting.filter(q=>q.actor!==actor); for (const [key, owner] of this.owners) if (owner === actor) this.owners.delete(key); }
  snapshot() { return Object.fromEntries(this.owners); }
  clear() { this.owners.clear(); this.waiting=[]; }
}
