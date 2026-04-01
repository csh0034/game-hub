import type { PlacardStore } from "../interfaces/placard-store.js";

export class InMemoryPlacardStore implements PlacardStore {
  private items: string[] = [];

  async getItems(): Promise<string[]> {
    return this.items;
  }

  async setItems(items: string[]): Promise<void> {
    this.items = items;
  }
}
