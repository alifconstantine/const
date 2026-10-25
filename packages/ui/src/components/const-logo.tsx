"use client";

import React from "react";

export type ConstLogoVariant =
  | "auto"
  | "transparent"
  | "solid"
  | "dark"
  | "light"
  | "dark-transparent"
  | "light-transparent";

export const CONST_BRAND_LOGOS = {
  light: "const-logo-light.png",
  lightTransparent: "const-logo-light-transparent.png",
  dark: "const-logo-dark.png",
  darkTransparent: "const-logo-dark-transparent.png",
} as const;

export interface ConstLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  color?: string;
  variant?: ConstLogoVariant;
}

export function ConstLogoIcon({
  size = "md",
  className = "",
  variant = "transparent",
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  color?: string;
  variant?: ConstLogoVariant;
}) {
  let sizeClass = "w-8 h-8";
  if (size === "xs") sizeClass = "w-5 h-5";
  if (size === "sm") sizeClass = "w-6 h-6";
  if (size === "md") sizeClass = "w-8 h-8";
  if (size === "lg") sizeClass = "w-10 h-10";
  if (size === "xl") sizeClass = "w-12 h-12";
  if (typeof size === "number") sizeClass = "";

  // Packaged Electron pages load assets beside index.html through file://.
  const assetBase = typeof window !== "undefined" && window.location.protocol === "file:"
    ? "./"
    : "/";

  if (variant === "dark") {
    return (
      <span
        aria-hidden="true"
        style={typeof size === "number" ? { width: size, height: size } : undefined}
        className={`${sizeClass} inline-flex shrink-0 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${assetBase}const-logo-dark.png`}
          alt=""
          draggable={false}
          width={48}
          height={48}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  if (variant === "light") {
    return (
      <span
        aria-hidden="true"
        style={typeof size === "number" ? { width: size, height: size } : undefined}
        className={`${sizeClass} inline-flex shrink-0 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${assetBase}const-logo-light.png`}
          alt=""
          draggable={false}
          width={48}
          height={48}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  if (variant === "dark-transparent") {
    return (
      <span
        aria-hidden="true"
        style={typeof size === "number" ? { width: size, height: size } : undefined}
        className={`${sizeClass} inline-flex shrink-0 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${assetBase}const-logo-dark-transparent.png`}
          alt=""
          draggable={false}
          width={48}
          height={48}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  if (variant === "light-transparent") {
    return (
      <span
        aria-hidden="true"
        style={typeof size === "number" ? { width: size, height: size } : undefined}
        className={`${sizeClass} inline-flex shrink-0 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${assetBase}const-logo-light-transparent.png`}
          alt=""
          draggable={false}
          width={48}
          height={48}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  if (variant === "solid") {
    return (
      <span
        aria-hidden="true"
        style={typeof size === "number" ? { width: size, height: size } : undefined}
        className={`${sizeClass} inline-flex shrink-0 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${assetBase}const-logo-light.png`}
          alt=""
          draggable={false}
          width={48}
          height={48}
          className="h-full w-full object-contain dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${assetBase}const-logo-dark.png`}
          alt=""
          draggable={false}
          width={48}
          height={48}
          className="hidden h-full w-full object-contain dark:block"
        />
      </span>
    );
  }

  // Default: variant === "transparent" || variant === "auto"
  return (
    <span
      aria-hidden="true"
      style={typeof size === "number" ? { width: size, height: size } : undefined}
      className={`${sizeClass} inline-flex shrink-0 ${className}`}
    >
      {/* CSS follows the selected theme without waiting for client hydration. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${assetBase}const-logo-light-transparent.png`}
        alt=""
        draggable={false}
        width={48}
        height={48}
        className="h-full w-full object-contain dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${assetBase}const-logo-dark-transparent.png`}
        alt=""
        draggable={false}
        width={48}
        height={48}
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}

export function ConstLogo({
  size = "md",
  showText = true,
  className = "",
  textClassName = "",
  iconClassName = "",
  color = "currentColor",
  variant = "transparent",
}: ConstLogoProps) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <ConstLogoIcon size={size} className={iconClassName} color={color} variant={variant} />
      {showText && (
        <span
          className={`font-serif font-normal tracking-tight text-foreground ${
            size === "xs"
              ? "text-lg"
              : size === "sm"
              ? "text-xl"
              : size === "lg"
              ? "text-3xl"
              : size === "xl"
              ? "text-4xl"
              : "text-2xl"
          } ${textClassName}`}
        >
          Const
        </span>
      )}
    </div>
  );
}
