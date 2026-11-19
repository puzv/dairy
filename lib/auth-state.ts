export type AuthFieldErrors = {
  username?: string;
  password?: string;
  confirmPassword?: string;
};

export type AuthState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: AuthFieldErrors;
};

export type AuthAction = (
  state: AuthState,
  formData: FormData,
) => Promise<AuthState>;

export const initialAuthState: AuthState = { status: "idle" };
