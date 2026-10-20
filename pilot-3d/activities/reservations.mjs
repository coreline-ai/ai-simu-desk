// Atomic claims: a caller either owns every requested resource or none.
export class Reservations {
  owners = new Map();
  acquire(actor, resources) {
    if (resources.some(key => this.owners.has(key) && this.owners.get(key) !== actor)) return false;
    for (const key of resources) this.owners.set(key, actor);
    return true;
  }
  release(actor) { for (const [key, owner] of this.owners) if (owner === actor) this.owners.delete(key); }
  snapshot() { return Object.fromEntries(this.owners); }
  clear() { this.owners.clear(); }
}
