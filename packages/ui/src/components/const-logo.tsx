"use client";

import React from "react";

interface ConstLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  color?: string;
}

export function ConstLogoIcon({
  size = "md",
  className = "",
  color = "currentColor",
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  color?: string;
}) {
  let sizeClass = "w-8 h-8";
  if (size === "xs") sizeClass = "w-5 h-5";
  if (size === "sm") sizeClass = "w-6 h-6";
  if (size === "md") sizeClass = "w-8 h-8";
  if (size === "lg") sizeClass = "w-10 h-10";
  if (size === "xl") sizeClass = "w-12 h-12";
  if (typeof size === "number") sizeClass = `w-[${size}px] h-[${size}px]`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={`${sizeClass} shrink-0 ${className}`}
      fill="none"
    >
      <defs>
        <clipPath id="const-logo-clip-clean">
          <path
            fillRule="evenodd"
            d="M432 72C250 36 40 136 40 256C40 376 250 476 432 440C320 384 180 320 180 256C180 192 320 128 432 72Z"
          />
        </clipPath>
      </defs>
      <g transform="translate(23 -35.5)">
        <g
          transform="translate(512 0) scale(-1 1) rotate(32 256 256)"
          clipPath="url(#const-logo-clip-clean)"
          fill={color === "currentColor" ? "currentColor" : color}
        >
          <rect x="-60" y="38" width="632" height="60" />
          <rect x="-60" y="113" width="632" height="60" />
          <rect x="-60" y="188" width="632" height="60" />
          <rect x="-60" y="264" width="632" height="60" />
          <rect x="-60" y="339" width="632" height="60" />
          <rect x="-60" y="414" width="632" height="60" />
        </g>
      </g>
    </svg>
  );
}

export function ConstLogo({
  size = "md",
  showText = true,
  className = "",
  textClassName = "",
  iconClassName = "",
  color = "currentColor",
}: ConstLogoProps) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <ConstLogoIcon size={size} className={iconClassName} color={color} />
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
