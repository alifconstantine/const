import { forwardRef, type AnchorHTMLAttributes } from "react";
import { navigate } from "./fixture-navigation";
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};
export default forwardRef<HTMLAnchorElement, Props>(function FixtureLink(
  { href, prefetch, replace, scroll, onClick, ...props },
  ref,
) {
  const target = typeof href === "string" ? href : href.pathname || "/";
  return (
    <a
      {...props}
      href={target}
      ref={ref}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          props.target === "_blank" ||
          event.metaKey ||
          event.ctrlKey ||
          !target.startsWith("/")
        )
          return;
        event.preventDefault();
        navigate(target, replace);
      }}
    />
  );
});
