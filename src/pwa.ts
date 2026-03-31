const SW_PATH = "/sw.js";

export function registerPWA() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_PATH).catch((error) => {
      console.error("Falha ao registrar o service worker do PWA.", error);
    });
  });
}
