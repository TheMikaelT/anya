import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as NavigatorWithStandalone).standalone === true;
}

export default function PwaReloadButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const updateVisible = () => setVisible(isStandaloneDisplay());

    updateVisible();
    mediaQuery.addEventListener("change", updateVisible);

    return () => mediaQuery.removeEventListener("change", updateVisible);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="pwa-reload-button fixed right-4 z-[85] flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-[#172129]/85 text-slate-100 shadow-glow backdrop-blur-xl transition hover:border-cyan-200/40 hover:text-cyan-100 sm:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8.5rem)" }}
      aria-label="Reload Anya"
      title="Reload Anya"
    >
      <RefreshCw className="h-5 w-5" />
    </button>
  );
}
