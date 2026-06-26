import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Share2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    if (ios) {
      if (!localStorage.getItem("install-dismissed-ios")) setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      if (!localStorage.getItem("install-dismissed")) setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(isIos ? "install-dismissed-ios" : "install-dismissed", "true");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9998] md:left-auto md:right-4 md:max-w-sm">
      <div className="relative rounded-2xl border-2 border-primary bg-card p-4 shadow-xl">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex gap-3 items-start pr-6">
          <div className="rounded-xl bg-primary/15 p-3 text-2xl shrink-0">📲</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm uppercase tracking-wide mb-1">Installer Stock BTP</p>
            {isIos ? (
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Share2 className="h-3 w-3 shrink-0" />
                Partager → Sur l&apos;écran d&apos;accueil
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Accès rapide — fonctionne même sans internet
                </p>
                <Button
                  className="w-full uppercase font-bold text-xs h-9"
                  onClick={handleInstall}
                  disabled={!prompt}
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Installer l&apos;application
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
