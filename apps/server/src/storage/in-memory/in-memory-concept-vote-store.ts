import type { ConceptVoteStore } from "../interfaces/concept-vote-store.js";

export class InMemoryConceptVoteStore implements ConceptVoteStore {
  private votes = new Map<string, Set<string>>();

  async toggle(conceptFile: string, browserId: string): Promise<Record<string, string[]>> {
    const set = this.votes.get(conceptFile) ?? new Set();
    if (set.has(browserId)) set.delete(browserId);
    else set.add(browserId);
    this.votes.set(conceptFile, set);
    return this.getAll();
  }

  async getAll(): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};
    for (const [k, v] of this.votes) {
      if (v.size > 0) result[k] = [...v];
    }
    return result;
  }
}
