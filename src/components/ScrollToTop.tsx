import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType !== "POP") {
      // Immediate scroll
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.querySelectorAll("main").forEach((el) =>
        el.scrollTo({ top: 0, left: 0, behavior: "instant" })
      );

      // Also after next paint (for content that renders async)
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        document.querySelectorAll("main").forEach((el) =>
          el.scrollTo({ top: 0, left: 0, behavior: "instant" })
        );
      });
    }
  }, [pathname, navType]);

  return null;
};
