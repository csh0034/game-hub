export interface PlacardStore {
  getItems(): Promise<string[]>;
  setItems(items: string[]): Promise<void>;
}
