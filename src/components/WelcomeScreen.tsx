"use client";

import { useEffect, useState } from "react";
import BrandMark from "@/components/BrandMark";

export default function WelcomeScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = "campus-life-welcome-shown";

    if (sessionStorage.getItem(key)) return;

    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(key, "true");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B1F3A]">
      <div className="flex animate-pulse flex-col items-center gap-4">
        {/* background={false} drops the navy tile, so the mark sits straight on the splash. */}
        <BrandMark size={88} background={false} />
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Campus Plus
        </h1>
        <p className="text-center text-sm text-gray-300">
          Your campus. Your people. Your life.
        </p>
      </div>
    </div>
  );
}