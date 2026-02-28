"use client";

import { useEffect } from "react";

type AutoFocusTargetProps = {
  targetId?: string;
};

function readHashId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

export default function AutoFocusTarget({ targetId }: AutoFocusTargetProps) {
  useEffect(() => {
    const id = targetId || readHashId();
    if (!id) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 8;

    const focus = () => {
      const element = document.getElementById(id);
      if (!element) {
        if (attempts < maxAttempts) {
          attempts += 1;
          window.setTimeout(focus, 80);
        }
        return;
      }

      element.classList.add("kb-target-entry");
      element.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    focus();
  }, [targetId]);

  return null;
}
