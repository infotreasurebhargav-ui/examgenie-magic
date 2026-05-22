const KEY = "pf_session";

export function login(username: string, password: string): boolean {
  if (username.trim() === "admin" && password === "123") {
    localStorage.setItem(KEY, "1");
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem(KEY);
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}
