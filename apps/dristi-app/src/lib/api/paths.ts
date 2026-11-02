/**
 * Where the API proxy is mounted on this app's origin. The browser client calls paths
 * under it and the proxy serves them, so both import it from here: if they drifted apart,
 * every API call would fail. The route folder `app/api/v1/` must match it too — a folder
 * name cannot import, so change that by hand with this.
 */
export const API_BASE_PATH = "/api/v1";
