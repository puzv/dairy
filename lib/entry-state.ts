export type EntryField = "date" | "title" | "body" | "mood";

export type EntryState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<EntryField, string>>;
};

export type EntryAction = (
  state: EntryState,
  formData: FormData,
) => Promise<EntryState>;

export const initialEntryState: EntryState = { status: "idle" };
