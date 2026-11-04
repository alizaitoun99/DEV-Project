export interface SearchItem {
  id: string;
  title: string;
  type: { slug: string; name: string };
  preview: string;
}

export interface SearchCollection {
  id: string;
  name: string;
  itemCount: number;
}

export interface SearchData {
  items: SearchItem[];
  collections: SearchCollection[];
}
