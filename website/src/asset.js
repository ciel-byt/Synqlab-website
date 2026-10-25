// Public files (logos, photos, structures) live under the Vite base ("/site/" in production).
export const asset = (p) => import.meta.env.BASE_URL + p.replace(/^\//, "");
