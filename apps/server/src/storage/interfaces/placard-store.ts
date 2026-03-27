export interface PlacardStore {
  getText(): Promise<string | null>;
  setText(text: string | null): Promise<void>;
}
