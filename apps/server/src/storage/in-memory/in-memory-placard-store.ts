import type { PlacardStore } from "../interfaces/placard-store.js";

export class InMemoryPlacardStore implements PlacardStore {
  private text: string | null = null;

  async getText(): Promise<string | null> {
    return this.text;
  }

  async setText(text: string | null): Promise<void> {
    this.text = text;
  }
}
