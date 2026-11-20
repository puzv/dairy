export type FontOption = { id: string; label: string };

export type BundledLibrary = {
  fonts: readonly FontOption[];
  load: (id: string) => Promise<string>;
};

export type FontRecord = FontOption & { persistent: boolean };

export type PersonalLibrary = {
  list: () => Promise<FontRecord[]>;
  importFile: (file: File) => Promise<FontRecord>;
  load: (id: string) => Promise<string>;
  remove: (id: string) => Promise<void>;
  subscribe: (notify: () => void) => () => void;
};
