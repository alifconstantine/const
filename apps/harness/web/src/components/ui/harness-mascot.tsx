"use client";
import React from "react";
import { motion } from "framer-motion";

export function HarnessMascot({
  size = 52,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      animate={{
        y: [0, -3, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_6px_16px_rgba(14,165,233,0.32)]"
      >
        <defs>
          {/* Vibrant cyan to sky blue 3D body gradient */}
          <linearGradient id="bodyGrad" x1="16" y1="12" x2="48" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="42%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Top bright specular glow */}
          <radialGradient id="topHighlight" cx="26" cy="18" r="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#bae6fd" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>

          {/* Bottom shadow */}
          <radialGradient id="dropGlow" cx="32" cy="54" r="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient bottom shadow */}
        <ellipse cx="32" cy="54" rx="14" ry="2.5" fill="url(#dropGlow)" />

        {/* Smooth 3D Droplet Creature Body with 4 wavy feet */}
        <path
          d="M 18 32
             C 18 20, 24 13, 32 13
             C 40 13, 46 20, 46 32
             C 46 41, 45 46, 42 48
             C 40 49.5, 38 48.5, 37 45.5
             C 36 43, 34 43.5, 33 47
             C 32 49, 31 49, 30 47
             C 29 43.5, 27 43, 26 45.5
             C 25 48.5, 23 49.5, 21 48
             C 18 46, 18 41, 18 32 Z"
          fill="url(#bodyGrad)"
        />

        {/* Gloss Specular Layer */}
        <path
          d="M 18 32
             C 18 20, 24 13, 32 13
             C 40 13, 46 20, 46 32
             C 46 41, 45 46, 42 48
             C 40 49.5, 38 48.5, 37 45.5
             C 36 43, 34 43.5, 33 47
             C 32 49, 31 49, 30 47
             C 29 43.5, 27 43, 26 45.5
             C 25 48.5, 23 49.5, 21 48
             C 18 46, 18 41, 18 32 Z"
          fill="url(#topHighlight)"
        />

        {/* Glass Crescent Highlight on top-left dome */}
        <path
          d="M 23 17.5 C 26 15, 34 15, 38 17.5 C 35 16.5, 27 16.5, 23 17.5 Z"
          fill="#ffffff"
          fillOpacity="0.85"
        />

        {/* Friendly Left Eye */}
        <ellipse cx="26.5" cy="29" rx="2.4" ry="3.1" fill="#0f172a" />
        <circle cx="25.5" cy="27.8" r="1" fill="#ffffff" />
        <circle cx="27.3" cy="30" r="0.45" fill="#ffffff" />

        {/* Friendly Right Eye */}
        <ellipse cx="37.5" cy="29" rx="2.4" ry="3.1" fill="#0f172a" />
        <circle cx="36.5" cy="27.8" r="1" fill="#ffffff" />
        <circle cx="38.3" cy="30" r="0.45" fill="#ffffff" />

        {/* Soft Smile */}
        <path
          d="M 30.5 32.8 C 31.5 34.2, 32.5 34.2, 33.5 32.8"
          stroke="#0f172a"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}
