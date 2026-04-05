export interface ConceptVoteStore {
  toggle(conceptFile: string, browserId: string): Promise<Record<string, string[]>>;
  getAll(): Promise<Record<string, string[]>>;
}
