export const editionNames = { shanjian: "山笺", minimal: "简约", tech: "科技" } as const;
export type Edition = keyof typeof editionNames;
export const editionCookie = "shanjian_edition";

export function readEdition(value?: string): Edition {
  return value === "minimal" || value === "tech" ? value : "shanjian";
}
