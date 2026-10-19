import { useEffect, useState } from "react";
import { flushQueue, queueSize } from "@/lib/offline-queue";

export function useSyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(queueSize());

  useEffect(() => {
    async function trySync() {
      const left = await flushQueue();
      setPending(left);
    }

    function onOnline() {
      setOnline(true);
      trySync();
    }
    function onOffline() {
      setOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(trySync, 15000);
    trySync();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  return { online, pending, refresh: () => setPending(queueSize()) };
}
